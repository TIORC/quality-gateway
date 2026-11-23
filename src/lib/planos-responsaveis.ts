/**
 * Quem pode ser escolhido como Responsável por uma ação de plano.
 *
 * Elegíveis:
 * - a Qualidade (setor Qualidade, Gestor, Auxiliar, Desenvolvedor ou Coordenador da Qualidade);
 * - os líderes de setor (nível "Líder de setor");
 * - quem está no grupo de acesso "Responsáveis por processos" (ex.: Angel, Yasmin,
 *   Jusirlene, a equipe da Recepção). O grupo é cadastrado em Configurações.
 *
 * Os demais colaboradores continuam podendo ser seguidores da ação.
 */
import { NIVEL_AUXILIAR_QUALIDADE, NIVEL_DESENVOLVEDOR_SISTEMA, NIVEL_GESTOR_QUALIDADE, NIVEL_LIDER_SETOR, normalizarSetor } from "@/lib/niveis-acesso";
import type { Colaborador } from "@/lib/dados";
import type { UserSession } from "@/lib/auth";
import type { PlanoAcao } from "@/lib/planos";
import { ehAdministrador } from "@/lib/permissoes";

/** Nome do grupo de acesso que marca os responsáveis por processos. */
export const GRUPO_RESPONSAVEIS_PROCESSO = "Responsáveis por processos";

function estaNoGrupo(grupos: string | undefined, nomeGrupo: string): boolean {
  const alvo = normalizarSetor(nomeGrupo);
  return (grupos ?? "")
    .split(",")
    .some((item) => normalizarSetor(item) === alvo);
}

export function podeSerResponsavelAcao(colaborador: Colaborador): boolean {
  const nivel = colaborador.nivelAcesso ?? "";
  if (normalizarSetor(colaborador.setor) === "qualidade") return true;
  if (
    nivel === NIVEL_GESTOR_QUALIDADE ||
    nivel === NIVEL_AUXILIAR_QUALIDADE ||
    nivel === NIVEL_DESENVOLVEDOR_SISTEMA ||
    normalizarSetor(colaborador.cargo) === "coordenador da qualidade"
  ) return true;
  if (nivel === NIVEL_LIDER_SETOR) return true;
  return estaNoGrupo(colaborador.grupos, GRUPO_RESPONSAVEIS_PROCESSO);
}

/**
 * Quem pode transferir a responsabilidade de uma ação: Gestor da Qualidade,
 * setor da Qualidade e Desenvolvedor do Sistema. Os demais só transferem a
 * ação quando eles mesmos são o responsável atual.
 */
export function podeTransferirResponsavel(
  sessao: UserSession | null | undefined,
  plano: Pick<PlanoAcao, "responsavelId" | "responsavelEmail">,
): boolean {
  if (!sessao) return false;
  if (sessao.nivelAcesso === NIVEL_GESTOR_QUALIDADE || ehAdministrador(sessao)) return true;
  if (normalizarSetor(sessao.setor) === "qualidade") return true;
  const colaborador = (sessao.colaboradorId ?? "").trim();
  if (colaborador && plano.responsavelId === colaborador) return true;
  const email = (sessao.email ?? "").trim().toLowerCase();
  return !!email && plano.responsavelEmail.toLowerCase() === email;
}
