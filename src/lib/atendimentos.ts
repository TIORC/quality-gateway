/**
 * Atendimentos realizados do relatório "Indicador_Atendimento": aba "Por Departamento" (colunas
 * Departamento e Total) e aba "Por Colaborador" (colunas Colaborador e Total), gravação por mês e
 * somas para os cards.
 */
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import { unificarSetor } from "@/lib/tarefas-gestta";

const TABELA = "atendimentos_departamento";
const TABELA_COLABORADOR = "atendimentos_colaborador";

export interface AtendimentoDepartamento {
  mes: string; // YYYY-MM
  departamento: string;
  total: number;
}

export interface AtendimentoColaborador {
  mes: string; // YYYY-MM
  colaborador: string; // nome como vem na planilha, sem o " - Dep. ..."
  departamento: string;
  total: number;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Mês do relatório: "Indicador_Atendimento_01-09-2026_30-09-2026.xlsx" → "2026-09". */
export function mesDoNomeDoArquivo(nome: string): string {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(nome);
  return m ? `${m[3]}-${m[2]}` : "";
}

/** Competência da linha (serial do Excel, dd/mm/aaaa ou aaaa-mm) → YYYY-MM; vazio se não reconhecer. */
function mesDaCompetencia(v: unknown): string {
  if (typeof v === "number") {
    const d = new Date((Math.floor(v) - 25569) * 86400000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 7);
  }
  const t = String(v ?? "").trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}`;
  const iso = /^(\d{4})-(\d{2})/.exec(t);
  return iso ? `${iso[1]}-${iso[2]}` : "";
}

export interface LinhaAtendimento {
  mes: string; // vazio quando a planilha não traz a competência
  departamento: string;
  total: number;
}

export type LinhaAtendimentoColaborador = AtendimentoColaborador;

type Planilha = typeof import("xlsx");

interface LinhaBruta {
  mes: string;
  nome: string;
  total: number;
}

/**
 * Soma uma aba por (mês, nome). A coluna `coluna` traz o nome (Departamento ou Colaborador);
 * Competência é opcional (sem ela, o mês fica vazio).
 */
function lerAba(XLSX: Planilha, aba: import("xlsx").WorkSheet, coluna: string): LinhaBruta[] {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null });
  const cabecalho = (linhas[0] ?? []).map((c) => semAcento(String(c ?? "")));
  const iNome = cabecalho.indexOf(semAcento(coluna));
  const iTotal = cabecalho.indexOf("total");
  const iMes = cabecalho.indexOf("competencia");
  if (iNome < 0 || iTotal < 0) {
    throw new Error(`Planilha fora do formato: a aba precisa das colunas "${coluna}" e "Total".`);
  }
  const somados = new Map<string, LinhaBruta>();
  for (const linha of linhas.slice(1)) {
    const nome = String(linha[iNome] ?? "").replace(/\s+/g, " ").trim();
    const total = Number(linha[iTotal]);
    if (!nome || !Number.isFinite(total)) continue;
    const mes = iMes < 0 ? "" : mesDaCompetencia(linha[iMes]);
    const chave = `${mes}|${nome}`;
    const atual = somados.get(chave);
    if (atual) atual.total += total;
    else somados.set(chave, { mes, nome, total });
  }
  return [...somados.values()];
}

/** "Adalgiza - Dep. Pessoal" → colaborador "Adalgiza" e departamento "Dep. Pessoal". */
function separarColaborador(l: LinhaBruta): LinhaAtendimentoColaborador {
  const m = /^(.*?)\s+-\s+(.*)$/.exec(l.nome);
  return {
    mes: l.mes,
    colaborador: (m?.[1] ?? l.nome).trim(),
    departamento: m?.[2]?.trim() ?? "",
    total: l.total,
  };
}

/**
 * Lê a aba "Por Departamento" (obrigatória) e a aba "Por Colaborador" (opcional).
 * Sem a aba de colaborador, `colaboradores` vem vazio.
 */
export async function lerPlanilhaAtendimentos(
  arquivo: File,
): Promise<{ linhas: LinhaAtendimento[]; colaboradores: LinhaAtendimentoColaborador[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const nomeAba =
    wb.SheetNames.find((n) => semAcento(n).includes("departamento")) ?? wb.SheetNames[0];
  const aba = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const nomeAbaColaborador = wb.SheetNames.find((n) => semAcento(n).includes("colaborador"));
  const abaColaborador = nomeAbaColaborador ? wb.Sheets[nomeAbaColaborador] : undefined;
  return {
    linhas: lerAba(XLSX, aba, "Departamento").map((l) => ({ mes: l.mes, departamento: l.nome, total: l.total })),
    colaboradores: abaColaborador ? lerAba(XLSX, abaColaborador, "Colaborador").map(separarColaborador) : [],
  };
}

/** Grava por mês: cada mês presente nas linhas é substituído por inteiro. */
async function gravarPorMes<T extends { mes: string }>(
  tabela: string,
  registros: T[],
  registro: (r: T, agora: string) => Record<string, unknown>,
): Promise<void> {
  const cliente = clienteLivre();
  const meses = [...new Set(registros.map((r) => r.mes))];
  const { error: erroApagar } = await cliente.from(tabela).delete().in("mes", meses);
  if (erroApagar) throw traduzErro(erroApagar);
  const agora = new Date().toISOString();
  const { error } = await cliente.from(tabela).insert(registros.map((r) => registro(r, agora)));
  if (error) {
    if (tabelaAusente(error)) {
      throw new Error(`A tabela ${tabela} ainda não existe. Aplique a migration de atendimentos do Supabase.`);
    }
    throw traduzErro(error);
  }
}

export async function importarAtendimentos(linhas: LinhaAtendimento[]): Promise<void> {
  await gravarPorMes(TABELA, linhas, (l, agora) => ({
    mes: l.mes,
    departamento: l.departamento,
    total: l.total,
    importado_em: agora,
  }));
}

export async function importarAtendimentosColaborador(linhas: LinhaAtendimentoColaborador[]): Promise<void> {
  await gravarPorMes(TABELA_COLABORADOR, linhas, (l, agora) => ({
    mes: l.mes,
    colaborador: l.colaborador,
    departamento: l.departamento,
    total: l.total,
    importado_em: agora,
  }));
}

export async function carregarAtendimentos(): Promise<AtendimentoDepartamento[]> {
  const { data, error } = await clienteLivre().from(TABELA).select("mes,departamento,total");
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return ((data ?? []) as { mes: string; departamento: string; total: number }[]).map((r) => ({
    mes: r.mes,
    departamento: r.departamento,
    total: Number(r.total),
  }));
}

export async function carregarAtendimentosColaborador(): Promise<AtendimentoColaborador[]> {
  const { data, error } = await clienteLivre().from(TABELA_COLABORADOR).select("mes,colaborador,departamento,total");
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return ((data ?? []) as AtendimentoColaborador[]).map((r) => ({
    mes: r.mes,
    colaborador: r.colaborador,
    departamento: r.departamento,
    total: Number(r.total),
  }));
}

/**
 * Compara departamento da planilha com o setor do sistema. A planilha traz "Contábil Maracás" e o
 * sistema tem "Contábil": qualquer variação que comece por "contábil" conta como o setor Contábil.
 */
const chaveSetor = (nome: string) => {
  const chave = semAcento(unificarSetor(nome));
  return chave.startsWith("contabil") ? "contabil" : chave;
};

/**
 * Departamentos do mês, do maior para o menor. `setores` null = sem filtro;
 * com lista, só os departamentos que correspondem a esses setores.
 */
export function atendimentosDoMes(
  dados: AtendimentoDepartamento[],
  mes: string,
  setores: string[] | null,
): AtendimentoDepartamento[] {
  const chaves = setores ? new Set(setores.map(chaveSetor)) : null;
  return dados
    .filter((d) => d.mes === mes && (!chaves || chaves.has(chaveSetor(d.departamento))))
    .sort((x, y) => y.total - x.total);
}

/**
 * A planilha traz o nome curto ("Adalgiza") e o Gestta, o nome completo ("Adalgiza Argôlo de Souza").
 * Bate quando as palavras da planilha são o início do nome do Gestta.
 */
export function colaboradorCorresponde(nomePlanilha: string, nomeGestta: string): boolean {
  const planilha = semAcento(nomePlanilha).split(" ");
  const gestta = semAcento(nomeGestta).split(" ");
  return planilha.length <= gestta.length && planilha.every((p, i) => p === gestta[i]);
}

/**
 * Todas as linhas por colaborador e departamento do mês, do maior para o menor.
 * `setor` null = sem filtro; com setor, só os departamentos desse setor.
 */
export function atendimentosDoColaboradoresDoMes(
  dados: AtendimentoColaborador[],
  mes: string,
  setor: string | null = null,
): AtendimentoColaborador[] {
  return dados
    .filter((d) => d.mes === mes && (!setor || chaveSetor(d.departamento) === chaveSetor(setor)))
    .sort((x, y) => y.total - x.total);
}

/** Atendimentos de um colaborador (nome do Gestta) no mês, do maior para o menor, por departamento. */
export function atendimentosDoColaborador(
  dados: AtendimentoColaborador[],
  mes: string,
  nomeGestta: string,
): AtendimentoDepartamento[] {
  return dados
    .filter((d) => d.mes === mes && colaboradorCorresponde(d.colaborador, nomeGestta))
    .map((d) => ({ mes: d.mes, departamento: d.departamento, total: d.total }))
    .sort((x, y) => y.total - x.total);
}
