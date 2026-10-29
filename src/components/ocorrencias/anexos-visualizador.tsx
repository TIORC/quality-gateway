/**
 * Visualizador de evidências da ocorrência (imagens, vídeos e PDFs), no mesmo
 * modelo do POP: quadro com cabeçalho, conteúdo embutido e leitura protegida
 * (sem botão direito/download pelo player). Outros formatos abrem em nova aba.
 */
import { ExternalLink, FileText, Film, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PdfProtegido } from "@/components/pdf-protegido";
import { urlAssinada } from "@/lib/ocorrencias-crud";
import type { AnexoOcorrencia } from "@/lib/ocorrencias";

type Categoria = "imagem" | "video" | "pdf" | "outro";

function categoriaDe(anexo: Pick<AnexoOcorrencia, "nome" | "tipo">): Categoria {
  const tipo = (anexo.tipo ?? "").toLowerCase();
  const nome = anexo.nome.toLowerCase();
  if (tipo.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg|heic|avif)$/.test(nome))
    return "imagem";
  if (tipo.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/.test(nome))
    return "video";
  if (tipo === "application/pdf" || nome.endsWith(".pdf")) return "pdf";
  return "outro";
}

const ICONES = { imagem: ImageIcon, video: Film, pdf: FileText, outro: FileText } as const;
const ROTULOS = { imagem: "IMAGEM", video: "VÍDEO", pdf: "PDF", outro: "ARQUIVO" } as const;

function AnexoItem({ anexo }: { anexo: AnexoOcorrencia }) {
  const categoria = categoriaDe(anexo);
  const Icone = ICONES[categoria];
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!anexo.caminho) return;
    let ativo = true;
    setUrl(null);
    setErro("");
    urlAssinada(anexo.caminho)
      .then((u) => ativo && setUrl(u))
      .catch(() => ativo && setErro("Não foi possível abrir o anexo agora. Tente novamente."));
    return () => {
      ativo = false;
    };
  }, [anexo.caminho]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-[#D9E0EA] bg-white"
      onContextMenu={(e) => categoria !== "outro" && e.preventDefault()}
    >
      <div className="flex items-center gap-2 border-b border-[#E9EEF5] bg-[#F8FAFC] px-4 py-2.5">
        <Icone className="h-4 w-4 shrink-0 text-[#1E3A8A]" />
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1F2937]">
          {anexo.nome}
          <span className="ml-2 rounded bg-[#EEF2F7] px-1.5 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
            {ROTULOS[categoria]}
          </span>
        </p>
        {categoria !== "outro" && (
          <span className="hidden text-[11px] text-[#94A3B8] sm:inline">
            Somente leitura — download bloqueado
          </span>
        )}
      </div>

      {!anexo.caminho ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#64748B]">
          Este arquivo não foi enviado ao armazenamento e não pode ser visualizado.
        </p>
      ) : erro ? (
        <p className="px-4 py-6 text-center text-[13px] text-destructive">{erro}</p>
      ) : !url ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo arquivo…
        </div>
      ) : categoria === "imagem" ? (
        <div className="flex justify-center bg-[#F1F5F9] p-2">
          <img
            src={url}
            alt={anexo.nome}
            draggable={false}
            className="max-h-[65vh] max-w-full select-none object-contain"
          />
        </div>
      ) : categoria === "video" ? (
        <video
          src={url}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          preload="metadata"
          className="max-h-[65vh] w-full bg-black"
        />
      ) : categoria === "pdf" ? (
        <PdfProtegido url={url} titulo={anexo.nome} />
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-[13px] text-[#475569]">
          <span>Visualização embutida indisponível para este formato.</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#1E3A8A] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </a>
        </div>
      )}
    </div>
  );
}

export function AnexosVisualizador({ anexos }: { anexos: AnexoOcorrencia[] }) {
  if (anexos.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-3">
      {anexos.map((a, i) => (
        <AnexoItem key={`${a.caminho ?? a.nome}-${i}`} anexo={a} />
      ))}
    </div>
  );
}

/** Lê o valor de um campo/resposta como lista de anexos (ou lista vazia). */
export function anexosDe(valor: unknown): AnexoOcorrencia[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (a): a is AnexoOcorrencia =>
      !!a && typeof a === "object" && typeof (a as { nome?: unknown }).nome === "string",
  );
}
