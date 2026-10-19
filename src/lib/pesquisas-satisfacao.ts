/**
 * Pesquisas de satisfação: respostas de clientes (empresa, pessoa, unidade e as
 * notas de 1 a 10 de cada pergunta).
 *
 * Fonte: `public.pesquisas_satisfacao` (ver a migration de mesmo nome).
 */

import { exigirCloud } from "@/integrations/supabase/client";

/** Chaves das cinco perguntas com nota de 1 a 10. */
export const PERGUNTAS_NOTA = [
  { chave: "notaAtendimento", rotulo: "Avaliação do nosso atendimento" },
  { chave: "notaQualidade", rotulo: "Qualidade dos serviços prestados" },
  { chave: "notaOrientacoes", rotulo: "Orientações técnicas do time Orcoma" },
  { chave: "notaPrazos", rotulo: "Cumprimento dos prazos" },
  { chave: "notaRecomendacao", rotulo: "Probabilidade de recomendar" },
] as const;

export type ChavePergunta = (typeof PERGUNTAS_NOTA)[number]["chave"];

export interface PesquisaSatisfacao {
  id: string;
  criadoEm: string;
  empresa: string;
  nomePessoa: string;
  unidade: string;
  notaAtendimento: number;
  notaQualidade: number;
  notaOrientacoes: number;
  notaPrazos: number;
  notaRecomendacao: number;
}

/** Lista todas as respostas, da mais recente para a mais antiga. */
export async function listarPesquisas(): Promise<PesquisaSatisfacao[]> {
  const { data, error } = await exigirCloud()
    .from("pesquisas_satisfacao")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    criadoEm: row.created_at,
    empresa: row.empresa,
    nomePessoa: row.nome_pessoa,
    unidade: row.unidade,
    notaAtendimento: row.nota_atendimento,
    notaQualidade: row.nota_qualidade,
    notaOrientacoes: row.nota_orientacoes,
    notaPrazos: row.nota_prazos,
    notaRecomendacao: row.nota_recomendacao,
  }));
}

/** Média (uma casa decimal) de cada pergunta. Vazio quando não há respostas. */
export function mediaPorPergunta(pesquisas: PesquisaSatisfacao[]) {
  return PERGUNTAS_NOTA.map((pergunta) => {
    const soma = pesquisas.reduce((total, p) => total + p[pergunta.chave], 0);
    const media = pesquisas.length ? Math.round((soma / pesquisas.length) * 10) / 10 : 0;
    return { chave: pergunta.chave, rotulo: pergunta.rotulo, media };
  });
}

/** Média Geral: média das médias de todas as perguntas. */
export function mediaGeral(pesquisas: PesquisaSatisfacao[]): number {
  const medias = mediaPorPergunta(pesquisas).map((item) => item.media);
  if (!pesquisas.length) return 0;
  return Math.round((medias.reduce((t, m) => t + m, 0) / medias.length) * 10) / 10;
}
