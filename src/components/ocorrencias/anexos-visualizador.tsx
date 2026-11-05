/**
 * Visualizador de evidências da ocorrência (imagens, vídeos e PDFs), no mesmo
 * modelo do POP: quadro com cabeçalho, conteúdo embutido e leitura protegida
 * (sem botão direito/download pelo player). Outros formatos abrem em nova aba.
 * Começa recolhido: só o cabeçalho aparece até o operador clicar para abrir.
 */
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Maximize2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PdfProtegido } from "@/components/pdf-protegido";
import { urlAssinada, type OtimizacaoImagem } from "@/lib/ocorrencias-crud";
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

// Imagens de visualização: até 1600 px de largura, qualidade 75 (bem mais leve que a original).
const OTIMIZACAO_IMAGEM: OtimizacaoImagem = { largura: 1600, qualidade: 75 };

function AnexoItem({ anexo }: { anexo: AnexoOcorrencia }) {
  const categoria = categoriaDe(anexo);
  const Icone = ICONES[categoria];
  const ehImagem = categoria === "imagem";
  const [expandido, setExpandido] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  // O arquivo só é pedido quando o anexo é aberto. Imagens vêm redimensionadas;
  // se o servidor não conseguir redimensionar, usa o arquivo original.
  useEffect(() => {
    if (!anexo.caminho || !expandido) return;
    let ativo = true;
    setUrl(null);
    setErro("");
    const pedido = ehImagem
      ? urlAssinada(anexo.caminho, OTIMIZACAO_IMAGEM).catch(() => urlAssinada(anexo.caminho!))
      : urlAssinada(anexo.caminho);
    pedido
      .then((u) => ativo && setUrl(u))
      .catch(() => ativo && setErro("Não foi possível abrir o anexo agora. Tente novamente."));
    return () => {
      ativo = false;
    };
  }, [anexo.caminho, expandido, ehImagem]);

  return (
    <div
      className="overflow-hidden rounded-xl border border-[#D9E0EA] bg-white"
      onContextMenu={(e) => categoria !== "outro" && e.preventDefault()}
    >
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className={`flex w-full items-center gap-2 bg-[#F8FAFC] px-4 py-2.5 text-left hover:bg-[#F1F5F9] ${
          expandido ? "border-b border-[#E9EEF5]" : ""
        }`}
      >
        <Icone className="h-4 w-4 shrink-0 text-[#1E3A8A]" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1F2937]">
          {anexo.nome}
          <span className="ml-2 rounded bg-[#EEF2F7] px-1.5 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
            {ROTULOS[categoria]}
          </span>
        </span>
        {categoria !== "outro" && (
          <span className="hidden text-[11px] text-[#94A3B8] sm:inline">
            Somente leitura — download bloqueado
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#1E3A8A]">
          {expandido ? "Recolher" : "Abrir"}
          {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {expandido &&
        (!anexo.caminho ? (
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
          <div className="bg-[#F1F5F9] p-2">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTelaCheia(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E0EA] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Tela cheia
              </button>
            </div>
            <div className="relative h-[65vh] min-h-[320px] w-full overflow-hidden rounded-md bg-white">
              <img
                src={url}
                alt={anexo.nome}
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-contain"
              />
            </div>
            <Dialog open={telaCheia} onOpenChange={setTelaCheia}>
              <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-black/95 p-4 sm:max-w-none">
                <DialogTitle className="sr-only">{anexo.nome}</DialogTitle>
                <div className="flex h-full w-full items-center justify-center">
                  <img
                    src={url}
                    alt={anexo.nome}
                    decoding="async"
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                </div>
              </DialogContent>
            </Dialog>
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
        ))}
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
