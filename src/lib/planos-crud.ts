import { exigirCloud } from "@/integrations/supabase/client";
import type { UserSession } from "@/lib/auth";
import type { PlanoDeAcaoUpdate } from "@/integrations/supabase/db-types";
import { traduzErro } from "@/lib/organizacao";
import { planoDoRow } from "@/lib/planos-base";
import {
  autorDe, destinatariosDoPlano, notificarPlano, notificacaoDeAlteracao,
  proximoCodigo, rotuloOrigem, type NovoPlanoInput,
} from "@/lib/planos-mutar";
import type { PlanoAcao, StatusAcao } from "@/lib/planos";
import { STATUS_ACAO_LABELS, formatarPrazo } from "@/lib/planos";
import { listarPlanos } from "@/lib/planos-base";

type Rec = Record<string, unknown>;

export async function criarPlano(input: NovoPlanoInput, sessao: UserSession | null): Promise<PlanoAcao> {
  const client = exigirCloud();
  const existentes = await listarPlanos().catch(() => [] as PlanoAcao[]);
  const codigo = proximoCodigo(existentes);
  const origemFinal = rotuloOrigem(input.origem, input.origemOutros);
  const { data, error } = await client.from("planos_de_acao").insert({
    codigo, titulo: input.titulo.trim(), descricao: input.descricao.trim(),
    detalhamento: input.descricao.trim(), status: "nao_iniciado",
    origem: origemFinal, origem_outros: input.origemOutros?.trim() ?? "",
    setor: input.setor, prioridade: input.prioridade,
    responsavel_id: input.responsavelId, responsavel_nome: input.responsavelNome,
    responsavel_email: input.responsavelEmail.toLowerCase(),
    seguidores: input.seguidoresEmails, seguidores_ids: input.seguidoresIds,
    prazo: input.prazo, progresso: 0,
    vinculo_tipo: input.vinculoTipo ?? "", vinculo_id: input.vinculoId ?? "",
  }).select("*").single();
  if (error) throw traduzErro(error);
  const plano = planoDoRow(data as unknown as Rec);
  const autor = autorDe(sessao);
  await client.from("plano_historico").insert({
    plano_id: plano.id, ...autor, campo: "Criação", de: "", para: `Criada ${codigo}`,
  });
  // Responsável e seguidores são avisados no sino do Painel.
  await notificarPlano(client, destinatariosDoPlano(plano, autor.autor_email).map((d) => ({
    ...d, planoId: plano.id,
    titulo: `Nova ação ${codigo} atribuída a você`,
    mensagem: `${plano.titulo} · prazo ${formatarPrazo(plano.prazo)} · prioridade ${plano.prioridade}`,
    tipo: "plano_criado", autorNome: autor.autor_nome, autorEmail: autor.autor_email,
  }))).catch(() => undefined);
  return plano;
}

export interface AtualizacaoPlano {
  titulo?: string; descricao?: string; origem?: string; setor?: string;
  responsavelId?: string; responsavelNome?: string; responsavelEmail?: string;
  seguidoresIds?: string[]; seguidoresEmails?: string[];
  prazo?: string | null; prioridade?: string; status?: StatusAcao;
  progresso?: number; vinculoTipo?: string; vinculoId?: string;
  anexos?: PlanoAcao["anexos"];
}

/** Valor legível para o histórico de alterações. */
function exibido(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (campo === "Status") return STATUS_ACAO_LABELS[v as StatusAcao] ?? String(v);
  if (campo === "Prazo") return formatarPrazo(v as string | null);
  if (campo === "Progresso") return `${v}%`;
  if (campo === "Anexos") return `${v} anexo(s)`;
  return String(v);
}

