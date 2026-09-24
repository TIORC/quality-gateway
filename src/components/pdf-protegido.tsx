import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfProtegidoProps {
  /** URL assinada (ou pública) do arquivo PDF. */
  url: string;
  titulo: string;
  altura?: string;
}

/**
 * Visualiza um PDF em <canvas> (via PDF.js) — sem iframe/plugin do navegador.
 * Isso elimina os menus "Salvar como…" / "Imprimir" do botão direito e o
 * download pelo visualizador padrão. O botão direito é bloqueado na página;
 * se a renderização falhar (ex.: rede/CORS bloqueada), cai para o iframe antigo.
 */
export function PdfProtegido({ url, titulo, altura = "65vh" }: PdfProtegidoProps) {
  const [estado, setEstado] = useState<"abrindo" | "renderizando" | "pronto" | "erro">("abrindo");
  const [paginas, setPaginas] = useState(0);
  const alvoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    const raiz = alvoRef.current;
    if (raiz) raiz.replaceChildren();
    setEstado("abrindo");
    setPaginas(0);

    (async () => {
      try {
        if (!url) throw new Error("Sem URL do documento");
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`Falha ao carregar (HTTP ${resposta.status})`);
        const dados = await resposta.arrayBuffer();
        if (cancelado) return;
        const pdf = await getDocument({ data: new Uint8Array(dados) }).promise;
        if (cancelado) return;

        setEstado("renderizando");
        const raizAtual = alvoRef.current;
        if (!raizAtual) return;
        raizAtual.replaceChildren();

        const larguraAlvo = Math.max(600, raizAtual.clientWidth || 794);
        const dpr = window.devicePixelRatio || 1;
        for (let numero = 1; numero <= pdf.numPages; numero++) {
          if (cancelado) return;
          const pagina = await pdf.getPage(numero);
          const base = pagina.getViewport({ scale: 1 });
          const escala = (larguraAlvo / base.width) * dpr;
          const viewport = pagina.getViewport({ scale: escala });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block w-full rounded-md bg-white shadow-sm ring-1 ring-[#E9EEF5]";
          raizAtual.appendChild(canvas);
          await pagina.render({ canvas, viewport }).promise;
          if (!cancelado) setPaginas(numero);
        }
        if (!cancelado) setEstado("pronto");
      } catch {
        if (!cancelado) setEstado("erro");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [url]);

  return (
    <div className="space-y-2" onContextMenu={(evento) => evento.preventDefault()}>
      {estado === "erro" ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          title={`Visualização de ${titulo}`}
          className="h-[65vh] w-full bg-white"
        />
      ) : (
        <>
          {estado !== "pronto" ? (
            <div className="flex items-center justify-center gap-2 py-3 text-[13px] text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {estado === "renderizando"
                ? `Renderizando página ${paginas || 1}…`
                : "Abrindo documento…"}
            </div>
          ) : (
            <p className="text-[12px] font-medium text-[#64748B]">
              {paginas} {paginas === 1 ? "página" : "páginas"} renderizadas
            </p>
          )}
          <div
            ref={alvoRef}
            className="space-y-3 overflow-auto border border-[#D9E0EA] bg-[#E9EEF5]/40 p-3"
            style={{ height: altura }}
            onContextMenu={(evento) => evento.preventDefault()}
          />
        </>
      )}
    </div>
  );
}
