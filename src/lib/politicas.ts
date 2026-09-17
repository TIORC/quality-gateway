/**
 * Políticas — tipos, constantes e acesso a dados.
 *
 * Fonte: banco do Lovable Cloud (`public.politicas`, criada na migration
 * `supabase/migrations/20260917010000_politicas_validade.sql`). As datas são
 * gravadas no formato `dd/mm/aaaa` (texto), coerente com o restante da aba.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PoliticaInsert, PoliticaRow } from "@/integrations/supabase/db-types";
import { organizacaoDisponivel } from "@/lib/organizacao";
import type { Pop } from "@/lib/pops";

/* -------------------------------------------------------------------------- */
/* Domínio                                                                    */
/* -------------------------------------------------------------------------- */

export interface PoliticaAnexo {
  /** Caminho dentro do bucket (para gerar URL assinada). `null` quando o upload não foi possível (ex.: offline). */
  path: string | null;
  nome: string;
  tipo: string;
}

export interface RevisaoPolitica {
  id: string;
  numero: number;
  data: string;
  observacao: string;
}

export interface ParecerPolitica {
  tipo: "concordo" | "discordo";
  clausula: string;
  motivo: string;
  data: string;
}

export interface SugestaoPolitica {
  id: string;
  texto: string;
  data: string;
}

export interface PoliticaItem {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string;
  setores: string[];
  aplicabilidade: string;
  links: string[];
  dataPostagem: string;
  status: string;
  historico: RevisaoPolitica[];
  dataRevisao: string;
  revisao: number;
  observacaoRevisao: string;
  anexo: PoliticaAnexo | null;
  parecer: ParecerPolitica | null;
  sugestoes: SugestaoPolitica[];
  /** Data de validade da política (`dd/mm/aaaa`). Vazia quando não definida. */
  dataVencimento: string;
}

/* -------------------------------------------------------------------------- */
/* Acesso a dados — Lovable Cloud (Supabase)                                  */
/* -------------------------------------------------------------------------- */

