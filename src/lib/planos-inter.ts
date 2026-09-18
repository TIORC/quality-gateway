import { exigirCloud } from "@/integrations/supabase/client";
import type { UserSession } from "@/lib/auth";
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import { autorDe, destinatariosDoPlano, notificarPlano } from "@/lib/planos-mutar";
import type { ComentarioPlano, HistoricoPlano, PlanoAcao } from "@/lib/planos";
import { str } from "@/lib/planos-base";

type Rec = Record<string, unknown>;

export async function listarComentarios(planoId: string): Promise<ComentarioPlano[]> {
  const { data, error } = await exigirCloud().from("plano_comentarios")
    .select("*").eq("plano_id", planoId).order("created_at", { ascending: true });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as Rec;
    return {
      id: str(row["id"]), planoId: str(row["plano_id"]), autorId: str(row["autor_id"]),
      autorNome: str(row["autor_nome"]), autorEmail: str(row["autor_email"]),
      mensagem: str(row["mensagem"]), createdAt: str(row["created_at"]),
    };
  });
}

export async function adicionarComentario(plano: PlanoAcao, mensagem: string, sessao: UserSession | null) {
  const client = exigirCloud();
  const texto = mensagem.trim();
  if (!texto) throw new Error("Escreva o comentário antes de enviar.");
  const autor = autorDe(sessao);
  const { data, error } = await client.from("plano_comentarios")
    .insert({ plano_id: plano.id, ...autor, mensagem: texto }).select("*").single();
  if (error) throw traduzErro(error);
  const row = data as unknown as Rec;
  // Comentário avisa responsável e seguidores (timeline tipo chat).
  await notificarPlano(client, destinatariosDoPlano(plano, autor.autor_email).map((d) => ({
    ...d, planoId: plano.id, tipo: "plano_comentario",
    titulo: `Novo comentário em ${plano.codigo || "uma ação"}`,
    mensagem: `${autor.autor_nome}: ${texto}`,
    autorNome: autor.autor_nome, autorEmail: autor.autor_email,
  }))).catch(() => undefined);
  return {
    id: str(row["id"]), planoId: str(row["plano_id"]), autorId: str(row["autor_id"]),
    autorNome: str(row["autor_nome"]), autorEmail: str(row["autor_email"]),
    mensagem: str(row["mensagem"]), createdAt: str(row["created_at"]),
  };
}

export async function listarHistorico(planoId: string): Promise<HistoricoPlano[]> {
  const { data, error } = await exigirCloud().from("plano_historico")
    .select("*").eq("plano_id", planoId).order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as Rec;
    return {
      id: str(row["id"]), planoId: str(row["plano_id"]), autorId: str(row["autor_id"]),
      autorNome: str(row["autor_nome"]), autorEmail: str(row["autor_email"]),
      campo: str(row["campo"]), de: str(row["de"]), para: str(row["para"]), createdAt: str(row["created_at"]),
    };
  });
}

export function emailDaSessao(sessao: UserSession | null): string {
  return (sessao?.email ?? "").trim().toLowerCase();
}

export function ehResponsavel(plano: PlanoAcao, sessao: UserSession | null): boolean {
  const email = emailDaSessao(sessao);
  if (email && plano.responsavelEmail.toLowerCase() === email) return true;
  const colab = (sessao?.colaboradorId ?? "").trim();
  return !!colab && plano.responsavelId === colab;
}

export function ehSeguidor(plano: PlanoAcao, sessao: UserSession | null): boolean {
  const email = emailDaSessao(sessao);
  if (email && plano.seguidores.some((e) => e.toLowerCase() === email)) return true;
  const colab = (sessao?.colaboradorId ?? "").trim();
  return !!colab && plano.seguidoresIds.includes(colab);
}
