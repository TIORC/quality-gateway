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
  { valor: "nps", rotulo: "NPS (0 a 10)" },
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
  /** Data/hora (ISO) até a qual a pesquisa aceita respostas. Null = sem prazo. */
  prazoRespostas: string | null;
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
    prazo_respostas: dados.prazoRespostas,
  };
}

/** Verdadeiro quando o prazo da pesquisa já passou (sem prazo = nunca encerra). */
export function prazoEncerrado(modelo: Pick<ModeloPesquisa, "prazoRespostas">, agora = new Date()) {
  return modelo.prazoRespostas !== null && agora.getTime() >= new Date(modelo.prazoRespostas).getTime();
}

/** Valor ISO para o campo `datetime-local` (horário local, sem fuso). */
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

/** Converte o valor do `datetime-local` (horário local) para ISO. Vazio vira null. */
export function doCampoDataHora(valor: string): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/** Pergunta que traz a razão social de quem respondeu (pelo texto da pergunta). */
export function chaveEmpresaDo(perguntas: PerguntaModelo[]): string | undefined {
  return perguntas.find((p) => /nome da empresa|raz[aã]o social/i.test(p.texto))?.id;
}

/** Razão social de uma resposta, já sem espaços nas pontas. Vazia se não houver. */
export function empresaDaResposta(resposta: RespostaModelo, chave: string | undefined): string {
  const valor = chave ? resposta.respostas[chave] : undefined;
  return typeof valor === "string" ? valor.trim() : "";
}

/** Texto de uma resposta (sem espaços nas pontas). Vazio se não houver. */
export function textoDaResposta(resposta: RespostaModelo, chave: string | undefined): string {
  const valor = chave ? resposta.respostas[chave] : undefined;
  return typeof valor === "string" ? valor.trim() : "";
}

/** Pergunta que pede o nome de quem respondeu (não a razão social). */
export function chaveNomeDo(perguntas: PerguntaModelo[]): string | undefined {
  return perguntas.find(
    (p) => /nome|respondido por/i.test(p.texto) && !/empresa|raz[aã]o social/i.test(p.texto),
  )?.id;
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
    prazoRespostas: row.prazo_respostas,
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

/** Exclui um modelo e, em cascata, as respostas dele. Lança erro se a exclusão falhar. */
export async function excluirModeloPesquisa(id: string): Promise<void> {
  const { error } = await exigirCloud().from("pesquisas_modelos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Uma nota NPS gravada, com a razão social e o nome de quem respondeu. */
export interface RegistroNps {
  nota: number;
  empresa: string;
  pessoa: string;
}

/**
 * Todas as notas NPS já gravadas em `nps_respostas`, inclusive de pesquisas excluídas.
 * O NPS geral sai daqui, não das pesquisas, para não perder as notas ao excluir uma pesquisa.
 */
export async function listarRegistrosNps(): Promise<RegistroNps[]> {
  const { data, error } = await exigirCloud().from("nps_respostas").select("nota, empresa, pessoa");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    nota: row.nota,
    empresa: row.empresa.trim(),
    pessoa: row.pessoa.trim(),
  }));
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

/** Uma resposta com a data em que foi enviada. */
export interface RespostaModelo {
  id: string;
  criadoEm: string;
  respostas: RespostaPesquisa;
}

/** Respostas de um modelo, da mais recente para a mais antiga, com a data de cada uma. */
export async function listarRespostasDetalhadas(modeloId: string): Promise<RespostaModelo[]> {
  const { data, error } = await exigirCloud()
    .from("pesquisas_respostas")
    .select("id, created_at, respostas")
    .eq("modelo_id", modeloId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    criadoEm: row.created_at,
    respostas: row.respostas as unknown as RespostaPesquisa,
  }));
}

/** Busca um modelo pelo id (usado pelo formulário público). Retorna null se não existir. */
export async function buscarModeloPesquisa(id: string): Promise<ModeloPesquisa | null> {
  const { data, error } = await exigirCloud()
    .from("pesquisas_modelos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    criadoEm: data.created_at,
    criadoPor: data.criado_por,
    titulo: data.titulo,
    descricao: data.descricao,
    perguntas: (Array.isArray(data.perguntas) ? data.perguntas : []) as unknown as PerguntaModelo[],
    prazoRespostas: data.prazo_respostas,
  };
}

/** Grava a resposta de uma pessoa a um modelo. Lança erro se a gravação falhar. */
export async function registrarRespostaModelo(
  modeloId: string,
  respostas: RespostaPesquisa,
): Promise<void> {
  const { error } = await exigirCloud()
    .from("pesquisas_respostas")
    .insert({ modelo_id: modeloId, respostas: respostas as unknown as Json });
  if (error) throw new Error(error.message);
}

/**
 * Apaga o valor de uma pergunta nas respostas de um modelo. Sem `ids`, vale para
 * todas as respostas (usado ao excluir a pergunta); com `ids`, só para essas linhas.
 * As demais respostas da mesma pessoa/empresa ficam intactas.
 */
export async function removerRespostasDaPergunta(
  modeloId: string,
  perguntaId: string,
  ids?: string[],
): Promise<void> {
  const cliente = exigirCloud();
  const { data, error } = await cliente
    .from("pesquisas_respostas")
    .select("id, respostas")
    .eq("modelo_id", modeloId);
  if (error) throw new Error(error.message);

  const alvos = (data ?? []).filter(
    (row) =>
      (!ids || ids.includes(row.id)) &&
      Object.prototype.hasOwnProperty.call(row.respostas ?? {}, perguntaId),
  );
  const atualizacoes = alvos.map((row) => {
    const { [perguntaId]: _removida, ...restante } = row.respostas as unknown as RespostaPesquisa;
    return cliente
      .from("pesquisas_respostas")
      .update({ respostas: restante as unknown as Json })
      .eq("id", row.id);
  });
  const resultados = await Promise.all(atualizacoes);
  const falha = resultados.find((r) => r.error);
  if (falha?.error) throw new Error(falha.error.message);
}

/**
 * Apaga envios inteiros (uma linha de `pesquisas_respostas` cada) e as notas NPS deles.
 * Usado pelo menu Configurações ao excluir todas as respostas de uma pessoa.
 */
export async function excluirRespostasPorIds(ids: string[]): Promise<void> {
  const cliente = exigirCloud();
  const TAMANHO_LOTE = 100;
  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_LOTE) {
    const lote = ids.slice(inicio, inicio + TAMANHO_LOTE);
    const { error: erroNps } = await cliente.from("nps_respostas").delete().in("resposta_id", lote);
    if (erroNps) throw new Error(erroNps.message);
    const { error } = await cliente.from("pesquisas_respostas").delete().in("id", lote);
    if (error) throw new Error(error.message);
  }
}

/** Remove uma pergunta do modelo e apaga o valor dela em todas as respostas. */
export async function excluirPerguntaDaPesquisa(
  modelo: ModeloPesquisa,
  perguntaId: string,
): Promise<void> {
  // Primeiro tira a pergunta do modelo: se falhar aqui, nada foi apagado das respostas.
  await atualizarModeloPesquisa(modelo.id, {
    titulo: modelo.titulo,
    descricao: modelo.descricao,
    perguntas: modelo.perguntas.filter((p) => p.id !== perguntaId),
    prazoRespostas: modelo.prazoRespostas,
  });
  await removerRespostasDaPergunta(modelo.id, perguntaId);
}

/** Link público de uma pesquisa. Abre o formulário com as perguntas dela. */
export function linkDaPesquisa(id: string): string {
  return `${window.location.origin}/responder-pesquisa?pesquisa=${encodeURIComponent(id)}`;
}
