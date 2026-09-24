/**
 * Indicadores — acesso ao Cloud (Supabase).
 *
 * `types.ts` do Supabase é gerado automaticamente e ainda não conhece as
 * tabelas deste módulo; por isso o cliente vem de `clienteLivre()` (mesma
 * técnica de `auditorias-base.ts`) e a leitura tolera a migration ainda não
 * aplicada (`tabelaAusente`).
 */
import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import {
  FONTES_INDICADOR,
  SENTIDOS_INDICADOR,
  UNIDADES_INDICADOR,
  type Apuracao,
  type Indicador,
  type StatusApuracao,
} from "@/lib/indicadores";

export type Linha = Record<string, unknown>;

export const str = (v: unknown, p = ""): string => (typeof v === "string" ? v : p);

/** Número tolerante: aceita `null`/`undefined`/string numérica. */
export const numOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function dentro<T extends string>(opcoes: readonly T[], valor: unknown, padrao: T): T {
  return typeof valor === "string" && (opcoes as readonly string[]).includes(valor)
    ? (valor as T)
    : padrao;
}

function statusValido(valor: unknown): StatusApuracao {
  return valor === "dentro_da_meta" || valor === "abaixo_da_meta" ? valor : "pendente";
}

export function indicadorDoRow(row: Linha): Indicador {
  return {
    id: str(row["id"]),
    nome: str(row["nome"]),
    descricao: str(row["descricao"]),
    setor: str(row["setor"]),
    responsavelId: str(row["responsavel_id"]),
    responsavelNome: str(row["responsavel_nome"]),
    unidade: dentro(UNIDADES_INDICADOR, row["unidade"], "percentual"),
    formulaDescricao: str(row["formula_descricao"]),
    meta: numOuNulo(row["meta"]),
    sentido: dentro(SENTIDOS_INDICADOR, row["sentido"], "maior_melhor"),
    periodicidade: str(row["periodicidade"], "mensal"),
    fonte: dentro(FONTES_INDICADOR, row["fonte"], "manual"),
    automatico: Boolean(row["automatico"]),
    regraAutomatica: str(row["regra_automatica"]),
    ativo: row["ativo"] === undefined ? true : Boolean(row["ativo"]),
    criadoDeModelo: Boolean(row["criado_de_modelo"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

export function apuracaoDoRow(row: Linha): Apuracao {
  return {
    id: str(row["id"]),
    indicadorId: str(row["indicador_id"]),
    mesReferencia: str(row["mes_referencia"]),
    valorRealizado: numOuNulo(row["valor_realizado"]),
    metaNoMes: numOuNulo(row["meta_no_mes"]),
    status: statusValido(row["status"]),
    planoAcaoId: str(row["plano_acao_id"]) || null,
    lancadoPor: str(row["lancado_por"]),
    lancadoEm: typeof row["lancado_em"] === "string" ? (row["lancado_em"] as string) : null,
    fechado: Boolean(row["fechado"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

/** Todos os indicadores (ativos, arquivados e modelos da biblioteca). */
export async function listarIndicadores(): Promise<Indicador[]> {
  try {
    const { data, error } = await clienteLivre()
      .from("indicadores")
      .select("*")
      .order("nome", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => indicadorDoRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    if (e instanceof Error && /não configurado/i.test(e.message)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}

/** Apurações de todos os indicadores (mais recentes primeiro). */
export async function listarApuracoes(indicadorId?: string): Promise<Apuracao[]> {
  try {
    let consulta = clienteLivre().from("apuracoes").select("*");
    if (indicadorId) consulta = consulta.eq("indicador_id", indicadorId);
    const { data, error } = await consulta.order("mes_referencia", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => apuracaoDoRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    if (e instanceof Error && /não configurado/i.test(e.message)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}

/**
 * Modelos da biblioteca: linhas marcadas como modelo e ainda inativas.
 * Quando a tabela não existe, devolve lista vazia (a tela avisa para aplicar a
 * migration) — nunca modelos fictícios.
 */
export async function listarModelos(): Promise<Indicador[]> {
  const todos = await listarIndicadores();
  return todos.filter((i) => i.criadoDeModelo && !i.ativo);
}
