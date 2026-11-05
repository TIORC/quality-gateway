import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface ExclusaoPorPerguntaProps {
  modelos: ModeloPesquisa[];
  respostasPorModelo: Record<string, RespostaModelo[]>;
  /** Chamado depois de qualquer exclusão, para a página recarregar os dados. */
  onAlterado: () => void;
}

/** Uma linha da lista: empresa + pessoa que respondeu a pergunta. */
interface Grupo {
  chave: string;
  empresa: string;
  pessoa: string;
  ids: string[];
  valores: string[];
}

/** Ação pendente de confirmação: a pergunta inteira ou as respostas de uma ou mais linhas. */
type Acao =
  | { tipo: "pergunta" }
  | { tipo: "resposta"; descricao: string; ids: string[]; quantidade: number };

function formatarValor(valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor ?? "");
}

/** Exclusão de respostas por pergunta (aba "Pergunta" de Configurações). */
export function ExclusaoPorPergunta({
  modelos,
  respostasPorModelo,
  onAlterado,
}: ExclusaoPorPerguntaProps) {
  const [modeloId, setModeloId] = useState("");
  const [perguntaId, setPerguntaId] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [acao, setAcao] = useState<Acao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const modelo = modelos.find((m) => m.id === modeloId);
  const pergunta = modelo?.perguntas.find((p) => p.id === perguntaId);
  const respostas = useMemo(
    () => respostasPorModelo[modeloId] ?? [],
    [respostasPorModelo, modeloId],
  );

  // Uma linha por empresa + pessoa que respondeu esta pergunta.
  const grupos = useMemo<Grupo[]>(() => {
    if (!modelo || !pergunta) return [];
    const chaveEmpresa = chaveEmpresaDo(modelo.perguntas);
    const chaveNome = chaveNomeDo(modelo.perguntas);
    const mapa = new Map<string, Grupo>();
    for (const resposta of respostas) {
      const valor = resposta.respostas[pergunta.id];
      if (valor === undefined || valor === "") continue;
      const empresa = empresaDaResposta(resposta, chaveEmpresa) || "Empresa não informada";
      const pessoa = textoDaResposta(resposta, chaveNome) || "Pessoa não informada";
      const chave = `${empresa}\u0000${pessoa}`;
      const grupo = mapa.get(chave) ?? { chave, empresa, pessoa, ids: [], valores: [] };
      grupo.ids.push(resposta.id);
      grupo.valores.push(formatarValor(valor));
      mapa.set(chave, grupo);
    }
    return [...mapa.values()];
  }, [modelo, pergunta, respostas]);

  // Só mantém na seleção as linhas que ainda existem nesta pergunta.
  const selecionadasVisiveis = grupos.filter((g) => selecionadas.has(g.chave));
  const todasMarcadas = grupos.length > 0 && selecionadasVisiveis.length === grupos.length;

  function alternarLinha(chave: string, marcada: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (marcada) proximo.add(chave);
      else proximo.delete(chave);
      return proximo;
    });
  }

  function alternarTodas(marcada: boolean) {
    setSelecionadas(marcada ? new Set(grupos.map((g) => g.chave)) : new Set());
  }

  async function confirmar() {
    if (!modelo || !pergunta || !acao) return;
    setExcluindo(true);
    try {
      if (acao.tipo === "pergunta") {
        await excluirPerguntaDaPesquisa(modelo, pergunta.id);
        setPerguntaId("");
        setSelecionadas(new Set());
        toast.success("Pergunta excluída e respostas dela apagadas.");
      } else {
        await removerRespostasDaPergunta(modelo.id, pergunta.id, acao.ids);
        setSelecionadas(new Set());
        toast.success(
          acao.quantidade === 1
            ? `Resposta de ${acao.descricao} apagada.`
            : `${acao.quantidade} respostas apagadas.`,
        );
      }
      setAcao(null);
      onAlterado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir os dados.");
    } finally {
      setExcluindo(false);
    }
  }

  /** Ação de exclusão para uma lista de linhas (uma ou várias). */
  function pedirExclusao(lista: Grupo[]) {
    const ids = lista.flatMap((g) => g.ids);
    const [unica] = lista;
    const descricao =
      lista.length === 1 && unica
        ? `${unica.empresa} (${unica.pessoa})`
        : `${lista.length} respostas`;
    setAcao({ tipo: "resposta", descricao, ids, quantidade: lista.length });
  }

  const textoConfirmacao = (() => {
    if (acao?.tipo === "pergunta") {
      return `A pergunta "${pergunta?.texto ?? ""}" será removida da pesquisa e as respostas dela em todas as empresas serão apagadas. Não pode ser desfeito.`;
    }
    if (acao?.tipo === "resposta" && acao.quantidade > 1) {
      return `As respostas de ${acao.quantidade} empresas/pessoas para esta pergunta serão apagadas. As demais respostas ficam. Não pode ser desfeito.`;
    }
    return `A resposta de ${acao?.descricao} para esta pergunta será apagada. As demais respostas dessa empresa ficam. Não pode ser desfeito.`;
  })();

  return (
    <>
      <div className="grid gap-4">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Pesquisa</Label>
              <Select
                value={modeloId}
                onValueChange={(valor) => {
                  setModeloId(valor);
                  setPerguntaId("");
                  setSelecionadas(new Set());
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
              <Select
                value={perguntaId}
                onValueChange={(valor) => {
                  setPerguntaId(valor);
                  setSelecionadas(new Set());
                }}
                disabled={!modelo}
              >
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Respostas desta pergunta ({grupos.length})
                </h3>
                {grupos.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-[#64748B]">
                      <Checkbox
                        checked={todasMarcadas}
                        disabled={excluindo}
                        onCheckedChange={(marcada) => alternarTodas(marcada === true)}
                        aria-label="Selecionar todas as respostas"
                      />
                      Selecionar todas
                    </label>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={excluindo || selecionadasVisiveis.length === 0}
                      onClick={() => pedirExclusao(selecionadasVisiveis)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir selecionadas ({selecionadasVisiveis.length})
                    </Button>
                  </div>
                )}
              </div>

              {grupos.length === 0 ? (
                <p className="text-sm text-[#64748B]">Nenhuma resposta para esta pergunta.</p>
              ) : (
                <ul className="grid gap-2">
                  {grupos.map((grupo) => {
                    const marcada = selecionadas.has(grupo.chave);
                    return (
                      <li
                        key={grupo.chave}
                        className={`flex items-center gap-3 rounded-md border p-3 ${
                          marcada ? "border-[#DC2626] bg-rose-50/40" : "border-[#E2E8F0]"
                        }`}
                      >
                        <Checkbox
                          checked={marcada}
                          disabled={excluindo}
                          onCheckedChange={(valor) => alternarLinha(grupo.chave, valor === true)}
                          aria-label={`Selecionar resposta de ${grupo.empresa} · ${grupo.pessoa}`}
                        />
                        <div className="min-w-0 flex-1">
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
                          onClick={() => pedirExclusao([grupo])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
      </div>

      <ConfirmarDialog
        open={acao !== null}
        onOpenChange={(proximo) => {
          if (!proximo && !excluindo) setAcao(null);
        }}
        tom="danger"
        titulo={
          acao?.tipo === "pergunta"
            ? "Excluir esta pergunta?"
            : acao && acao.quantidade > 1
              ? `Excluir ${acao.quantidade} respostas?`
              : "Excluir esta resposta?"
        }
        descricao={textoConfirmacao}
        textoConfirmar="Excluir"
        carregando={excluindo}
        onConfirmar={() => void confirmar()}
      />
    </>
  );
}
