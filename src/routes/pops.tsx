import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  Copy,
  CreditCard,
  Edit3,
  FileText,
  Grid2,
  LayoutGrid,
  Loader2,
  MonitorSmartphone,
  MoreVertical,
  Plus,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Star,
  Target,
  ThumbsUp,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  type EntradaPop,
  type FonteDados,
  type Pop,
  type SetorPop,
  carregarPops,
  contarPopsPorSetor,
  criarPop,
  duplicarPop,
  excluirPop,
  atualizarPop,
  ENTRADA_PADRAO,
} from "@/lib/pops";

export const Route = createFileRoute("/pops")({
  head: () => ({
    meta: [{ title: "POPs | Gestão da Qualidade" }],
  }),
  component: Pops,
});

const PAGE_SIZE = 7;

/** Card virtual que abriga todos os POPs (independente do setor). */
const SETOR_TODOS: SetorPop = {
  id: "todos",
  nome: "Todos os POPs",
  prefixo: "ALL",
  categoria: "GERAL",
  icone: "layout-grid",
  ordem: 0,
};

const ICONES_SETOR: Record<string, typeof LayoutGrid> = {
  "layout-grid": LayoutGrid,
  receipt: ReceiptText,
  calculator: Calculator,
  users: Users,
  wallet: Wallet,
  scale: Scale,
  shield: Shield,
  monitor: MonitorSmartphone,
  building: Building2,
  briefcase: CreditCard,
};

function iconeDoSetor(chave: string): typeof LayoutGrid {
  return ICONES_SETOR[chave] ?? LayoutGrid;
}

/* -------------------------------------------------------------------------- */
/* Cor das tags do cartão POP                                                 */
/* -------------------------------------------------------------------------- */

const BG = {
  indigo: "bg-[#EEF2FF]",
  sky: "bg-[#EFF6FF]",
  amber: "bg-[#FEF3C7]",
  orange: "bg-[#FFF7ED]",
  muted: "bg-[#F1F5F9]",
};
const TEXT = {
  indigo: "text-[#4F46E5]",
  sky: "text-[#2563EB]",
  amber: "text-[#B45309]",
  orange: "text-[#EA580C]",
  emerald: "text-[#059669]",
  rose: "text-[#E11D48]",
  muted: "text-[#475569]",
};

function classeCategoria(valor: string): string {
  switch (valor) {
    case "FISCAL":
      return `${BG.indigo} ${TEXT.indigo}`;
    case "CONTABIL":
      return `${BG.indigo} ${TEXT.indigo}`;
    case "PESSOAL":
      return `${BG.sky} ${TEXT.sky}`;
    case "FINANCEIRO":
      return `${BG.sky} ${TEXT.sky}`;
    case "LEGALIZACAO":
      return `${BG.gray} ${TEXT.muted}`;
    case "QUALIDADE":
      return `${BG.emerald} ${TEXT.emerald}`;
    case "TI":
      return `${BG.rose} ${TEXT.rose}`;
    case "DIRECAO":
      return `${BG.orange} ${TEXT.orange}`;
    default:
      return `${BG.muted} ${TEXT.muted}`;
  }
}

function classeDificuldade(valor: string): string {
  switch (valor) {
    case "FACIL":
      return `${BG.muted} ${TEXT.emerald}`;
    case "MEDIO":
      return `${BG.muted} ${TEXT.amber}`;
    case "DIFICIL":
      return `${BG.muted} ${TEXT.rose}`;
    default:
      return `${BG.muted} ${TEXT.muted}`;
  }
}

