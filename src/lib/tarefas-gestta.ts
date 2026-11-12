/**
 * Tarefas do Gestta: leitura da planilha, gravação sem duplicidade e métricas
 * de Indicadores (Por Setor / Por Colaborador / Por Célula).
 *
 * Regras (mês escolhido = mês do Vencimento da tarefa):
 *  - Mês de cada tarefa do Gestta: o mês do Vencimento (sem Vencimento, a Competência).
 *  - Total de tarefas: tarefas do Gestta da competência do mês.
 *  - % concluídas: status CONCLUIDO ÷ total.
 *  - No prazo / fora do prazo (excludentes, somam % concluídas):
 *    conclusão <= vencimento (inclui as antecipadas) / conclusão > vencimento.
 *  - % em impedimento: status IMPEDIMENTO ÷ total.
 *  - % abertas em atraso: ABERTO com vencimento anterior a hoje ÷ total.
 *  - Concluídas no mês: linhas da planilha complementar com data de conclusão no mês
 *    (qualquer vencimento; todas as linhas contam, inclusive Ids repetidos).
 *  - Acumuladas: linhas do relatório de atrasadas (origem "acumulada") cuja Competência
 *    é o mês escolhido, sem filtrar por status. Cada importação substitui só as acumuladas
 *    da(s) competência(s) do arquivo; os demais meses são preservados.
 */
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";

export interface TarefaGestta {
  id: string;
  nome: string;
  tipo: string;
  status: string; // CONCLUIDO | ABERTO | IMPEDIMENTO
  cliente: string;
  departamento: string;
  responsavel: string;
  vencimento: string | null; // YYYY-MM-DD
  dataConclusao: string | null; // YYYY-MM-DD
  competencia: string;
  cnpjCpf: string;
  dataLegal: string | null;
  feitoAtrasado: string;
  feitoComMulta: string;
  baixado: string;
  origem: string; // gestta | complementar | acumulada
}

export interface ResultadoImportacao {
  lidas: number;
  novas: number;
  atualizadas: number;
  ignoradas: number; // já existiam, sem nenhuma mudança
  duplicadasNoArquivo: number;
  mesPredominante: string; // YYYY-MM do vencimento
  mesCompetencia: string; // YYYY-MM da coluna Competência (relatório de acumuladas)
}

const TABELA = "tarefas_gestta";

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function textoCelula(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Serial do Excel (ou texto dd/mm/aaaa, aaaa-mm-dd) → YYYY-MM-DD. */
function paraData(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = new Date((Math.floor(v) - 25569) * 86400000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const t = String(v).trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

const COLUNAS: Record<string, keyof TarefaGestta> = {
  id: "id",
  nome: "nome",
  tipo: "tipo",
  status: "status",
  cliente: "cliente",
  departamento: "departamento",
  responsavel: "responsavel",
  vencimento: "vencimento",
  "data de conclusao": "dataConclusao",
  competencia: "competencia",
  "cnpj/cpf": "cnpjCpf",
  "data legal": "dataLegal",
  "feito atrasado": "feitoAtrasado",
  "feito com multa": "feitoComMulta",
  baixado: "baixado",
};

/** Lê a 1ª aba da planilha e devolve as tarefas (sem repetir Id dentro do arquivo). */
export async function lerPlanilhaTarefas(
  arquivo: File,
): Promise<{ tarefas: TarefaGestta[]; duplicadasNoArquivo: number }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const nomeAba = wb.SheetNames[0];
  const aba = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null });
  const cabecalho = (linhas[0] ?? []).map((c) => semAcento(textoCelula(c)));
  const indice = new Map<keyof TarefaGestta, number>();
  cabecalho.forEach((nome, i) => {
    const campo = COLUNAS[nome];
    if (campo && !indice.has(campo)) indice.set(campo, i);
  });
  const faltando = (["id", "status", "departamento", "responsavel", "vencimento"] as const).filter(
    (c) => !indice.has(c),
  );
  if (faltando.length > 0) {
    throw new Error(
      `Planilha fora do formato do Gestta. Colunas não encontradas: ${faltando.join(", ")}.`,
    );
  }
  const pega = (linha: unknown[], campo: keyof TarefaGestta) => {
    const i = indice.get(campo);
    return i === undefined ? null : linha[i];
  };

  const porId = new Map<string, TarefaGestta>();
  let duplicadasNoArquivo = 0;
  for (const linha of linhas.slice(1)) {
    const id = textoCelula(pega(linha, "id")).replace(/^"+|"+$/g, "");
    if (!id) continue;
    if (porId.has(id)) duplicadasNoArquivo += 1;
    porId.set(id, {
      id,
      nome: textoCelula(pega(linha, "nome")),
      tipo: textoCelula(pega(linha, "tipo")),
      status: semAcento(textoCelula(pega(linha, "status"))).toUpperCase(),
      cliente: textoCelula(pega(linha, "cliente")),
      departamento: unificarSetor(textoCelula(pega(linha, "departamento"))),
      responsavel: textoCelula(pega(linha, "responsavel")),
      vencimento: paraData(pega(linha, "vencimento")),
      dataConclusao: paraData(pega(linha, "dataConclusao")),
      // Competência pode vir como data do Excel (serial numérico): converte como no relatório de atrasadas.
      competencia: competenciaDoRelatorio(pega(linha, "competencia")),
      cnpjCpf: textoCelula(pega(linha, "cnpjCpf")),
      dataLegal: paraData(pega(linha, "dataLegal")),
      feitoAtrasado: textoCelula(pega(linha, "feitoAtrasado")),
      feitoComMulta: textoCelula(pega(linha, "feitoComMulta")),
      baixado: textoCelula(pega(linha, "baixado")),
      origem: "gestta",
    });
  }
  return { tarefas: [...porId.values()], duplicadasNoArquivo };
}

