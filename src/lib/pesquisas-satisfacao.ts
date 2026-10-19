/**
 * Pesquisas de satisfação: respostas de clientes (empresa, pessoa, unidade e as
 * notas de 1 a 10 de cada pergunta).
 *
 * Fonte: `public.pesquisas_satisfacao` (ver a migration de mesmo nome). A primeira
 * pergunta é obrigatória; as demais podem ficar vazias (ver a migration
 * `20261019060000_pesquisas_satisfacao_so_atendimento`).
 */

import { exigirCloud } from "@/integrations/supabase/client";

/** Chaves das cinco perguntas com nota de 1 a 10, na ordem do formulário. */
export const PERGUNTAS_NOTA = [
  {
    chave: "notaAtendimento",
    rotulo: "Avaliação do nosso atendimento",
    pergunta: "Como você avalia o nosso atendimento?",
  },
  {
    chave: "notaQualidade",
    rotulo: "Qualidade dos serviços prestados",
    pergunta: "Como você avalia a qualidade dos serviços prestados?",
  },
  {
    chave: "notaOrientacoes",
    rotulo: "Orientações técnicas do time Orcoma",
    pergunta: "Como você avalia as orientações técnicas do time Orcoma?",
  },
  {
    chave: "notaPrazos",
    rotulo: "Cumprimento dos prazos",
    pergunta: "Como você avalia o cumprimento dos prazos?",
  },
  {
    chave: "notaRecomendacao",
    rotulo: "Probabilidade de recomendar",
    pergunta: "Qual a probabilidade de você nos recomendar?",
  },
] as const;

export type ChavePergunta = (typeof PERGUNTAS_NOTA)[number]["chave"];

export interface PesquisaSatisfacao {
  id: string;
  criadoEm: string;
  empresa: string;
  nomePessoa: string;
  unidade: string;
  notaAtendimento: number | null;
  notaQualidade: number | null;
  notaOrientacoes: number | null;
  notaPrazos: number | null;
  notaRecomendacao: number | null;
  sugestao: string;
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
    sugestao: row.sugestao,
  }));
}

export interface RespostaPesquisaCliente {
  empresa: string;
  email: string;
  nomePessoa: string;
  unidade: string;
  notaAtendimento: number;
  notaQualidade: number;
  notaOrientacoes: number;
  notaPrazos: number;
  notaRecomendacao: number;
  sugestao: string;
}

/** Grava a resposta do formulário público. */
export async function registrarRespostaPesquisa(resposta: RespostaPesquisaCliente): Promise<void> {
  const { error } = await exigirCloud()
    .from("pesquisas_satisfacao")
    .insert({
      empresa: resposta.empresa,
      email: resposta.email,
      nome_pessoa: resposta.nomePessoa,
      unidade: resposta.unidade,
      nota_atendimento: resposta.notaAtendimento,
      nota_qualidade: resposta.notaQualidade,
      nota_orientacoes: resposta.notaOrientacoes,
      nota_prazos: resposta.notaPrazos,
      nota_recomendacao: resposta.notaRecomendacao,
      sugestao: resposta.sugestao,
    });
  if (error) throw new Error(error.message);
}

/** Média (uma casa decimal) de cada pergunta, ignorando respostas em branco. */
export function mediaPorPergunta(pesquisas: PesquisaSatisfacao[]) {
  return PERGUNTAS_NOTA.map((pergunta) => {
    const notas = pesquisas
      .map((p) => p[pergunta.chave])
      .filter((nota): nota is number => typeof nota === "number");
    const soma = notas.reduce((total, nota) => total + nota, 0);
    const media = notas.length ? Math.round((soma / notas.length) * 10) / 10 : 0;
    return { chave: pergunta.chave, rotulo: pergunta.rotulo, media };
  });
}

/** Média Geral: média das médias de todas as perguntas. */
export function mediaGeral(pesquisas: PesquisaSatisfacao[]): number {
  const medias = mediaPorPergunta(pesquisas).map((item) => item.media);
  if (!pesquisas.length) return 0;
  return Math.round((medias.reduce((t, m) => t + m, 0) / medias.length) * 10) / 10;
}
