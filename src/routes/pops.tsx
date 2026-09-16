import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FileText,
  LayoutGrid,
  Link2,
  Loader2,
  MessageSquare,
  MonitorSmartphone,
  MoreVertical,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Send,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { getSession } from "@/lib/auth";
import { temAcessoTotalPops } from "@/lib/permissoes";
import {
  CARGOS_RESPONSAVEIS,
  CATEGORIAS,
  DIFICULDADES,
  FREQUENCIAS,
  PRAZOS_REFERENCIA,
  REGIMES,
  ROTULO_TIPO_ANEXO,
  aplicarContadores,
  assinarAnotacoesPop,
  assinarContadoresPops,
  assinarNotificacoes,
  atualizarPop,
  carregarContadoresPops,
  carregarFavoritosDoUsuario,
  carregarLeiturasDoUsuario,
  carregarNotificacoes,
  carregarPopsAcessiveis,
  contarNaoLidas,
  contarPopsPorSetor,
  criarAnotacao,
  criarPop,
  desfavoritarPop,
  duplicarPop,
  enviarAnexoPop,
  excluirAnotacao,
  excluirPop,
  favoritarPop,
  listarAnotacoes,
  listarLeiturasPop,
  marcarNotificacaoLida,
  registrarLeitura,
  rotuloDoValor,
  textoDoAnexoDocx,
  urlAssinadaDoAnexo,
  ENTRADA_PADRAO,
  type DecisaoLeitura,
  type EntradaPop,
  type Notificacao,
  type Pop,
  type PopAnotacao,
  type PopEtapa,
  type PopLeitura,
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
  favoritado: boolean;
  onAbrir: (pop: Pop) => void;
  onEditar: (pop: Pop) => void;
  onDuplicar: (pop: Pop) => void;
  onExcluir: (pop: Pop) => void;
  onDiscutir: (pop: Pop) => void;
  onFavoritar: (pop: Pop) => void;
}

function PopCard({
  pop,
  favoritado,
  onAbrir,
  onEditar,
  onDuplicar,
  onExcluir,
  onDiscutir,
  onFavoritar,
}: PopCardProps) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm lg:flex-row lg:gap-6 lg:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E3A8A]">
            {pop.codigo}
          </span>
          <button
            type="button"
            onClick={() => onAbrir(pop)}
            title="Abrir o POP"
            className="text-left text-[15px] font-bold tracking-tight text-[#1F2937] transition hover:text-[#1E3A8A] hover:underline"
          >
            {pop.titulo}
          </button>
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
          {/* Contadores reais do banco: 0 enquanto ninguém favoritou/comentou. */}
          <button
            type="button"
            onClick={() => onFavoritar(pop)}
            aria-pressed={favoritado}
            aria-label={favoritado ? "Remover dos favoritos" : "Favoritar POP"}
            title={favoritado ? "Remover dos favoritos" : "Favoritar POP"}
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-medium transition",
              favoritado ? "text-amber-600" : "text-[#1F2937] hover:text-[#1E3A8A]",
            )}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                favoritado ? "fill-amber-400 text-amber-400" : "text-[#64748B]",
              )}
            />
            {pop.favoritos}
          </button>
          <button
            type="button"
            onClick={() => onDiscutir(pop)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1F2937] transition hover:text-[#1E3A8A]"
            aria-label={`Abrir discussão — ${pop.anotacoes} anotações`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#64748B] group-hover:text-[#1E3A8A]" />{" "}
            {pop.anotacoes}
          </button>
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
  onAbrir: (pop: Pop) => void;
  favoritos: string[];
  aoEditar: (pop: Pop) => void;
  aoDuplicar: (pop: Pop) => void;
  aoExcluir: (pop: Pop) => void;
  aoDiscutir: (pop: Pop) => void;
  aoFavoritar: (pop: Pop) => void;
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
  onAbrir,
  favoritos,
  aoEditar,
  aoDuplicar,
  aoExcluir,
  aoDiscutir,
  aoFavoritar,
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
              favoritado={favoritos.includes(pop.id)}
              onAbrir={onAbrir}
              onEditar={aoEditar}
              onDuplicar={aoDuplicar}
              onExcluir={aoExcluir}
              onDiscutir={aoDiscutir}
              onFavoritar={aoFavoritar}
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
    objetivo: pop.objetivo ?? "",
    materiaisSistemas: pop.materiaisSistemas ?? "",
    documentosGerados: pop.documentosGerados ?? "",
    linksRelacionados: pop.linksRelacionados ?? [],
    observacoes: pop.observacoes ?? "",
    etapas: pop.etapas ?? [],
  };
}

