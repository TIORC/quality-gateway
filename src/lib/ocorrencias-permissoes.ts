/**
 * Ocorrências — permissões e visibilidade.
 *
 * Papéis:
 *  - qualidade: setor Qualidade/liderança — vê tudo e age em qualquer etapa;
 *  - administrador: admin do sistema / nível Administrador — acompanha o
 *    andamento de todas as ocorrências em tempo real, em leitura (sem agir);
 *  - encarregado: responsável pela etapa atual — age somente nela;
 *  - lider: líder de setor de quem abriu (ou de setor envolvido) — acompanha em leitura;
 *  - solicitante: quem abriu — vê a linha do metrô simplificada e o resultado
 *    do julgamento (procedente / não-procedente);
 *  - leitor: demais usuários — sem detalhes.
 */
import type { UserSession } from "@/lib/auth";
import { NIVEL_GESTOR_QUALIDADE, normalizarSetor } from "@/lib/niveis-acesso";
import { ehAdministrador, ehUsuarioDaQualidade, liderDoSetor } from "@/lib/permissoes";
import { setoresEnvolvidosDe, type Ocorrencia } from "@/lib/ocorrencias";

export type PapelOcorrencia =
  "qualidade" | "administrador" | "encarregado" | "lider" | "solicitante" | "leitor";

/**
 * Opera as ocorrências (puxar, aprovar, reprovar, movimentar, avaliar eficácia):
 * o Gestor da Qualidade, o setor da Qualidade e o Desenvolvedor do Sistema.
 */
export function podeOperarOcorrencias(sessao: UserSession | null | undefined): boolean {
  if (!sessao) return false;
  if (ehAdministrador(sessao)) return true;
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
 * O Desenvolvedor do Sistema opera livremente, sem precisar puxar a tratativa.
 */
function operaComoDono(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  return o.status === "encerrada" || ehAdministrador(sessao) || ehDonoDaOcorrencia(sessao, o);
}

/** Pode puxar a ocorrência: operador da Qualidade, aberta e ainda sem dono (ou já é dele). */
export function podeAssumirOcorrencia(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  if (!podeOperarOcorrencias(sessao) || o.status === "encerrada") return false;
  return !o.donoQualidadeEmail || ehDonoDaOcorrencia(sessao, o);
}

/**
 * Pode sugerir ação do plano de ação: a Qualidade (que valida e encaminha) e a liderança
 * do setor de quem abriu. Sugestões do líder entram como "Sugestão do líder" até a validação.
 */
export function podeSugerirAcao(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  if (o.status === "encerrada") return false;
  return podeOperarOcorrencias(sessao) || papelNaOcorrencia(sessao, o) === "lider";
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
  // Líder de setor acompanha (somente leitura) as ocorrências dos setores que lidera.
  const ehLiderDaEquipe =
    liderDoSetor(sessao, o.abertaPorSetor) ||
    setoresEnvolvidosDe(o).some((s) => liderDoSetor(sessao, s));
  if (ehLiderDaEquipe) return "lider";
  const ehSolicitante =
    (!!o.abertaPorEmail && o.abertaPorEmail.toLowerCase() === email) ||
    (!!o.abertaPorId && o.abertaPorId === colaborador);
  if (ehSolicitante) return "solicitante";
  return "leitor";
}

/** Qualidade, administradores, encarregados e líderes da equipe veem a visão completa/detalhada. */
export function veVisaoCompleta(sessao: UserSession | null | undefined, o: Ocorrencia): boolean {
  const papel = papelNaOcorrencia(sessao, o);
  return papel === "qualidade" || papel === "administrador" || papel === "encarregado" || papel === "lider";
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
  return papel === "qualidade" || papel === "administrador" || papel === "encarregado" || papel === "lider";
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
