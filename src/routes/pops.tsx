import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Edit3,
  FileCheck,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MonitorSmartphone,
  MoreVertical,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Shield,
  Star,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CARGOS_RESPONSAVEIS,
  CATEGORIAS,
  DIFICULDADES,
  FREQUENCIAS,
  PRAZOS_REFERENCIA,
  REGIMES,
  carregarPops,
  contarPopsPorSetor,
  criarPop,
  atualizarPop,
  duplicarPop,
  excluirPop,
  rotuloDoValor,
  ENTRADA_PADRAO,
  type EntradaPop,
  type Pop,
  type SetorPop,
} from "@/lib/pops";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pops")({
  head: () => ({
    meta: [{ title: "POPs | Gestão da Qualidade" }],
  }),
  validateSearch: (search: Record<string, unknown>): PopSearch => {
    const setor = typeof search["setor"] === "string" ? search["setor"] : undefined;
    return setor ? { setor } : {};
  },
  component: Pops,
});

interface PopSearch {
  setor?: string;
}

const PAGE_SIZE = 7;

const ICONES_SETOR: Record<string, LucideIcon> = {
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

function iconeDoSetor(chave: string): LucideIcon {
  return ICONES_SETOR[chave] ?? LayoutGrid;
}

/* -------------------------------------------------------------------------- */
/* Cores das tags do cartão POP                                               */
/* -------------------------------------------------------------------------- */

const BG = {
  indigo: "bg-[#EEF2FF]",
  sky: "bg-[#EFF6FF]",
  amber: "bg-[#FEF3C7]",
  orange: "bg-[#FFF7ED]",
  emerald: "bg-[#ECFDF5]",
  rose: "bg-[#FFF1F2]",
  gray: "bg-[#F1F5F9]",
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

const COR_NEUTRA = `${BG.muted} ${TEXT.muted}`;
const COR_AZUL = `${BG.sky} ${TEXT.sky}`;
const COR_VIOLETA = `${BG.indigo} ${TEXT.indigo}`;
const COR_VERDE = `${BG.emerald} ${TEXT.emerald}`;
const COR_LARANJA = `${BG.orange} ${TEXT.orange}`;

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

function formatarPrazo(valor: string | null): string {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function paginasCompactas(paginaAtual: number, totalPaginas: number): (number | "…")[] {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }
  const paginas = new Set<number>([1, totalPaginas]);
  for (let i = Math.max(1, paginaAtual - 1); i <= Math.min(totalPaginas, paginaAtual + 2); i += 1) {
    paginas.add(i);
  }
  const resultado: (number | "…")[] = [];
  let anterior = 0;
  for (const p of [...paginas].sort((a, b) => a - b)) {
    if (p - anterior > 1) resultado.push("…");
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}

/* -------------------------------------------------------------------------- */
/* Componentes de apoio                                                       */
/* -------------------------------------------------------------------------- */

function Tag({ cor, rotulo, children }: { cor: string; rotulo: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]", cor)}>
      <span className="font-medium opacity-70">{rotulo}</span>
      <span className="font-semibold">{children}</span>
    </span>
  );
}

function Meta({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-[#94A3B8]">{rotulo}</span>
      <span className="text-[13px] font-semibold text-[#1F2937]">{valor}</span>
    </div>
  );
}

interface CardSetorProps {
  nome: string;
  chaveIcone: string;
  contagem: number;
  aoClicar: () => void;
  destaque?: boolean;
}

function CardSetor({ nome, chaveIcone, contagem, aoClicar, destaque = false }: CardSetorProps) {
  const Icone = iconeDoSetor(chaveIcone);
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="group relative flex min-h-[130px] flex-col rounded-2xl border border-[#D9E0EA] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#1E3A8A]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition",
            destaque
              ? "bg-[#1E3A8A] text-white"
              : "bg-[#EEF2F7] text-[#1E3A8A] group-hover:bg-[#E0E7FF]",
          )}
        >
          <Icone className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-xs font-bold text-[#1F2937]">
          ({contagem})
        </span>
      </div>
      <div className="mt-auto pt-4">
        <p className="text-[14px] font-semibold leading-snug text-[#1F2937]">{nome}</p>
        <p className="mt-1 text-[11px] text-[#64748B]">
          {destaque
            ? "Todos os POPs do portal"
            : contagem === 0
              ? "Nenhum POP cadastrado ainda"
              : "Ver POPs do setor"}
        </p>
      </div>
    </button>
  );
}

interface PopCardProps {
  pop: Pop;
  onEditar: (pop: Pop) => void;
  onDuplicar: (pop: Pop) => void;
  onExcluir: (pop: Pop) => void;
}

function PopCard({ pop, onEditar, onDuplicar, onExcluir }: PopCardProps) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm lg:flex-row lg:gap-6 lg:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E3A8A]">
            {pop.codigo}
          </span>
          <h3 className="text-[15px] font-bold tracking-tight text-[#1F2937]">{pop.titulo}</h3>
        </div>

        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#64748B]">
          {pop.descricao || "Sem descrição cadastrada."}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag cor={COR_NEUTRA} rotulo="Depto">
            {pop.departamento || "—"}
          </Tag>
          <Tag cor={classeCategoria(pop.categoria)} rotulo="Categoria">
            {rotuloDoValor(pop.categoria)}
          </Tag>
          <Tag cor={COR_AZUL} rotulo="Frequência">
            {rotuloDoValor(pop.frequencia)}
          </Tag>
          <Tag cor={COR_VIOLETA} rotulo="Prazo de ref.">
            {rotuloDoValor(pop.prazoReferencia)}
          </Tag>
          <Tag cor={COR_VERDE} rotulo="Regime">
            {rotuloDoValor(pop.regime)}
          </Tag>
          <Tag cor={classeDificuldade(pop.dificuldade)} rotulo="Dificuldade">
            {rotuloDoValor(pop.dificuldade)}
          </Tag>
          <Tag cor={COR_LARANJA} rotulo="Cargo">
            {rotuloDoValor(pop.cargoResponsavel)}
          </Tag>
        </div>
      </div>

      <aside className="lg:w-64 flex shrink-0 flex-col rounded-xl border border-[#E9EEF5] bg-[#F8FAFC]">
        <div className="flex items-center justify-between border-b border-[#E9EEF5] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Prazo e controles
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#64748B]"
                aria-label="Ações do POP"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditar(pop)}>
                <Edit3 className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicar(pop)}>
                <Copy className="h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onExcluir(pop)}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 space-y-2.5 px-4 py-3">
          <Meta
            rotulo="Dia de início"
            valor={pop.diaInicio !== null ? String(pop.diaInicio) : "—"}
          />
          <Meta
            rotulo="Meta de conclusão"
            valor={pop.metaDia !== null ? String(pop.metaDia) : "—"}
          />
          <Meta rotulo="Prazo legal" valor={formatarPrazo(pop.prazoLegal)} />
        </div>

        <div className="flex items-center gap-4 border-t border-[#E9EEF5] px-4 py-2.5">
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1F2937]">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {pop.favoritos}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1F2937]">
            <MessageSquare className="h-3.5 w-3.5 text-[#64748B]" /> {pop.anotacoes}
          </span>
        </div>
      </aside>
    </li>
  );
}

