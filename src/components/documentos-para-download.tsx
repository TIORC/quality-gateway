import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSession } from "@/lib/auth";
import {
  ACCEPT_DOCUMENTO,
  formatarTamanhoDocumento,
  rotuloFormato,
  type DocumentoDownload,
  type ServicoDocumentos,
} from "@/lib/documentos-download";

interface DocumentosParaDownloadProps {
  /** Id do registro (POP ou política) ao qual os documentos pertencem. */
  entidadeId: string;
  /** Setor da Qualidade: pode adicionar e remover documentos. */
  podeGerenciar: boolean;
  /** Operações do tipo de registro (POP ou política). */
  servico: ServicoDocumentos;
}

/**
 * Documentos para download (planilhas, Word, Excel, PDF...).
 * Todos que abrem o registro baixam; só a Qualidade adiciona e remove.
 */
export function DocumentosParaDownload({
  entidadeId,
  podeGerenciar,
  servico,
}: DocumentosParaDownloadProps) {
  const [documentos, setDocumentos] = useState<DocumentoDownload[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [paraRemover, setParaRemover] = useState<DocumentoDownload | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    servico
      .listar(entidadeId)
      .then((lista) => {
        if (ativo) setDocumentos(lista);
      })
      .catch(() => {
        if (ativo) setDocumentos([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [entidadeId, servico]);

  async function aoEscolherArquivos(evento: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(evento.target.files ?? []);
    evento.target.value = "";
    if (arquivos.length === 0) return;

    setEnviando(true);
    const sessao = getSession();
    let enviados = 0;
    for (const arquivo of arquivos) {
      try {
        const doc = await servico.enviar(entidadeId, arquivo, sessao);
        setDocumentos((atual) => [...atual, doc]);
        enviados += 1;
      } catch (erro) {
        toast.error(
          `${arquivo.name}: ${erro instanceof Error ? erro.message : "não foi possível enviar"}`,
        );
      }
    }
    if (enviados > 0) {
      toast.success(enviados === 1 ? "Documento adicionado" : `${enviados} documentos adicionados`);
    }
    setEnviando(false);
  }

  async function baixar(doc: DocumentoDownload) {
    setBaixandoId(doc.id);
    try {
      await servico.baixar(doc);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível baixar o documento");
    } finally {
      setBaixandoId(null);
    }
  }

  async function confirmarRemocao() {
    if (!paraRemover) return;
    setRemovendo(true);
    try {
      await servico.remover(paraRemover, getSession());
      setDocumentos((atual) => atual.filter((d) => d.id !== paraRemover.id));
      toast.success("Documento removido");
      setParaRemover(null);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível remover o documento");
    } finally {
      setRemovendo(false);
    }
  }

  // Quem só lê não vê a seção quando não há nenhum documento.
  if (!carregando && documentos.length === 0 && !podeGerenciar) return null;

  return (
    <section className="mt-5 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1F2937]">
          <Paperclip className="h-4 w-4 text-[#1E3A8A]" />
          Documentos para download
          {documentos.length > 0 ? (
            <span className="text-[12px] font-medium text-[#64748B]">({documentos.length})</span>
          ) : null}
        </h3>
        {podeGerenciar ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_DOCUMENTO}
              multiple
              className="hidden"
              onChange={(evento) => void aoEscolherArquivos(evento)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar documento
            </Button>
          </>
        ) : null}
      </div>

      {carregando ? (
        <p className="mt-3 text-[12.5px] text-[#64748B]">Carregando documentos…</p>
      ) : documentos.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[#64748B]">
          Nenhum documento anexado. Envie planilhas, Word, Excel ou PDFs para os colaboradores
          baixarem.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#E9EEF5]">
          {documentos.map((doc) => {
            const detalhes = [
              rotuloFormato(doc.nome),
              formatarTamanhoDocumento(doc.tamanho),
              doc.enviadoPorNome ? `enviado por ${doc.enviadoPorNome}` : "",
            ].filter(Boolean);
            return (
              <li key={doc.id} className="flex items-center gap-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-[#1E3A8A]" />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13.5px] font-semibold text-[#1F2937]"
                    title={doc.nome}
                  >
                    {doc.nome}
                  </p>
                  {detalhes.length > 0 ? (
                    <p className="text-[11.5px] text-[#64748B]">{detalhes.join(" · ")}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={baixandoId === doc.id}
                  onClick={() => void baixar(doc)}
                  aria-label={`Baixar ${doc.nome}`}
                  className="text-[#1E3A8A]"
                >
                  {baixandoId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar
                </Button>
                {podeGerenciar ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setParaRemover(doc)}
                    aria-label={`Remover ${doc.nome}`}
                    className="text-[#B91C1C] hover:text-[#991B1B]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={paraRemover !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !removendo) setParaRemover(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              “{paraRemover?.nome}” deixará de aparecer para os colaboradores. O arquivo será
              apagado e não pode ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removendo}
              onClick={(evento) => {
                evento.preventDefault();
                void confirmarRemocao();
              }}
              className="bg-[#B91C1C] text-white hover:bg-[#991B1B]"
            >
              {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
