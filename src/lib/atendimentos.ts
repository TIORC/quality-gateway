/**
 * Atendimentos realizados por departamento: leitura do relatório "Indicador_Atendimento"
 * (aba "Por Departamento", colunas Departamento e Total), gravação por mês e soma para o card.
 */
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import { unificarSetor } from "@/lib/tarefas-gestta";

const TABELA = "atendimentos_departamento";

export interface AtendimentoDepartamento {
  mes: string; // YYYY-MM
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

/**
 * Lê a aba "Por Departamento" (colunas Competência, Departamento e Total). O mês de cada linha
 * vem da coluna Competência; a coluna é opcional (sem ela, o mês fica vazio).
 */
export async function lerPlanilhaAtendimentos(arquivo: File): Promise<{ linhas: LinhaAtendimento[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
  const nomeAba =
    wb.SheetNames.find((n) => semAcento(n).includes("departamento")) ?? wb.SheetNames[0];
  const aba = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null });
  const cabecalho = (linhas[0] ?? []).map((c) => semAcento(String(c ?? "")));
  const iDep = cabecalho.indexOf("departamento");
  const iTotal = cabecalho.indexOf("total");
  const iMes = cabecalho.indexOf("competencia");
  if (iDep < 0 || iTotal < 0) {
    throw new Error('Planilha fora do formato: a aba precisa das colunas "Departamento" e "Total".');
  }
  const somados = new Map<string, LinhaAtendimento>();
  for (const linha of linhas.slice(1)) {
    const departamento = String(linha[iDep] ?? "").replace(/\s+/g, " ").trim();
    const total = Number(linha[iTotal]);
    if (!departamento || !Number.isFinite(total)) continue;
    const mes = iMes < 0 ? "" : mesDaCompetencia(linha[iMes]);
    const chave = `${mes}|${departamento}`;
    const atual = somados.get(chave);
    if (atual) atual.total += total;
    else somados.set(chave, { mes, departamento, total });
  }
  return { linhas: [...somados.values()] };
}

/** Grava por mês: cada mês presente nas linhas é substituído por inteiro. */
export async function importarAtendimentos(linhas: LinhaAtendimento[]): Promise<void> {
  const cliente = clienteLivre();
  const meses = [...new Set(linhas.map((l) => l.mes))];
  const { error: erroApagar } = await cliente.from(TABELA).delete().in("mes", meses);
  if (erroApagar) throw traduzErro(erroApagar);
  const agora = new Date().toISOString();
  const { error } = await cliente
    .from(TABELA)
    .insert(linhas.map((l) => ({ mes: l.mes, departamento: l.departamento, total: l.total, importado_em: agora })));
  if (error) {
    if (tabelaAusente(error)) {
      throw new Error(
        "A tabela atendimentos_departamento ainda não existe. Aplique a migration 20261030050000_atendimentos_departamento.sql.",
      );
    }
    throw traduzErro(error);
  }
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

const chaveSetor = (nome: string) => semAcento(unificarSetor(nome));

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

export function totalAtendimentos(
  dados: AtendimentoDepartamento[],
  mes: string,
  setores: string[] | null,
): number {
  return atendimentosDoMes(dados, mes, setores).reduce((soma, d) => soma + d.total, 0);
}