function Paginador({
  pagina,
  totalPaginas,
  onMudar,
}: {
  pagina: number;
  totalPaginas: number;
  onMudar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  const paginas = paginasCompactas(pagina + 1, totalPaginas);
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={pagina === 0}
        onClick={() => onMudar(pagina - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {paginas.map((item, indice) =>
        item === "…" ? (
          <span
            key={`reticencias-${indice}`}
            className="flex h-8 w-8 items-center justify-center text-[13px] text-[#94A3B8]"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onMudar(item - 1)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-semibold transition",
              item - 1 === pagina ? "bg-[#1E3A8A] text-white" : "text-[#64748B] hover:bg-[#EEF2F7]",
            )}
          >
            {item}
          </button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={pagina >= totalPaginas - 1}
        onClick={() => onMudar(pagina + 1)}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tela 1 — Grade de setores                                                  */
/* -------------------------------------------------------------------------- */

interface GradeProps {
  setores: SetorPop[];
  contagens: Record<string, number>;
  totalPops: number;
  aoAbrirSetor: (id: string) => void;
  aoCriar: () => void;
}

function GradeDeSetores({ setores, contagens, totalPops, aoAbrirSetor, aoCriar }: GradeProps) {
  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Processos e padrões
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Procedimentos Operacionais Padrão
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Selecione um setor para navegar pelos POPs cadastrados.
          </p>
        </div>
        <Button className="shrink-0" onClick={aoCriar}>
          <Plus className="h-4 w-4" />
          Novo POP
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CardSetor
          nome="Todos os Setores"
          chaveIcone="layout-grid"
          contagem={totalPops}
          destaque
          aoClicar={() => aoAbrirSetor("todos")}
        />
        {setores.map((s) => (
          <CardSetor
            key={s.id}
            nome={s.nome}
            chaveIcone={s.icone}
            contagem={contagens[s.id] ?? 0}
            aoClicar={() => aoAbrirSetor(s.id)}
          />
        ))}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tela 2 — Lista de POPs do setor                                            */
/* -------------------------------------------------------------------------- */

interface ListaProps {
  nomeSetor: string;
  total: number;
  busca: string;
  aoMudarBusca: (valor: string) => void;
  itens: Pop[];
  pagina: number;
  totalPaginas: number;
  aoMudarPagina: (pagina: number) => void;
  aoVoltar: () => void;
  aoCriar: () => void;
  aoEditar: (pop: Pop) => void;
  aoDuplicar: (pop: Pop) => void;
  aoExcluir: (pop: Pop) => void;
}

function ListaDePops({
  nomeSetor,
  total,
  busca,
  aoMudarBusca,
  itens,
  pagina,
  totalPaginas,
  aoMudarPagina,
  aoVoltar,
  aoCriar,
  aoEditar,
  aoDuplicar,
  aoExcluir,
}: ListaProps) {
  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
            onClick={aoVoltar}
            aria-label="Voltar para a grade de setores"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Processos e padrões
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
              {nomeSetor}
            </h1>
            <p className="mt-1.5 text-sm text-[#64748B]">
              {total} {total === 1 ? "POP cadastrado" : "POPs cadastrados"}
              {busca ? " para a busca atual" : ""}
            </p>
          </div>
        </div>
        <Button className="shrink-0" onClick={aoCriar}>
          <Plus className="h-4 w-4" />
          Novo POP
        </Button>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <Input
          value={busca}
          onChange={(e) => aoMudarBusca(e.target.value)}
          placeholder="Buscar por código ou título do POP…"
          className="h-10 pl-9"
        />
      </div>

      <ul className="space-y-3">
        {itens.length === 0 ? (
          <li className="flex flex-col items-center justify-center rounded-2xl border border-[#D9E0EA] bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <FileCheck className="h-7 w-7 text-[#94A3B8]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhum POP encontrado</h3>
            <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
              {busca
                ? "Ajuste o termo da busca ou cadastre um novo procedimento."
                : "Este setor ainda não possui POPs cadastrados."}
            </p>
          </li>
        ) : (
          itens.map((pop) => (
            <PopCard
              key={pop.id}
              pop={pop}
              onEditar={aoEditar}
              onDuplicar={aoDuplicar}
              onExcluir={aoExcluir}
            />
          ))
        )}
      </ul>

      <footer className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-[#64748B]">
          {itens.length} de {total} itens
        </p>
        <Paginador pagina={pagina} totalPaginas={totalPaginas} onMudar={aoMudarPagina} />
      </footer>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Formulário de criação / edição                                             */
/* -------------------------------------------------------------------------- */

interface CampoProps {
  rotulo: string;
  className?: string;
  children: ReactNode;
}

function Campo({ rotulo, className, children }: CampoProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

function camposDoPop(pop: Pop): EntradaPop {
  return {
    setorId: pop.setorId,
    codigo: pop.codigo,
    titulo: pop.titulo,
    descricao: pop.descricao,
    departamento: pop.departamento,
    categoria: pop.categoria,
    frequencia: pop.frequencia,
    prazoReferencia: pop.prazoReferencia,
    regime: pop.regime,
    dificuldade: pop.dificuldade,
    cargoResponsavel: pop.cargoResponsavel,
    diaInicio: pop.diaInicio,
    metaDia: pop.metaDia,
    prazoLegal: pop.prazoLegal,
    arquivo: pop.arquivo,
  };
}

interface PopFormDialogProps {
  aberto: boolean;
  pop: Pop | null;
  setores: SetorPop[];
  setorPadrao: string;
  onFechar: () => void;
  onSalvo: () => void;
}

function PopFormDialog({
  aberto,
  pop,
  setores,
  setorPadrao,
  onFechar,
  onSalvo,
}: PopFormDialogProps) {
  const [entrada, setEntrada] = useState<EntradaPop>(ENTRADA_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setEntrada(pop ? camposDoPop(pop) : { ...ENTRADA_PADRAO, setorId: setorPadrao });
      setSalvando(false);
    }
  }, [aberto, pop, setorPadrao]);

  function definir<C extends keyof EntradaPop>(campo: C, valor: EntradaPop[C]) {
    setEntrada((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    if (!entrada.codigo.trim() || !entrada.titulo.trim()) {
      toast.error("Preencha o código e o título do POP");
      return;
    }
    setSalvando(true);
    try {
      if (pop) {
        await atualizarPop(pop.id, entrada);
        toast.success("POP atualizado com sucesso");
      } else {
        await criarPop(entrada);
        toast.success("POP criado com sucesso");
      }
      onSalvo();
      onFechar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o POP");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pop ? "Editar POP" : "Novo POP"}</DialogTitle>
          <DialogDescription>
            {pop
              ? "Ajuste os dados do procedimento e salve as alterações."
              : "Cadastre o procedimento operacional padrão."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          <Campo rotulo="Setor">
            <Select value={entrada.setorId} onValueChange={(v) => definir("setorId", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {setores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Código">
            <Input
              value={entrada.codigo}
              onChange={(e) => definir("codigo", e.target.value)}
              placeholder="Ex.: FIS-01"
            />
          </Campo>

          <Campo rotulo="Título" className="sm:col-span-2">
            <Input
              value={entrada.titulo}
              onChange={(e) => definir("titulo", e.target.value)}
              placeholder="Ex.: Apuração do ICMS"
            />
          </Campo>

          <Campo rotulo="Descrição" className="sm:col-span-2">
            <Textarea
              value={entrada.descricao}
              onChange={(e) => definir("descricao", e.target.value)}
              placeholder="Resuma o procedimento e o que ele padroniza."
              className="min-h-[80px]"
            />
          </Campo>

          <Campo rotulo="Departamento">
            <Input
              value={entrada.departamento}
              onChange={(e) => definir("departamento", e.target.value)}
              placeholder="Ex.: Fiscal"
            />
          </Campo>

          <Campo rotulo="Categoria">
            <Select value={entrada.categoria} onValueChange={(v) => definir("categoria", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Frequência">
            <Select value={entrada.frequencia} onValueChange={(v) => definir("frequencia", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIAS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Prazo de referência">
            <Select
              value={entrada.prazoReferencia}
              onValueChange={(v) => definir("prazoReferencia", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRAZOS_REFERENCIA.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Regime aplicável">
            <Select value={entrada.regime} onValueChange={(v) => definir("regime", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Dificuldade">
            <Select value={entrada.dificuldade} onValueChange={(v) => definir("dificuldade", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFICULDADES.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Cargo responsável">
            <Select
              value={entrada.cargoResponsavel}
              onValueChange={(v) => definir("cargoResponsavel", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARGOS_RESPONSAVEIS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {rotuloDoValor(opcao)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Dia de início do prazo">
            <Input
              type="number"
              min={1}
              max={31}
              value={entrada.diaInicio ?? ""}
              onChange={(e) =>
                definir("diaInicio", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Ex.: 5"
            />
          </Campo>

          <Campo rotulo="Meta (dia ideal de conclusão)">
            <Input
              type="number"
              min={1}
              max={31}
              value={entrada.metaDia ?? ""}
              onChange={(e) =>
                definir("metaDia", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Ex.: 12"
            />
          </Campo>

          <Campo rotulo="Prazo legal (data limite)" className="sm:col-span-2">
            <Input
              type="date"
              value={entrada.prazoLegal ?? ""}
              onChange={(e) => definir("prazoLegal", e.target.value || null)}
            />
          </Campo>

          <Campo rotulo="Arquivo do procedimento" className="sm:col-span-2">
            <Input
              type="file"
              onChange={(e) => definir("arquivo", e.target.files?.[0]?.name ?? null)}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : pop ? (
              "Salvar alterações"
            ) : (
              "Criar POP"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                     */
/* -------------------------------------------------------------------------- */

function Pops() {
  const { setor } = Route.useSearch();
  const router = useRouter();
  const [setores, setSetores] = useState<SetorPop[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [formAberto, setFormAberto] = useState(false);
  const [popEmEdicao, setPopEmEdicao] = useState<Pop | null>(null);
  const [popExcluindo, setPopExcluindo] = useState<Pop | null>(null);

  useEffect(() => {
    let ativo = true;
    void carregarPops()
      .then((dados) => {
        if (!ativo) return;
        setSetores(dados.setores);
        setPops([...dados.pops].sort((a, b) => a.codigo.localeCompare(b.codigo)));
      })
      .catch((erro) => {
        if (!ativo) return;
        toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar os POPs");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    setPagina(0);
  }, [busca, setor]);

  async function buscarDados() {
    try {
      const dados = await carregarPops();
      setSetores(dados.setores);
      setPops([...dados.pops].sort((a, b) => a.codigo.localeCompare(b.codigo)));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar os POPs");
    }
  }

  function navegarParaSetor(id: string) {
    void router.navigate({ to: "/pops", search: { setor: id } });
  }

  function voltarParaGrade() {
    void router.navigate({ to: "/pops", search: {} });
  }

  async function duplicar(pop: Pop) {
    try {
      await duplicarPop(pop);
      toast.success("POP duplicado com sucesso");
      await buscarDados();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível duplicar o POP");
    }
  }

  async function confirmarExclusao() {
    if (!popExcluindo) return;
    try {
      await excluirPop(popExcluindo.id);
      toast.success("POP excluído");
      setPopExcluindo(null);
      await buscarDados();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir o POP");
    }
  }

  const setorEhTodos = setor === "todos";
  const setorSelecionado =
    setor && setor !== "todos" ? setores.find((s) => s.id === setor) : undefined;
  const mostraLista = setorEhTodos || Boolean(setorSelecionado);
  const nomeDoSetor = setorEhTodos ? "Todos os Setores" : (setorSelecionado?.nome ?? "POPs");

  const contagens = useMemo(() => contarPopsPorSetor(pops), [pops]);

  const popsDoSetor = useMemo(() => {
    if (setorEhTodos || !setorSelecionado) return pops;
    return pops.filter((p) => p.setorId === setorSelecionado.id);
  }, [pops, setorEhTodos, setorSelecionado]);

  const termo = busca.trim().toLowerCase();
  const popsVisiveis = useMemo(() => {
    if (!termo) return popsDoSetor;
    return popsDoSetor.filter(
      (p) => p.codigo.toLowerCase().includes(termo) || p.titulo.toLowerCase().includes(termo),
    );
  }, [popsDoSetor, termo]);

  const total = popsVisiveis.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * PAGE_SIZE;
  const itensDaPagina = popsVisiveis.slice(inicio, inicio + PAGE_SIZE);

  function abrirCriacao() {
    setPopEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(pop: Pop) {
    setPopEmEdicao(pop);
    setFormAberto(true);
  }

  let conteudo: ReactNode;
  if (carregando) {
    conteudo = (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A8A]" />
        <p className="text-sm text-[#64748B]">Carregando POPs…</p>
      </div>
    );
  } else if (!mostraLista) {
    conteudo = (
      <GradeDeSetores
        setores={setores}
        contagens={contagens}
        totalPops={pops.length}
        aoAbrirSetor={navegarParaSetor}
        aoCriar={abrirCriacao}
      />
    );
  } else {
    conteudo = (
      <ListaDePops
        nomeSetor={nomeDoSetor}
        total={total}
        busca={busca}
        aoMudarBusca={setBusca}
        itens={itensDaPagina}
        pagina={paginaAtual}
        totalPaginas={totalPaginas}
        aoMudarPagina={setPagina}
        aoVoltar={voltarParaGrade}
        aoCriar={abrirCriacao}
        aoEditar={abrirEdicao}
        aoDuplicar={(p) => void duplicar(p)}
        aoExcluir={(p) => setPopExcluindo(p)}
      />
    );
  }

  return (
    <PanelShell wide>
      {conteudo}

      <p className="mt-8 text-center text-[11px] text-[#94A3B8]">
        Desenvolvido com 💙 pelos Desenvolvedores Orcoma Contabilidade
      </p>

      <PopFormDialog
        aberto={formAberto}
        pop={popEmEdicao}
        setores={setores}
        setorPadrao={setorSelecionado?.id ?? setores[0]?.id ?? ENTRADA_PADRAO.setorId}
        onFechar={() => setFormAberto(false)}
        onSalvo={buscarDados}
      />

      <AlertDialog
        open={popExcluindo !== null}
        onOpenChange={(abre) => (abre ? undefined : setPopExcluindo(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir POP?</AlertDialogTitle>
            <AlertDialogDescription>
              {popExcluindo?.codigo} — {popExcluindo?.titulo}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmarExclusao()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelShell>
  );
}
