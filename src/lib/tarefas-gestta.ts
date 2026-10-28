/**
 * Tarefas do Gestta: leitura da planilha, gravação sem duplicidade e métricas
 * de Indicadores (Por Setor / Por Colaborador / Por Célula).
 *
 * Regras (mês escolhido = mês do Vencimento da tarefa):
 *  - Total de tarefas: tarefas com vencimento no mês.
 *  - % concluídas: status CONCLUIDO ÷ total.
 *  - No prazo / fora do prazo (excludentes, somam % concluídas):
 *    conclusão <= vencimento (inclui as antecipadas) / conclusão > vencimento.
 *  - % em impedimento: status IMPEDIMENTO ÷ total.
 *  - % abertas em atraso: ABERTO com vencimento anterior a hoje ÷ total.
 *  - Concluídas no mês: concluídas com data de conclusão no mês (qualquer vencimento).
 *  - Acumuladas: concluídas com vencimento em mês anterior ao mês (até o mês).
 *    As concluídas no mês após o vencimento também contam em "fora do prazo".
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
      competencia: textoCelula(pega(linha, "competencia")),
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
  let duplicadasNoArquivo = 0;
  for (const linha of linhas.slice(1)) {
    const id = textoCelula(pega(linha, "id")).replace(/^"+|"+$/g, "");
    if (!id) continue;
    if (porId.has(id)) duplicadasNoArquivo += 1;
    porId.set(id, {
      id,
      nome: textoCelula(pega(linha, "nome")),
      tipo: "",
      status: statusAtrasada(textoCelula(pega(linha, "status"))),
      cliente: textoCelula(pega(linha, "cliente")),
      departamento: unificarSetor(textoCelula(pega(linha, "departamento"))),
      responsavel: textoCelula(pega(linha, "responsavel")),
      vencimento: paraData(pega(linha, "vencimento")),
      dataConclusao: paraData(pega(linha, "dataConclusao")),
      competencia: "",
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

/** Todas as tarefas já gravadas (paginado: o Supabase devolve no máx. 1000 por consulta). */
/** Nomes do Gestta que representam o mesmo setor do cadastro (chave sem acento/caixa/espaços extras). */
const SETORES_EQUIVALENTES: Record<string, string> = {
  "sucesso do cliente/ relacionamento": "Sucesso do Cliente",
  "sucesso do cliente/relacionamento": "Sucesso do Cliente",
  ti: "TI - Desenvolvimento",
  "suporte ti": "TI - Desenvolvimento",
  "ti / desenvolvimento": "TI - Desenvolvimento",
  "ti/desenvolvimento": "TI - Desenvolvimento",
  "ti - desenvolvimento": "TI - Desenvolvimento",
};

/**
 * Nome único do setor: junta variações de grafia (ex.: "Sucesso do Cliente/ Relacionamento").
 * Vale para importações, para os dados já gravados e para os setores do cadastro.
 *  - TI: sempre "TI - Desenvolvimento";
 *  - Recepção: qualquer variação vira "Recepção";
 *  - Fiscal: só "Fiscal Jaguaquara" e "Fiscal Maracás" (variações de grafia são unificadas).
 */
export function unificarSetor(nome: string): string {
  const limpo = nome.replace(/\s+/g, " ").trim();
  const chave = semAcento(limpo);
  const equivalente = SETORES_EQUIVALENTES[chave];
  if (equivalente) return equivalente;
  if (chave.startsWith("recepcao")) return "Recepção";
  if (/^fiscal.*jaguaquara/.test(chave)) return "Fiscal Jaguaquara";
  if (/^fiscal.*maracas/.test(chave)) return "Fiscal Maracás";
  return limpo;
}

const COLUNAS_SELECT =
  "id,nome,tipo,status,cliente,departamento,responsavel,vencimento,data_conclusao,competencia,cnpj_cpf,data_legal,feito_atrasado,feito_com_multa,baixado,origem";
const PAGINAS_SIMULTANEAS = 6;

