/**
 * Ocorrências — permissões e visibilidade.
 *
 * Papéis:
 *  - qualidade: setor Qualidade/liderança — vê tudo e age em qualquer etapa;
 *  - administrador: admin do sistema / nível Administrador — acompanha o
 *    andamento de todas as ocorrências em tempo real, em leitura (sem agir);
 *  - encarregado: responsável pela etapa atual — age somente nela;
 *  - solicitante: quem abriu — vê a linha do metrô simplificada e o resultado
 *    do julgamento (procedente / não-procedente);
 *  - leitor: demais usuários — sem detalhes.
 */
import type { UserSession } from "@/lib/auth";
import { ehAdministrador, ehUsuarioDaQualidade } from "@/lib/permissoes";
import type { Ocorrencia } from "@/lib/ocorrencias";

export type PapelOcorrencia =
  "qualidade" | "administrador" | "encarregado" | "solicitante" | "leitor";

export function papelNaOcorrencia(
  sessao: UserSession | null | undefined,
  o: Ocorrencia,
): PapelOcorrencia {
  if (!sessao) return "leitor";
  if (ehUsuarioDaQualidade(sessao)) return "qualidade";
  if (ehAdministrador(sessao)) return "administrador";
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

/** Qualidade, administradores e encarregados veem a visão completa/detalhada. */
export function veVisaoCompleta(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "administrador" || papel === "encarregado";
}

/** Pode agir (aprovar/reprovar/…) na etapa atual da ocorrência. */
export function podeAgir(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  if (o.status === "encerrada") return papel === "qualidade";
  return papel === "qualidade" || papel === "encarregado";
}

/** Pode comentar (solicitante acompanha e pode responder). */
export function podeComentar(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel !== "leitor";
}

/** Movimentação manual e avaliação de eficácia: só a Qualidade. */
export function podeGerenciar(sessao: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(sessao);
}

/** Detalhes internos (respostas de etapa, histórico completo) — não para o solicitante. */
export function podeVerInternos(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "administrador" || papel === "encarregado";
}

/**
 * Quem enxerga todas as ocorrências (Qualidade e administradores).
 * O colaborador comum vê apenas as que abriu (ou em que é responsável).
 */
export function veTodasAsOcorrencias(sessao: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(sessao) || ehAdministrador(sessao);
}

/** Pode excluir ocorrências: Qualidade e administradores. */
export function podeExcluir(sessao: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(sessao) || ehAdministrador(sessao);
}
