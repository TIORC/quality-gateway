/**
 * Ocorrências — permissões e visibilidade.
 *
 * Papéis:
 *  - qualidade: setor Qualidade/liderança — vê tudo e age em qualquer etapa;
 *  - encarregado: responsável pela etapa atual — age somente nela;
 *  - solicitante: quem abriu — vê a linha do metrô simplificada, sem os
 *    detalhes internos de apuração/julgamento;
 *  - leitor: demais usuários — sem detalhes.
 */
import type { UserSession } from "@/lib/auth";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import type { Ocorrencia } from "@/lib/ocorrencias";

export type PapelOcorrencia = "qualidade" | "encarregado" | "solicitante" | "leitor";

export function papelNaOcorrencia(
  sessao: UserSession | null | undefined, o: Ocorrencia,
): PapelOcorrencia {
  if (!sessao) return "leitor";
  if (ehUsuarioDaQualidade(sessao)) return "qualidade";
  const email = (sessao.email ?? "").trim().toLowerCase();
  const colaborador = (sessao.colaboradorId ?? "").trim();
  const ehResponsavel =
    (!!o.responsavelEmail && o.responsavelEmail.toLowerCase() === email) ||
    (!!o.responsavelId && o.responsavelId === colaborador);
  if (ehResponsavel && o.status !== "encerrada") return "encarregado";
  const ehSolicitante =
    (!!o.abertaPorEmail && o.abertaPorEmail.toLowerCase() === email) ||
    (!!o.abertaPorId && o.abertaPorId === colaborador);
  if (ehSolicitante) return "solicitante";
  return "leitor";
}

/** Qualidade e encarregado veem a visão completa/detalhada. */
export function veVisaoCompleta(
  sessao: UserSession | null | undefined, o: Ocorrencia,
): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "encarregado";
}

/** Pode agir (aprovar/reprovar/…) na etapa atual da ocorrência. */
export function podeAgir(
  sessao: UserSession | null | undefined, o: Ocorrencia,
): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  if (o.status === "encerrada") return papel === "qualidade";
  return papel === "qualidade" || papel === "encarregado";
}

/** Pode comentar (solicitante acompanha e pode responder). */
export function podeComentar(
  sessao: UserSession | null | undefined, o: Ocorrencia,
): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel !== "leitor";
}

/** Movimentação manual e avaliação de eficácia: só a Qualidade. */
export function podeGerenciar(
  sessao: UserSession | null | undefined,
): boolean {
  return ehUsuarioDaQualidade(sessao);
}

/** Detalhes internos (respostas de etapa, histórico completo) — não para o solicitante. */
export function podeVerInternos(
  sessao: UserSession | null | undefined, o: Ocorrencia,
): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "encarregado";
}