let cacheTarefas: TarefaGestta[] | null = null;

/** Devolve o que já foi carregado nesta sessão (abre a tela na hora; atualize em segundo plano). */
export function tarefasEmCache(): TarefaGestta[] | null {
  return cacheTarefas;
}

/** Todas as tarefas já gravadas, buscando várias páginas ao mesmo tempo. */
export async function carregarTarefas(): Promise<TarefaGestta[]> {
  const cliente = clienteLivre();
  let colunas = COLUNAS_SELECT;
  const consultaPagina = (de: number) =>
    cliente
      .from(TABELA)
      .select(colunas)
      .order("id")
      .range(de, de + TAMANHO_PAGINA - 1);

  let primeira = await consultaPagina(0);
  if (primeira.error && !tabelaAusente(primeira.error)) {
    // Migration da coluna "origem" ainda não aplicada: carrega sem ela.
    colunas = COLUNAS_SELECT.replace(",origem", "");
    primeira = await consultaPagina(0);
  }
  if (primeira.error) {
    if (tabelaAusente(primeira.error)) return [];
    throw traduzErro(primeira.error);
  }
  const paginas: Record<string, string | null>[][] = [
    (primeira.data ?? []) as Record<string, string | null>[],
  ];
  if (paginas[0]!.length === TAMANHO_PAGINA) {
    const { count } = await cliente.from(TABELA).select("id", { count: "exact", head: true });
    const restantes: number[] = [];
    for (let de = TAMANHO_PAGINA; de < (count ?? 0); de += TAMANHO_PAGINA) restantes.push(de);
    let proximo = 0;
    const resultados: Record<string, string | null>[][] = new Array(restantes.length);
    const trabalhador = async () => {
      while (proximo < restantes.length) {
        const i = proximo++;
        const { data, error } = await consultaPagina(restantes[i]!);
        if (error) throw traduzErro(error);
        resultados[i] = (data ?? []) as Record<string, string | null>[];
      }
    };
    await Promise.all(Array.from({ length: Math.min(PAGINAS_SIMULTANEAS, restantes.length) }, trabalhador));
    paginas.push(...resultados);
  }

  const todas: TarefaGestta[] = [];
  for (const pagina of paginas) {
    for (const r of pagina) {
      todas.push({
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
      });
    }
  }
  cacheTarefas = todas;
  return todas;
}

const mudou = (a: TarefaGestta, b: TarefaGestta) =>
  a.status !== b.status ||
  a.dataConclusao !== b.dataConclusao ||
  a.vencimento !== b.vencimento ||
  a.departamento !== b.departamento ||
  a.responsavel !== b.responsavel ||
  a.cnpjCpf !== b.cnpjCpf ||
  a.dataLegal !== b.dataLegal ||
  a.feitoAtrasado !== b.feitoAtrasado ||
  a.feitoComMulta !== b.feitoComMulta ||
  a.baixado !== b.baixado;

/**
 * Grava as tarefas sem duplicar: o Id é a chave. Tarefas novas são inseridas;
 * as que já existem só são regravadas se algo mudou (status, conclusão etc.).
 */