function traduzirErro(erro: unknown): Error {
  if (erro && typeof erro === "object" && "message" in erro) {
    return new Error(String((erro as { message: unknown }).message));
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

function politicaDoRow(row: PoliticaRow): PoliticaItem {
  return {
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    objetivo: row.objetivo ?? "",
    setores: row.setores ?? [],
    aplicabilidade: row.aplicabilidade ?? "",
    links: row.links ?? [],
    dataPostagem: row.data_postagem ?? "",
    status: row.status ?? "Em aprovação",
    historico: Array.isArray(row.historico)
      ? (row.historico as unknown as RevisaoPolitica[])
      : [],
    dataRevisao: row.data_revisao ?? "",
    revisao: typeof row.revisao === "number" && row.revisao > 0 ? row.revisao : 1,
    observacaoRevisao: row.observacao_revisao ?? "",
    anexo:
      row.anexo && typeof row.anexo === "object" ? (row.anexo as unknown as PoliticaAnexo) : null,
    parecer:
      row.parecer && typeof row.parecer === "object"
        ? (row.parecer as unknown as ParecerPolitica)
        : null,
    sugestoes: Array.isArray(row.sugestoes)
      ? (row.sugestoes as unknown as SugestaoPolitica[])
      : [],
    dataVencimento: row.data_vencimento ?? "",
  };
}

function politicaParaInsercao(item: PoliticaItem): PoliticaInsert {
  return {
    codigo: item.codigo,
    titulo: item.titulo,
    objetivo: item.objetivo ?? "",
    setores: item.setores ?? [],
    aplicabilidade: item.aplicabilidade ?? "",
    links: item.links ?? [],
    data_postagem: item.dataPostagem ?? "",
    status: item.status ?? "Em aprovação",
    historico: (item.historico ?? []) as unknown as NonNullable<PoliticaInsert["historico"]>,
    data_revisao: item.dataRevisao ?? "",
    revisao: item.revisao,
    observacao_revisao: item.observacaoRevisao ?? "",
    anexo: item.anexo as unknown as NonNullable<PoliticaInsert["anexo"]>,
    parecer: item.parecer as unknown as NonNullable<PoliticaInsert["parecer"]>,
    sugestoes: (item.sugestoes ?? []) as unknown as NonNullable<PoliticaInsert["sugestoes"]>,
    data_vencimento: item.dataVencimento ?? "",
  };
}

/** Lista as políticas cadastradas, ordenadas pelo código. */
export async function carregarPoliticas(): Promise<PoliticaItem[]> {
  const { data, error } = await supabase
    .from("politicas")
    .select("*")
    .order("codigo", { ascending: true });
  if (error) throw traduzirErro(error);
  return (data ?? []).map(politicaDoRow);
}

/** Cria uma política no banco e devolve o registro persistido. */
export async function criarPolitica(item: PoliticaItem): Promise<PoliticaItem> {
  const { data, error } = await supabase
    .from("politicas")
    .insert(politicaParaInsercao(item))
    .select()
    .single();
  if (error) throw traduzirErro(error);
  if (!data) throw new Error("Não foi possível criar a política.");
  return politicaDoRow(data);
}

/** Atualiza uma política no banco e devolve o registro persistido. */
export async function atualizarPolitica(item: PoliticaItem): Promise<PoliticaItem> {
  const { data, error } = await supabase
    .from("politicas")
    .update(politicaParaInsercao(item))
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw traduzirErro(error);
  if (!data) throw new Error("Política não encontrada.");
  return politicaDoRow(data);
}

/** Remove uma política do banco. */
export async function excluirPolitica(id: string): Promise<void> {
  const { error } = await supabase.from("politicas").delete().eq("id", id);
  if (error) throw traduzirErro(error);
}

/* -------------------------------------------------------------------------- */
/* Próximos vencimentos                                                        */
/* -------------------------------------------------------------------------- */

/** Documento com data de validade próxima/vencida, para o painel. */
export interface DocumentoVencimento {
  id: string;
  codigo: string;
  titulo: string;
  tipo: "pop" | "politica";
  /** Data de vencimento em `aaaa-mm-dd` (normalizada para comparação). */
  dataVencimento: string;
  /** Data de vencimento formatada para exibição (`dd/mm/aaaa`). */
  dataVencimentoExibicao: string;
  /** Dias até vencer (negativo = já vencido). */
  diasRestantes: number;
}

/** Converte datas em `dd/mm/aaaa` ou `aaaa-mm-dd` para `Date` no início do dia. */
function dataParaComparar(valor: string): Date | null {
  if (!valor) return null;
  let ano = "";
  let mes = "";
  let dia = "";
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const partes = valor.slice(0, 10).split("-");
    ano = partes[0] ?? "";
    mes = partes[1] ?? "";
    dia = partes[2] ?? "";
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const partes = valor.split("/");
    dia = partes[0] ?? "";
    mes = partes[1] ?? "";
    ano = partes[2] ?? "";
  } else {
    return null;
  }
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

/** Exibe a data de vencimento como `dd/mm/aaaa`. */
function exibirData(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return valor;
}

/**
 * Documentos (POPs e políticas) com data de validade definida e vencendo em
 * até 30 dias (incluindo os já vencidos), ordenados do mais urgente ao menos.
 */
export function documentosVencidosOuProximos(
  pops: Pop[],
  politicas: PoliticaItem[],
  janelaDias = 30,
): DocumentoVencimento[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const milissegundosPorDia = 24 * 60 * 60 * 1000;

  const itens: Omit<DocumentoVencimento, "dataVencimentoExibicao" | "diasRestantes">[] = [
    ...pops.map((pop) => ({
      id: pop.id,
      codigo: pop.codigo,
      titulo: pop.titulo,
      tipo: "pop" as const,
      dataVencimento: pop.dataVencimento ?? "",
    })),
    ...politicas.map((politica) => ({
      id: politica.id,
      codigo: politica.codigo,
      titulo: politica.titulo,
      tipo: "politica" as const,
      dataVencimento: politica.dataVencimento ?? "",
    })),
  ];

  const resultado: DocumentoVencimento[] = [];
  for (const item of itens) {
    const alvo = dataParaComparar(item.dataVencimento);
    if (!alvo) continue;
    const dias = Math.ceil((alvo.getTime() - hoje.getTime()) / milissegundosPorDia);
    if (dias > janelaDias) continue;
    resultado.push({
      ...item,
      dataVencimentoExibicao: exibirData(item.dataVencimento),
      diasRestantes: dias,
    });
  }

  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** `true` quando o Lovable Cloud está configurado (fonte de dados das políticas). */
export function politicasDisponiveis(): boolean {
  return organizacaoDisponivel();
}