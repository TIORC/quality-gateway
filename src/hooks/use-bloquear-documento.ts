import { useEffect } from "react";

const TECLAS_BLOQUEADAS = new Set(["p", "s", "c", "x", "u"]);

function alvoEditavel(alvo: unknown): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return (
    alvo.isContentEditable ||
    alvo.tagName === "INPUT" ||
    alvo.tagName === "TEXTAREA" ||
    alvo.tagName === "SELECT"
  );
}

/**
 * Bloqueia atalhos de "salvar/imprimir/copiar" enquanto um documento
 * (POP/Política) estiver aberto. Evita Ctrl+P, Ctrl+S, Ctrl+C/X e Ctrl+U,
 * preservando a digitação/cópia dentro de campos de texto.
 */
export function useBloquearAtalhosDocumento(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return undefined;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (alvoEditavel(evento.target)) return;
      const atalhoComModificador = evento.ctrlKey || evento.metaKey;
      if (!atalhoComModificador) return;
      const tecla = (evento.key || "").toLowerCase();
      if (TECLAS_BLOQUEADAS.has(tecla)) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    };

    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [ativo]);
}
