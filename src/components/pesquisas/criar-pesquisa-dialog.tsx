import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  atualizarModeloPesquisa,
  criarModeloPesquisa,
  linkDaPesquisa,
  TIPOS_COM_OPCOES,
  TIPOS_RESPOSTA,
  type ModeloPesquisa,
  type PerguntaModelo,
  type TipoResposta,
} from "@/lib/pesquisas-modelos";

interface CriarPesquisaDialogProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** Modelo a editar. Sem ele, o diálogo cria uma pesquisa nova. */
  modelo?: ModeloPesquisa | null;
  onSalvo?: () => void;
}

function novaPergunta(): PerguntaModelo {
  return {
    id: crypto.randomUUID(),
    texto: "",
    subtitulo: "",
    tipo: "texto_curto",
    obrigatoria: false,
    opcoes: [],
    permiteOutro: false,
  };
}

export function CriarPesquisaDialog({
  aberto,
  onAbertoChange,
  modelo = null,
  onSalvo,
}: CriarPesquisaDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaModelo[]>([novaPergunta()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao abrir, preenche com o modelo a editar (ou limpa para uma pesquisa nova).
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setTitulo(modelo?.titulo ?? "");
    setDescricao(modelo?.descricao ?? "");
    setPerguntas(modelo?.perguntas.length ? modelo.perguntas : [novaPergunta()]);
  }, [aberto, modelo]);

  async function copiarLink() {
    if (!modelo) return;
    try {
      await navigator.clipboard.writeText(linkDaPesquisa(modelo.id));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  function atualizar(id: string, mudancas: Partial<PerguntaModelo>) {
    setPerguntas((atuais) => atuais.map((p) => (p.id === id ? { ...p, ...mudancas } : p)));
  }

  function mudarTipo(id: string, tipo: TipoResposta) {
    const precisaOpcoes = TIPOS_COM_OPCOES.includes(tipo);
    setPerguntas((atuais) =>
      atuais.map((p) =>
        p.id === id
          ? {
              ...p,
              tipo,
              opcoes: precisaOpcoes && p.opcoes.length === 0 ? ["Opção 1", "Opção 2"] : p.opcoes,
            }
          : p,
      ),
    );
  }

  function duplicar(pergunta: PerguntaModelo) {
    setPerguntas((atuais) => {
      const indice = atuais.findIndex((p) => p.id === pergunta.id);
      const copia = { ...pergunta, id: crypto.randomUUID(), opcoes: [...pergunta.opcoes] };
      return [...atuais.slice(0, indice + 1), copia, ...atuais.slice(indice + 1)];
    });
  }

  function remover(id: string) {
    setPerguntas((atuais) => (atuais.length > 1 ? atuais.filter((p) => p.id !== id) : atuais));
  }

  function atualizarOpcao(id: string, indice: number, texto: string) {
    setPerguntas((atuais) =>
      atuais.map((p) =>
        p.id === id ? { ...p, opcoes: p.opcoes.map((o, i) => (i === indice ? texto : o)) } : p,
      ),
    );
  }

  function adicionarOpcao(id: string) {
    setPerguntas((atuais) =>
      atuais.map((p) =>
        p.id === id ? { ...p, opcoes: [...p.opcoes, `Opção ${p.opcoes.length + 1}`] } : p,
      ),
    );
  }

  function removerOpcao(id: string, indice: number) {
    setPerguntas((atuais) =>
      atuais.map((p) =>
        p.id === id && p.opcoes.length > 1
          ? { ...p, opcoes: p.opcoes.filter((_, i) => i !== indice) }
          : p,
      ),
    );
  }

  function validar(): string | null {
    if (!titulo.trim()) return "Dê um título para a pesquisa.";
    const comTexto = perguntas.filter((p) => p.texto.trim());
    if (comTexto.length === 0) return "Adicione pelo menos uma pergunta com texto.";
    for (const p of comTexto) {
      if (TIPOS_COM_OPCOES.includes(p.tipo) && p.opcoes.filter((o) => o.trim()).length === 0) {
        return `Informe as opções da pergunta "${p.texto.trim()}".`;
      }
    }
    return null;
  }

  async function salvar() {
    const problema = validar();
    if (problema) {
      setErro(problema);
      toast.error(problema);
      return;
    }
    setErro(null);
    setSalvando(true);
    const dados = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      perguntas: perguntas
        .filter((p) => p.texto.trim())
        .map((p) => ({
          ...p,
          texto: p.texto.trim(),
          subtitulo: p.subtitulo.trim(),
          opcoes: TIPOS_COM_OPCOES.includes(p.tipo)
            ? p.opcoes.map((o) => o.trim()).filter(Boolean)
            : [],
        })),
    };
    try {
      if (modelo) await atualizarModeloPesquisa(modelo.id, dados);
      else await criarModeloPesquisa(dados);
      toast.success(modelo ? "Pesquisa atualizada." : "Pesquisa criada.");
      onAbertoChange(false);
      onSalvo?.();
    } catch (falha) {
      const mensagem =
        falha instanceof Error ? falha.message : "Não foi possível salvar a pesquisa.";
      setErro(mensagem);
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo ? "Editar pesquisa" : "Criar pesquisa"}</DialogTitle>
          <DialogDescription>
            Monte as perguntas e escolha como cada uma será respondida.
          </DialogDescription>
        </DialogHeader>

        {modelo && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Link desta pesquisa</p>
            <p className="mb-3 text-xs text-[#64748B]">
              Envie este link aos clientes. Ele abre somente esta pesquisa.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={linkDaPesquisa(modelo.id)}
                onFocus={(e) => e.target.select()}
              />
              <Button variant="outline" onClick={() => void copiarLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <Input
              className="mb-2 border-0 border-b border-[#E2E8F0] px-0 text-lg font-semibold focus-visible:ring-0"
              placeholder="Título da pesquisa"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <Textarea
              className="border-0 px-0 focus-visible:ring-0"
              placeholder="Descrição (opcional)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {perguntas.map((pergunta, numero) => (
            <div key={pergunta.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <div className="mb-3 flex flex-wrap gap-3">
                <Input
                  className="min-w-[240px] flex-1"
                  placeholder={`Pergunta ${numero + 1}`}
                  value={pergunta.texto}
                  onChange={(e) => atualizar(pergunta.id, { texto: e.target.value })}
                />
                <Textarea
                  className="min-h-[60px] w-full"
                  placeholder="Subtítulo (opcional): texto de apoio abaixo da pergunta"
                  value={pergunta.subtitulo}
                  onChange={(e) => atualizar(pergunta.id, { subtitulo: e.target.value })}
                />
                <Select
                  value={pergunta.tipo}
                  onValueChange={(valor) => mudarTipo(pergunta.id, valor as TipoResposta)}
                >
                  <SelectTrigger className="w-[210px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESPOSTA.map((tipo) => (
                      <SelectItem key={tipo.valor} value={tipo.valor}>
                        {tipo.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {TIPOS_COM_OPCOES.includes(pergunta.tipo) && (
                <div className="mb-3 grid gap-2">
                  {pergunta.opcoes.map((opcao, indice) => (
                    <div key={indice} className="flex items-center gap-2">
                      <span className="text-[#94A3B8]">
                        {pergunta.tipo === "caixas_selecao" ? "☐" : "○"}
                      </span>
                      <Input
                        value={opcao}
                        onChange={(e) => atualizarOpcao(pergunta.id, indice, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removerOpcao(pergunta.id, indice)}
                        aria-label="Remover opção"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {pergunta.permiteOutro && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#94A3B8]">
                        {pergunta.tipo === "caixas_selecao" ? "☐" : "○"}
                      </span>
                      <span className="shrink-0 text-sm text-[#475569]">Outro:</span>
                      <Input disabled placeholder="Resposta escrita pela pessoa" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => atualizar(pergunta.id, { permiteOutro: false })}
                        aria-label="Remover opção Outro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => adicionarOpcao(pergunta.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar opção
                    </Button>
                    {!pergunta.permiteOutro && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => atualizar(pergunta.id, { permiteOutro: true })}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar "Outro"
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {pergunta.tipo === "texto_curto" && (
                <Input disabled placeholder="Resposta curta" className="mb-3" />
              )}
              {pergunta.tipo === "texto_longo" && (
                <Textarea disabled placeholder="Resposta longa" className="mb-3" />
              )}
              {(pergunta.tipo === "escala" || pergunta.tipo === "nps") && (
                <div className="mb-3 flex flex-wrap gap-2 text-sm text-[#64748B]">
                  {Array.from(
                    { length: pergunta.tipo === "nps" ? 11 : 10 },
                    (_, i) => (pergunta.tipo === "nps" ? i : i + 1),
                  ).map((nota) => (
                    <span
                      key={nota}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#CBD5E1]"
                    >
                      {nota}
                    </span>
                  ))}
                </div>
              )}
              {pergunta.tipo === "sim_nao" && (
                <div className="mb-3 flex gap-4 text-sm text-[#64748B]">
                  <span>○ Sim</span>
                  <span>○ Não</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                <label className="flex items-center gap-2 text-sm text-[#475569]">
                  <Switch
                    checked={pergunta.obrigatoria}
                    onCheckedChange={(valor) => atualizar(pergunta.id, { obrigatoria: valor })}
                  />
                  Obrigatória
                </label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicar(pergunta)}
                    aria-label="Duplicar pergunta"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remover(pergunta.id)}
                    disabled={perguntas.length === 1}
                    aria-label="Remover pergunta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() => setPerguntas((atuais) => [...atuais, novaPergunta()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar pergunta
          </Button>
        </div>

        {erro && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onAbertoChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : modelo ? "Salvar alterações" : "Salvar pesquisa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
