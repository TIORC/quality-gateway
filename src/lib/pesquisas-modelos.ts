/**
 * Modelos de pesquisa criados pelo administrador (perguntas e tipo de resposta de
 * cada uma). Fonte: `public.pesquisas_modelos`.
 */

import { exigirCloud } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getSession } from "@/lib/auth";

export const TIPOS_RESPOSTA = [
  { valor: "texto_curto", rotulo: "Resposta curta" },
  { valor: "texto_longo", rotulo: "Parágrafo" },
  { valor: "escala", rotulo: "Escala de 1 a 10" },
  { valor: "multipla_escolha", rotulo: "Múltipla escolha" },
  { valor: "caixas_selecao", rotulo: "Caixas de seleção" },
  { valor: "sim_nao", rotulo: "Sim ou não" },
] as const;

export type TipoResposta = (typeof TIPOS_RESPOSTA)[number]["valor"];

/** Tipos que usam uma lista de opções. */
export const TIPOS_COM_OPCOES: TipoResposta[] = ["multipla_escolha", "caixas_selecao"];

export interface PerguntaModelo {
  id: string;
  texto: string;
  /** Subtítulo exibido abaixo da pergunta (opcional). */
  subtitulo: string;
  tipo: TipoResposta;
  obrigatoria: boolean;
  opcoes: string[];
  /** Mostra a opção "Outro", com campo para a pessoa escrever a resposta. */
  permiteOutro: boolean;
}

export interface DadosModeloPesquisa {
  titulo: string;
  descricao: string;
  perguntas: PerguntaModelo[];
}

export interface ModeloPesquisa extends DadosModeloPesquisa {
  id: string;
  criadoEm: string;
  criadoPor: string;
}

function paraJson(dados: DadosModeloPesquisa) {
  return {
    titulo: dados.titulo,
    descricao: dados.descricao,
    perguntas: dados.perguntas as unknown as Json,
  };
}

/** Lista os modelos, do mais recente para o mais antigo. */
export async function listarModelosPesquisa(): Promise<ModeloPesquisa[]> {
  const { data, error } = await exigirCloud()
    .from("pesquisas_modelos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    criadoEm: row.created_at,
    criadoPor: row.criado_por,
    titulo: row.titulo,
    descricao: row.descricao,
    perguntas: (Array.isArray(row.perguntas) ? row.perguntas : []) as unknown as PerguntaModelo[],
  }));
}

/** Cria um modelo de pesquisa. Lança erro se a gravação falhar. */
export async function criarModeloPesquisa(dados: DadosModeloPesquisa): Promise<void> {
  const sessao = getSession();
  const { error } = await exigirCloud()
    .from("pesquisas_modelos")
    .insert({ ...paraJson(dados), criado_por: sessao?.email ?? "" });
  if (error) throw new Error(error.message);
}

/** Atualiza um modelo existente. Lança erro se a gravação falhar. */
export async function atualizarModeloPesquisa(
  id: string,
  dados: DadosModeloPesquisa,
): Promise<void> {
  const { error } = await exigirCloud()
    .from("pesquisas_modelos")
    .update(paraJson(dados))
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Respostas de um modelo: cada item é o objeto { id_da_pergunta: resposta }. */
export type RespostaPesquisa = Record<string, number | string | string[]>;

export async function listarRespostasModelo(modeloId: string): Promise<RespostaPesquisa[]> {
  const { data, error } = await exigirCloud()
    .from("pesquisas_respostas")
    .select("respostas")
    .eq("modelo_id", modeloId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.respostas as unknown as RespostaPesquisa);
}
