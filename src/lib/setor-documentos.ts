/**
 * Helpers compartilhados de visibilidade de documentos (POPs e políticas) por setor.
 */

import { normalizarSetor, politicaDoSetor, politicaEhGeral, prefixoDoSetor } from "@/lib/niveis-acesso";
import type { Pop, SetorPop } from "@/lib/pops";

/** POP geral (código GER-* ou setorId "geral"). */
export function popEhGeral(pop: Pick<Pop, "codigo" | "setorId">): boolean {
  return pop.codigo.startsWith("GER") || pop.setorId === "geral";
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
