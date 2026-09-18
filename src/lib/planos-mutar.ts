import { exigirCloud } from "@/integrations/supabase/client";
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import { ORIGEM_OUTROS, type PlanoAcao } from "@/lib/planos";

export interface NovoPlanoInput {
  titulo: string; descricao: string; origem: string; origemOutros?: string;
  setor: string; responsavelId: string; responsavelNome: string; responsavelEmail: string;
  seguidoresIds: string[]; seguidoresEmails: string[];
  prazo: string | null; prioridade: string; vinculoTipo?: string; vinculoId?: string;
}

/** "Outros" + detalhe livre vira "Outros: <detalhe>" no rótulo da origem. */
export function rotuloOrigem(origem: string, detalhe?: string): string {
  const texto = (detalhe ?? "").trim();
  if (origem === ORIGEM_OUTROS && texto) return `${ORIGEM_OUTROS}: ${texto}`;
  return origem || ORIGEM_OUTROS;
}

export function proximoCodigo(planos: PlanoAcao[]): string {
  const ano = new Date().getFullYear();
  let max = 0;
  for (const p of planos) {
    const m = /^PA-(\d{4})-(\d+)$/.exec(p.codigo);
    if (!m) continue;
    const anoM = m[1];
    const numM = m[2];
    if (anoM === undefined || numM === undefined) continue;
    if (Number(anoM) === ano) max = Math.max(max, Number(numM));
  }
  return `PA-${ano}-${String(max + 1).padStart(3, "0")}`;
}

export function autorDe(sessao: UserSession | null) {
  return {
    autor_id: sessao?.colaboradorId ?? sessao?.id ?? "",
    autor_nome: sessao?.nome ?? "",
    autor_email: (sessao?.email ?? "").toLowerCase(),
  };
}

/** Nome de exibição derivado do e-mail (fallback quando não há cadastro). */
export function nomeDoEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!local) return email;
  return local.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
}

export interface DestinatarioNotificacao { email: string; nome: string }

/**
 * Responsável + seguidores de uma ação, sem duplicatas e sem o autor da
 * alteração (quem agiu não precisa ser notificado do próprio ato).
 */
export function destinatariosDoPlano(plano: PlanoAcao, excluirEmail?: string): DestinatarioNotificacao[] {
  const excluido = (excluirEmail ?? "").trim().toLowerCase();
  const candidatos: DestinatarioNotificacao[] = [
    { email: plano.responsavelEmail, nome: plano.responsavelNome },
    ...plano.seguidores.map((email) => ({ email, nome: nomeDoEmail(email) })),
  ];
  const vistos = new Set<string>();
  const lista: DestinatarioNotificacao[] = [];
  for (const c of candidatos) {
    const email = c.email.trim().toLowerCase();
    if (!email.includes("@") || email === excluido || vistos.has(email)) continue;
    vistos.add(email);
    lista.push({ email, nome: c.nome || nomeDoEmail(email) });
  }
  return lista;
}

/** Texto do aviso de atualização (status/prazo/responsável/progresso…). */
export function notificacaoDeAlteracao(
  antes: PlanoAcao, depois: PlanoAcao, eventos: { campo: string; de: string; para: string }[],
): { titulo: string; mensagem: string } | null {
  const relevantes = eventos.filter((e) => e.campo !== "Anexos");
  const trocaResponsavel = eventos.find((e) => e.campo === "Responsável");
  const mudancaStatus = eventos.find((e) => e.campo === "Status");
  const titulo = trocaResponsavel
    ? `Você é o novo responsável por ${depois.codigo || "uma ação"}`
    : mudancaStatus
      ? `${depois.codigo || "Ação"}: ${mudancaStatus.para}`
      : `Atualização em ${depois.codigo || "uma ação"}`;
  if (!relevantes.length) return null;
  const mensagem = relevantes.map((e) => `${e.campo}: ${e.de} → ${e.para}`).join(" · ");
  return { titulo, mensagem: `${depois.titulo} · ${mensagem}` };
}

export async function notificarPlano(
  client: ReturnType<typeof exigirCloud>,
  itens: { email: string; nome: string; titulo: string; mensagem: string; tipo: string; planoId: string; autorNome: string; autorEmail: string }[],
) {
  const validos = itens.filter((i) => i.email.includes("@"));
  if (!validos.length) return;
  const { error } = await client.from("notificacoes").insert(
    validos.map((i) => ({
      destinatario_email: i.email.toLowerCase(),
      destinatario_nome: i.nome,
      titulo: i.titulo,
      mensagem: i.mensagem,
      tipo: i.tipo,
      plano_id: i.planoId,
      autor_nome: i.autorNome,
      autor_email: i.autorEmail,
    })),
  );
  if (error) throw traduzErro(error);
}

