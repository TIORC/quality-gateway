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
import { NIVEL_GESTOR_QUALIDADE, normalizarSetor } from "@/lib/niveis-acesso";
import { ehAdministrador, ehUsuarioDaQualidade } from "@/lib/permissoes";
import type { Ocorrencia } from "@/lib/ocorrencias";

export type PapelOcorrencia =
  "qualidade" | "administrador" | "encarregado" | "solicitante" | "leitor";

/**
 * Opera as ocorrências (aprovar, reprovar, movimentar, avaliar eficácia): só o
 * Gestor da Qualidade e o setor da Qualidade. O Desenvolvedor do Sistema e os
 * administradores acompanham, mas não agem.
 */
export function podeOperarOcorrencias(sessao: UserSession | null | undefined): boolean {
  if (!sessao || ehAdministrador(sessao)) return false;
  return (
    sessao.nivelAcesso === NIVEL_GESTOR_QUALIDADE || normalizarSetor(sessao.setor) === "qualidade"
  );
}

/** A pessoa da sessão é o dono da tratativa (quem assumiu a ocorrência). */
export function ehDonoDaOcorrencia(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  if (!sessao) return false;
  const email = (sessao.email ?? "").trim().toLowerCase();
  const colaborador = (sessao.colaboradorId ?? "").trim();
  return (
    (!!o.donoQualidadeEmail && o.donoQualidadeEmail.toLowerCase() === email) ||
    (!!o.donoQualidadeId && o.donoQualidadeId === colaborador)
  );
}

/**
 * Operadores da Qualidade só agem na ocorrência que assumiram ("puxar tarefa")
 * e a acompanham até o encerramento. Encerrada: segue como antes (qualquer operador).
 */
function operaComoDono(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  return o.status === "encerrada" || ehDonoDaOcorrencia(sessao, o);
}

/** Pode puxar a ocorrência: operador da Qualidade, aberta e ainda sem dono (ou já é dele). */
export function podeAssumirOcorrencia(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  if (!podeOperarOcorrencias(sessao) || o.status === "encerrada") return false;
  return !o.donoQualidadeEmail || ehDonoDaOcorrencia(sessao, o);
}

/** Pode soltar a tratativa: só o dono, enquanto a ocorrência estiver aberta. */
export function podeLiberarOcorrencia(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  return o.status !== "encerrada" && ehDonoDaOcorrencia(sessao, o);
}

export function papelNaOcorrencia(
  sessao: UserSession | null | undefined,
  o: Ocorrencia,
): PapelOcorrencia {
  if (!sessao) return "leitor";
  if (podeOperarOcorrencias(sessao)) return "qualidade";
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
  if (papel === "qualidade") return operaComoDono(sessao, o);
  if (o.status === "encerrada") return false;
  return papel === "encarregado";
}

/** Pode comentar (solicitante acompanha e pode responder). */
export function podeComentar(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel !== "leitor";
}

/** Movimentação manual e avaliação de eficácia: só a Qualidade, na ocorrência que assumiu. */
export function podeGerenciar(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  return podeOperarOcorrencias(sessao) && operaComoDono(sessao, o);
}

/** Move a ocorrência de etapa: dono da tratativa (Qualidade) e Desenvolvedor do Sistema. */
export function podeMoverEtapa(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  return (podeOperarOcorrencias(sessao) && operaComoDono(sessao, o)) || ehAdministrador(sessao);
}

/** Define a prioridade da ocorrência: Qualidade e Desenvolvedor do Sistema. */
export function podeDefinirPrioridade(sessao: UserSession | null | undefined): boolean {
  return podeOperarOcorrencias(sessao) || ehAdministrador(sessao);
}

/** Detalhes internos (respostas de etapa, histórico completo) — não para o solicitante. */
export function podeVerInternos(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "administrador" || papel === "encarregado";
}

/**
 * Quem enxerga todas as ocorrências (aba "Todas as Ocorrências"): quem opera,
 * o Desenvolvedor do Sistema e os administradores, somente para acompanhar.
 * O colaborador comum vê apenas as que abriu (ou em que é responsável).
 */
export function veTodasAsOcorrencias(sessao: UserSession | null | undefined): boolean {
  return podeOperarOcorrencias(sessao) || ehAdministrador(sessao);
}

/** Pode excluir ocorrências: Qualidade e administradores. */
export function podeExcluir(sessao: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(sessao) || ehAdministrador(sessao);
}

/**
 * Configurar tipos de ocorrência, fluxos e formulários: somente o Gestor da
 * Qualidade e o Desenvolvedor do Sistema.
 */
export function podeConfigurarOcorrencias(sessao: UserSession | null | undefined): boolean {
  if (!sessao) return false;
  return (
    sessao.nivelAcesso === "Gestor da Qualidade" ||
    sessao.nivelAcesso === "Desenvolvedor do Sistema"
  );
}
