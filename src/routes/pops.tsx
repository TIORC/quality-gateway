import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FileText,
  HeartHandshake,
  History,
  LayoutGrid,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  Megaphone,
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
  UserRound,
  Users,
  Wallet,
  Wrench,
  CheckCircle2,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSession } from "@/lib/auth";
import { NIVEIS_FILTRAM_POR_SETOR, normalizarSetor, prefixoDoSetor } from "@/lib/niveis-acesso";
import {
  podeAdicionarDocumentos,
  podeExcluirDocumentos,
  podeModificarDocumentos,
  temAcessoTotalPops,
} from "@/lib/permissoes";
import {
  ENTRADA_PADRAO,
  aplicarContadores,
  aprovarPopLiderProcesso,
  aprovarPopLiderQualidade,
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
  dataIsoParaBr,
  desfavoritarPop,
  duplicarPop,
  ehSetorQualidade,
  enviarAnexoPop,
  enviarSugestaoPop,
  excluirAnotacao,
  excluirPop,
  favoritarPop,
  formatarDataRevisao,
  listarAnotacoes,
  listarLeiturasPop,
  listarRevisoesPop,
  listarSugestoesPop,
  marcarNotificacaoLida,
  nomesDosSetores,
  podeAprovarLiderProcesso,
  podeAprovarLiderQualidade,
  podeVerVersoesAnteriores,
  registrarLeitura,
  registrarVisualizacao,
  ROTULO_TIPO_ANEXO,
  rotuloDoValor,
  rotuloRevisao,
  STATUS_POP,
  textoDoAnexoOffice,
  urlAssinadaDoAnexo,
  type ConteudoRevisaoPop,
  type EntradaPop,
  type Notificacao,
  type Pop,
  type PopAnotacao,
  type PopEtapa,
  type PopLeitura,
  type PopRevisao,
  type PopSugestao,
  type SetorPop,
  type StatusPop,
} from "@/lib/pops";
import { cn, mascaraDataBr } from "@/lib/utils";

export const Route = createFileRoute("/pops")({
  head: () => ({
    meta: [{ title: "POPs | Gestão da Qualidade" }],
  }),
  validateSearch: (search: Record<string, unknown>): PopSearch => {
    const setor = typeof search["setor"] === "string" ? search["setor"] : undefined;
    const abrir = typeof search["abrir"] === "string" ? search["abrir"] : undefined;
    return { ...(setor ? { setor } : {}), ...(abrir ? { abrir } : {}) };
  },
  component: Pops,
});

interface PopSearch {
  setor?: string;
  /** Id do POP a abrir automaticamente ao carregar a página (deep link do painel). */
  abrir?: string;
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
  layers: Layers,
  "user-round": UserRound,
  megaphone: Megaphone,
  "heart-handshake": HeartHandshake,
  wrench: Wrench,
};

function iconeDoSetor(chave: string): LucideIcon {
  return ICONES_SETOR[chave] ?? LayoutGrid;
}

