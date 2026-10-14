/**
 * Logs de atividade dos documentos (POPs e políticas): adições, edições,
 * movimentações (aprovações e mudanças de status) e exclusões.
 *
 * Fonte: `public.logs_atividade`. A leitura fica restrita à página de logs
 * (ver `podeVerLogs` em `src/lib/permissoes.ts`).
 */

import { exigirCloud } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getSession } from "@/lib/auth";

export type AcaoLog = "adicionado" | "editado" | "movimentado" | "excluido";
export type EntidadeLog = "pop" | "politica";

export interface LogAtividade {
  id: string;
  criadoEm: string;
  acao: AcaoLog;
  entidade: EntidadeLog;
  entidadeId: string;
  codigo: string;
  titulo: string;
  detalhe: string;
  dados: Record<string, unknown>;
  atorNome: string;
  atorEmail: string;
}

export interface EntradaLog {
  acao: AcaoLog;
  entidade: EntidadeLog;
  entidadeId: string;
  codigo?: string;
  titulo?: string;
  detalhe?: string;
  /** Conteúdo guardado no registro (ex.: documento excluído). */
  dados?: Record<string, unknown>;
}

/**
 * Registra um evento de atividade com o usuário logado como autor. Falhas são
 * apenas reportadas no console: o log não pode impedir a ação principal.
 */
export async function registrarLog(entrada: EntradaLog): Promise<void> {
  const sessao = getSession();
  try {
    const { error } = await exigirCloud()
      .from("logs_atividade")
      .insert({
        acao: entrada.acao,
        entidade: entrada.entidade,
        entidade_id: entrada.entidadeId,
        codigo: entrada.codigo ?? "",
        titulo: entrada.titulo ?? "",
        detalhe: entrada.detalhe ?? "",
        dados: (entrada.dados ?? {}) as Json,
        ator_id: sessao?.colaboradorId || sessao?.id || "",
        ator_nome: sessao?.nome ?? "",
        ator_email: sessao?.email ?? "",
      });
    if (error) console.warn("Não foi possível registrar o log de atividade:", error.message);
  } catch (erro) {
    console.warn("Não foi possível registrar o log de atividade:", erro);
  }
}

/** Lista os eventos mais recentes (o limite evita carregar o histórico inteiro de uma vez). */
export async function listarLogs(limite = 500): Promise<LogAtividade[]> {
  const { data, error } = await exigirCloud()
    .from("logs_atividade")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    criadoEm: row.created_at,
    acao: row.acao as AcaoLog,
    entidade: row.entidade as EntidadeLog,
    entidadeId: row.entidade_id,
    codigo: row.codigo,
    titulo: row.titulo,
    detalhe: row.detalhe,
    dados: (row.dados ?? {}) as Record<string, unknown>,
    atorNome: row.ator_nome,
    atorEmail: row.ator_email,
  }));
}