export async function atualizarPlano(plano: PlanoAcao, patch: AtualizacaoPlano, sessao: UserSession | null): Promise<PlanoAcao> {
  const client = exigirCloud();
  const u: PlanoDeAcaoUpdate = {};
  if (patch.titulo !== undefined) { u.titulo = patch.titulo.trim(); u.descricao = patch.titulo.trim(); }
  if (patch.descricao !== undefined) u.detalhamento = patch.descricao;
  if (patch.origem !== undefined) u.origem = patch.origem;
  if (patch.setor !== undefined) u.setor = patch.setor;
  if (patch.responsavelId !== undefined) u.responsavel_id = patch.responsavelId;
  if (patch.responsavelNome !== undefined) u.responsavel_nome = patch.responsavelNome;
  if (patch.responsavelEmail !== undefined) u.responsavel_email = patch.responsavelEmail.toLowerCase();
  if (patch.seguidoresIds !== undefined) u.seguidores_ids = patch.seguidoresIds;
  if (patch.seguidoresEmails !== undefined) u.seguidores = patch.seguidoresEmails;
  if (patch.prazo !== undefined) u.prazo = patch.prazo;
  if (patch.prioridade !== undefined) u.prioridade = patch.prioridade;
  if (patch.status !== undefined) {
    u.status = patch.status;
    if (patch.status === "concluida") {
      u.progresso = 100;
      u.concluida_em = new Date().toISOString();
    } else if (plano.status === "concluida") {
      u.concluida_em = null;
    }
  }
  if (patch.progresso !== undefined) u.progresso = Math.max(0, Math.min(100, Math.round(patch.progresso)));
  if (patch.vinculoTipo !== undefined) u.vinculo_tipo = patch.vinculoTipo;
  if (patch.vinculoId !== undefined) u.vinculo_id = patch.vinculoId;
  if (patch.anexos !== undefined) u.anexos = patch.anexos;
  const { data, error } = await client.from("planos_de_acao")
    .update(u).eq("id", plano.id).select("*").single();
  if (error) throw traduzErro(error);
  const atualizado = planoDoRow(data as unknown as Rec);
  const autor = autorDe(sessao);

  // Auditoria (histórico): quem mudou status, prazo, responsável, prioridade etc.
  const eventos: { campo: string; de: string; para: string }[] = [];
  function registrar(campo: string, de: unknown, para: unknown) {
    const antes = exibido(campo, de);
    const depois = exibido(campo, para);
    if (antes !== depois) eventos.push({ campo, de: antes, para: depois });
  }
  if (patch.status !== undefined) registrar("Status", plano.status, patch.status);
  if (patch.prazo !== undefined) registrar("Prazo", plano.prazo, patch.prazo);
  if (patch.responsavelId !== undefined) {
    registrar("Responsável", plano.responsavelNome, patch.responsavelNome ?? patch.responsavelEmail ?? "");
  }
  if (patch.progresso !== undefined) registrar("Progresso", plano.progresso, patch.progresso);
  if (patch.prioridade !== undefined) registrar("Prioridade", plano.prioridade, patch.prioridade);
  if (patch.setor !== undefined) registrar("Setor", plano.setor, patch.setor);
  if (patch.origem !== undefined) registrar("Origem", plano.origem, patch.origem);
  if (patch.vinculoId !== undefined) registrar("Vinculação", plano.vinculoId, patch.vinculoId);
  if (patch.anexos !== undefined) registrar("Anexos", plano.anexos.length, patch.anexos.length);
  if (eventos.length) {
    await client.from("plano_historico")
      .insert(eventos.map((e) => ({ plano_id: plano.id, ...autor, ...e })));
  }

  // Avisa responsável/seguidores do que mudou (exceto quem fez a alteração).
  const aviso = notificacaoDeAlteracao(plano, atualizado, eventos);
  if (aviso) {
    await notificarPlano(client, destinatariosDoPlano(atualizado, autor.autor_email).map((d) => ({
      ...d, planoId: atualizado.id, titulo: aviso.titulo, mensagem: aviso.mensagem,
      tipo: "plano_atualizado", autorNome: autor.autor_nome, autorEmail: autor.autor_email,
    }))).catch(() => undefined);
  }
  return atualizado;
}

export async function excluirPlano(id: string): Promise<void> {
  const { error } = await exigirCloud().from("planos_de_acao").delete().eq("id", id);
  if (error) throw traduzErro(error);
}
