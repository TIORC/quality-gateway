/**
 * Notificações do Painel (sino): lista, não-lidas, marcar lida/todas.
 * Usa `public.notificacoes` (+ `plano_id` p/ deep-link na ação).
 */
import { exigirCloud } from "@/integrations/supabase/client";
import { traduzErro } from "@/lib/organizacao";

export interface NotificacaoPainel {
  id: string; titulo: string; mensagem: string; tipo: string;
  planoId: string | null; lida: boolean; createdAt: string;
  autorNome: string;
}

type Linha = Record<string, unknown>;
const str = (v: unknown, p = ""): string => (typeof v === "string" ? v : p);

function doRow(r: Record<string, unknown>): NotificacaoPainel {
  return {
    id: str(r["id"]), titulo: str(r["titulo"]), mensagem: str(r["mensagem"], ""),
    tipo: str(r["tipo"], ""),
    planoId: typeof r["plano_id"] === "string" ? (r["plano_id"] as string) : null,
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

export async function marcarTodasLidas(email: string): Promise<void> {
  const { error } = await exigirCloud().from("notificacoes")
    .update({ lida: true }).eq("destinatario_email", email.toLowerCase()).eq("lida", false);
  if (error) throw traduzErro(error);
}