export async function importarTarefas(
  tarefas: TarefaGestta[],
  duplicadasNoArquivo: number,
  aoProgredir?: (feito: number, total: number) => void,
  apenasNovas = false,
): Promise<ResultadoImportacao> {
  const jaGravadas = await carregarTarefas();
  const existentes = new Map(jaGravadas.map((t) => [t.id, t]));
  if (apenasNovas) {
    // Relatórios com nome abreviado ("Ramon S"): usa o nome completo já cadastrado, sem criar colaborador novo.
    const nomes = [...new Set(jaGravadas.map((t) => t.responsavel).filter(Boolean))];
    for (const t of tarefas) {
      if (!t.responsavel || nomes.includes(t.responsavel)) continue;
      const prefixo = semAcento(t.responsavel);
      const candidatos = nomes.filter((n) => semAcento(n).startsWith(prefixo));
      if (candidatos.length === 1) t.responsavel = candidatos[0]!;
      else if (candidatos.length > 1) t.responsavel = "";
    }
  }
  const gravar: TarefaGestta[] = [];
  let novas = 0;
  let atualizadas = 0;
  let ignoradas = 0;
  for (const t of tarefas) {
    const atual = existentes.get(t.id);
    if (!atual) {
      novas += 1;
      gravar.push(t);
    } else if (!apenasNovas && mudou(atual, t)) {
      atualizadas += 1;
      gravar.push(t);
    } else {
      ignoradas += 1;
    }
  }

  aoProgredir?.(0, gravar.length);
  const cliente = clienteLivre();
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

  const contagemMes = new Map<string, number>();
  for (const t of tarefas) {
    const m = t.vencimento?.slice(0, 7);
    if (m) contagemMes.set(m, (contagemMes.get(m) ?? 0) + 1);
  }
  const mesPredominante = [...contagemMes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return { lidas: tarefas.length, novas, atualizadas, ignoradas, duplicadasNoArquivo, mesPredominante };
}

/**
 * Apaga tarefas importadas. Com `mes` (AAAA-MM), apaga só as com vencimento nesse mês;
 * sem `mes`, apaga todas. Não mexe em indicadores nem em apurações.
 */
export async function zerarTarefas(mes?: string): Promise<void> {
  let filtrada = clienteLivre().from(TABELA).delete().not("id", "is", null);
  if (mes) {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const proximo = new Date(Date.UTC(ano!, numeroMes!, 1)).toISOString().slice(0, 10);
    filtrada = filtrada.gte("vencimento", `${mes}-01`).lt("vencimento", proximo);
  }
  const { error } = await filtrada;
  if (error) throw traduzErro(error);
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

/** Acumulada (relatório de atrasadas): qualquer status, vencimento em mês anterior ao escolhido. */
function ehAcumuladaDoMes(t: TarefaGestta, mes: string): boolean {
  return t.origem === "acumulada" && !!t.vencimento && t.vencimento.slice(0, 7) < mes;
}

/** Complementar: concluída no mês escolhido, com vencimento em mês anterior. */
function ehComplementarDoMes(t: TarefaGestta, mes: string): boolean {
  if (t.origem !== "complementar" || t.status !== "CONCLUIDO" || !t.dataConclusao || !t.vencimento)
    return false;
  return t.dataConclusao.slice(0, 7) === mes && t.vencimento.slice(0, 7) < mes;
}

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
    if (ehAcumuladaDoMes(t, mes)) m.acumuladasAnteriores += 1;
    if (t.origem !== "gestta") continue;
    if (!t.vencimento || t.vencimento.slice(0, 7) !== mes) continue;
    m.total += 1;
    if (concluida) {
      m.concluidas += 1;
      if (t.dataConclusao) {
        if (t.dataConclusao > t.vencimento) m.foraDoPrazo += 1;
        else m.noPrazo += 1;
      }
    } else if (t.status === "IMPEDIMENTO") {
      m.impedimento += 1;
    } else if (t.vencimento < hoje) {
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
  | "acumuladasAnteriores";

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
    if (chave === "acumuladasAnteriores") return ehAcumuladaDoMes(t, mes);
    if (t.origem !== "gestta") return false;
    if (!t.vencimento || t.vencimento.slice(0, 7) !== mes) return false;
    switch (chave) {
      case "total":
        return true;
      case "concluidas":
        return concluida;
      case "noPrazo":
        return concluida && !!t.dataConclusao && t.dataConclusao <= t.vencimento;
      case "foraDoPrazo":
        return concluida && !!t.dataConclusao && t.dataConclusao > t.vencimento;
      case "impedimento":
        return t.status === "IMPEDIMENTO";
      case "abertasEmAtraso":
        return !concluida && t.status !== "IMPEDIMENTO" && t.vencimento < hoje;
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