function Tag({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${bg}`}
    >
      {children}
    </span>
  );
}

import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETORES } from "@/lib/dados";
import { cn, mascaraDataBr } from "@/lib/utils";

const ABAS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "gerais", rotulo: "Gerais" },
  { valor: "meu-setor", rotulo: "Do setor Qualidade" },
  { valor: "preciso-ler", rotulo: "Preciso ler" },
  { valor: "aprovar", rotulo: "Aprovar" },
] as const;

type Visao = "grade" | "kanban";

function novaId() {
  return `pop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface PopItem {
  id: string;
  codigo: string;
  titulo: string;
  doQueTrata: string;
  abrangencia: "Setorial" | "Geral";
  setor: string;
  setores: string[];
  proximaRevisao: string;
  arquivo: string | null;
}

function Pops() {
  const [visao, setVisao] = useState<Visao>("kanban");
  const [novoPopAberto, setNovoPopAberto] = useState(false);
  const [itens, setItens] = useState<PopItem[]>([]);

  function itensDaAba(valor: string): PopItem[] {
    switch (valor) {
      case "gerais":
        return itens.filter((item) => item.abrangencia === "Geral");
      case "meu-setor":
        return itens.filter(
          (item) => item.abrangencia === "Setorial" && item.setor === "Qualidade",
        );
      case "preciso-ler":
      case "aprovar":
        return [];
      default:
        return itens;
    }
  }

  function adicionarPop(dados: Omit<PopItem, "id">) {
    setItens((atual) => [{ id: novaId(), ...dados }, ...atual]);
  }

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Processos e padrões
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Procedimentos Operacionais Padrão
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Dupla checagem: o líder do processo valida a prática, a Qualidade valida o padrão.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-lg border border-[#D9E0EA] bg-white p-0.5">
            <button
              type="button"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition",
                visao === "grade"
                  ? "bg-[#EEF2F7] text-[#1F2937]"
                  : "text-[#64748B] hover:text-[#1F2937]",
              )}
              onClick={() => setVisao("grade")}
            >
              <LayoutGrid className="h-4 w-4" />
              Grade
            </button>
            <button
              type="button"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition",
                visao === "kanban"
                  ? "bg-[#EEF2F7] text-[#1F2937]"
                  : "text-[#64748B] hover:text-[#1F2937]",
              )}
              onClick={() => setVisao("kanban")}
            >
              <SquareKanban className="h-4 w-4" />
              Kanban
            </button>
          </div>

          <Button onClick={() => setNovoPopAberto(true)}>
            <Plus className="h-4 w-4" />
            Novo POP
          </Button>
        </div>
      </div>

      <Tabs defaultValue="todos">
        <TabsList>
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {itensDaAba(aba.valor).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((aba) => (
          <TabsContent key={aba.valor} value={aba.valor}>
            {visao === "kanban" ? (
              <KanbanPop itens={itensDaAba(aba.valor)} />
            ) : (
              <GradePop itens={itensDaAba(aba.valor)} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <NovoPopDialog
        aberto={novoPopAberto}
        onFechar={() => setNovoPopAberto(false)}
        onCriar={adicionarPop}
      />

      <p className="mt-8 text-center text-[11px] text-[#94A3B8]">
        Desenvolvido com 💙 pelos Desenvolvedores Orcoma Contabilidade
      </p>
    </PanelShell>
  );
}

const COLUNAS = ["Gerais", ...SETORES];

function KanbanPop({ itens }: { itens: PopItem[] }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-[#64748B]">
        Organizado por setor. Arraste um POP para a coluna do setor responsável — o responsável da
        divulgação e a leitura passam a valer para aquele setor.
      </p>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((coluna) => {
          const daColuna = itens.filter((item) =>
            item.abrangencia === "Geral" ? coluna === "Gerais" : item.setor === coluna,
          );
          return (
            <div
              key={coluna}
              className="flex w-[371px] shrink-0 flex-col rounded-xl border border-[#D9E0EA] bg-[#F8FAFC]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#E9EEF5] px-3 py-2.5">
                <p className="truncate text-[12px] font-semibold text-[#1F2937]">{coluna}</p>
                <span className="rounded-full border border-[#E9EEF5] bg-white px-2 py-0.5 text-[11px] font-semibold leading-none text-[#64748B]">
                  {daColuna.length}
                </span>
              </div>
              <div className="flex min-h-[180px] flex-1 flex-col gap-2 px-3 pb-6 pt-3">
                {daColuna.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <p className="text-xs text-[#94A3B8]">sem POPs</p>
                  </div>
                ) : (
                  daColuna.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[#E9EEF5] bg-white p-3 shadow-sm min-h-[110px]"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                        {item.codigo}
                      </p>
                      <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#1F2937]">
                        {item.titulo}
                      </p>
                      {item.arquivo ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#1E3A8A]">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[150px] truncate">{item.arquivo}</span>
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GradePop({ itens }: { itens: PopItem[] }) {
  if (itens.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <FileCheck className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhum POP aqui</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Crie o procedimento, submeta à dupla checagem e publique por setor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-[#E9EEF5] overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      {itens.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-semibold text-[#64748B]">
                {item.codigo}
              </span>
              <p className="truncate text-[14px] font-semibold text-[#1F2937]">{item.titulo}</p>
            </div>
            <p className="text-xs text-[#64748B]">
              {item.abrangencia === "Geral" ? "Geral" : `Setor ${item.setor}`} · Revisão{" "}
              {item.proximaRevisao}
            </p>
          </div>

          {item.arquivo ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#1E3A8A]">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[220px] truncate">{item.arquivo}</span>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

interface CampoProps {
  rotulo: string;
  children: ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

const ABRANGENCIAS = ["Setorial", "Geral"] as const;

interface NovoPopDialogProps {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: Omit<PopItem, "id">) => void;
}

function NovoPopDialog({ aberto, onFechar, onCriar }: NovoPopDialogProps) {
  const [codigo, setCodigo] = useState("POP-TI-009");
  const [titulo, setTitulo] = useState("");
  const [doQueTrata, setDoQueTrata] = useState("");
  const [abrangencia, setAbrangencia] = useState<string>("Setorial");
  const [setores, setSetores] = useState<string[]>([]);
  const [setor, setSetor] = useState("Qualidade");
  const [proximaRevisao, setProximaRevisao] = useState("18/08/2027");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  function alternarSetor(setor: string) {
    setSetores((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor],
    );
  }

  function limpar() {
    setCodigo("POP-TI-009");
    setTitulo("");
    setDoQueTrata("");
    setAbrangencia("Setorial");
    setSetores([]);
    setSetor("Qualidade");
    setProximaRevisao("18/08/2027");
    setArquivo(null);
  }

  useEffect(() => {
    if (!aberto) limpar();
  }, [aberto]);

  function enviar() {
    onCriar({
      codigo,
      titulo,
      doQueTrata,
      abrangencia: abrangencia as PopItem["abrangencia"],
      setor,
      setores,
      proximaRevisao,
      arquivo: arquivo?.name ?? null,
    });
    limpar();
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo POP</DialogTitle>
          <DialogDescription>
            Cadastre o procedimento e envie para a dupla checagem de aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código">
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </Campo>

            <Campo rotulo="Título">
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Backup e restauração de bases"
              />
            </Campo>
          </div>

          <Campo rotulo="Do que trata">
            <Textarea
              value={doQueTrata}
              onChange={(e) => setDoQueTrata(e.target.value)}
              placeholder="Resuma o procedimento e o que ele padroniza."
              className="min-h-[90px]"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Abrangência">
              <Select value={abrangencia} onValueChange={setAbrangencia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABRANGENCIAS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            {abrangencia === "Setorial" ? (
              <Campo rotulo="Setor do processo">
                <Select value={setor} onValueChange={setSetor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            ) : null}
          </div>

          {abrangencia === "Geral" ? (
            <Campo rotulo="Setores a que se aplica">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SETORES.map((opcao) => (
                  <label
                    key={opcao}
                    htmlFor={`setor-pop-${opcao}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                  >
                    <Checkbox
                      id={`setor-pop-${opcao}`}
                      checked={setores.includes(opcao)}
                      onCheckedChange={() => alternarSetor(opcao)}
                    />
                    {opcao}
                  </label>
                ))}
              </div>
            </Campo>
          ) : null}

          <Campo rotulo="Próxima revisão">
            <Input
              value={proximaRevisao}
              onChange={(e) => setProximaRevisao(mascaraDataBr(e.target.value))}
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
            />
            <p className="text-xs italic text-[#94A3B8]">
              Aviso automático 30 dias antes da revisão.
            </p>
          </Campo>

          <div className="rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-4">
            <p className="text-[13px] leading-relaxed text-[#64748B]">
              Vai para — <strong className="text-[#1F2937]">(líder do processo)</strong> e depois
              para a <strong className="text-[#1F2937]">liderança da Qualidade</strong>. Só depois
              das duas aprovações a divulgação é liberada.
            </p>
          </div>

          <Campo rotulo="Arquivo do procedimento">
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.doc"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setArquivo(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9E0EA] bg-white px-6 py-10 text-center transition hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
            >
              <UploadCloud className="h-8 w-8 text-[#94A3B8]" />
              {arquivo ? (
                <>
                  <p className="mt-3 text-[13px] font-semibold text-[#1F2937]">{arquivo.name}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Clique para trocar ou arraste outro arquivo.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] font-medium text-[#1F2937]">
                  Arraste o .docx do POP ou clique para selecionar
                </p>
              )}
            </button>
            <p className="text-xs italic text-[#94A3B8]">
              O arquivo fica apenas para visualização e edição no site — não há download.
            </p>
          </Campo>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={enviar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Enviar para aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
