import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export const ITENS_POR_PAGINA = 50;

/**
 * Paginação em memória. `reiniciarEm` lista os valores (busca, filtros…) que
 * devem devolver a listagem para a página 1 quando mudarem.
 */
export function usePaginacao<T>(itens: T[], reiniciarEm: unknown[] = []) {
  const [pagina, setPagina] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPagina(1), reiniciarEm);

  const totalPaginas = Math.max(1, Math.ceil(itens.length / ITENS_POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const inicio = (atual - 1) * ITENS_POR_PAGINA;

  return {
    itensDaPagina: itens.slice(inicio, inicio + ITENS_POR_PAGINA),
    pagina: atual,
    totalPaginas,
    total: itens.length,
    inicio: itens.length === 0 ? 0 : inicio + 1,
    fim: Math.min(inicio + ITENS_POR_PAGINA, itens.length),
    irParaPagina: setPagina,
  };
}

/** Números de página a exibir; `null` representa reticências. */
function paginasVisiveis(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas = new Set([1, total, atual - 1, atual, atual + 1]);
  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const saida: (number | null)[] = [];
  ordenadas.forEach((p, i) => {
    const anterior = ordenadas[i - 1];
    if (anterior !== undefined && p - anterior > 1) saida.push(null);
    saida.push(p);
  });
  return saida;
}

interface PaginacaoProps {
  pagina: number;
  totalPaginas: number;
  onMudar: (pagina: number) => void;
}

/** Botões 1 · 2 · 3 … — só aparece quando há mais de uma página. */
export function Paginacao({ pagina, totalPaginas, onMudar }: PaginacaoProps) {
  if (totalPaginas <= 1) return null;

  const base =
    "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[13px] font-medium transition";

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-center gap-1 border-t border-[#E9EEF5] p-3"
    >
      <button
        type="button"
        aria-label="Página anterior"
        disabled={pagina === 1}
        onClick={() => onMudar(pagina - 1)}
        className={`${base} border-[#D9E0EA] bg-white text-[#64748B] hover:bg-[#EEF2F7] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {paginasVisiveis(pagina, totalPaginas).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-[#94A3B8]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === pagina ? "page" : undefined}
            onClick={() => onMudar(p)}
            className={`${base} ${
              p === pagina
                ? "border-[#312E81] bg-[#312E81] text-white"
                : "border-[#D9E0EA] bg-white text-[#1F2937] hover:bg-[#EEF2F7]"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Próxima página"
        disabled={pagina === totalPaginas}
        onClick={() => onMudar(pagina + 1)}
        className={`${base} border-[#D9E0EA] bg-white text-[#64748B] hover:bg-[#EEF2F7] disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
