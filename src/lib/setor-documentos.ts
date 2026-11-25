/**
 * Helpers compartilhados de visibilidade de documentos (POPs e políticas) por setor.
 */

import { normalizarSetor, politicaDoSetor, politicaEhGeral, prefixoDoSetor } from "@/lib/niveis-acesso";
import type { Pop, SetorPop } from "@/lib/pops";

/** Id do setor "Processos Gerais" (card geral dos POPs). */
export const SETOR_GERAL_ID = "geral";

/**
 * Regra "Todos os setores": um POP marcado como todos os setores é um POP geral.
 * Qualquer seleção que inclua Processos Gerais vira somente ele.
 */
export function setoresEfetivosDoPop(selecionados: string[]): string[] {
  return selecionados.includes(SETOR_GERAL_ID) ? [SETOR_GERAL_ID] : selecionados;
}

/**
 * POP geral: código GER-*, setorId "geral" ou marcado como "Todos os setores".
 * POPs gerais aparecem em Processos Gerais e são visíveis a todos os níveis de acesso.
 */
export function popEhGeral(
  pop: Pick<Pop, "codigo" | "setorId"> & { setoresResponsaveis?: string[] },
): boolean {
  return (
    pop.codigo.startsWith("GER") ||
    pop.setorId === SETOR_GERAL_ID ||
    (pop.setoresResponsaveis ?? []).includes(SETOR_GERAL_ID)
  );
}

/**
 * Indica se o POP pertence ao setor do usuário (prefixo de código, vínculos
 * em pop_setores, departamento ou setores responsáveis).
 */
export function popDoSetorDoUsuario(
  pop: Pop,
  setorUsuario: string | null | undefined,
  setores: SetorPop[],
): boolean {
  if (popEhGeral(pop)) return true;

  const setorNorm = normalizarSetor(setorUsuario);
  if (!setorNorm) return false;

  const prefixo = prefixoDoSetor(setorUsuario ?? "");
  if (prefixo && pop.codigo.startsWith(prefixo)) return true;

  const setorIdUsuario = setores.find((item) => normalizarSetor(item.nome) === setorNorm)?.id;
  if (setorIdUsuario) {
    if (pop.setorId === setorIdUsuario) return true;
    if (pop.setoresResponsaveis.includes(setorIdUsuario)) return true;
  }

  if (normalizarSetor(pop.departamento) === setorNorm) return true;

  const nomeSetorPop = setores.find((item) => item.id === pop.setorId)?.nome;
  if (normalizarSetor(nomeSetorPop) === setorNorm) return true;

  for (const id of pop.setoresResponsaveis) {
    const nome = setores.find((item) => item.id === id)?.nome;
    if (normalizarSetor(nome) === setorNorm) return true;
  }

  return false;
}

/** Política visível ao setor do usuário (gerais ou setor listado). */
export function politicaVisivelPorSetor(
  politica: { setores: string[] },
  setorUsuario: string | null | undefined,
): boolean {
  const setores = politica.setores ?? [];
  if (politicaEhGeral(setores)) return true;
  return politicaDoSetor(setores, setorUsuario ?? "");
}
