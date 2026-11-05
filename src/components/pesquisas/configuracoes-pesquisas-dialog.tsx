import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { ExclusaoPorPergunta } from "@/components/pesquisas/exclusao-dados-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  chaveEmpresaDo,
  chaveNomeDo,
  empresaDaResposta,
  excluirRespostasPorIds,
  textoDaResposta,
  type ModeloPesquisa,
  type RespostaModelo,
} from "@/lib/pesquisas-modelos";

interface ConfiguracoesPesquisasDialogProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  modelos: ModeloPesquisa[];
  /** Todas as respostas, sem filtro da página. */
  respostasPorModelo: Record<string, RespostaModelo[]>;
  /** Chamado depois de excluir, para a página recarregar os dados. */
  onAlterado: () => void;
}

/** Um envio de uma pessoa em uma pesquisa. */
interface Envio {
  modelo: ModeloPesquisa;
  resposta: RespostaModelo;
}

/** Uma pessoa (razão social + nome) com todos os envios dela, em todas as pesquisas. */
interface Pessoa {
  chave: string;
  empresa: string;
  pessoa: string;
  envios: Envio[];
}

function formatarValor(valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor ?? "");
}

export function ConfiguracoesPesquisasDialog({
  aberto,
  onAbertoChange,
  modelos,
  respostasPorModelo,
  onAlterado,
}: ConfiguracoesPesquisasDialogProps) {
  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Exclua respostas por pergunta ou veja e apague tudo o que uma pessoa respondeu.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pergunta">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pergunta">Pergunta</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
          </TabsList>
          <TabsContent value="pergunta">
            <ExclusaoPorPergunta
              modelos={modelos}
              respostasPorModelo={respostasPorModelo}
              onAlterado={onAlterado}
            />
          </TabsContent>
          <TabsContent value="individual">
            <ExclusaoIndividual
              modelos={modelos}
              respostasPorModelo={respostasPorModelo}
              onAlterado={onAlterado}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Aba "Individual": uma pessoa por vez, com navegação e exclusão de tudo o que ela respondeu. */
function ExclusaoIndividual({
  modelos,
  respostasPorModelo,
  onAlterado,
}: {
  modelos: ModeloPesquisa[];
  respostasPorModelo: Record<string, RespostaModelo[]>;
  onAlterado: () => void;
}) {
  const [chaveAtual, setChaveAtual] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Uma entrada por razão social + pessoa, com todos os envios dela em todas as pesquisas.
  const pessoas = useMemo<Pessoa[]>(() => {
    const mapa = new Map<string, Pessoa>();
    for (const modelo of modelos) {
      const chaveEmpresa = chaveEmpresaDo(modelo.perguntas);
      const chaveNome = chaveNomeDo(modelo.perguntas);
      for (const resposta of respostasPorModelo[modelo.id] ?? []) {
        const empresa = empresaDaResposta(resposta, chaveEmpresa) || "Empresa não informada";
        const pessoa = textoDaResposta(resposta, chaveNome) || "Pessoa não informada";
        const chave = `${empresa}\u0000${pessoa}`;
        const grupo = mapa.get(chave) ?? { chave, empresa, pessoa, envios: [] };
        grupo.envios.push({ modelo, resposta });
        mapa.set(chave, grupo);
      }
    }
    return [...mapa.values()].sort((a, b) =>
      `${a.empresa} ${a.pessoa}`.localeCompare(`${b.empresa} ${b.pessoa}`, "pt-BR"),
    );
  }, [modelos, respostasPorModelo]);

  const indice = Math.max(
    0,
    pessoas.findIndex((p) => p.chave === chaveAtual),
  );
  const atual = pessoas[indice];

  async function excluirTudo() {
    if (!atual) return;
    setExcluindo(true);
    try {
      await excluirRespostasPorIds(atual.envios.map((e) => e.resposta.id));
      toast.success(`Respostas de ${atual.empresa} · ${atual.pessoa} apagadas.`);
      setChaveAtual("");
      setConfirmando(false);
      onAlterado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir as respostas.");
    } finally {
      setExcluindo(false);
    }
  }

  if (!atual) {
    return <p className="mt-4 text-sm text-[#64748B]">Nenhuma resposta registrada ainda.</p>;
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={excluindo || indice <= 0}
          onClick={() => setChaveAtual(pessoas[indice - 1]?.chave ?? "")}
          aria-label="Pessoa anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select value={atual.chave} onValueChange={setChaveAtual} disabled={excluindo}>
          <SelectTrigger className="min-w-0 flex-1 [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pessoas.map((p) => (
              <SelectItem key={p.chave} value={p.chave}>
                {p.empresa} · {p.pessoa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          disabled={excluindo || indice >= pessoas.length - 1}
          onClick={() => setChaveAtual(pessoas[indice + 1]?.chave ?? "")}
          aria-label="Próxima pessoa"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="shrink-0 text-xs text-[#64748B]">
          {indice + 1} de {pessoas.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={excluindo}
          onClick={() => setConfirmando(true)}
          className="shrink-0 text-[#DC2626] hover:text-[#DC2626]"
          aria-label="Excluir todas as respostas desta pessoa"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#0F172A]">{atual.empresa}</p>
        <p className="text-xs text-[#64748B]">
          {atual.pessoa} · {atual.envios.length}{" "}
          {atual.envios.length === 1 ? "resposta" : "respostas"}
        </p>
      </div>

      <div className="grid gap-3">
        {atual.envios.map(({ modelo, resposta }) => (
          <div key={resposta.id} className="rounded-md border border-[#E2E8F0] p-3">
            <p className="text-sm font-semibold text-[#0F172A]">{modelo.titulo}</p>
            <p className="mb-2 text-xs text-[#64748B]">
              {new Date(resposta.criadoEm).toLocaleString("pt-BR")}
            </p>
            <dl className="grid gap-2">
              {modelo.perguntas.map((pergunta, numero) => {
                const valor = resposta.respostas[pergunta.id];
                if (valor === undefined || valor === "") return null;
                return (
                  <div key={pergunta.id}>
                    <dt className="text-xs text-[#64748B]">
                      {numero + 1}. {pergunta.texto.replace(/^\s*\d+\s*[-.)]\s*/, "")}
                    </dt>
                    <dd className="text-sm text-[#0F172A]">{formatarValor(valor)}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      <ConfirmarDialog
        open={confirmando}
        onOpenChange={(proximo) => {
          if (!proximo && !excluindo) setConfirmando(false);
        }}
        tom="danger"
        titulo="Excluir todas as respostas desta pessoa?"
        descricao={`As ${atual.envios.length} resposta(s) de ${atual.empresa} · ${atual.pessoa}, em todas as pesquisas, serão apagadas junto com as notas NPS. Não pode ser desfeito.`}
        textoConfirmar="Excluir"
        carregando={excluindo}
        onConfirmar={() => void excluirTudo()}
      />
    </div>
  );
}