/** Colunas do "Relatório de tarefas atrasadas" (abertas / impedimentos). */
const COLUNAS_ATRASADAS: Record<string, keyof TarefaGestta> = {
  "tarefa - id": "id",
  "tarefa - nome": "nome",
  "cliente - nome": "cliente",
  "empresa - departamento": "departamento",
  "tarefa - data de vencimento (completa)": "vencimento",
  "tarefa - responsavel": "responsavel",
  "tarefa - status": "status",
  "tarefa - gera multa?": "feitoComMulta",
  competencia: "competencia",
  // Relatório de tarefas concluídas (mesmo leitor)
  "tarefa - concluido por": "responsavel",
  "tarefa - data de conclusao (completa)": "dataConclusao",
};

function statusAtrasada(v: string): string {
  const s = semAcento(v);
  if (s.startsWith("impediment")) return "IMPEDIMENTO";
  if (s.startsWith("abert")) return "ABERTO";
  if (s.startsWith("conclu")) return "CONCLUIDO";
  return s.toUpperCase();
}

/** Competência do relatório: no Excel costuma ser uma data (01/09/2026, mostrada como "set/26"). */
function competenciaDoRelatorio(v: unknown): string {
  if (typeof v === "number") return paraData(v)?.slice(0, 7) ?? "";
  return textoCelula(v);
}

