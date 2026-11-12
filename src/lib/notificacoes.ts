/**
 * Notificações do Painel (sino): lista, não-lidas, marcar lida/todas.
 * Usa `public.notificacoes` (+ `plano_id` p/ deep-link na ação).
 */
import { exigirCloud } from "@/integrations/supabase/client";
import { traduzErro } from "@/lib/organizacao";
import { TIPO_NOTIFICACAO_CONVERSA } from "@/lib/ocorrencias";

export interface NotificacaoPainel {
  id: string; titulo: string; mensagem: string; tipo: string;
  planoId: string | null; popId: string | null; politicaId: string | null;
  ocorrenciaId: string | null;
  revisao: number | null;
  lida: boolean; createdAt: string;
  autorNome: string;
}

type Linha = Record<string, unknown>;
const str = (v: unknown, p = ""): string => (typeof v === "string" ? v : p);
const numOuNulo = (v: unknown): number | null => (typeof v === "number" ? v : null);

function doRow(r: Record<string, unknown>): NotificacaoPainel {
  return {
    id: str(r["id"]), titulo: str(r["titulo"]), mensagem: str(r["mensagem"], ""),
    tipo: str(r["tipo"], ""),
    planoId: typeof r["plano_id"] === "string" ? (r["plano_id"] as string) : null,
    popId: typeof r["pop_id"] === "string" ? (r["pop_id"] as string) : null,
    politicaId: typeof r["politica_id"] === "string" ? (r["politica_id"] as string) : null,
    ocorrenciaId: typeof r["ocorrencia_id"] === "string" && r["ocorrencia_id"] ? (r["ocorrencia_id"] as string) : null,
    revisao: numOuNulo(r["revisao"]),
    lida: Boolean(r["lida"]), createdAt: str(r["created_at"]),
    autorNome: str(r["autor_nome"], ""),
  };
}

export async function listarNotificacoes(email: string, limite = 30): Promise<NotificacaoPainel[]> {
  const { data, error } = await exigirCloud().from("notificacoes")
    .select("*").eq("destinatario_email", email.toLowerCase())
    .order("created_at", { ascending: false }).limit(limite);
  if (error) throw traduzErro(error);
  return (data ?? []).map((r) => doRow(r as unknown as Record<string, unknown>));
}

export async function contarNaoLidas(email: string): Promise<number> {
  const { count, error } = await exigirCloud().from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_email", email.toLowerCase()).eq("lida", false);
  if (error) throw traduzErro(error);
  return count ?? 0;
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  const { error } = await exigirCloud().from("notificacoes").update({ lida: true }).eq("id", id);
  if (error) throw traduzErro(error);
}

/* Conversas (chat da Comunicação): ícone @ ao lado do sino. */

export async function listarConversas(email: string, limite = 30): Promise<NotificacaoPainel[]> {
  const { data, error } = await exigirCloud().from("notificacoes")
    .select("*").eq("destinatario_email", email.toLowerCase())
    .eq("tipo", TIPO_NOTIFICACAO_CONVERSA)
    .order("created_at", { ascending: false }).limit(limite);
  if (error) throw traduzErro(error);
  return (data ?? []).map((r) => doRow(r as unknown as Record<string, unknown>));
}

export async function contarConversasNaoLidas(email: string): Promise<number> {
  const { count, error } = await exigirCloud().from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_email", email.toLowerCase())
    .eq("tipo", TIPO_NOTIFICACAO_CONVERSA).eq("lida", false);
  if (error) throw traduzErro(error);
  return count ?? 0;
}

/** Marca como lidas as conversas de uma ocorrência (quando a pessoa a vê). */
export async function marcarConversasLidas(email: string, ocorrenciaId: string): Promise<void> {
  const client = exigirCloud();
  const { data, error } = await client.from("notificacoes")
    .select("*").eq("destinatario_email", email.toLowerCase())
    .eq("tipo", TIPO_NOTIFICACAO_CONVERSA).eq("lida", false);
  if (error) throw traduzErro(error);
  const ids = (data ?? [])
    .map((r) => doRow(r as unknown as Record<string, unknown>))
    .filter((n) => n.ocorrenciaId === ocorrenciaId)
    .map((n) => n.id);
  if (ids.length === 0) return;
  const { error: erroUpdate } = await client.from("notificacoes")
    .update({ lida: true }).in("id", ids);
  if (erroUpdate) throw traduzErro(erroUpdate);
}

export async function marcarTodasConversasLidas(email: string): Promise<void> {
  const { error } = await exigirCloud().from("notificacoes")
    .update({ lida: true }).eq("destinatario_email", email.toLowerCase())
    .eq("tipo", TIPO_NOTIFICACAO_CONVERSA).eq("lida", false);
  if (error) throw traduzErro(error);
}

export async function marcarTodasLidas(email: string): Promise<void> {
  const { error } = await exigirCloud().from("notificacoes")
    .update({ lida: true }).eq("destinatario_email", email.toLowerCase()).eq("lida", false);
  if (error) throw traduzErro(error);
}
