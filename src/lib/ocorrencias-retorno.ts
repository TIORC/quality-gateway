/**
 * Retorno da Qualidade não visto: ocorrências encerradas de quem abriu, que a pessoa
 * ainda não abriu neste navegador. Alimenta o contador ao lado de "Ocorrencias" no menu.
 */
import type { UserSession } from "@/lib/auth";
import type { Ocorrencia } from "@/lib/ocorrencias";

const CHAVE_VISTOS = "quality-gateway:ocorrencias-retorno-visto";

/** Disparado quando um retorno é marcado como visto, para o menu recontar. */
export const EVENTO_RETORNO_VISTO = "ocorrencias-retorno-visto";

function lerVistos(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_VISTOS) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Marca o retorno desta ocorrência como visto neste navegador. */
export function marcarRetornoVisto(o: Ocorrencia): void {
  try {
    const vistos = lerVistos();
    vistos[o.id] = o.encerradaEm ?? "";
    window.localStorage.setItem(CHAVE_VISTOS, JSON.stringify(vistos));
    window.dispatchEvent(new Event(EVENTO_RETORNO_VISTO));
  } catch {
    // Sem armazenamento local o aviso continua aparecendo; não é um erro para o usuário.
  }
}

/** Quantidade de retornos encerrados, de quem abriu, ainda não vistos neste navegador. */
export function contarRetornosNaoVistos(
  lista: Ocorrencia[],
  sessao: UserSession | null | undefined,
): number {
  if (!sessao) return 0;
  const email = (sessao.email ?? "").trim().toLowerCase();
  const colaborador = (sessao.colaboradorId ?? "").trim();
  const vistos = lerVistos();
  return lista.filter((o) => {
    if (o.status !== "encerrada") return false;
    const ehDeQuemAbriu =
      (!!email && o.abertaPorEmail.trim().toLowerCase() === email) ||
      (!!o.abertaPorId && o.abertaPorId === colaborador);
    return ehDeQuemAbriu && vistos[o.id] !== (o.encerradaEm ?? "");
  }).length;
}