/** Lê os relatórios "Tarefa - ..." (atrasadas: abertas/impedimentos; concluídas de outros meses). */
export async function lerPlanilhaAtrasadas(
  arquivo: File,
  origem: "complementar" | "acumulada" = "acumulada",
): Promise<{ tarefas: TarefaGestta[]; duplicadasNoArquivo: number }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const nomeAba = wb.SheetNames[0];
  const aba = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null });
  const indice = new Map<keyof TarefaGestta, number>();
  (linhas[0] ?? []).forEach((c, i) => {
    const campo = COLUNAS_ATRASADAS[semAcento(textoCelula(c))];
    if (campo && !indice.has(campo)) indice.set(campo, i);
  });
  const faltando = (["id", "status", "departamento", "responsavel", "vencimento"] as const).filter(
    (c) => !indice.has(c),
  );
  if (faltando.length > 0) {
    throw new Error(
      `Planilha fora do formato do relatório de tarefas atrasadas. Colunas não encontradas: ${faltando.join(", ")}.`,
    );
  }
  const pega = (linha: unknown[], campo: keyof TarefaGestta) => {
    const i = indice.get(campo);
    return i === undefined ? null : linha[i];
  };
  const porId = new Map<string, TarefaGestta>();
  const contagem = new Map<string, number>();
  let duplicadasNoArquivo = 0;
  for (const linha of linhas.slice(1)) {
    const id = textoCelula(pega(linha, "id")).replace(/^"+|"+$/g, "");
    if (!id) continue;
    const n = (contagem.get(id) ?? 0) + 1;
    contagem.set(id, n);
    if (n > 1) duplicadasNoArquivo += 1;
    // Repetições entram como linhas próprias (chave Id + "#n"). Concluídas complementares usam
    // o prefixo "c:" para não colidir com a mesma tarefa já gravada pela planilha do Gestta.
    // Acumuladas usam "a:" pelo mesmo motivo: a leitura é independente das demais planilhas.
    // A competência entra na chave: a mesma tarefa aberta em janeiro e em fevereiro é duas linhas,
    // e não pode sobrescrever a de janeiro ao importar fevereiro.
    const competencia = competenciaDoRelatorio(pega(linha, "competencia"));
    const base =
      origem === "complementar" ? `c:${id}` : `a:${mesDaCompetencia(competencia) || "sem-competencia"}:${id}`;
    const chave = n > 1 ? `${base}#${n}` : base;
    porId.set(chave, {
      id: chave,
      nome: textoCelula(pega(linha, "nome")),
      tipo: "",
      status: statusAtrasada(textoCelula(pega(linha, "status"))),
      cliente: textoCelula(pega(linha, "cliente")),
      departamento: unificarSetor(textoCelula(pega(linha, "departamento"))),
      responsavel: textoCelula(pega(linha, "responsavel")),
      vencimento: paraData(pega(linha, "vencimento")),
      dataConclusao: paraData(pega(linha, "dataConclusao")),
      competencia,
      cnpjCpf: "",
      dataLegal: null,
      feitoAtrasado: "",
      feitoComMulta: textoCelula(pega(linha, "feitoComMulta")),
      baixado: "",
      origem,
    });
  }
  return { tarefas: [...porId.values()], duplicadasNoArquivo };
}

const TAMANHO_PAGINA = 1000;

/* ---------------- Cache local (IndexedDB) + sincronização incremental ---------------- */
// A tela abre com o que já está salvo no navegador e só busca no banco o que mudou
// desde a última vez (coluna importado_em). Carga completa só na 1ª vez ou se algo foi apagado.

type LinhaBanco = Record<string, string | null>;
interface CacheLocal { tarefas: TarefaGestta[]; ultima: string | null }

const IDB_NOME = "gq-indicadores";
const IDB_LOJA = "tarefas";
const IDB_CHAVE = "v1";

function abrirIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function lerCacheLocal(): Promise<CacheLocal | null> {
  const db = await abrirIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = db.transaction(IDB_LOJA).objectStore(IDB_LOJA).get(IDB_CHAVE);
    req.onsuccess = () => resolve((req.result as CacheLocal) ?? null);
    req.onerror = () => resolve(null);
  });
}
async function gravarCacheLocal(valor: CacheLocal | null): Promise<void> {
  const db = await abrirIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_LOJA, "readwrite");
    const loja = tx.objectStore(IDB_LOJA);
    if (valor) loja.put(valor, IDB_CHAVE);
    else loja.delete(IDB_CHAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

let ultimaSync: string | null = null;

/** Abre a tela na hora com o cache salvo no navegador (se houver). */
export async function tarefasDoCacheLocal(): Promise<TarefaGestta[] | null> {
  if (cacheTarefas) return cacheTarefas;
  const local = await lerCacheLocal();
  if (!local) return null;
  cacheTarefas = local.tarefas;
  ultimaSync = local.ultima;
  return cacheTarefas;
}

function linhaParaTarefa(r: LinhaBanco): TarefaGestta {
  return {
    id: r.id ?? "",
    nome: r.nome ?? "",
    tipo: r.tipo ?? "",
    status: r.status ?? "",
    cliente: r.cliente ?? "",
    departamento: unificarSetor(r.departamento ?? ""),
    responsavel: r.responsavel ?? "",
    vencimento: r.vencimento ?? null,
    dataConclusao: r.data_conclusao ?? null,
    competencia: r.competencia ?? "",
    cnpjCpf: r.cnpj_cpf ?? "",
    dataLegal: r.data_legal ?? null,
    feitoAtrasado: r.feito_atrasado ?? "",
    feitoComMulta: r.feito_com_multa ?? "",
    baixado: r.baixado ?? "",
    origem: r.origem ?? "gestta",
  };
}

async function comRetentativa<T extends { error: unknown }>(fazer: () => PromiseLike<T>): Promise<T> {
  let resposta = await fazer();
  for (let tentativa = 1; resposta.error && tentativa < 3; tentativa++) {
    await new Promise((r) => setTimeout(r, 700 * tentativa));
    resposta = await fazer();
  }
  return resposta;
}

/** Busca páginas por "id maior que o último" (rápido em qualquer profundidade, ao contrário de OFFSET). */
async function buscarFaixa(
  inicio: string | null,
  fim: string | null,
  desde: string | null,
  aoPagina: (n: number) => void,
): Promise<LinhaBanco[]> {
  const cliente = clienteLivre();
  const linhas: LinhaBanco[] = [];
  let ultimo: string | null = null;
  for (;;) {
    const resposta = await comRetentativa(() => {
      let q = cliente.from(TABELA).select(COLUNAS_SELECT).order("id").limit(TAMANHO_PAGINA);
      if (ultimo !== null) q = q.gt("id", ultimo);
      else if (inicio !== null) q = q.gte("id", inicio);
      if (fim !== null) q = q.lt("id", fim);
      if (desde) q = q.gt("importado_em", desde);
      return q;
    });
    if (resposta.error) {
      if (tabelaAusente(resposta.error as never)) return linhas;
      throw traduzErro(resposta.error as never);
    }
    const pagina = (resposta.data ?? []) as unknown as LinhaBanco[];
    linhas.push(...pagina);
    aoPagina(pagina.length);
    if (pagina.length < TAMANHO_PAGINA) return linhas;
    ultimo = pagina[pagina.length - 1]!.id ?? "";
  }
}

async function resumoBanco(): Promise<{ total: number; ultima: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (clienteLivre() as any).rpc("tarefas_gestta_resumo");
  if (error) throw traduzErro(error);
  const linha = (Array.isArray(data) ? data[0] : data) ?? {};
  return { total: Number(linha.total ?? 0), ultima: linha.ultima ?? null };
}

/** Todas as tarefas: usa o cache local e só baixa o que mudou; carga completa quando necessário. */
export async function carregarTarefas(
  aoProgredir?: (carregadas: number, total: number) => void,
  opcoes: { completo?: boolean } = {},
): Promise<TarefaGestta[]> {
  const resumo = await resumoBanco();
  if (!opcoes.completo) await tarefasDoCacheLocal();

  // Incremental: só o que foi importado depois da última sincronização.
  if (!opcoes.completo && cacheTarefas && ultimaSync) {
    if (resumo.ultima === ultimaSync && resumo.total === cacheTarefas.length) return cacheTarefas;
    const novas = await buscarFaixa(null, null, ultimaSync, () => {});
    const mapa = new Map(cacheTarefas.map((t) => [t.id, t] as const));
    for (const r of novas) mapa.set(r.id ?? "", linhaParaTarefa(r));
    if (mapa.size === resumo.total) {
      cacheTarefas = [...mapa.values()];
      ultimaSync = resumo.ultima;
      void gravarCacheLocal({ tarefas: cacheTarefas, ultima: ultimaSync });
      return cacheTarefas;
    }
    // Alguma tarefa foi apagada por outra pessoa: recarrega tudo.
  }

  // Carga completa: 4 faixas de Id em paralelo (carga moderada no banco).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: faixas } = await (clienteLivre() as any).rpc("tarefas_gestta_faixas", { partes: 4 });
  const inicios: (string | null)[] = ((faixas ?? []) as { id_inicio: string }[]).map((f) => f.id_inicio);
  if (!inicios.length) inicios.push(null);
  inicios[0] = null;
  let carregadas = 0;
  aoProgredir?.(0, resumo.total);
  const partes = await Promise.all(
    inicios.map((ini, i) =>
      buscarFaixa(ini, inicios[i + 1] ?? null, null, (n) => {
        carregadas += n;
        aoProgredir?.(carregadas, resumo.total);
      }),
    ),
  );
  cacheTarefas = partes.flat().map(linhaParaTarefa);
  ultimaSync = resumo.ultima;
  void gravarCacheLocal({ tarefas: cacheTarefas, ultima: ultimaSync });
  return cacheTarefas;
}

/** Tira do cache local as tarefas apagadas. */
function esquecerTarefas(ids: string[] | null) {
  if (ids === null) {
    cacheTarefas = null;
    ultimaSync = null;
    void gravarCacheLocal(null);
    return;
  }
  if (!cacheTarefas) return;
  const fora = new Set(ids);
  cacheTarefas = cacheTarefas.filter((t) => !fora.has(t.id));
  void gravarCacheLocal({ tarefas: cacheTarefas, ultima: ultimaSync });
}

const LOTE_EXCLUSAO = 200;

/** Apaga tarefas pelo Id, em lotes (evita URL longa). */
async function apagarTarefasPorId(ids: string[]): Promise<void> {
  const cliente = clienteLivre();
  for (let i = 0; i < ids.length; i += LOTE_EXCLUSAO) {
    const { error } = await cliente.from(TABELA).delete().in("id", ids.slice(i, i + LOTE_EXCLUSAO));
    if (error) throw traduzErro(error);
  }
}

const LOTE_IDS = 200;

/** Ids do arquivo que já existem no banco, com a origem de cada um (consulta só esses Ids). */
async function origensExistentes(ids: string[]): Promise<Map<string, string>> {
  const cliente = clienteLivre();
  const mapa = new Map<string, string>();
  for (let i = 0; i < ids.length; i += LOTE_IDS) {
    const lote = ids.slice(i, i + LOTE_IDS);
    let { data, error } = await cliente.from(TABELA).select("id,origem").in("id", lote);
    if (error && /origem/i.test(error.message ?? "")) {
      // Migration da coluna "origem" ainda não aplicada.
      ({ data, error } = await cliente.from(TABELA).select("id").in("id", lote));
    }
    if (error) {
      if (tabelaAusente(error)) return mapa;
      throw traduzErro(error);
    }
    for (const r of (data ?? []) as Record<string, string | null>[]) {
      mapa.set(r.id ?? "", r.origem ?? "gestta");
    }
  }
  return mapa;
}

/**
 * Quais nomes de responsável já existem na tabela. Uma consulta por vez (consultas em paralelo sem
 * índice em `responsavel` estouravam o tempo do servidor). Erro numa consulta = nome não confirmado.
 */
async function responsaveisExistem(nomes: string[]): Promise<Set<string>> {
  const cliente = clienteLivre();
  const achados = new Set<string>();
  for (const n of nomes) {
    const { data, error } = await cliente.from(TABELA).select("responsavel").eq("responsavel", n).limit(1);
    if (!error && (data ?? []).length > 0) achados.add(n);
  }
  return achados;
}

/**
 * Grava as tarefas sem duplicar: o Id é a chave. Tarefas novas são inseridas;
 * as que já existem são sempre regravadas (status, conclusão etc.).
 */
export async function importarTarefas(
  tarefas: TarefaGestta[],
  duplicadasNoArquivo: number,
  aoProgredir?: (feito: number, total: number) => void,
  apenasNovas = false,
): Promise<ResultadoImportacao> {
  // Só consulta os Ids do arquivo (antes baixava a tabela inteira a cada importação).
  const existentes = await origensExistentes(tarefas.map((t) => t.id));
  if (apenasNovas) {
    // Relatórios com nome abreviado ("Ramon S"): usa o nome completo já cadastrado, sem criar colaborador novo.
    const distintos = [...new Set(tarefas.map((t) => t.responsavel).filter(Boolean))];
    const existem = await responsaveisExistem(distintos);
    const nomes =
      existem.size === distintos.length
        ? distintos
        : [...new Set((tarefasEmCache() ?? (await carregarTarefas())).map((t) => t.responsavel).filter(Boolean))];
    for (const t of tarefas) {
      if (!t.responsavel || nomes.includes(t.responsavel)) continue;
      const prefixo = semAcento(t.responsavel);
      const candidatos = nomes.filter((n) => semAcento(n).startsWith(prefixo));
      if (candidatos.length === 1) t.responsavel = candidatos[0]!;
      else if (candidatos.length > 1) t.responsavel = "";
    }
  }
  // Relatório de acumuladas é uma foto do momento: substitui as acumuladas anteriores.
  const substituirAcumuladas = tarefas.length > 0 && tarefas.every((t) => t.origem === "acumulada");
  // Complementares são uma foto do período: cada importação substitui o que já havia nas datas
  // de conclusão cobertas pelo arquivo e grava todas as linhas (repetidas ou não).
  const substituirComplementares = tarefas.length > 0 && tarefas.every((t) => t.origem === "complementar");
  const gravar: TarefaGestta[] = [];
  let novas = 0;
  let atualizadas = 0;
  let ignoradas = 0;
  for (const t of tarefas) {
    const atual = existentes.get(t.id);
    // A planilha principal não mexe em tarefas acumuladas: elas só mudam pelo relatório de acumuladas.
    if (atual === "acumulada" && t.origem === "gestta") {
      ignoradas += 1;
      continue;
    }
    if (substituirComplementares || substituirAcumuladas) {
      // Relatórios substitutivos: o que havia é apagado antes, então toda linha é nova.
      novas += 1;
      gravar.push(t);
    } else if (atual === undefined) {
      novas += 1;
      gravar.push(t);
    } else if (!apenasNovas) {
      // Planilha do Gestta: regrava as tarefas que já existiam, mesmo sem mudança.
      atualizadas += 1;
      gravar.push(t);
    } else {
      ignoradas += 1;
    }
  }

  const cliente = clienteLivre();
  if (substituirAcumuladas) {
    // Só substitui as acumuladas das competências presentes no arquivo: os outros meses ficam intactos.
    const mesesDoArquivo = new Set(tarefas.map((t) => mesDaCompetencia(t.competencia)));
    const jaGravadas = await carregarTarefas();
    const idsDosMeses = jaGravadas
      .filter((t) => t.origem === "acumulada" && mesesDoArquivo.has(mesDaCompetencia(t.competencia)))
      .map((t) => t.id);
    await apagarTarefasPorId(idsDosMeses);
  }
  if (substituirComplementares) {
    const datas = tarefas.map((t) => t.dataConclusao).filter((d): d is string => !!d).sort();
    if (datas.length > 0) {
      const { error: erroPeriodo } = await cliente
        .from(TABELA)
        .delete()
        .eq("origem", "complementar")
        .gte("data_conclusao", datas[0]!)
        .lte("data_conclusao", datas[datas.length - 1]!);
      if (erroPeriodo) throw traduzErro(erroPeriodo);
    }
  }
  aoProgredir?.(0, gravar.length);
  const agora = new Date().toISOString();
  for (let i = 0; i < gravar.length; i += TAMANHO_PAGINA) {
    const lote = gravar.slice(i, i + TAMANHO_PAGINA).map((t) => ({
      id: t.id,
      nome: t.nome,
      tipo: t.tipo,
      status: t.status,
      cliente: t.cliente,
      departamento: t.departamento,
      responsavel: t.responsavel,
      vencimento: t.vencimento,
      data_conclusao: t.dataConclusao,
      competencia: t.competencia,
      cnpj_cpf: t.cnpjCpf,
      data_legal: t.dataLegal,
      feito_atrasado: t.feitoAtrasado,
      feito_com_multa: t.feitoComMulta,
      baixado: t.baixado,
      origem: t.origem,
      importado_em: agora,
    }));
    const { error } = await cliente.from(TABELA).upsert(lote, { onConflict: "id" });
    if (error) {
      if (/origem/i.test(error.message ?? "")) {
        throw new Error(
          "Aplique a migration 20261016040000_tarefas_gestta_origem.sql (coluna origem) antes de importar.",
        );
      }
      if (tabelaAusente(error)) {
        throw new Error(
          "A tabela tarefas_gestta ainda não existe no banco. Aplique a migration 20261015010000_tarefas_gestta.sql.",
        );
      }
      throw traduzErro(error);
    }
    aoProgredir?.(Math.min(i + TAMANHO_PAGINA, gravar.length), gravar.length);
  }

  // Relatório de acumuladas: a coluna Competência define o mês da tela.
  const mesCompetencia = substituirAcumuladas
    ? mesDaCompetencia(tarefas.find((t) => t.competencia)?.competencia ?? "")
    : "";
  const contagemMes = new Map<string, number>();
  for (const t of tarefas) {
    const m = mesDoGestta(t);
    if (m) contagemMes.set(m, (contagemMes.get(m) ?? 0) + 1);
  }
  const mesPredominante = [...contagemMes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { lidas: tarefas.length, novas, atualizadas, ignoradas, duplicadasNoArquivo, mesPredominante, mesCompetencia };
}

/**
 * Apaga tarefas importadas. Com `mes` (AAAA-MM), apaga só as desse mês (Competência; acumuladas e complementares pelo critério do card);
 * sem `mes`, apaga todas. Não mexe em indicadores nem em apurações.
 */
export async function zerarTarefas(mes?: string): Promise<void> {
  const cliente = clienteLivre();
  if (!mes) {
    const { error } = await cliente.from(TABELA).delete().not("id", "is", null);
    if (error) throw traduzErro(error);
    esquecerTarefas(null);
    return;
  }
  // Mesmas regras de mês dos cards: cada origem tem o seu critério.
  const idsDoMes = (await carregarTarefas())
    .filter((t) => {
      if (t.origem === "acumulada") return mesDaCompetencia(t.competencia) === mes;
      if (t.origem === "complementar") return !!t.dataConclusao && t.dataConclusao.slice(0, 7) === mes;
      return mesDoGestta(t) === mes;
    })
    .map((t) => t.id);
  await apagarTarefasPorId(idsDoMes);
  esquecerTarefas(idsDoMes);
}

/* -------------------------------------------------------------------------- */
/* Métricas                                                                    */
/* -------------------------------------------------------------------------- */

export interface MetricasTarefas {
  total: number;
  concluidas: number;
  noPrazo: number;
  foraDoPrazo: number;
  impedimento: number;
  abertasEmAtraso: number;
  concluidasNoMes: number;
  acumuladasAnteriores: number;
}

export type AgruparPor = "departamento" | "responsavel";

function hojeIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Concluída (até o mês) cujo vencimento é de um mês anterior ao escolhido. */
function ehAcumuladaConcluida(t: TarefaGestta, mes: string): boolean {
  if (t.status !== "CONCLUIDO" || !t.dataConclusao || !t.vencimento) return false;
  return t.vencimento.slice(0, 7) < mes && t.dataConclusao.slice(0, 7) <= mes;
}

/** Acumulada (relatório de atrasadas): de qualquer status e vencimento, da competência do relatório. */
function ehAcumulada(t: TarefaGestta, mes: string): boolean {
  return t.origem === "acumulada" && mesDaCompetencia(t.competencia) === mes;
}

/** Complementar: concluída no mês escolhido, com vencimento em mês anterior. */
function ehComplementarDoMes(t: TarefaGestta, mes: string): boolean {
  if (t.origem !== "complementar" || t.status !== "CONCLUIDO" || !t.dataConclusao) return false;
  return t.dataConclusao.slice(0, 7) === mes;
}

const MESES_COMPETENCIA = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Competência escrita no relatório → YYYY-MM. Aceita "Setembro", "set/26", "set/2026".
 * Sem ano na planilha: usa o ano atual, ou o anterior se o mês ainda não chegou.
 */
export function mesDaCompetencia(texto: string, hoje: string = hojeIso()): string {
  const iso = /^(\d{4})-(\d{2})/.exec(texto.trim());
  if (iso) return `${iso[1]}-${iso[2]}`;
  const numerico = /^(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (numerico) return `${numerico[2]}-${numerico[1]!.padStart(2, "0")}`;
  const [mes = "", ano = ""] = semAcento(texto).split(/[\s/-]+/).filter(Boolean);
  // Pelas três primeiras letras: "set" e "setembro" são o mesmo mês.
  const numero = MESES_COMPETENCIA.findIndex((nome) => mes.length >= 3 && mes.slice(0, 3) === nome.slice(0, 3)) + 1;
  if (numero === 0) return "";
  const [anoHoje, mesHoje] = hoje.split("-").map(Number);
  let anoNumero = numero > mesHoje! ? anoHoje! - 1 : anoHoje!;
  if (/^\d{2}$/.test(ano)) anoNumero = 2000 + Number(ano);
  else if (/^\d{4}$/.test(ano)) anoNumero = Number(ano);
  return `${anoNumero}-${String(numero).padStart(2, "0")}`;
}

/**
 * Mês de uma tarefa do Gestta: o mês do Vencimento. Sem Vencimento, usa a Competência.
 */
export function mesDoGestta(t: TarefaGestta): string {
  return t.vencimento?.slice(0, 7) || mesDaCompetencia(t.competencia) || "";
}

/** "Orientação ao Cliente" é tipo de tarefa (Registro de Orientação), não setor: fica fora dos totais de tarefas. */
const ehOrientacao = (t: TarefaGestta) => semAcento(t.departamento) === "orientacao ao cliente";

export function calcularMetricas(
  tarefas: TarefaGestta[],
  mes: string,
  hoje: string = hojeIso(),
): MetricasTarefas {
  const m: MetricasTarefas = {
    total: 0,
    concluidas: 0,
    noPrazo: 0,
    foraDoPrazo: 0,
    impedimento: 0,
    abertasEmAtraso: 0,
    concluidasNoMes: 0,
    acumuladasAnteriores: 0,
  };
  for (const t of tarefas) {
    const concluida = t.status === "CONCLUIDO";
    // Cada origem alimenta só os seus cards: complementar → concluídas no mês;
    // acumulada → acumuladas; Gestta → os demais.
    if (ehComplementarDoMes(t, mes)) m.concluidasNoMes += 1;
    if (ehAcumulada(t, mes)) m.acumuladasAnteriores += 1;
    if (t.origem !== "gestta") continue;
    if (mesDoGestta(t) !== mes) continue;
    if (ehOrientacao(t)) continue;
    m.total += 1;
    if (concluida) {
      m.concluidas += 1;
      if (t.dataConclusao && t.vencimento) {
        if (t.dataConclusao > t.vencimento) m.foraDoPrazo += 1;
        else m.noPrazo += 1;
      }
    } else if (t.status === "IMPEDIMENTO") {
      m.impedimento += 1;
    } else if (t.vencimento && t.vencimento < hoje) {
      m.abertasEmAtraso += 1;
    }
  }
  return m;
}

export type ChaveIndicador =
  | "total"
  | "concluidas"
  | "noPrazo"
  | "foraDoPrazo"
  | "impedimento"
  | "abertasEmAtraso"
  | "concluidasNoMes"
  | "acumuladasAnteriores"
  | "orientacao";

/** Tarefas que compõem cada card (mesmas regras de `calcularMetricas`). */
export function tarefasDoIndicador(
  tarefas: TarefaGestta[],
  mes: string,
  chave: ChaveIndicador,
  hoje: string = hojeIso(),
): TarefaGestta[] {
  return tarefas.filter((t) => {
    const concluida = t.status === "CONCLUIDO";
    const mesConclusao = concluida && t.dataConclusao ? t.dataConclusao.slice(0, 7) : "";
    if (chave === "concluidasNoMes") return ehComplementarDoMes(t, mes);
    if (chave === "acumuladasAnteriores") return ehAcumulada(t, mes);
    if (t.origem !== "gestta") return false;
    if (mesDoGestta(t) !== mes) return false;
    if (chave === "orientacao") return ehOrientacao(t);
    if (ehOrientacao(t)) return false;
    switch (chave) {
      case "total":
        return true;
      case "concluidas":
        return concluida;
      case "noPrazo":
        return concluida && !!t.dataConclusao && !!t.vencimento && t.dataConclusao <= t.vencimento;
      case "foraDoPrazo":
        return concluida && !!t.dataConclusao && !!t.vencimento && t.dataConclusao > t.vencimento;
      case "impedimento":
        return t.status === "IMPEDIMENTO";
      case "abertasEmAtraso":
        return !concluida && t.status !== "IMPEDIMENTO" && !!t.vencimento && t.vencimento < hoje;
    }
  });
}

export function agruparMetricas(
  tarefas: TarefaGestta[],
  mes: string,
  por: AgruparPor,
): { nome: string; metricas: MetricasTarefas }[] {
  const grupos = new Map<string, TarefaGestta[]>();
  for (const t of tarefas) {
    const nome = t[por] || "(sem informação)";
    const lista = grupos.get(nome);
    if (lista) lista.push(t);
    else grupos.set(nome, [t]);
  }
  return [...grupos.entries()]
    .map(([nome, lista]) => ({ nome, metricas: calcularMetricas(lista, mes) }))
    .filter((g) => g.metricas.total > 0 || g.metricas.concluidasNoMes > 0)
    .sort((a, b) => b.metricas.total - a.metricas.total);
}

export const pct = (parte: number, total: number) =>
  total === 0 ? "0%" : `${((parte / total) * 100).toFixed(1).replace(".", ",")}%`;
