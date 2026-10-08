import { renderAsync } from "docx-preview";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DocxProtegidoProps {
  /** Arquivo .docx baixado do bucket privado. */
  arquivo: Blob;
  altura?: string;
}

/**
 * Visualiza um Word (.docx) no navegador, com o layout do documento (tabelas, cores,
 * imagens), na mesma moldura do PDF. Sem botão de download e com o botão direito
 * bloqueado, igual ao PDF.
 */
export function DocxProtegido({ arquivo, altura = "65vh" }: DocxProtegidoProps) {
  const alvoRef = useRef<HTMLDivElement | null>(null);
  const [estado, setEstado] = useState<"abrindo" | "pronto" | "erro">("abrindo");

  useEffect(() => {
    let cancelado = false;
    const raiz = alvoRef.current;
    if (!raiz) return;
    raiz.replaceChildren();
    setEstado("abrindo");

    renderAsync(arquivo, raiz, undefined, {
      className: "docx-protegido",
      inWrapper: true,
      ignoreWidth: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(() => {
        if (!cancelado) setEstado("pronto");
      })
      .catch(() => {
        if (!cancelado) setEstado("erro");
      });

    return () => {
      cancelado = true;
    };
  }, [arquivo]);

  return (
    <div className="space-y-2" onContextMenu={(evento) => evento.preventDefault()}>
      {estado === "abrindo" ? (
        <div className="flex items-center justify-center gap-2 py-3 text-[13px] text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo documento…
        </div>
      ) : null}
      {estado === "erro" ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
          Não foi possível exibir este Word agora. Tente novamente mais tarde.
        </p>
      ) : null}
      <div
        ref={alvoRef}
        className="overflow-auto border border-[#D9E0EA] bg-[#E9EEF5]/40 p-3"
        style={{ height: altura, display: estado === "erro" ? "none" : undefined }}
        onContextMenu={(evento) => evento.preventDefault()}
      />
    </div>
  );
}