/** Converte o texto do formulário (uma etapa por linha; 2 espaços = subnível). */
function etapasDoTexto(texto: string): PopEtapa[] {
  return texto
    .split("\n")
    .map((linha) => {
      const recuo = linha.match(/^ */)?.[0].length ?? 0;
      return { nivel: Math.min(4, Math.floor(recuo / 2)), texto: linha.trim() };
    })
    .filter((etapa) => etapa.texto !== "");
}

/** Devolve as etapas como texto do formulário (2 espaços por nível). */
function textoDasEtapas(etapas: PopEtapa[] | undefined): string {
  return (etapas ?? []).map((etapa) => "  ".repeat(etapa.nivel) + etapa.texto).join("\n");
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

  const [textoEtapas, setTextoEtapas] = useState("");
  const [textoLinks, setTextoLinks] = useState("");
  const [anexoNovo, setAnexoNovo] = useState<File | null>(null);

  useEffect(() => {
    if (aberto) {
      setEntrada(pop ? camposDoPop(pop) : { ...ENTRADA_PADRAO, setorId: setorPadrao });
      setTextoEtapas(textoDasEtapas(pop?.etapas));
      setTextoLinks((pop?.linksRelacionados ?? []).join("\n"));
      setAnexoNovo(null);
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
      const dados: EntradaPop = {
        ...entrada,
        etapas: etapasDoTexto(textoEtapas),
        linksRelacionados: textoLinks
          .split("\n")
          .map((link) => link.trim())
          .filter((link) => link !== ""),
      };
      let popSalvo: Pop;
      if (pop) {
        popSalvo = await atualizarPop(pop.id, dados);
        toast.success("POP atualizado com sucesso");
      } else {
        popSalvo = await criarPop(dados);
        toast.success("POP criado com sucesso");
      }
      if (anexoNovo) {
        await enviarAnexoPop(popSalvo.id, anexoNovo);
        toast.success("Anexo enviado");
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

          <Campo rotulo="Objetivo" className="sm:col-span-2">
            <Textarea
              value={entrada.objetivo ?? ""}
              onChange={(e) => definir("objetivo", e.target.value)}
              placeholder="Ex.: Realizar o lançamento da movimentação de provisões financeiras..."
              className="min-h-[60px]"
            />
          </Campo>

          <Campo rotulo="Materiais e Sistemas Necessários" className="sm:col-span-2">
            <Textarea
              value={entrada.materiaisSistemas ?? ""}
              onChange={(e) => definir("materiaisSistemas", e.target.value)}
              placeholder="Ex.: Software Domínio, Software de Comunicação..."
              className="min-h-[60px]"
            />
          </Campo>

          <Campo rotulo="Documentos Gerados" className="sm:col-span-2">
            <Textarea
              value={entrada.documentosGerados ?? ""}
              onChange={(e) => definir("documentosGerados", e.target.value)}
              placeholder="Ex.: Arquivo TXT"
              className="min-h-[50px]"
            />
          </Campo>

          <Campo rotulo="Links Relacionados (um por linha)" className="sm:col-span-2">
            <Textarea
              value={textoLinks}
              onChange={(e) => setTextoLinks(e.target.value)}
              placeholder={"https://youtu.be/...\nhttps://..."}
              className="min-h-[60px]"
            />
          </Campo>

          <Campo rotulo="Observações" className="sm:col-span-2">
            <Textarea
              value={entrada.observacoes ?? ""}
              onChange={(e) => definir("observacoes", e.target.value)}
              placeholder="Observações, boas práticas e pontos de atenção."
              className="min-h-[100px]"
            />
          </Campo>

          <Campo
            rotulo="Etapas do procedimento (uma por linha; 2 espaços = subpasso)"
            className="sm:col-span-2"
          >
            <Textarea
              value={textoEtapas}
              onChange={(e) => setTextoEtapas(e.target.value)}
              placeholder={
                "Receber o arquivo financeiro da empresa;\n  Caso o cliente tenha enviado: baixar os documentos;\n  Salvar na pasta;\nAnalisar o tipo do arquivo;"
              }
              className="min-h-[160px] font-mono text-[12px]"
            />
          </Campo>

          <Campo
            rotulo={
              pop?.anexo
                ? `Anexo atual: ${pop.anexo.nome} — escolha outro arquivo para substituir`
                : "Anexo do procedimento (WORD ou PDF, máx. 20 MB)"
            }
            className="sm:col-span-2"
          >
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setAnexoNovo(e.target.files?.[0] ?? null)}
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
/* Detalhe do POP (visualização no formato oficial do documento)              */
/* -------------------------------------------------------------------------- */

function RotuloDetalhe({ children }: { children: ReactNode }) {
  return (
    <span className="font-bold text-[#1E293B]">
      {children}
      {": "}
    </span>
  );
}

function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const vazio =
    children === null ||
    children === undefined ||
    (typeof children === "string" && children.trim() === "");
  if (vazio) return null;
  return (
    <p className="text-[13.5px] leading-relaxed text-[#334155]">
      <RotuloDetalhe>{rotulo}</RotuloDetalhe>
      {children}
    </p>
  );
}

/** Visualizador embutido do anexo: PDF via <iframe> de URL assinada; DOCX em texto. */
function PopAnexoVisualizador({ pop }: { pop: Pop }) {
  const anexo = pop.anexo;
  const [url, setUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!anexo) return;
    let ativo = true;
    setUrl(null);
    setTexto(null);
    setErro("");
    setCarregando(true);
    const ehPdf = anexo.tipo === "application/pdf" || anexo.nome.toLowerCase().endsWith(".pdf");
    const tarefa = ehPdf
      ? urlAssinadaDoAnexo(anexo.path).then((link) => {
          if (ativo) setUrl(link);
        })
      : textoDoAnexoDocx(anexo.path).then((conteudo) => {
          if (!ativo) return;
          if (conteudo === null) setErro("Não foi possível extrair o texto deste arquivo.");
          else setTexto(conteudo);
        });
    tarefa
      .catch(() => {
        if (ativo) setErro("Não foi possível abrir o anexo agora. Tente novamente.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [anexo]);

  if (!anexo) return null;

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-[#D9E0EA]">
      <div className="flex items-center gap-2 border-b border-[#E9EEF5] bg-[#F8FAFC] px-4 py-2.5">
        <FileText className="h-4 w-4 text-[#1E3A8A]" />
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1F2937]">
          {anexo.nome}
          {anexo.tipo && ROTULO_TIPO_ANEXO[anexo.tipo] ? (
            <span className="ml-2 rounded bg-[#EEF2F7] px-1.5 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
              {ROTULO_TIPO_ANEXO[anexo.tipo]}
            </span>
          ) : null}
        </p>
        <span className="text-[11px] text-[#94A3B8]">Somente leitura — download bloqueado</span>
      </div>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo documento…
        </div>
      ) : erro ? (
        <p className="px-4 py-6 text-center text-[13px] text-destructive">{erro}</p>
      ) : url ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          title={`Visualização de ${anexo.nome}`}
          className="h-[65vh] w-full bg-white"
        />
      ) : texto !== null ? (
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap px-5 py-4 font-sans text-[13px] leading-relaxed text-[#334155]">
          {texto}
        </pre>
      ) : null}
    </div>
  );
}

/** Etapas numeradas, respeitando o recuo configurado no cadastro. */
function PopEtapas({ etapas }: { etapas: PopEtapa[] }) {
  let numero = 1;
  return (
    <ol className="space-y-1.5">
      {etapas.map((etapa, indice) => (
        <li
          key={`etapa-${indice}`}
          className="flex gap-2 text-[13.5px] leading-relaxed text-[#334155]"
          style={{ paddingLeft: `${etapa.nivel * 22}px` }}
        >
          <span
            className={cn(
              "shrink-0 font-semibold",
              etapa.nivel <= 0 ? "text-[#1E3A8A]" : "text-[#64748B]",
            )}
          >
            {etapa.nivel <= 0 ? `${numero++}.` : "•"}
          </span>
          <span className="whitespace-pre-wrap">{etapa.texto}</span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Ciência do POP: "Li e Concordo" / "Li e DISCORDO!"                         */
/* -------------------------------------------------------------------------- */

interface SecaoCienciaProps {
  leitura: PopLeitura | null;
  todasLeituras: PopLeitura[];
  composerAberto: boolean;
  justificativa: string;
  enviando: boolean;
  aoMudarJustificativa: (valor: string) => void;
  aoAbrirComposer: () => void;
  aoCancelarComposer: () => void;
  aoConfirmar: (decisao: DecisaoLeitura) => void;
}

function SecaoCiencia({
  leitura,
  todasLeituras,
  composerAberto,
  justificativa,
  enviando,
  aoMudarJustificativa,
  aoAbrirComposer,
  aoCancelarComposer,
  aoConfirmar,
}: SecaoCienciaProps) {
  const concordancias = todasLeituras.filter((l) => l.decisao === "concordo").length;
  const discordancias = todasLeituras.filter((l) => l.decisao === "discordo").length;

  return (
    <section className="mt-5 border-t border-[#E9EEF5] pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {leitura?.decisao === "concordo" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[12px] font-semibold text-[#047857]">
            <ThumbsUp className="h-3.5 w-3.5" /> Li e concordo
          </span>
        ) : leitura?.decisao === "discordo" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] px-3 py-1.5 text-[12px] font-semibold text-[#B91C1C]">
            <ThumbsDown className="h-3.5 w-3.5" /> Li e discordo
          </span>
        ) : (
          <span className="text-[12.5px] text-[#64748B]">
            Após a leitura deste POP, registre sua ciência:
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={enviando || composerAberto}
            onClick={() => aoConfirmar("concordo")}
            className="bg-[#047857] text-white hover:bg-[#059669]"
          >
            <ThumbsUp className="h-4 w-4" /> Li e Concordo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={enviando || composerAberto}
            onClick={aoAbrirComposer}
            className="border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2]"
          >
            <ThumbsDown className="h-4 w-4" /> Li e DISCORDO!
          </Button>
        </div>

        <span className="text-[12px] text-[#94A3B8]">
          {concordancias} concordam · {discordancias} discordam
        </span>
      </div>

      {composerAberto ? (
        <div className="mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2]/60 p-4">
          <Label className="text-[13px] font-semibold text-[#7F1D1D]">
            Justifique a sua discordância
          </Label>
          <Textarea
            value={justificativa}
            onChange={(e) => aoMudarJustificativa(e.target.value)}
            placeholder="Descreva o ponto do POP com o qual você discorda e a sua sugestão. Esta mensagem será enviada ao Coordenador da Qualidade e ao time de Qualidade."
            className="mt-1.5 min-h-[110px] border-[#FCA5A5] bg-white"
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={aoCancelarComposer}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={enviando}
              onClick={() => aoConfirmar("discordo")}
              className="bg-[#B91C1C] text-white hover:bg-[#DC2626]"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar discordância
            </Button>
          </div>
        </div>
      ) : null}

      {leitura?.decisao === "discordo" && leitura.justificativa ? (
        <p className="mt-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#7F1D1D]">
          <span className="font-semibold">Sua justificativa:</span> {leitura.justificativa}
        </p>
      ) : null}

      {todasLeituras.filter((l) => l.decisao === "discordo").length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {todasLeituras
            .filter((l) => l.decisao === "discordo")
            .map((l) => (
              <div key={l.id} className="rounded-lg border border-[#FECACA] bg-white px-3 py-2">
                <p className="text-[12px] font-semibold text-[#7F1D1D]">
                  {l.usuarioNome || l.usuarioEmail} discordou
                </p>
                {l.justificativa ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[#334155]">
                    {l.justificativa}
                  </p>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

interface PopDetalheProps {
  pop: Pop;
  onFechar: () => void;
}

function PopDetalhe({ pop, onFechar }: PopDetalheProps) {
  const sessao = getSession();
  const email = sessao?.email ?? "";
  const nome = sessao?.nome ?? "";

  const [leitura, setLeitura] = useState<PopLeitura | null>(null);
  const [todasLeituras, setTodasLeituras] = useState<PopLeitura[]>([]);
  const [composerAberto, setComposerAberto] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setLeitura(null);
    setComposerAberto(false);
    setJustificativa("");
  }, [pop.id]);

  useEffect(() => {
    if (!email) return;
    let ativo = true;
    void Promise.all([carregarLeiturasDoUsuario(email), listarLeiturasPop(pop.id)])
      .then(([minhas, todas]) => {
        if (!ativo) return;
        setLeitura(minhas[pop.id] ?? null);
        setTodasLeituras(todas);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [email, pop.id]);

  async function registrar(decisao: DecisaoLeitura) {
    if (!email) {
      toast.error("Entre no portal para registrar sua leitura");
      return;
    }
    if (decisao === "discordo" && justificativa.trim() === "") {
      toast.error("Escreva a justificativa da sua discordância");
      return;
    }
    setEnviando(true);
    try {
      await registrarLeitura(pop.id, { email, nome }, decisao, justificativa.trim());
      const [minhas, todas] = await Promise.all([
        carregarLeiturasDoUsuario(email),
        listarLeiturasPop(pop.id),
      ]);
      setLeitura(minhas[pop.id] ?? null);
      setTodasLeituras(todas);
      setComposerAberto(false);
      setJustificativa("");
      toast.success(
        decisao === "concordo"
          ? "Registro salvo: você leu e concordou com este POP"
          : "Discordância registrada e enviada à Qualidade",
      );
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar sua leitura");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onFechar} className="text-[#64748B]">
          <ArrowLeft className="h-4 w-4" /> Voltar para os POPs
        </Button>
        <span className="rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E3A8A]">
          {pop.codigo}
        </span>
      </div>

      <article className="rounded-2xl border border-[#D9E0EA] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold tracking-tight text-[#1F2937] sm:text-xl">{pop.titulo}</h2>
        {pop.descricao ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#64748B]">{pop.descricao}</p>
        ) : null}

        <div className="mt-5 space-y-3 border-t border-[#E9EEF5] pt-5">
          <LinhaDetalhe rotulo="Objetivo">{pop.objetivo || pop.descricao}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Departamento">{pop.departamento}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Cargo Responsável">
            {rotuloDoValor(pop.cargoResponsavel)}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Periodicidade">{rotuloDoValor(pop.frequencia)}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Data Início">
            {pop.diaInicio !== null ? String(pop.diaInicio) : "—"}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Data Meta">
            {pop.metaDia !== null ? String(pop.metaDia) : "—"}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Competência">{rotuloDoValor(pop.prazoReferencia)}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Regime Tributário">{rotuloDoValor(pop.regime)}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Complexidade">{rotuloDoValor(pop.dificuldade)}</LinhaDetalhe>
          <LinhaDetalhe rotulo="Materiais e Sistemas Necessários">
            {pop.materiaisSistemas}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Documentos Gerados">{pop.documentosGerados}</LinhaDetalhe>
          {(pop.linksRelacionados ?? []).length > 0 ? (
            <div className="text-[13.5px] leading-relaxed text-[#334155]">
              <RotuloDetalhe>Links Relacionados</RotuloDetalhe>
              <ul className="mt-1 space-y-1">
                {(pop.linksRelacionados ?? []).map((link) => (
                  <li key={link} className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-[#1E3A8A]" />
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-[#1E3A8A] underline decoration-[#C7D2E4] underline-offset-2 hover:decoration-[#1E3A8A]"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <LinhaDetalhe rotulo="Observações">
            <span className="whitespace-pre-wrap">{pop.observacoes}</span>
          </LinhaDetalhe>
        </div>

        {pop.etapas && pop.etapas.length > 0 ? (
          <div className="mt-5 border-t border-[#E9EEF5] pt-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#1E293B]">
              Procedimento
            </h3>
            <div className="mt-3">
              <PopEtapas etapas={pop.etapas} />
            </div>
          </div>
        ) : null}

        <PopAnexoVisualizador pop={pop} />

        <SecaoCiencia
          leitura={leitura}
          todasLeituras={todasLeituras}
          composerAberto={composerAberto}
          justificativa={justificativa}
          enviando={enviando}
          aoMudarJustificativa={setJustificativa}
          aoAbrirComposer={() => setComposerAberto(true)}
          aoCancelarComposer={() => {
            setComposerAberto(false);
            setJustificativa("");
          }}
          aoConfirmar={(decisao) => void registrar(decisao)}
        />
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Discussão do POP (anotações / comentários)                                 */
/* -------------------------------------------------------------------------- */

interface PopDiscussaoDialogProps {
  aberto: boolean;
  pop: Pop | null;
  onFechar: () => void;
  onAtualizado: () => void;
}

function formatarDataAnotacao(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PopDiscussaoDialog({ aberto, pop, onFechar, onAtualizado }: PopDiscussaoDialogProps) {
  const sessao = getSession();
  const [anotacoes, setAnotacoes] = useState<PopAnotacao[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto || !pop) return;
    let ativo = true;
    setCarregando(true);
    setMensagem("");
    listarAnotacoes(pop.id)
      .then((dados) => {
        if (ativo) setAnotacoes(dados);
      })
      .catch((erro) => {
        if (ativo)
          toast.error(
            erro instanceof Error ? erro.message : "Não foi possível carregar as anotações",
          );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, pop]);

  // Novos comentários (inclusive de outros usuários) aparecem na hora.
  useEffect(() => {
    if (!aberto || !pop) return undefined;
    const popId = pop.id;
    const cancelar = assinarAnotacoesPop(popId, () => {
      void listarAnotacoes(popId)
        .then((dados) => setAnotacoes(dados))
        .catch(() => undefined);
    });
    return cancelar;
  }, [aberto, pop]);

  async function enviarAnotacao() {
    const texto = mensagem.trim();
    if (!texto) {
      toast.error("Escreva uma mensagem antes de enviar");
      return;
    }
    const autorNome = sessao?.nome ?? "Usuário";
    const autorEmail = sessao?.email ?? "";
    setEnviando(true);
    try {
      await criarAnotacao(pop!.id, { autorNome, autorEmail, mensagem: texto });
      const novas = await listarAnotacoes(pop!.id);
      setAnotacoes(novas);
      setMensagem("");
      onAtualizado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a anotação");
    } finally {
      setEnviando(false);
    }
  }

  async function removerAnotacao(anotacao: PopAnotacao) {
    try {
      await excluirAnotacao(anotacao);
      setAnotacoes((atuais) => atuais.filter((a) => a.id !== anotacao.id));
      onAtualizado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir a anotação");
    }
  }

  const podeExcluir = (anotacao: PopAnotacao) =>
    sessao?.email !== "" && (sessao?.role === "admin" || sessao?.email === anotacao.autorEmail);

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Discussão — {pop?.codigo ?? ""}</DialogTitle>
          <DialogDescription>
            {pop?.titulo ?? ""}. Compartilhe dúvidas e orientações sobre este procedimento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto pr-1">
          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin text-[#1E3A8A]" />
              Carregando anotações…
            </div>
          ) : anotacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-6 py-10 text-center">
              <MessageSquare className="h-6 w-6 text-[#94A3B8]" />
              <p className="mt-3 text-sm font-semibold text-[#1F2937]">Nenhuma anotação ainda</p>
              <p className="mt-1 text-[13px] text-[#64748B]">
                Seja a primeira pessoa a comentar sobre este POP.
              </p>
            </div>
          ) : (
            anotacoes.map((anotacao) => (
              <div
                key={anotacao.id}
                className="rounded-xl border border-[#E9EEF5] bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2F7] text-[11px] font-bold uppercase text-[#1E3A8A]">
                      {anotacao.autorNome.slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1F2937]">
                        {anotacao.autorNome}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {formatarDataAnotacao(anotacao.createdAt)}
                      </p>
                    </div>
                  </div>
                  {podeExcluir(anotacao) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#94A3B8] hover:text-rose-600"
                      onClick={() => void removerAnotacao(anotacao)}
                      aria-label="Excluir anotação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#475569]">
                  {anotacao.mensagem}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={`Anotar como ${sessao?.nome ?? "Usuário"}…`}
            className="min-h-[70px]"
          />
          <div className="flex justify-end">
            <Button onClick={() => void enviarAnotacao()} disabled={enviando}>
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Comentar
            </Button>
          </div>
        </div>
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
  const [popEmDiscussao, setPopEmDiscussao] = useState<Pop | null>(null);
  const [popAberto, setPopAberto] = useState<Pop | null>(null);

  const sessao = getSession();
  const emailUsuario = sessao?.email ?? "";
  const colaboradorIdUsuario = sessao?.colaboradorId ?? "";
  const [favoritosMeus, setFavoritosMeus] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;
    void carregarPopsAcessiveis(sessao)
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

  // Favoritos do colaborador logado (fonte: tabela `pop_favoritos`).
  useEffect(() => {
    if (!emailUsuario) {
      setFavoritosMeus([]);
      return undefined;
    }
    let ativo = true;
    void carregarFavoritosDoUsuario(emailUsuario, colaboradorIdUsuario || undefined)
      .then((ids) => {
        if (ativo) setFavoritosMeus(ids);
      })
      .catch((erro) => {
        if (ativo)
          toast.error(
            erro instanceof Error ? erro.message : "Não foi possível carregar os favoritos",
          );
      });
    return () => {
      ativo = false;
    };
  }, [emailUsuario, colaboradorIdUsuario]);

  // Reconfirma os contadores com os números reais do banco.
  const sincronizarContadores = useCallback(async () => {
    try {
      const contadores = await carregarContadoresPops();
      setPops((atuais) => aplicarContadores(atuais, contadores));
    } catch {
      // silencioso: o próximo evento de tempo real tenta de novo
    }
  }, []);

  // Tempo real: cada comentário ou favorito atualiza os números do cartão.
  useEffect(() => {
    const cancelar = assinarContadoresPops(() => void sincronizarContadores());
    return cancelar;
  }, [sincronizarContadores]);

  useEffect(() => {
    setPagina(0);
  }, [busca, setor]);

  async function buscarDados() {
    try {
      const dados = await carregarPopsAcessiveis(sessao);
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

  async function alternarFavorito(pop: Pop) {
    if (!emailUsuario) {
      toast.error("Entre no portal para favoritar um POP");
      return;
    }
    const jaFavoritado = favoritosMeus.includes(pop.id);
    const passo = jaFavoritado ? -1 : 1;

    // Efeito otimista: o número reage na hora e o banco confirma em seguida.
    setFavoritosMeus((atuais) =>
      jaFavoritado ? atuais.filter((id) => id !== pop.id) : [...atuais, pop.id],
    );
    setPops((atuais) =>
      atuais.map((item) =>
        item.id === pop.id ? { ...item, favoritos: Math.max(0, item.favoritos + passo) } : item,
      ),
    );

    try {
      if (jaFavoritado) {
        await desfavoritarPop(pop.id, emailUsuario);
      } else {
        const favorito = colaboradorIdUsuario
          ? { email: emailUsuario, nome: sessao?.nome ?? "", colaboradorId: colaboradorIdUsuario }
          : { email: emailUsuario, nome: sessao?.nome ?? "" };
        await favoritarPop(pop.id, favorito);
      }
    } catch (erro) {
      setFavoritosMeus((atuais) =>
        jaFavoritado ? [...atuais, pop.id] : atuais.filter((id) => id !== pop.id),
      );
      setPops((atuais) =>
        atuais.map((item) =>
          item.id === pop.id ? { ...item, favoritos: Math.max(0, item.favoritos - passo) } : item,
        ),
      );
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar os favoritos");
      return;
    }

    await sincronizarContadores();
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

  // Níveis sem acesso total só abrem POPs que chegaram até eles (liberados
  // individualmente ou do próprio setor — a grade já vem filtrada).
  function aoAbrirPop(pop: Pop) {
    if (!temAcessoTotalPops(sessao) && !pops.some((item) => item.id === pop.id)) {
      toast.error("Este POP não está liberado para o seu nível de acesso.");
      return;
    }
    setPopAberto(pop);
  }

  let conteudo: ReactNode;
  if (popAberto) {
    conteudo = <PopDetalhe pop={popAberto} onFechar={() => setPopAberto(null)} />;
  } else if (carregando) {
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
        onAbrir={aoAbrirPop}
        aoEditar={abrirEdicao}
        aoDuplicar={(p) => void duplicar(p)}
        aoExcluir={(p) => setPopExcluindo(p)}
        aoDiscutir={setPopEmDiscussao}
        favoritos={favoritosMeus}
        aoFavoritar={(p) => void alternarFavorito(p)}
      />
    );
  }

  return (
    <PanelShell wide>
      {conteudo}

      <PopFormDialog
        aberto={formAberto}
        pop={popEmEdicao}
        setores={setores}
        setorPadrao={setorSelecionado?.id ?? setores[0]?.id ?? ENTRADA_PADRAO.setorId}
        onFechar={() => setFormAberto(false)}
        onSalvo={buscarDados}
      />

      <PopDiscussaoDialog
        aberto={popEmDiscussao !== null}
        pop={popEmDiscussao}
        onFechar={() => setPopEmDiscussao(null)}
        onAtualizado={buscarDados}
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