/** Selo colorido do status de ciclo de vida de um POP. */
function StatusBadge({ status }: { status: StatusPop }) {
  const classes =
    status === STATUS_POP.VIGENTE
      ? "bg-[#ECFDF5] text-[#059669]"
      : status === STATUS_POP.REVISANDO || status === STATUS_POP.REVISADO
        ? "bg-[#FEF3C7] text-[#B45309]"
        : status === STATUS_POP.PENDENTE_LIDER_PROCESSO
          ? "bg-[#FFF7ED] text-[#EA580C]"
          : "bg-[#FFF1F2] text-[#E11D48]";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide",
        classes,
      )}
    >
      {rotuloDoValor(status)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Cores e rótulos auxiliares da ficha do POP                                 */
/* -------------------------------------------------------------------------- */

/** Cor da tag de revisão vigente. */
const COR_REVISAO = "bg-[#EEF2FF] text-[#4F46E5]";
/** Cor da tag neutra (setores, materiais e afins). */
const COR_NEUTRA = "bg-[#F1F5F9] text-[#475569]";

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

/** Etiqueta usada na ficha do POP (setores responsáveis, acesso, revisão...). */
function Tag({ cor, rotulo, children }: { cor: string; rotulo?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]", cor)}>
      {rotulo ? <span className="font-medium opacity-70">{rotulo}</span> : null}
      <span className="font-semibold">{children}</span>
    </span>
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
  podeAdicionar: boolean;
  podeModificar: boolean;
  podeExcluir: boolean;
  setores: SetorPop[];
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
  podeAdicionar,
  podeModificar,
  podeExcluir,
  setores,
  onAbrir,
  onEditar,
  onDuplicar,
  onExcluir,
  onDiscutir,
  onFavoritar,
}: PopCardProps) {
  const responsaveis = nomesDosSetores(pop.setoresResponsaveis ?? [], setores);
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm lg:flex-row lg:gap-6 lg:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E3A8A]">
            {pop.codigo}
          </span>
          <StatusBadge status={pop.status} />
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
          {pop.objetivo || pop.descricao || "Sem objetivo cadastrado."}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag cor={COR_REVISAO} rotulo="Revisão">
            {rotuloRevisao(pop.revisao)}
          </Tag>
          <Tag cor={COR_NEUTRA} rotulo="Data da revisão">
            {formatarDataRevisao(pop.dataRevisao)}
          </Tag>
          {responsaveis.map((nome) => (
            <Tag key={nome} cor={COR_NEUTRA} rotulo="Responsável">
              {nome}
            </Tag>
          ))}
        </div>
      </div>

      <aside className="lg:w-64 flex shrink-0 flex-col rounded-xl border border-[#E9EEF5] bg-[#F8FAFC]">
        <div className="flex items-center justify-between border-b border-[#E9EEF5] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Controles
          </p>
          {podeAdicionar || podeModificar || podeExcluir ? (
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
                {podeModificar ? (
                  <DropdownMenuItem onClick={() => onEditar(pop)}>
                    <Edit3 className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                ) : null}
                {podeAdicionar ? (
                  <DropdownMenuItem onClick={() => onDuplicar(pop)}>
                    <Copy className="h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                ) : null}
                {podeExcluir ? (
                  <>
                    {(podeAdicionar || podeModificar) ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onExcluir(pop)}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex-1 space-y-2.5 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8]">
              <History className="h-3 w-3" /> Revisão vigente
            </span>
            <span className="text-[13px] font-semibold text-[#1F2937]">
              {rotuloRevisao(pop.revisao)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8]">
              <Eye className="h-3 w-3" /> Quem visualiza
            </span>
            <span className="text-right text-[12.5px] font-semibold text-[#1F2937]">
              {(pop.visualizadores ?? []).length === 0
                ? "Todos os setores"
                : nomesDosSetores(pop.visualizadores, setores).join(", ")}
            </span>
          </div>
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
  mostrarCardGeral: boolean;
  podeAdicionar: boolean;
  aoAbrirSetor: (id: string) => void;
  aoCriar: () => void;
}

function GradeDeSetores({
  setores,
  contagens,
  totalPops,
  mostrarCardGeral,
  podeAdicionar,
  aoAbrirSetor,
  aoCriar,
}: GradeProps) {
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
        {podeAdicionar ? (
          <Button className="shrink-0" onClick={aoCriar}>
            <Plus className="h-4 w-4" />
            Novo POP
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mostrarCardGeral ? (
          <CardSetor
            nome="Todos os Setores"
            chaveIcone="layout-grid"
            contagem={totalPops}
            destaque
            aoClicar={() => aoAbrirSetor("todos")}
          />
        ) : null}
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
  podeAdicionar: boolean;
  podeModificar: boolean;
  podeExcluir: boolean;
  setores: SetorPop[];
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
  podeAdicionar,
  podeModificar,
  podeExcluir,
  setores,
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
        {podeAdicionar ? (
          <Button className="shrink-0" onClick={aoCriar}>
            <Plus className="h-4 w-4" />
            Novo POP
          </Button>
        ) : null}
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <Input
          value={busca}
          onChange={(e) => aoMudarBusca(e.target.value)}
          placeholder="Buscar por código ou nome do POP…"
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
              podeAdicionar={podeAdicionar}
              podeModificar={podeModificar}
              podeExcluir={podeExcluir}
              setores={setores}
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
  /** Quando true, mostra um * vermelho ao lado do rótulo (campo obrigatório). */
  obrigatorio?: boolean;
  children: ReactNode;
}

function Campo({ rotulo, className, obrigatorio, children }: CampoProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[13px] font-medium text-[#1F2937]">
        {rotulo}
        {obrigatorio ? <span className="ml-0.5 text-[#DC2626]" aria-hidden="true">*</span> : null}
      </Label>
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
    dataVencimento: dataIsoParaBr(pop.dataVencimento) || null,
    arquivo: pop.arquivo,
    objetivo: pop.objetivo ?? "",
    materiaisSistemas: pop.materiaisSistemas ?? "",
    documentosGerados: pop.documentosGerados ?? "",
    linksRelacionados: pop.linksRelacionados ?? [],
    observacoes: pop.observacoes ?? "",
    etapas: pop.etapas ?? [],
    setoresResponsaveis: pop.setoresResponsaveis ?? [],
    visualizadores: pop.visualizadores ?? [],
  };
}

/**
 * Sugere o próximo código sequencial da área/setor (ex.: `FIS-03`) a partir do
 * prefixo do setor escolhido e dos códigos já usados.
 */
function codigoSugerido(prefixo: string, codigosExistentes: string[]): string {
  const usados = codigosExistentes
    .filter((codigo) => codigo.startsWith(`${prefixo}-`))
    .map((codigo) => Number.parseInt(codigo.slice(prefixo.length + 1), 10))
    .filter((numero) => Number.isFinite(numero));
  const proximo = (usados.length > 0 ? Math.max(...usados) : 0) + 1;
  return `${prefixo}-${String(proximo).padStart(2, "0")}`;
}

interface SeletorSetoresProps {
  setores: SetorPop[];
  selecionados: string[];
  aoAlternar: (id: string) => void;
}

/** Seleção múltipla de setores/unidades (Setores responsáveis e ACESSO). */
function SeletorSetores({ setores, selecionados, aoAlternar }: SeletorSetoresProps) {
  if (setores.length === 0) {
    return <p className="text-[12px] text-[#94A3B8]">Nenhum setor cadastrado ainda.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] p-2.5">
      {setores.map((setor) => {
        const ativo = selecionados.includes(setor.id);
        return (
          <button
            key={setor.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoAlternar(setor.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
              ativo
                ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                : "border-[#D9E0EA] bg-white text-[#475569] hover:border-[#1E3A8A]/40",
            )}
          >
            {ativo ? <Check className="h-3 w-3" /> : null}
            {setor.nome}
          </button>
        );
      })}
    </div>
  );
}

interface PopFormDialogProps {
  aberto: boolean;
  pop: Pop | null;
  setores: SetorPop[];
  setorPadrao: string;
  /** Códigos já usados no portal, para sugerir a sequência da área/setor. */
  codigosExistentes: string[];
  onFechar: () => void;
  onSalvo: () => void;
}

function PopFormDialog({
  aberto,
  pop,
  setores,
  setorPadrao,
  codigosExistentes,
  onFechar,
  onSalvo,
}: PopFormDialogProps) {
  const [entrada, setEntrada] = useState<EntradaPop>(ENTRADA_PADRAO);
  const [salvando, setSalvando] = useState(false);

  const [textoLinks, setTextoLinks] = useState("");
  const [observacaoRevisao, setObservacaoRevisao] = useState("");
  const [anexoNovo, setAnexoNovo] = useState<File | null>(null);

  useEffect(() => {
    if (aberto) {
      setEntrada(pop ? camposDoPop(pop) : { ...ENTRADA_PADRAO, setorId: setorPadrao });
      setTextoLinks((pop?.linksRelacionados ?? []).join("\n"));
      setObservacaoRevisao("");
      setAnexoNovo(null);
      setSalvando(false);
    }
  }, [aberto, pop, setorPadrao]);

  function definir<C extends keyof EntradaPop>(campo: C, valor: EntradaPop[C]) {
    setEntrada((atual) => ({ ...atual, [campo]: valor }));
  }

  /** Liga/desliga um setor de uma lista (responsáveis ou autorizados a ver). */
  function alternarSetor(campo: "setoresResponsaveis" | "visualizadores", id: string) {
    setEntrada((atual) => {
      const lista = atual[campo] ?? [];
      const nova = lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id];
      const atualizado: EntradaPop = { ...atual, [campo]: nova };
      // O primeiro setor responsável define o vínculo do POP no banco e, ao
      // criar um POP novo, sugere o próximo código sequencial da área.
      if (campo === "setoresResponsaveis") {
        atualizado.setorId = nova[0] ?? setorPadrao;
        if (!pop && nova.length > 0 && atual.codigo.trim() === "") {
          const prefixo = setores.find((setor) => setor.id === nova[0])?.prefixo;
          if (prefixo) atualizado.codigo = codigoSugerido(prefixo, codigosExistentes);
        }
      }
      return atualizado;
    });
  }

  const geraNovaRevisao =
    pop !== null && (pop.status === STATUS_POP.VIGENTE || pop.status === STATUS_POP.REVISADO);

  async function salvar() {
    if (!entrada.codigo.trim() || !entrada.titulo.trim()) {
      toast.error("Preencha o código e o nome do POP");
      return;
    }
    if ((entrada.setoresResponsaveis ?? []).length === 0) {
      toast.error("Selecione ao menos um setor responsável pelo processo");
      return;
    }
    // Dupla checagem de permissão (defesa mesmo se o botão congelar).
    if (pop) {
      if (!podeModificarDocumentos(getSession())) {
        toast.error("Você não tem permissão para modificar documentos.");
        return;
      }
    } else if (!podeAdicionarDocumentos(getSession())) {
      toast.error("Você não tem permissão para adicionar documentos.");
      return;
    }
    setSalvando(true);
    try {
      const dados: EntradaPop = {
        ...entrada,
        linksRelacionados: textoLinks
          .split("\n")
          .map((link) => link.trim())
          .filter((link) => link !== ""),
      };
      let popSalvo: Pop;
      if (pop) {
        popSalvo = await atualizarPop(pop.id, dados, observacaoRevisao);
        toast.success(
          popSalvo.status === STATUS_POP.REVISANDO
            ? `POP atualizado — ${rotuloRevisao(popSalvo.revisao)} gerada, aguardando as aprovações`
            : "POP atualizado com sucesso",
        );
      } else {
        popSalvo = await criarPop(dados);
        toast.success("POP criado — aguardando aprovação do líder do setor");
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
              : "Cadastre o procedimento operacional padrão."}{" "}
            <span className="text-[#DC2626]">*</span> Campos obrigatórios.
          </DialogDescription>
          {geraNovaRevisao ? (
            <p className="mt-2 rounded-lg bg-[#FEF3C7] px-3 py-2 text-[12.5px] leading-relaxed text-[#92400E]">
              {`Este POP está ${pop?.status === STATUS_POP.VIGENTE ? "vigente" : "revisado"}. Ao salvar, o mesmo código é mantido e será gerada a ${rotuloRevisao((pop?.revisao ?? 1) + 1)}: a versão anterior (${rotuloRevisao(pop?.revisao ?? 1)}) permanece no histórico, para consulta apenas do gestor, e a nova versão passa a valer para os setores e unidades definidos em "Quem pode visualizar".`}
            </p>
          ) : null}
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          <Campo rotulo="Código (sequencial por área/setor)" obrigatorio>
            <Input
              value={entrada.codigo}
              onChange={(e) => definir("codigo", e.target.value)}
              placeholder="Ex.: FIS-01"
            />
          </Campo>

          <Campo rotulo="Revisão vigente">
            <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-[#E9EEF5] bg-[#F8FAFC] px-3 py-1.5 text-[12.5px] text-[#475569]">
              <Tag cor={COR_REVISAO}>{rotuloRevisao(pop?.revisao ?? 1)}</Tag>
              <span>
                {pop
                  ? `Vigente desde ${formatarDataRevisao(pop.dataRevisao)}`
                  : "A Revisão 01 é criada automaticamente ao salvar"}
              </span>
            </div>
          </Campo>

          <Campo rotulo="Data de validade do documento">
            <Input
              value={entrada.dataVencimento ?? ""}
              onChange={(e) => definir("dataVencimento", mascaraDataBr(e.target.value))}
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
            />
            <p className="mt-1 text-[11.5px] text-[#94A3B8]">
              Data em que o documento expira — alimenta "Próximos vencimentos" no painel.
            </p>
          </Campo>

          <Campo rotulo="Nome do POP" className="sm:col-span-2" obrigatorio>
            <Input
              value={entrada.titulo}
              onChange={(e) => definir("titulo", e.target.value)}
              placeholder="Ex.: Apuração do ICMS"
            />
          </Campo>

          <Campo rotulo="Objetivo / Quando utilizar" className="sm:col-span-2">
            <Textarea
              value={entrada.objetivo ?? ""}
              onChange={(e) => definir("objetivo", e.target.value)}
              placeholder="Ex.: Realizar o lançamento da movimentação de provisões financeiras... Utilize este POP sempre que..."
              className="min-h-[80px]"
            />
          </Campo>

          <Campo rotulo="Setores responsáveis do processo" className="sm:col-span-2" obrigatorio>
            <SeletorSetores
              setores={setores}
              selecionados={entrada.setoresResponsaveis ?? []}
              aoAlternar={(id) => alternarSetor("setoresResponsaveis", id)}
            />
            <p className="mt-1 text-[11.5px] text-[#94A3B8]">
              O primeiro setor selecionado é o vínculo do POP com a grade de setores.
            </p>
          </Campo>

          <Campo
            rotulo="Quem pode visualizar — ACESSO (setores e unidades)"
            className="sm:col-span-2"
          >
            <SeletorSetores
              setores={setores}
              selecionados={entrada.visualizadores ?? []}
              aoAlternar={(id) => alternarSetor("visualizadores", id)}
            />
            <p className="mt-1 text-[11.5px] text-[#94A3B8]">
              Somente os setores e unidades marcados aqui enxergam esta revisão. Sem nenhuma seleção,
              valem as regras atuais de divulgação do portal.
            </p>
          </Campo>

          <Campo rotulo="Links vinculados (um por linha)" className="sm:col-span-2">
            <Textarea
              value={textoLinks}
              onChange={(e) => setTextoLinks(e.target.value)}
              placeholder={"https://youtu.be/...\nhttps://..."}
              className="min-h-[60px]"
            />
            <p className="mt-1 text-[11.5px] text-[#94A3B8]">
              Outros POPs, vídeos, sistemas, ferramentas e documentos relacionados.
            </p>
          </Campo>

          <Campo rotulo="Materiais necessários" className="sm:col-span-2">
            <Textarea
              value={entrada.materiaisSistemas ?? ""}
              onChange={(e) => definir("materiaisSistemas", e.target.value)}
              placeholder="Ex.: Software Domínio, Software de Comunicação, planilha de controle..."
              className="min-h-[60px]"
            />
          </Campo>

          {pop ? (
            <Campo
              rotulo={
                geraNovaRevisao
                  ? `Observação da revisão (será gravada na ${rotuloRevisao(pop.revisao + 1)})`
                  : "Observação da revisão em andamento"
              }
              className="sm:col-span-2"
            >
              <Textarea
                value={observacaoRevisao}
                onChange={(e) => setObservacaoRevisao(e.target.value)}
                placeholder="Ex.: Alterado o passo 3 — inclusão da conferência do arquivo TXT; atualizado o link do vídeo."
                className="min-h-[70px]"
              />
              <p className="mt-1 text-[11.5px] text-[#94A3B8]">
                Registro objetivo do que foi alterado nesta versão. Aparece no histórico de
                modificações do POP.
              </p>
            </Campo>
          ) : null}

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
      : textoDoAnexoOffice(anexo.path).then((conteudo) => {
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
/* Leitura do POP: botões "Lido" e "Sugerir melhoria"                          */
/* -------------------------------------------------------------------------- */

interface SecaoLeituraSugestaoProps {
  leitura: PopLeitura | null;
  todasLeituras: PopLeitura[];
  sugestoes: PopSugestao[];
  sugestaoAberta: boolean;
  sugestao: string;
  enviando: boolean;
  aoMudarSugestao: (valor: string) => void;
  aoAbrirSugestao: () => void;
  aoCancelarSugestao: () => void;
  aoRegistrarLido: () => void;
  aoEnviarSugestao: () => void;
}

function SecaoLeituraSugestao({
  leitura,
  todasLeituras,
  sugestoes,
  sugestaoAberta,
  sugestao,
  enviando,
  aoMudarSugestao,
  aoAbrirSugestao,
  aoCancelarSugestao,
  aoRegistrarLido,
  aoEnviarSugestao,
}: SecaoLeituraSugestaoProps) {
  const jaLeu = leitura !== null && leitura.decisao !== "discordo";
  const leitores = todasLeituras.filter((l) => l.decisao !== "discordo");

  return (
    <section className="mt-5 border-t border-[#E9EEF5] pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {jaLeu ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[12px] font-semibold text-[#047857]">
            <Check className="h-3.5 w-3.5" /> Leitura registrada
          </span>
        ) : (
          <span className="text-[12.5px] text-[#64748B]">
            Após a leitura deste POP, registre o seu "Lido":
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={enviando || sugestaoAberta}
            onClick={aoRegistrarLido}
            className="bg-[#047857] text-white hover:bg-[#059669]"
          >
            <Check className="h-4 w-4" /> Lido
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={enviando}
            onClick={aoAbrirSugestao}
            className="border-[#C7D2E4] text-[#1E3A8A] hover:bg-[#EEF2FF]"
          >
            <Lightbulb className="h-4 w-4" /> Sugerir melhoria
          </Button>
        </div>

        <span className="text-[12px] text-[#94A3B8]">
          {leitores.length} {leitores.length === 1 ? "leitura" : "leituras"} · {sugestoes.length}{" "}
          {sugestoes.length === 1 ? "sugestão" : "sugestões"}
        </span>
      </div>

      {sugestaoAberta ? (
        <div className="mt-3 rounded-xl border border-[#C7D2E4] bg-[#F8FAFC] p-4">
          <Label className="text-[13px] font-semibold text-[#1E3A8A]">
            Sugira uma melhoria para este POP
          </Label>
          <Textarea
            value={sugestao}
            onChange={(e) => aoMudarSugestao(e.target.value)}
            placeholder="Descreva a alteração ou melhoria que você propõe no procedimento. O Gestor da Qualidade e o time de Qualidade recebem esta sugestão."
            className="mt-1.5 min-h-[110px] border-[#C7D2E4] bg-white"
          />
          <div className="mt-2.5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={aoCancelarSugestao}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={enviando}
              onClick={aoEnviarSugestao}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
              Enviar sugestão
            </Button>
          </div>
        </div>
      ) : null}

      {leitores.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {leitores.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11.5px] font-medium text-[#047857]"
            >
              <Check className="h-3 w-3" /> {l.usuarioNome || l.usuarioEmail}
            </span>
          ))}
        </div>
      ) : null}

      {sugestoes.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {sugestoes.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#D9E0EA] bg-white px-3 py-2">
              <p className="text-[12px] font-semibold text-[#1E3A8A]">
                <Lightbulb className="mr-1 inline h-3 w-3" />
                {item.usuarioNome || item.usuarioEmail} sugeriu
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[#334155]">
                {item.sugestao}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface PopDetalheProps {
  pop: Pop;
  setores: SetorPop[];
  onFechar: () => void;
  onAtualizado: () => void;
}

function PopDetalhe({ pop, setores, onFechar, onAtualizado }: PopDetalheProps) {
  const [popExibido, setPopExibido] = useState(pop);
  useEffect(() => setPopExibido(pop), [pop]);

  const sessao = getSession();
  const email = sessao?.email ?? "";
  const nome = sessao?.nome ?? "";
  const [aprovando, setAprovando] = useState(false);
  const nomeSetorDoPop = setores.find((s) => s.id === popExibido.setorId)?.nome ?? "";

  const aguardaLiderProcesso =
    popExibido.status === STATUS_POP.PENDENTE_LIDER_PROCESSO ||
    popExibido.status === STATUS_POP.REVISANDO;
  const aguardaLiderQualidade =
    popExibido.status === STATUS_POP.PENDENTE_LIDER_QUALIDADE ||
    popExibido.status === STATUS_POP.REVISADO;
  const podeAprovarEtapa1 =
    aguardaLiderProcesso && podeAprovarLiderProcesso(sessao, popExibido, nomeSetorDoPop);
  const podeAprovarEtapa2 = aguardaLiderQualidade && podeAprovarLiderQualidade(sessao);

  async function aprovarEtapa1() {
    setAprovando(true);
    try {
      const atualizado = await aprovarPopLiderProcesso(popExibido.id);
      setPopExibido((atual) => ({ ...atual, ...atualizado }));
      toast.success("Aprovação do líder registrada — POP enviado à liderança da Qualidade");
      onAtualizado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível aprovar o POP");
    } finally {
      setAprovando(false);
    }
  }

  async function aprovarEtapa2() {
    setAprovando(true);
    try {
      const atualizado = await aprovarPopLiderQualidade(popExibido.id);
      setPopExibido((atual) => ({ ...atual, ...atualizado }));
      toast.success("POP aprovado pela Qualidade — agora está VIGENTE");
      onAtualizado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível aprovar o POP");
    } finally {
      setAprovando(false);
    }
  }

  const [leitura, setLeitura] = useState<PopLeitura | null>(null);
  const [todasLeituras, setTodasLeituras] = useState<PopLeitura[]>([]);
  const [sugestoes, setSugestoes] = useState<PopSugestao[]>([]);
  const [revisoes, setRevisoes] = useState<PopRevisao[]>([]);
  const [sugestaoAberta, setSugestaoAberta] = useState(false);
  const [sugestao, setSugestao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const podeVerAnteriores = podeVerVersoesAnteriores(sessao);

  useEffect(() => {
    setLeitura(null);
    setSugestaoAberta(false);
    setSugestao("");
  }, [popExibido.id]);

  useEffect(() => {
    if (!email) return;
    let ativo = true;
    void registrarVisualizacao(popExibido.id, { email, nome }).catch(() => undefined);
    void Promise.all([carregarLeiturasDoUsuario(email), listarLeiturasPop(popExibido.id)])
      .then(([minhas, todas]) => {
        if (!ativo) return;
        setLeitura(minhas[popExibido.id] ?? null);
        setTodasLeituras(todas);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [email, nome, popExibido.id]);

  // Sugestões de melhoria e histórico de modificações do POP aberto.
  useEffect(() => {
    let ativo = true;
    void Promise.all([listarSugestoesPop(popExibido.id), listarRevisoesPop(popExibido.id)])
      .then(([listaSugestoes, listaRevisoes]) => {
        if (!ativo) return;
        setSugestoes(listaSugestoes);
        setRevisoes(listaRevisoes);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [popExibido.id]);

  /** Botão "Lido": registra a ciência do colaborador na revisão vigente. */
  async function registrarLido() {
    if (!email) {
      toast.error("Entre no portal para registrar sua leitura");
      return;
    }
    setEnviando(true);
    try {
      await registrarLeitura(popExibido.id, { email, nome }, "lido");
      const [minhas, todas] = await Promise.all([
        carregarLeiturasDoUsuario(email),
        listarLeiturasPop(popExibido.id),
      ]);
      setLeitura(minhas[popExibido.id] ?? null);
      setTodasLeituras(todas);
      toast.success(`Leitura registrada na ${rotuloRevisao(popExibido.revisao)}`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar sua leitura");
    } finally {
      setEnviando(false);
    }
  }

  /** Botão "Sugerir melhoria": envia a proposta à Qualidade. */
  async function enviarSugestao() {
    if (!email) {
      toast.error("Entre no portal para sugerir uma melhoria");
      return;
    }
    if (sugestao.trim() === "") {
      toast.error("Escreva a sua sugestão antes de enviar");
      return;
    }
    setEnviando(true);
    try {
      await enviarSugestaoPop(popExibido.id, { email, nome }, sugestao);
      setSugestoes(await listarSugestoesPop(popExibido.id));
      setSugestaoAberta(false);
      setSugestao("");
      toast.success("Sugestão enviada ao Gestor da Qualidade");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a sugestão");
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-lg font-bold tracking-tight text-[#1F2937] sm:text-xl">
            {pop.titulo}
          </h2>
          <StatusBadge status={popExibido.status} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Tag cor={COR_REVISAO} rotulo="Revisão">
            {rotuloRevisao(popExibido.revisao)}
          </Tag>
          <Tag cor={COR_NEUTRA} rotulo="Data da revisão">
            {formatarDataRevisao(popExibido.dataRevisao)}
          </Tag>
          {popExibido.dataVencimento ? (
            <Tag cor={COR_NEUTRA} rotulo="Validade até">
              {formatarDataRevisao(popExibido.dataVencimento)}
            </Tag>
          ) : null}
        </div>

        {popExibido.status !== STATUS_POP.VIGENTE ? (
          <div className="mt-4 space-y-2 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-3">
            <p className="text-[12.5px] font-semibold text-[#1F2937]">
              Status: {rotuloDoValor(popExibido.status)}
            </p>
            {popExibido.criadoPorNome ? (
              <p className="text-[12.5px] text-[#64748B]">
                Elaborado por {popExibido.criadoPorNome}
              </p>
            ) : null}
            {popExibido.aprovadoProcessoNome ? (
              <p className="text-[12.5px] text-[#64748B]">
                Aprovado pelo líder do processo por {popExibido.aprovadoProcessoNome}
              </p>
            ) : null}
            {aguardaLiderProcesso && !podeAprovarEtapa1 ? (
              <p className="text-[12.5px] text-[#64748B]">
                Aguardando aprovação do líder do processo/setor.
              </p>
            ) : null}
            {aguardaLiderQualidade && !podeAprovarEtapa2 ? (
              <p className="text-[12.5px] text-[#64748B]">
                Aguardando aprovação da liderança da Qualidade.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {podeAprovarEtapa1 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={aprovando}
                  onClick={() => void aprovarEtapa1()}
                  className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                >
                  {aprovando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aprovar como líder do processo
                </Button>
              ) : null}
              {podeAprovarEtapa2 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={aprovando}
                  onClick={() => void aprovarEtapa2()}
                  className="bg-[#047857] text-white hover:bg-[#059669]"
                >
                  {aprovando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aprovar como liderança da Qualidade
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-3 border-t border-[#E9EEF5] pt-5">
          <LinhaDetalhe rotulo="Objetivo / Quando utilizar">
            <span className="whitespace-pre-wrap">{pop.objetivo || pop.descricao}</span>
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Setores responsáveis do processo">
            {(pop.setoresResponsaveis ?? []).length > 0
              ? nomesDosSetores(pop.setoresResponsaveis, setores).join(", ")
              : "—"}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Quem pode visualizar (ACESSO)">
            {(pop.visualizadores ?? []).length > 0
              ? nomesDosSetores(pop.visualizadores, setores).join(", ")
              : "Todos os setores conforme as regras de divulgação do portal"}
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Materiais necessários">
            <span className="whitespace-pre-wrap">{pop.materiaisSistemas}</span>
          </LinhaDetalhe>
          <LinhaDetalhe rotulo="Revisão">
            {`${rotuloRevisao(popExibido.revisao)} — ${formatarDataRevisao(popExibido.dataRevisao)}`}
          </LinhaDetalhe>
          {(pop.linksRelacionados ?? []).length > 0 ? (
            <div className="text-[13.5px] leading-relaxed text-[#334155]">
              <RotuloDetalhe>Links vinculados</RotuloDetalhe>
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

        <SecaoLeituraSugestao
          leitura={leitura}
          todasLeituras={todasLeituras}
          sugestoes={sugestoes}
          sugestaoAberta={sugestaoAberta}
          sugestao={sugestao}
          enviando={enviando}
          aoMudarSugestao={setSugestao}
          aoAbrirSugestao={() => setSugestaoAberta(true)}
          aoCancelarSugestao={() => {
            setSugestaoAberta(false);
            setSugestao("");
          }}
          aoRegistrarLido={() => void registrarLido()}
          aoEnviarSugestao={() => void enviarSugestao()}
        />

        <HistoricoModificacoes
          pop={popExibido}
          revisoes={revisoes}
          podeVerAnteriores={podeVerAnteriores}
        />

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E9EEF5] pt-4">
          <p className="text-[12px] font-semibold text-[#1E293B]">
            {`${rotuloRevisao(popExibido.revisao)} — ${formatarDataRevisao(popExibido.dataRevisao)}`}
          </p>
          {popExibido.observacaoRevisao ? (
            <p className="text-[12px] text-[#64748B]">{popExibido.observacaoRevisao}</p>
          ) : null}
        </footer>
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Histórico de modificações (revisões do POP)                                */
/* -------------------------------------------------------------------------- */

interface HistoricoModificacoesProps {
  pop: Pop;
  revisoes: PopRevisao[];
  /** Somente o gestor consulta o conteúdo das versões anteriores. */
  podeVerAnteriores: boolean;
}

function HistoricoModificacoes({ pop, revisoes, podeVerAnteriores }: HistoricoModificacoesProps) {
  const [versaoAberta, setVersaoAberta] = useState<PopRevisao | null>(null);

  return (
    <section className="mt-5 border-t border-[#E9EEF5] pt-5">
      <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-[#1E293B]">
        <History className="h-4 w-4 text-[#1E3A8A]" /> Histórico de modificações
      </h3>

      <div className="mt-3 overflow-hidden rounded-xl border border-[#E9EEF5]">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#F8FAFC]">
            <tr className="text-[11px] uppercase tracking-wide text-[#64748B]">
              <th className="px-3 py-2 font-semibold">Revisão</th>
              <th className="px-3 py-2 font-semibold">Data da revisão</th>
              <th className="px-3 py-2 font-semibold">Observação da revisão</th>
              <th className="px-3 py-2 font-semibold">Versão</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#E9EEF5] bg-white">
              <td className="px-3 py-2 text-[12.5px] font-semibold text-[#1E3A8A]">
                {rotuloRevisao(pop.revisao)}
              </td>
              <td className="px-3 py-2 text-[12.5px] text-[#334155]">
                {formatarDataRevisao(pop.dataRevisao)}
              </td>
              <td className="px-3 py-2 text-[12.5px] text-[#334155]">
                {pop.observacaoRevisao || "—"}
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#047857]">
                  Vigente
                </span>
              </td>
            </tr>
            {revisoes.map((revisao) => (
              <tr key={revisao.id} className="border-t border-[#E9EEF5] bg-white">
                <td className="px-3 py-2 text-[12.5px] font-semibold text-[#475569]">
                  {rotuloRevisao(revisao.revisao)}
                </td>
                <td className="px-3 py-2 text-[12.5px] text-[#334155]">
                  {formatarDataRevisao(revisao.dataRevisao)}
                </td>
                <td className="px-3 py-2 text-[12.5px] text-[#334155]">
                  {revisao.observacao || "—"}
                </td>
                <td className="px-3 py-2">
                  {podeVerAnteriores ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setVersaoAberta(revisao)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver versão
                    </Button>
                  ) : (
                    <span className="text-[11.5px] text-[#94A3B8]">Consulta do gestor</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!podeVerAnteriores ? (
        <p className="mt-2 text-[11.5px] text-[#94A3B8]">
          As revisões anteriores ficam arquivadas para consulta apenas do gestor. Esta é a versão
          vigente, disponível aos setores e unidades definidos em "Quem pode visualizar".
        </p>
      ) : null}

      <Dialog
        open={versaoAberta !== null}
        onOpenChange={(abre) => (abre ? undefined : setVersaoAberta(null))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pop.codigo} — {versaoAberta ? rotuloRevisao(versaoAberta.revisao) : ""}
            </DialogTitle>
            <DialogDescription>
              {`Versão arquivada em ${formatarDataRevisao(versaoAberta?.dataRevisao)} — consulta exclusiva do gestor.`}
            </DialogDescription>
          </DialogHeader>
          <VersaoArquivada conteudo={versaoAberta?.conteudo ?? {}} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Versão arquivada (consulta do gestor)                                      */
/* -------------------------------------------------------------------------- */

/** Conteúdo de uma revisão anterior (somente leitura, para o gestor). */
function VersaoArquivada({ conteudo }: { conteudo: ConteudoRevisaoPop }) {
  const links = conteudo.links ?? [];
  const etapas = conteudo.etapas ?? [];
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      <LinhaDetalhe rotulo="Nome do POP">{conteudo.titulo ?? ""}</LinhaDetalhe>
      <LinhaDetalhe rotulo="Objetivo / Quando utilizar">
        <span className="whitespace-pre-wrap">{conteudo.objetivo ?? ""}</span>
      </LinhaDetalhe>
      <LinhaDetalhe rotulo="Materiais necessários">
        <span className="whitespace-pre-wrap">{conteudo.materiais ?? ""}</span>
      </LinhaDetalhe>
      {links.length > 0 ? (
        <div className="text-[13.5px] leading-relaxed text-[#334155]">
          <RotuloDetalhe>Links vinculados</RotuloDetalhe>
          <ul className="mt-1 space-y-1">
            {links.map((link) => (
              <li key={link} className="break-all text-[#1E3A8A]">
                {link}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {etapas.length > 0 ? (
        <div>
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-[#1E293B]">
            Procedimento
          </p>
          <div className="mt-2">
            <PopEtapas etapas={etapas} />
          </div>
        </div>
      ) : null}
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
  const { setor, abrir } = Route.useSearch();
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
  const podeAdicionar = podeAdicionarDocumentos(sessao);
  const podeModificar = podeModificarDocumentos(sessao);
  const podeExcluir = podeExcluirDocumentos(sessao);
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

  // Deep link: abre um POP específico quando chega com `?abrir=<id>` (painel).
  useEffect(() => {
    if (!abrir || popAberto) return;
    const alvo = pops.find((pop) => pop.id === abrir);
    if (!alvo) return;
    setPopAberto(alvo);
    void router.navigate({ to: "/pops", search: setor ? { setor } : {} });
  }, [abrir, pops, popAberto, setor, router]);

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

  // Colaborador, Líder de setor e Desenvolvedor (fora do setor da Qualidade) veem
  // apenas o card "Geral" e o card do próprio setor; os demais níveis veem todos.
  const gradeRestrita = Boolean(
    !temAcessoTotalPops(sessao) &&
      !ehSetorQualidade(sessao) &&
      NIVEIS_FILTRAM_POR_SETOR.has(sessao?.nivelAcesso ?? ""),
  );

  const setoresGrade = useMemo(() => {
    if (!gradeRestrita) return setores;
    const setorNorm = normalizarSetor(sessao?.setor ?? "");
    const prefixo = prefixoDoSetor(sessao?.setor ?? "");
    return setores.filter((s) => {
      if (s.id === "geral" || normalizarSetor(s.nome) === "geral") return true;
      if (setorNorm && normalizarSetor(s.nome) === setorNorm) return true;
      if (prefixo && s.prefixo && s.prefixo.toUpperCase() === prefixo.toUpperCase()) return true;
      return false;
    });
  }, [gradeRestrita, setores, sessao]);

  const popsDoSetor = useMemo(() => {
    if (setorEhTodos || !setorSelecionado) return pops;
    const id = setorSelecionado.id;
    // POP com vários setores responsáveis aparece no card de cada um deles;
    // sem array preenchido (POPs antigos), vale o `setor_id`.
    return pops.filter((p) =>
      p.setoresResponsaveis.length > 0 ? p.setoresResponsaveis.includes(id) : p.setorId === id,
    );
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
    conteudo = (
      <PopDetalhe
        pop={popAberto}
        setores={setores}
        onFechar={() => setPopAberto(null)}
        onAtualizado={buscarDados}
      />
    );
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
        setores={setoresGrade}
        contagens={contagens}
        totalPops={pops.length}
        mostrarCardGeral={!gradeRestrita}
        podeAdicionar={podeAdicionar}
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
        podeAdicionar={podeAdicionar}
        podeModificar={podeModificar}
        podeExcluir={podeExcluir}
        setores={setores}
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
        codigosExistentes={pops.map((item) => item.codigo)}
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
