import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  chaveEmpresaDo,
  chaveNomeDo,
  empresaDaResposta,
  excluirPerguntaDaPesquisa,
  removerRespostasDaPergunta,
  textoDaResposta,
  type ModeloPesquisa,
  type RespostaModelo,
} from "@/lib/pesquisas-modelos";

interface ExclusaoDadosDialogProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  modelos: ModeloPesquisa[];
  respostasPorModelo: Record<string, RespostaModelo[]>;
  /** Chamado depois de qualquer exclusão, para a página recarregar os dados. */
  onAlterado: () => void;
}

/** Ação pendente de confirmação: a pergunta inteira ou só as respostas de uma empresa + pessoa. */
type Acao =
  { tipo: "pergunta" } | { tipo: "resposta"; empresa: string; pessoa: string; ids: string[] };

function formatarValor(valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor ?? "");
}

export function ExclusaoDadosDialog({
  aberto,
  onAbertoChange,
  modelos,
  respostasPorModelo,
  onAlterado,
}: ExclusaoDadosDialogProps) {
  const [modeloId, setModeloId] = useState("");
  const [perguntaId, setPerguntaId] = useState("");
  const [acao, setAcao] = useState<Acao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const modelo = modelos.find((m) => m.id === modeloId);
  const pergunta = modelo?.perguntas.find((p) => p.id === perguntaId);
  const respostas = useMemo(
    () => respostasPorModelo[modeloId] ?? [],
    [respostasPorModelo, modeloId],
  );

  // Uma linha por empresa + pessoa que respondeu esta pergunta.
  const grupos = useMemo(() => {
    if (!modelo || !pergunta) return [];
    const chaveEmpresa = chaveEmpresaDo(modelo.perguntas);
    const chaveNome = chaveNomeDo(modelo.perguntas);
    const mapa = new Map<
      string,
      { empresa: string; pessoa: string; ids: string[]; valores: string[] }
    >();
    for (const resposta of respostas) {
      const valor = resposta.respostas[pergunta.id];
      if (valor === undefined || valor === "") continue;
      const empresa = empresaDaResposta(resposta, chaveEmpresa) || "Empresa não informada";
      const pessoa = textoDaResposta(resposta, chaveNome) || "Pessoa não informada";
      const chave = `${empresa}\u0000${pessoa}`;
      const grupo = mapa.get(chave) ?? { empresa, pessoa, ids: [], valores: [] };
      grupo.ids.push(resposta.id);
      grupo.valores.push(formatarValor(valor));
      mapa.set(chave, grupo);
    }
    return [...mapa.values()];
  }, [modelo, pergunta, respostas]);

  function fechar(proximo: boolean) {
    if (excluindo) return;
    if (!proximo) {
      setModeloId("");
      setPerguntaId("");
    }
    onAbertoChange(proximo);
  }

  async function confirmar() {
    if (!modelo || !pergunta || !acao) return;
    setExcluindo(true);
    try {
      if (acao.tipo === "pergunta") {
        await excluirPerguntaDaPesquisa(modelo, pergunta.id);
        setPerguntaId("");
        toast.success("Pergunta excluída e respostas dela apagadas.");
      } else {
        await removerRespostasDaPergunta(modelo.id, pergunta.id, acao.ids);
        toast.success(`Resposta de ${acao.empresa} · ${acao.pessoa} apagada.`);
      }
      setAcao(null);
      onAlterado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir os dados.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exclusão de Dados</DialogTitle>
            <DialogDescription>
              Escolha a pesquisa e a pergunta. Você pode excluir a pergunta inteira ou apenas a
              resposta de uma empresa e pessoa nessa pergunta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Pesquisa</Label>
              <Select
                value={modeloId}
                onValueChange={(valor) => {
                  setModeloId(valor);
                  setPerguntaId("");
                }}
              >
                <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Selecione a pesquisa" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Pergunta</Label>
              <Select value={perguntaId} onValueChange={setPerguntaId} disabled={!modelo}>
                <SelectTrigger className="w-full min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Selecione a pergunta" />
                </SelectTrigger>
                <SelectContent>
                  {modelo?.perguntas.map((p, indice) => (
                    <SelectItem key={p.id} value={p.id}>
                      {indice + 1}. {p.texto.replace(/^\s*\d+\s*[-.)]\s*/, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pergunta && (
            <div className="mt-2 grid gap-3">
              <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-rose-900">
                  Excluir a pergunta remove também as respostas dela em todas as empresas.
                </p>
                <Button
                  variant="destructive"
                  className="shrink-0"
                  disabled={excluindo}
                  onClick={() => setAcao({ tipo: "pergunta" })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir pergunta
                </Button>
              </div>

              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Respostas desta pergunta ({grupos.length})
              </h3>
              {grupos.length === 0 ? (
                <p className="text-sm text-[#64748B]">Nenhuma resposta para esta pergunta.</p>
              ) : (
                <ul className="grid gap-2">
                  {grupos.map((grupo) => (
                    <li
                      key={`${grupo.empresa}|${grupo.pessoa}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-[#E2E8F0] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#0F172A]">
                          {grupo.empresa}
                        </p>
                        <p className="truncate text-xs text-[#64748B]">
                          {grupo.pessoa} · {grupo.valores.join(" | ")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-[#DC2626] hover:text-[#DC2626]"
                        disabled={excluindo}
                        aria-label="Excluir resposta desta empresa e pessoa"
                        onClick={() =>
                          setAcao({
                            tipo: "resposta",
                            empresa: grupo.empresa,
                            pessoa: grupo.pessoa,
                            ids: grupo.ids,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmarDialog
        open={acao !== null}
        onOpenChange={(proximo) => {
          if (!proximo && !excluindo) setAcao(null);
        }}
        tom="danger"
        titulo={acao?.tipo === "pergunta" ? "Excluir esta pergunta?" : "Excluir esta resposta?"}
        descricao={
          acao?.tipo === "pergunta"
            ? `A pergunta "${pergunta?.texto ?? ""}" será removida da pesquisa e as respostas dela em todas as empresas serão apagadas. Não pode ser desfeito.`
            : `A resposta de ${acao?.empresa} (${acao?.pessoa}) para esta pergunta será apagada. As demais respostas dessa empresa ficam. Não pode ser desfeito.`
        }
        textoConfirmar="Excluir"
        carregando={excluindo}
        onConfirmar={() => void confirmar()}
      />
    </>
  );
}
