import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  Download,
  Library,
  Network,
  Plus,
  Trash2,
  TrainFront,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type CSSProperties, type ReactNode } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { DetalheIndicadorDrawer } from "@/components/indicador-detalhe-drawer";
import { Pill, SeloAtraso, StatusApuracaoBadge, VariacaoIndicador } from "@/components/indicador-badges";
import {
  BibliotecaModelosDialog,
  FormularioIndicadorDialog,
  LancarApuracaoDialog,
  ORIGEM_INDICADOR,
  PlanoObrigatorioDialog,
} from "@/components/indicadores-dialogs";
import { useAsync } from "@/hooks/use-async";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import {
  apuracaoAtrasada,
  apuracaoDoMes,
  calcularVariacao,
  DIA_LIMITE_APURACAO,
  formatarValor,
  mesAnterior,
  mesAnteriorRef,
  mesesDoPeriodo,
  mesReferenciaAtual,
  mesReferenciaDe,
  MODOS_PERIODO,
  escopoDosIndicadores,
  normalizarIntervalo,
  podeGerenciarIndicadores,
  podeLancarApuracao,
  rotuloMes,
  rotuloMesLongo,
  rotuloPeriodo,
  ultimaApuracao,
  ultimosMeses,
  type Apuracao,
  type FiltroPeriodo,
  type Indicador,
} from "@/lib/indicadores";
import { getSession } from "@/lib/auth";
import { listarApuracoes, listarIndicadores } from "@/lib/indicadores-base";
import { definirArquivamento, fecharApuracao } from "@/lib/indicadores-crud";
import { listarOcorrencias, listarTipos } from "@/lib/ocorrencias-base";
import { ocorrenciaAtrasada } from "@/lib/ocorrencias";
import { listarPlanos } from "@/lib/planos-base";
import { normalizarSetor } from "@/lib/niveis-acesso";
import { setoresLiderados } from "@/lib/permissoes";
import type { PlanoAcao } from "@/lib/planos";
import {
  agruparMetricas,
  calcularMetricas,
  carregarTarefas,
  importarTarefas,
  lerPlanilhaAtrasadas,
  lerPlanilhaTarefas,
  pct,
  tarefasDoIndicador,
  tarefasEmCache,
  unificarSetor,
  zerarTarefas,
  type ChaveIndicador,
  type MetricasTarefas,
  type ResultadoImportacao,
  type TarefaGestta,
} from "@/lib/tarefas-gestta";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [{ title: "Indicadores | Gestão da Qualidade" }],
  }),
  component: Indicadores,
});

type SecaoIndicadores = "por-setor" | "por-colaborador" | "por-celula" | "importar";

const SECOES_INDICADORES: { valor: SecaoIndicadores; rotulo: string; icone: typeof Building2 }[] = [
  { valor: "por-setor", rotulo: "Por Setor", icone: Building2 },
  { valor: "por-colaborador", rotulo: "Por Colaborador", icone: Users },
  { valor: "por-celula", rotulo: "Por Célula", icone: Network },
  { valor: "importar", rotulo: "Importar", icone: Upload },
];

function cardsDeTarefas(m: MetricasTarefas): {
  chave: ChaveIndicador;
  label: string;
  valor: string;
  cor: string;
  rodape: string;
}[] {
  const p = (n: number) => pct(n, m.total);
  return [
    { chave: "total", label: "Total de tarefas", valor: String(m.total), cor: "#1F2937", rodape: "vencimento no mês" },
    { chave: "concluidas", label: "% concluídas", valor: p(m.concluidas), cor: "#1F2937", rodape: `${m.concluidas} tarefas` },
    { chave: "noPrazo", label: "% concluídas no prazo", valor: p(m.noPrazo), cor: "#059669", rodape: `${m.noPrazo} tarefas` },
    { chave: "foraDoPrazo", label: "% concluídas fora do prazo", valor: p(m.foraDoPrazo), cor: "#D97706", rodape: `${m.foraDoPrazo} tarefas` },
    { chave: "impedimento", label: "% em impedimento", valor: p(m.impedimento), cor: "#D97706", rodape: `${m.impedimento} tarefas` },
    { chave: "abertasEmAtraso", label: "% abertas em atraso", valor: p(m.abertasEmAtraso), cor: "#E11D48", rodape: `${m.abertasEmAtraso} tarefas` },
    {
      chave: "concluidasNoMes",
      label: "Concluídas no mês (todas competências)",
      valor: String(m.concluidasNoMes),
      cor: "#1F2937",
      rodape: "data de conclusão no mês",
    },
    {
      chave: "acumuladasAnteriores",
      label: "Acumuladas concluídas no(s) mês(es) anterior(es)",
      valor: String(m.acumuladasAnteriores),
      cor: "#1F2937",
      rodape: "vencimento em meses anteriores",
    },
  ];
}

function CardsTarefas({
  metricas,
  tarefas,
  mes,
}: {
  metricas: MetricasTarefas;
  tarefas: TarefaGestta[];
  mes: string;
}) {
  const [aberto, setAberto] = useState<{ chave: ChaveIndicador; label: string } | null>(null);
  return (
    <>
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cardsDeTarefas(metricas).map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setAberto({ chave: c.chave, label: c.label })}
            className="block cursor-pointer rounded-xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            <SummaryCard
              label={c.label}
              value={c.valor}
              valueClass={`mt-3 text-[30px] font-semibold leading-none ${
                c.cor === "#1F2937" ? "text-[#1F2937] dark:text-white" : ""
              }`}
              accent={c.cor}
              footer={c.rodape}
              style={c.cor === "#1F2937" ? undefined : { color: c.cor }}
            />
          </button>
        ))}
      </section>
      <DetalheTarefasSheet
        aberto={aberto}
        tarefas={tarefas}
        mes={mes}
        onFechar={() => setAberto(null)}
      />
    </>
  );
}

const LIMITE_LINHAS = 100;

/** Mesmas colunas, na mesma ordem, da planilha exportada do Gestta. */
const COLUNAS_PLANILHA: { titulo: string; valor: (t: TarefaGestta) => string }[] = [
  { titulo: "Id", valor: (t) => t.id },
  { titulo: "Nome", valor: (t) => t.nome },
  { titulo: "Tipo", valor: (t) => t.tipo },
  { titulo: "Status", valor: (t) => t.status },
  { titulo: "Cliente", valor: (t) => t.cliente },
  { titulo: "CNPJ/CPF", valor: (t) => t.cnpjCpf },
  { titulo: "Departamento", valor: (t) => t.departamento },
  { titulo: "Responsável", valor: (t) => t.responsavel },
  { titulo: "Vencimento", valor: (t) => formatarData(t.vencimento) },
  { titulo: "Data Legal", valor: (t) => formatarData(t.dataLegal) },
  { titulo: "Competência", valor: (t) => t.competencia },
  { titulo: "Data de Conclusão", valor: (t) => formatarData(t.dataConclusao) },
  { titulo: "Feito atrasado", valor: (t) => t.feitoAtrasado },
  { titulo: "Feito com multa", valor: (t) => t.feitoComMulta },
  { titulo: "Baixado", valor: (t) => t.baixado },
];

function formatarData(iso: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function DetalheTarefasSheet({
  aberto,
  tarefas,
  mes,
  onFechar,
}: {
  aberto: { chave: ChaveIndicador; label: string } | null;
  tarefas: TarefaGestta[];
  mes: string;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(LIMITE_LINHAS);
  const chave = aberto?.chave;
  useEffect(() => {
    setBusca("");
    setLimite(LIMITE_LINHAS);
  }, [chave]);

  const lista = useMemo(
    () => (chave ? tarefasDoIndicador(tarefas, mes, chave) : []),
    [tarefas, mes, chave],
  );
  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((t) =>
      `${t.nome} ${t.cliente} ${t.responsavel} ${t.departamento}`.toLowerCase().includes(q),
    );
  }, [lista, busca]);

  return (
    <Sheet open={aberto !== null} onOpenChange={(o) => (o ? undefined : onFechar())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-[min(95vw,1200px)]">
        <SheetHeader>
          <SheetTitle>{aberto?.label}</SheetTitle>
          <SheetDescription>
            {lista.length} tarefa(s) em {mes.split("-").reverse().join("/")}
          </SheetDescription>
        </SheetHeader>
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(LIMITE_LINHAS);
          }}
          placeholder="Buscar por tarefa, cliente, setor ou colaborador"
          className="mt-4"
        />
        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-[#CBD5E1]">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#E2E8F0] text-[#1F2937] dark:bg-[#1E293B] dark:text-white">
              <tr>
                {COLUNAS_PLANILHA.map((c) => (
                  <th
                    key={c.titulo}
                    className="whitespace-nowrap border border-[#CBD5E1] px-2 py-1.5 text-left font-semibold"
                  >
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrada.slice(0, limite).map((t) => (
                <tr key={t.id} className="odd:bg-transparent even:bg-[#94A3B8]/10">
                  {COLUNAS_PLANILHA.map((c) => (
                    <td key={c.titulo} className="whitespace-nowrap border border-[#CBD5E1]/60 px-2 py-1">
                      {c.valor(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtrada.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#64748B]">Nenhuma tarefa encontrada.</p>
          ) : null}
          {filtrada.length > limite ? (
            <div className="p-3">
              <Button variant="outline" className="w-full" onClick={() => setLimite((l) => l + LIMITE_LINHAS)}>
                Mostrar mais ({filtrada.length - limite} restantes)
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabelaMetricas({
  titulo,
  grupos,
  ocultarVazio = false,
}: {
  titulo: string;
  grupos: { nome: string; metricas: MetricasTarefas }[];
  /** Colaborador não vê o aviso de "nenhuma tarefa importada". */
  ocultarVazio?: boolean;
}) {
  if (grupos.length === 0 && ocultarVazio) return null;
  if (grupos.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-[#D9E0EA] bg-white px-6 py-10 text-center text-sm text-[#64748B]">
        Nenhuma tarefa importada para esta competência. Use a aba Importar.
      </p>
    );
  }
  const cab = ["Total", "% concl.", "% no prazo", "% fora", "% imped.", "% atraso", "Concl. no mês", "Acum. ant."];
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-[#D9E0EA] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-left text-[11px] uppercase tracking-wider text-[#64748B]">
          <tr>
            <th className="px-3 py-2">{titulo}</th>
            {cab.map((c) => (
              <th key={c} className="px-3 py-2 text-right">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ nome, metricas: m }) => (
            <tr key={nome} className="border-t border-[#E2E8F0]">
              <td className="px-3 py-2 font-medium text-[#1F2937]">{nome}</td>
              {[
                String(m.total),
                pct(m.concluidas, m.total),
                pct(m.noPrazo, m.total),
                pct(m.foraDoPrazo, m.total),
                pct(m.impedimento, m.total),
                pct(m.abertasEmAtraso, m.total),
                String(m.concluidasNoMes),
                String(m.acumuladasAnteriores),
              ].map((v, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums text-[#475569]">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  valueClass: string;
  accent: string;
  footer: string;
  style?: CSSProperties;
}

function SummaryCard({ label, value, valueClass, accent, footer, style }: SummaryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <p className={valueClass} style={style}>{value}</p>
      <p className="mt-2 text-[13px] text-[#64748B]">{footer}</p>
    </div>
  );
}

function Indicadores() {
  const router = useRouter();
  const catalogo = useCatalogoOrganizacional();
  // O hook de contexto é nulo aqui: este componente RENDERIZA o PanelShell (e o
  // contexto só flui para dentro). Lê a sessão persistida no navegador como
  // fallback, igual a painel/ocorrências/planos-de-ação.
  const sessaoCtx = usePanelSession();
  const sessao = getSession() ?? sessaoCtx;
  const podeGerenciar = podeGerenciarIndicadores(sessao);

  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [apuracoes, setApuracoes] = useState<Apuracao[]>([]);
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("todos");
  const [aba, setAba] = useState("visao-geral");
  const [secao, setSecao] = useState<SecaoIndicadores>("por-setor");
  const [tarefas, setTarefas] = useState<TarefaGestta[]>([]);
  /** Zerar tarefas: "mes" apaga o mês escolhido; "tudo" apaga todas. `null` = sem confirmação aberta. */
  const [zerarAlvo, setZerarAlvo] = useState<"mes" | "tudo" | null>(null);
  const [zerando, setZerando] = useState(false);
  const [colaboradorFiltro, setColaboradorFiltro] = useState("todos");
  /** Período de exibição (cards, gráficos, resumo e histórico). */
  const [periodo, setPeriodo] = useState<FiltroPeriodo>({ modo: "ultimos12" });
  const [mesEscolhido, setMesEscolhido] = useState(mesReferenciaAtual());
  const [anoEscolhido, setAnoEscolhido] = useState(() => new Date().getFullYear());
  /** Seleção parcial do calendário de intervalo (1º clique → arrastar → 2º clique). */
  const [intervaloCal, setIntervaloCal] = useState<DateRange>({ from: undefined });
  const [popoverIntervalo, setPopoverIntervalo] = useState(false);

  const [formulario, setFormulario] = useState<{ aberto: boolean; indicador: Indicador | null }>({
    aberto: false,
    indicador: null,
  });
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [lancamento, setLancamento] = useState<Indicador | null>(null);
  const [detalhe, setDetalhe] = useState<Indicador | null>(null);
  const [planoPendente, setPlanoPendente] = useState<{ indicador: Indicador; apuracao: Apuracao } | null>(
    null,
  );

  // Primitivos: a sessão é recriada a cada render e não pode entrar nas dependências.
  const escopo = escopoDosIndicadores(sessao);
  const colaboradorId = sessao?.colaboradorId ?? "";
  const setoresDoEscopo = setoresLiderados(sessao).join("|");

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [listaIndicadores, listaApuracoes, listaPlanos] = await Promise.all([
        listarIndicadores(),
        listarApuracoes(),
        listarPlanos().catch(() => [] as PlanoAcao[]),
      ]);
      // Líder de setor vê os indicadores do(s) seu(s) setor(es); os demais, só os que são seus.
      const setores = new Set(setoresDoEscopo.split("|").filter(Boolean));
      const permitidos = new Set(
        listaIndicadores
          .filter((i) =>
            escopo === "setor"
              ? setores.has(normalizarSetor(i.setor))
              : i.responsavelId === colaboradorId,
          )
          .map((i) => i.id),
      );
      const restrito = escopo !== "todos";
      setIndicadores(restrito ? listaIndicadores.filter((i) => permitidos.has(i.id)) : listaIndicadores);
      setApuracoes(restrito ? listaApuracoes.filter((a) => permitidos.has(a.indicadorId)) : listaApuracoes);
      setPlanos(listaPlanos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os indicadores.");
    } finally {
      setCarregando(false);
    }
  }, [escopo, colaboradorId, setoresDoEscopo]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /** Apurações agrupadas por indicador. */
  const porIndicador = useMemo(() => {
    const mapa = new Map<string, Apuracao[]>();
    for (const apuracao of apuracoes) {
      const lista = mapa.get(apuracao.indicadorId) ?? [];
      lista.push(apuracao);
      mapa.set(apuracao.indicadorId, lista);
    }
    return mapa;
  }, [apuracoes]);

  const planosPorId = useMemo(() => new Map(planos.map((p) => [p.id, p])), [planos]);
  const ativos = useMemo(() => indicadores.filter((i) => i.ativo), [indicadores]);

  /* Período de exibição ---------------------------------------------------- */
  /** `true` quando o filtro está no padrão (últimos 12 meses). */
  const ehPadraoPeriodo = periodo.modo === "ultimos12";
  /** Meses dos cards, gráficos e resumo do topo. */
  const mesesPeriodo = useMemo(() => mesesDoPeriodo(periodo), [periodo]);
  /** Meses do histórico do drawer (no padrão, os últimos 24 — comportamento original). */
  const mesesDrawer = useMemo(
    () => (ehPadraoPeriodo ? ultimosMeses(24) : mesesPeriodo),
    [ehPadraoPeriodo, mesesPeriodo],
  );
  const rotuloPeriodoAtual = rotuloPeriodo(periodo);
  const mesesDisponiveis = useMemo(() => [...ultimosMeses(36)].reverse(), []);
  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => atual - i);
  }, []);

  /** Troca o modo do filtro já aplicando o valor escolhido (mês/ano). */
  function mudarModoPeriodo(modo: string) {
    if (modo === "mes") setPeriodo({ modo: "mes", mes: mesEscolhido });
    else if (modo === "ano") setPeriodo({ modo: "ano", ano: anoEscolhido });
    else if (modo === "intervalo") {
      setPeriodo({ modo: "intervalo", inicio: "", fim: "" });
      setPopoverIntervalo(true);
    } else {
      setPeriodo({ modo: "ultimos12" });
    }
  }

  /**
   * Calendário em intervalo: o 1º clique marca a data inicial, o arrastar
   * mostra a prévia e o 2º clique fecha — aí o filtro de período é aplicado.
   */
  function aoSelecionarIntervalo(range: DateRange | undefined) {
    const de = range?.from;
    const ate = range?.to;
    setIntervaloCal({ from: de, to: ate });
    if (de && ate) {
      const inicio = mesReferenciaDe(de);
      const fim = mesReferenciaDe(ate);
      setPeriodo({ modo: "intervalo", ...normalizarIntervalo(inicio, fim) });
      setPopoverIntervalo(false);
    }
  }

  /** Apaga as tarefas do mês escolhido ou todas, conforme `zerarAlvo`, e recarrega a lista. */
  async function confirmarZerar() {
    if (!zerarAlvo) return;
    setZerando(true);
    try {
      await zerarTarefas(zerarAlvo === "mes" ? mesEscolhido : undefined);
      setTarefas(await carregarTarefas());
      toast.success(
        zerarAlvo === "mes"
          ? `Tarefas de ${rotuloMesLongo(mesEscolhido)} apagadas.`
          : "Todas as tarefas importadas foram apagadas.",
      );
      setZerarAlvo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar as tarefas.");
    } finally {
      setZerando(false);
    }
  }

  /** Volta para o padrão (últimos 12 meses) e limpa o calendário. */
  function limparPeriodo() {
    setIntervaloCal({ from: undefined });
    setPeriodo({ modo: "ultimos12" });
  }

  useEffect(() => {
    const abrir = (lista: TarefaGestta[]) => {
      setTarefas(lista);
      // Abre já no mês mais recente que tem tarefas (senão mostraria o mês atual, vazio).
      const ultimo = lista.reduce((max, t) => (t.vencimento && t.vencimento.slice(0, 7) > max ? t.vencimento.slice(0, 7) : max), "");
      if (ultimo) setMesEscolhido(ultimo);
    };
    const emCache = tarefasEmCache();
    if (emCache) abrir(emCache);
    carregarTarefas()
      .then((lista) => (emCache ? setTarefas(lista) : abrir(lista)))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível carregar as tarefas."));
  }, []);

  const controleImport = useMemo(
    () => [0, 1, 2].map(() => ({ current: null }) as MutableRefObject<(() => Promise<void>) | null>),
    [],
  );
  const [arquivosProntos, setArquivosProntos] = useState([false, false, false]);
  const [importandoTudo, setImportandoTudo] = useState(false);
  const marcarArquivo = useMemo(
    () =>
      [0, 1, 2].map((i) => (tem: boolean) =>
        setArquivosProntos((atual) => (atual[i] === tem ? atual : atual.map((v, k) => (k === i ? tem : v)))),
      ),
    [],
  );
  /** Importa na ordem: Gestta, complementares e, por último, o relatório de atrasadas (só Ids novos). */
  async function importarTudo() {
    setImportandoTudo(true);
    try {
      for (const c of controleImport) await c.current?.();
    } finally {
      setImportandoTudo(false);
    }
  }

  const tarefasFiltradas = useMemo(() => {
    if (escopo === "setor") {
      const setores = new Set(setoresDoEscopo.split("|").filter(Boolean));
      return tarefas.filter((t) => setores.has(normalizarSetor(t.departamento)));
    }
    if (escopo === "proprio") {
      const eu = normalizarSetor(sessao?.nome);
      return eu ? tarefas.filter((t) => normalizarSetor(t.responsavel) === eu) : [];
    }
    if (secao === "por-setor" && setorFiltro !== "todos")
      return tarefas.filter((t) => t.departamento === setorFiltro);
    if (secao === "por-colaborador" && colaboradorFiltro !== "todos")
      return tarefas.filter((t) => t.responsavel === colaboradorFiltro);
    return tarefas;
  }, [tarefas, secao, setorFiltro, colaboradorFiltro, escopo, setoresDoEscopo, sessao?.nome]);
  const metricasTarefas = useMemo(
    () => calcularMetricas(tarefasFiltradas, mesEscolhido),
    [tarefasFiltradas, mesEscolhido],
  );
  const gruposTarefas = useMemo(
    () =>
      agruparMetricas(
        tarefasFiltradas,
        mesEscolhido,
        secao === "por-colaborador" ? "responsavel" : "departamento",
      ),
    [tarefasFiltradas, mesEscolhido, secao],
  );
  const colaboradoresTarefas = useMemo(
    () =>
      [...new Set(tarefas.map((t) => t.responsavel).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [tarefas],
  );

  // Colaborador: só a seção "Por Colaborador", já com o próprio nome selecionado.
  const soProprio = escopo === "proprio";
  const meuNomeNasTarefas =
    colaboradoresTarefas.find((n) => normalizarSetor(n) === normalizarSetor(sessao?.nome)) ??
    sessao?.nome ??
    "";
  useEffect(() => {
    if (!soProprio) return;
    setSecao((atual) => (atual === "por-colaborador" ? atual : "por-colaborador"));
    if (meuNomeNasTarefas) setColaboradorFiltro(meuNomeNasTarefas);
  }, [soProprio, meuNomeNasTarefas]);

  const setorDaSessao = normalizarSetor(sessao?.setor);
  const listaVisaoGeral =
    setorFiltro === "todos" ? ativos : ativos.filter((i) => i.setor === setorFiltro);
  const listaMeuSetor = ativos.filter(
    (i) => setorDaSessao !== "" && normalizarSetor(i.setor) === setorDaSessao,
  );
  const atrasadasNoMeuSetor = listaMeuSetor.filter((i) =>
    apuracaoAtrasada(porIndicador.get(i.id) ?? []),
  ).length;

  const indicadorDetalhe = detalhe
    ? (indicadores.find((i) => i.id === detalhe.id) ?? detalhe)
    : null;

  function abrirFormulario(indicador: Indicador | null) {
    setFormulario({ aberto: true, indicador });
  }

  function aposLancamento(apuracao: Apuracao) {
    const indicador = indicadores.find((i) => i.id === apuracao.indicadorId) ?? null;
    setLancamento(null);
    void recarregar();
    if (apuracao.status === "abaixo_da_meta" && indicador) {
      setPlanoPendente({ indicador, apuracao });
      toast.warning("Meta não batida: registre o plano de ação para liberar o fechamento do mês.");
      return;
    }
    toast.success(`Apuração de ${rotuloMes(apuracao.mesReferencia)} registrada.`);
  }

  async function fecharMes(apuracao: Apuracao) {
    try {
      await fecharApuracao(apuracao, sessao);
      toast.success(`Mês de ${rotuloMes(apuracao.mesReferencia)} fechado.`);
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível fechar o mês.");
    }
  }

  async function alternarArquivamento(indicador: Indicador, arquivado: boolean) {
    try {
      await definirArquivamento(indicador, arquivado, sessao);
      toast.success(
        arquivado
          ? "Indicador arquivado. O histórico continua preservado."
          : "Indicador reativado e de volta à visão geral.",
      );
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o indicador.");
    }
  }

  /** Abre o formulário de plano de ação do módulo Planos de Ação já preenchido. */
  function criarPlanoDeAcao(indicador: Indicador, apuracao: Apuracao) {
    void router.navigate({
      to: "/planos-de-acao",
      search: {
        preencher: "1",
        titulo: `Meta não batida em ${rotuloMesLongo(apuracao.mesReferencia)} — ${indicador.nome}`,
        detalhamento:
          `Indicador ${indicador.nome} (${indicador.setor}) apurou ` +
          `${formatarValor(apuracao.valorRealizado, indicador.unidade)} contra a meta de ` +
          `${formatarValor(apuracao.metaNoMes, indicador.unidade)} em ${rotuloMesLongo(apuracao.mesReferencia)}.\n\n` +
          (indicador.formulaDescricao ? `Como o indicador é apurado: ${indicador.formulaDescricao}` : ""),
        setor: indicador.setor,
        origem: ORIGEM_INDICADOR,
        vinculo: `${indicador.nome} · ${apuracao.mesReferencia}`,
      },
    });
  }

  function abrirPlano(planoId: string) {
    void router.navigate({ to: "/planos-de-acao", search: { abrir: planoId } });
  }

  const setoresDoFiltro = useMemo(() => {
    const nomes = new Set(catalogo.setores.map(unificarSetor));
    for (const indicador of ativos) if (indicador.setor) nomes.add(unificarSetor(indicador.setor));
    for (const t of tarefas) if (t.departamento) nomes.add(t.departamento);
    // O Fiscal é dividido por unidade: sai o genérico e ficam Jaguaquara e Maracás.
    nomes.delete("Fiscal");
    nomes.add("Fiscal Jaguaquara");
    nomes.add("Fiscal Maracás");
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalogo.setores, ativos, tarefas]);

  function conteudoLista(lista: Indicador[], vazio: ReactNode) {
    if (carregando) {
      return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-[#F1F5F9]" />
          ))}
        </div>
      );
    }
    if (erro) {
      return (
        <div className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-14 text-center">
          <p className="text-sm text-[#E11D48]">{erro}</p>
          <Button variant="outline" className="mt-4" onClick={() => void recarregar()}>
            Tentar de novo
          </Button>
        </div>
      );
    }
    if (lista.length === 0) return <>{vazio}</>;
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((indicador) => (
          <CartaoIndicador
            key={indicador.id}
            indicador={indicador}
            apuracoes={porIndicador.get(indicador.id) ?? []}
            meses={mesesPeriodo}
            podeLancar={podeLancarApuracao(sessao, indicador)}
            onAbrir={() => setDetalhe(indicador)}
            onLancar={() => setLancamento(indicador)}
          />
        ))}
      </div>
    );
  }

  return (
    <PanelShell wide>
      <div className="indicadores-page">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Medição
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
              Indicadores
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm text-[#64748B]">
              Acompanhe o desempenho de cada setor mês a mês. Compare com a meta e com o mês anterior,
              consulte o histórico e, quando a meta não for batida, registre o plano de ação obrigatório.
            </p>
          </div>

        </div>

        <nav
          aria-label="Seções de indicadores"
          className="mt-6 flex flex-wrap gap-2 rounded-xl border border-[#D9E0EA] bg-white p-1.5"
        >
          {SECOES_INDICADORES.filter((s) => !soProprio || s.valor === "por-colaborador").map((s) => {
            const Icone = s.icone;
            const ativa = secao === s.valor;
            return (
              <button
                key={s.valor}
                type="button"
                aria-current={ativa ? "page" : undefined}
                onClick={() => setSecao(s.valor)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  ativa
                    ? "bg-[#1E293B] text-white shadow-sm"
                    : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#1F2937]"
                }`}
              >
                <Icone className="h-4 w-4" />
                {s.rotulo}
              </button>
            );
          })}
        </nav>

        {secao !== "importar" ? (
        <>
        <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-[#D9E0EA] bg-white p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="competencia-indicadores" className="text-xs text-[#64748B]">
              Competência (importação atual)
            </Label>
            <Input
              id="competencia-indicadores"
              type="month"
              value={mesEscolhido}
              onChange={(e) => setMesEscolhido(e.target.value)}
              className="w-[180px]"
            />
          </div>
          {secao === "por-colaborador" ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-[#64748B]">Colaborador</Label>
              <Select
                value={colaboradorFiltro}
                onValueChange={setColaboradorFiltro}
                disabled={soProprio}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {soProprio ? null : <SelectItem value="todos">Todos os colaboradores</SelectItem>}
                  {(soProprio ? [meuNomeNasTarefas] : colaboradoresTarefas).filter(Boolean).map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : secao === "por-setor" ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#64748B]">Setor</Label>
            <Select value={setorFiltro} onValueChange={setSetorFiltro}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setoresDoFiltro.map((setor) => (
                  <SelectItem key={setor} value={setor}>
                    {setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          ) : null}
          <Button disabled title="Ainda sem integração neste projeto">
            <Calculator className="h-4 w-4" />
            Recalcular snapshot
          </Button>
          <Button variant="outline" disabled title="Ainda sem integração neste projeto">
            <Download className="h-4 w-4" />
            Exportar snapshot
          </Button>
          {podeGerenciar && secao === "por-setor" ? (
            <>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={zerando}
                onClick={() => setZerarAlvo("mes")}
              >
                <Trash2 className="h-4 w-4" />
                Zerar Mês
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={zerando}
                onClick={() => setZerarAlvo("tudo")}
              >
                <Trash2 className="h-4 w-4" />
                Zerar Tudo
              </Button>
            </>
          ) : null}
        </div>
        <ConfirmarDialog
          open={zerarAlvo !== null}
          onOpenChange={(aberto) => {
            if (!aberto && !zerando) setZerarAlvo(null);
          }}
          tom="danger"
          titulo={zerarAlvo === "mes" ? `Zerar ${rotuloMesLongo(mesEscolhido)}?` : "Zerar todas as tarefas?"}
          descricao={
            zerarAlvo === "mes"
              ? `Todas as tarefas com vencimento em ${rotuloMesLongo(mesEscolhido)} serão apagadas do sistema. Essa ação não pode ser desfeita.`
              : "Todas as tarefas importadas do Gestta serão apagadas do sistema. Indicadores e apurações são mantidos. Essa ação não pode ser desfeita."
          }
          textoConfirmar={zerarAlvo === "mes" ? "Zerar mês" : "Zerar tudo"}
          carregando={zerando}
          onConfirmar={() => void confirmarZerar()}
        />
        <CardsTarefas metricas={metricasTarefas} tarefas={tarefasFiltradas} mes={mesEscolhido} />
        {secao === "por-celula" ? (
          <p className="mt-6 rounded-xl border border-[#D9E0EA] bg-white px-6 py-10 text-center text-sm text-[#64748B]">
            As células ainda não foram definidas. Quando você cadastrar quem faz parte de cada célula, os
            números aparecerão aqui.
          </p>
        ) : (
          <TabelaMetricas
            titulo={secao === "por-colaborador" ? "Colaborador" : "Setor"}
            grupos={gruposTarefas}
            ocultarVazio={soProprio}
          />
        )}
        </>
        ) : null}

        {secao === "por-setor" ? (
        <Tabs value={aba} onValueChange={setAba}>

          <TabsContent value="visao-geral">
            {conteudoLista(listaVisaoGeral, null)}
          </TabsContent>

          <TabsContent value="meu-setor">
            {setorDaSessao === "" ? (
              <div className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-14 text-center">
                <h3 className="text-base font-semibold text-[#1F2937]">Setor não identificado</h3>
                <p className="mt-1.5 text-sm text-[#64748B]">
                  Seu cadastro não tem setor definido, então não há indicadores para lançar aqui. Fale com a
                  Qualidade para ajustar o seu cadastro.
                </p>
              </div>
            ) : (
              <>
                <p className="mt-4 text-[13px] text-[#64748B]">
                  Indicadores do setor <span className="font-semibold text-[#1F2937]">{sessao?.setor}</span>.
                  {atrasadasNoMeuSetor > 0
                    ? ` ${atrasadasNoMeuSetor} apuração(ões) atrasada(s) — passou do dia ${
                        DIA_LIMITE_APURACAO
                      } e o mês anterior segue sem lançamento.`
                    : ""}
                </p>
                {conteudoLista(
                  listaMeuSetor,
                  <EstadoVazioIndicadores
                    podeGerenciar={podeGerenciar}
                    temIndicadores={false}
                    onCriar={() => abrirFormulario(null)}
                    onBiblioteca={() => setBibliotecaAberta(true)}
                  />,
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ocorrencias">
            <OcorrenciasIndicadores />
          </TabsContent>
        </Tabs>
        ) : secao === "importar" ? (
          <div className="space-y-6">
            <ImportadorTarefas
              controle={controleImport[0]}
              aoMudarArquivo={marcarArquivo[0]}
              titulo="Tarefas - Gestta"
              descricao="Envie a planilha de tarefas exportada do Gestta (.xlsx). Tarefas já importadas (mesmo Id) não são duplicadas: se algo mudou, como status ou data de conclusão, a tarefa é atualizada."
              totalImportadas={tarefas.length}
              aoConcluir={(r, lista) => {
                setTarefas(lista);
                if (r.mesPredominante) setMesEscolhido(r.mesPredominante);
              }}
            />
            <ImportadorTarefas
              controle={controleImport[1]}
              aoMudarArquivo={marcarArquivo[1]}
              titulo="Tarefas complementares (concluídas de meses anteriores)"
              descricao="Envie o relatório de tarefas concluídas de outros meses (.xlsx). Só entram tarefas com Id novo; as que já existem são ignoradas."
              atrasadas
              origemRelatorio="complementar"
              totalImportadas={tarefas.length}
              aoConcluir={(_, lista) => setTarefas(lista)}
            />
            <ImportadorTarefas
              controle={controleImport[2]}
              aoMudarArquivo={marcarArquivo[2]}
              titulo="Tarefas acumuladas (abertas / atrasadas / impedimentos)"
              descricao="Envie o Relatório de tarefas atrasadas (.xlsx, tarefas abertas e em impedimento). Só entram tarefas com Id novo; as que já existem são ignoradas."
              atrasadas
              totalImportadas={tarefas.length}
              aoConcluir={(_, lista) => setTarefas(lista)}
            />
            <div className="flex justify-end">
              <Button
                disabled={importandoTudo || !arquivosProntos.some(Boolean)}
                onClick={() => void importarTudo()}
              >
                <Upload className="h-4 w-4" />
                {importandoTudo ? "Importando tudo..." : "Importar tudo"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {podeGerenciar ? (
        <>
          <FormularioIndicadorDialog
            aberto={formulario.aberto}
            indicador={formulario.indicador}
            setores={catalogo.setores}
            colaboradores={catalogo.colaboradores}
            onFechar={() => setFormulario({ aberto: false, indicador: null })}
            onSalvo={() => {
              setFormulario({ aberto: false, indicador: null });
              toast.success("Indicador salvo.");
              void recarregar();
            }}
          />
          <BibliotecaModelosDialog
            aberto={bibliotecaAberta}
            modelos={indicadores.filter((i) => i.criadoDeModelo && !i.ativo)}
            carregando={carregando}
            setores={catalogo.setores}
            colaboradores={catalogo.colaboradores}
            onFechar={() => setBibliotecaAberta(false)}
            onAtivado={() => {
              setBibliotecaAberta(false);
              toast.success("Indicador ativado da biblioteca. Confira a meta e o responsável.");
              void recarregar();
            }}
          />
        </>
      ) : null}

      <LancarApuracaoDialog
        aberto={lancamento !== null}
        indicador={lancamento}
        apuracoes={lancamento ? (porIndicador.get(lancamento.id) ?? []) : []}
        onFechar={() => setLancamento(null)}
        onLancado={aposLancamento}
      />

      <PlanoObrigatorioDialog
        aberto={planoPendente !== null}
        indicador={planoPendente?.indicador ?? null}
        apuracao={planoPendente?.apuracao ?? null}
        onCriarPlano={criarPlanoDeAcao}
        onFechar={() => setPlanoPendente(null)}
        onVinculado={() => {
          setPlanoPendente(null);
          toast.success("Plano de ação vinculado ao mês.");
          void recarregar();
        }}
      />

      <DetalheIndicadorDrawer
        indicador={indicadorDetalhe}
        apuracoes={indicadorDetalhe ? (porIndicador.get(indicadorDetalhe.id) ?? []) : []}
        meses={mesesDrawer}
        periodoRotulo={ehPadraoPeriodo ? "últimos 24 meses" : rotuloPeriodoAtual}
        planosPorId={planosPorId}
        podeGerenciar={podeGerenciar}
        podeLancar={!!indicadorDetalhe && podeLancarApuracao(sessao, indicadorDetalhe)}
        onFechar={() => setDetalhe(null)}
        onLancar={(indicador) => setLancamento(indicador)}
        onEditar={(indicador) => abrirFormulario(indicador)}
        onAlternarArquivamento={(indicador, arquivado) => void alternarArquivamento(indicador, arquivado)}
        onFecharMes={(apuracao) => void fecharMes(apuracao)}
        onVincularPlano={(indicador, apuracao) => setPlanoPendente({ indicador, apuracao })}
        onAbrirPlano={abrirPlano}
      />
    </PanelShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards por indicador                                                         */
/* -------------------------------------------------------------------------- */

/** Mini-gráfico dos últimos meses com lançamento (linha + linha da meta). */
function SparklineValores({
  indicador,
  apuracoes,
  meses,
}: {
  indicador: Indicador;
  apuracoes: Apuracao[];
  meses: string[];
}) {
  const pontos = meses
    .map((mes) => ({ mes, valor: apuracaoDoMes(apuracoes, mes)?.valorRealizado ?? null }))
    .filter((ponto): ponto is { mes: string; valor: number } => ponto.valor !== null);

  if (pontos.length < 2) {
    return (
      <p className="text-[12px] text-[#94A3B8]">Sem histórico suficiente para o gráfico do período.</p>
    );
  }

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="mes" hide />
          <YAxis hide domain={["auto", "auto"]} />
          {indicador.meta !== null ? (
            <ReferenceLine
              y={indicador.meta}
              stroke="currentColor"
              strokeDasharray="3 3"
              className="text-[#94A3B8]"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="valor"
            stroke="currentColor"
            className="text-[#1E3A8A]"
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}




interface CartaoProps {
  indicador: Indicador;
  apuracoes: Apuracao[];
  /** Meses do período de exibição (recorte do filtro da página). */
  meses: string[];
  podeLancar: boolean;
  onAbrir: () => void;
  onLancar: () => void;
}

function CartaoIndicador({ indicador, apuracoes, meses, podeLancar, onAbrir, onLancar }: CartaoProps) {
  const noPeriodo = new Set(meses);
  const apuracoesNoPeriodo = apuracoes.filter((a) => noPeriodo.has(a.mesReferencia));
  const ultima = ultimaApuracao(apuracoesNoPeriodo);
  const anterior = ultima ? apuracaoDoMes(apuracoesNoPeriodo, mesAnterior(ultima.mesReferencia)) : null;
  const variacao = calcularVariacao(
    ultima?.valorRealizado ?? null,
    anterior?.valorRealizado ?? null,
    indicador.sentido,
  );
  const atrasada = apuracaoAtrasada(apuracoes);

  return (
    <div className="flex flex-col rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm transition hover:border-[#94A3B8]">
      <button type="button" onClick={onAbrir} className="text-left">
        <p className="text-[15px] font-semibold leading-snug text-[#1F2937]">{indicador.nome}</p>
        <p className="mt-1 text-[12px] text-[#64748B]">
          {indicador.setor || "Sem setor"}
          {indicador.responsavelNome ? ` · ${indicador.responsavelNome}` : ""}
        </p>
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusApuracaoBadge status={ultima?.status ?? "pendente"} fechado={ultima?.fechado} />
        {indicador.automatico ? <Pill tom="info">Automático</Pill> : null}
        {atrasada ? <SeloAtraso mes={rotuloMes(mesAnteriorRef())} /> : null}
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between gap-2">
          <p className="text-[24px] font-semibold leading-none text-[#1F2937]">
            {formatarValor(ultima?.valorRealizado ?? null, indicador.unidade)}
          </p>
          <p className="text-[12px] text-[#64748B]">
            meta {formatarValor(ultima?.metaNoMes ?? indicador.meta, indicador.unidade)}
          </p>
        </div>
        <p className="mt-1.5 text-[12px] text-[#94A3B8]">
          {ultima ? `Apurado em ${rotuloMes(ultima.mesReferencia)}` : "Nenhuma apuração lançada"}
        </p>
        <div className="mt-1.5">
          <VariacaoIndicador
            variacao={variacao}
            absoluta={formatarValor(variacao ? Math.abs(variacao.absoluta) : null, indicador.unidade)}
          />
        </div>
      </div>

      <div className="mt-3">
        <SparklineValores indicador={indicador} apuracoes={apuracoes} meses={meses} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#EEF2F7] pt-3">
        <Button size="sm" variant="outline" onClick={onAbrir}>
          Ver histórico
        </Button>
        {podeLancar && indicador.ativo ? (
          <Button size="sm" onClick={onLancar}>
            Lançar apuração
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface VazioProps {
  podeGerenciar: boolean;
  temIndicadores: boolean;
  onCriar: () => void;
  onBiblioteca: () => void;
}

function EstadoVazioIndicadores({ podeGerenciar, temIndicadores, onCriar, onBiblioteca }: VazioProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <BarChart3 className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
          {temIndicadores ? "Nenhum indicador neste setor" : "Nenhum indicador cadastrado aqui"}
        </h3>
      </div>
    </div>
  );
}


function Barra({
  rotulo,
  valor,
  cor,
  max,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  max: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="truncate text-[#334155]">{rotulo}</span>
        <span className="font-semibold text-[#1F2937]">{valor}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF2F7]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: max > 0 ? `${Math.max(4, (valor / max) * 100)}%` : "0%",
            backgroundColor: cor,
          }}
        />
      </div>
    </div>
  );
}

function OcorrenciasIndicadores() {
  const ocorrencias = useAsync(listarOcorrencias, []);
  const tipos = useAsync(listarTipos, []);

  const lista = ocorrencias.data ?? [];
  const porNomeCor = new Map<string, string>();
  for (const t of tipos.data ?? []) porNomeCor.set(t.nome, t.cor);

  const total = lista.length;
  const emAndamento = lista.filter((o) => o.status !== "encerrada").length;
  const encerradas = lista.filter((o) => o.status === "encerrada").length;
  const reabertas = lista.filter((o) => o.reaberturas > 0).length;
  const atrasadas = lista.filter((o) => ocorrenciaAtrasada(o)).length;
  const noPrazo =
    emAndamento > 0 ? Math.round(((emAndamento - atrasadas) / emAndamento) * 100) : 100;
  const reincidencia = total > 0 ? Math.round((reabertas / total) * 100) : 0;

  const porTipo = new Map<string, number>();
  for (const o of lista) porTipo.set(o.tipoNome, (porTipo.get(o.tipoNome) ?? 0) + 1);
  const tiposRecorrentes = [...porTipo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxTipo = tiposRecorrentes[0]?.[1] ?? 0;

  const barrasStatus = [
    { rotulo: "Em andamento", valor: emAndamento, cor: "#1E3A8A" },
    { rotulo: "Encerradas", valor: encerradas, cor: "#059669" },
    { rotulo: "Reabertas", valor: reabertas, cor: "#D97706" },
    { rotulo: "Atrasadas", valor: atrasadas, cor: "#E11D48" },
  ];
  const maxStatus = Math.max(...barrasStatus.map((b) => b.valor), 1);

  if (ocorrencias.loading) {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[#F1F5F9]" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Ocorrências abertas"
          value={String(total)}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
          accent="#1E3A8A"
          footer="desde o início da operação"
        />
        <SummaryCard
          label="Em andamento"
          value={String(emAndamento)}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1E3A8A]"
          accent="#1E3A8A"
          footer={`${atrasadas} atrasada(s) na etapa atual`}
        />
        <SummaryCard
          label="No prazo"
          value={`${noPrazo}%`}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
          accent="#059669"
          footer="entre as ocorrências em andamento"
        />
        <SummaryCard
          label="Reincidência"
          value={`${reincidencia}%`}
          valueClass={`mt-3 text-[30px] font-semibold leading-none ${
            reincidencia > 0 ? "text-[#D97706]" : "text-[#059669]"
          }`}
          accent={reincidencia > 0 ? "#D97706" : "#059669"}
          footer={`${reabertas} reaberta(s) por ineficácia`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#D9E0EA] bg-white p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            <TrainFront className="h-4 w-4" />
            Linha do metrô — situação
          </h3>
          <div className="mt-3 space-y-3">
            {barrasStatus.map((b) => (
              <Barra key={b.rotulo} rotulo={b.rotulo} valor={b.valor} cor={b.cor} max={maxStatus} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#D9E0EA] bg-white p-4">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            <AlertTriangle className="h-4 w-4" />
            Tipos mais recorrentes
          </h3>
          {tiposRecorrentes.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#94A3B8]">Nenhuma ocorrência registrada ainda.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {tiposRecorrentes.map(([nome, qtd]) => (
                <Barra
                  key={nome}
                  rotulo={nome}
                  valor={qtd}
                  max={maxTipo}
                  cor={porNomeCor.get(nome) ?? "#1E3A8A"}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}



function ImportadorTarefas({
  titulo,
  descricao,
  totalImportadas,
  aoConcluir,
  atrasadas = false,
  origemRelatorio = "acumulada",
  controle,
  aoMudarArquivo,
}: {
  atrasadas?: boolean;
  origemRelatorio?: "complementar" | "acumulada";
  controle?: MutableRefObject<(() => Promise<void>) | null>;
  aoMudarArquivo?: (temArquivo: boolean) => void;
  titulo: string;
  descricao: string;
  totalImportadas: number;
  aoConcluir: (r: ResultadoImportacao, lista: TarefaGestta[]) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  // Evita que o navegador abra o arquivo se ele for solto fora da área.
  useEffect(() => {
    const bloquear = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", bloquear);
    return () => {
      window.removeEventListener("dragover", bloquear);
      window.removeEventListener("drop", bloquear);
    };
  }, []);
  const [arrastando, setArrastando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; valor: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  async function importar() {
    if (!arquivo || importando) return;
    setImportando(true);
    setResultado(null);
    setProgresso({ etapa: "Lendo a planilha...", valor: 5 });
    try {
      const { tarefas: lidas, duplicadasNoArquivo } = await (atrasadas ? (a: File) => lerPlanilhaAtrasadas(a, origemRelatorio) : lerPlanilhaTarefas)(arquivo);
      if (lidas.length === 0) throw new Error("Nenhuma tarefa encontrada na planilha.");
      setProgresso({ etapa: `Verificando ${lidas.length} tarefas já importadas...`, valor: 15 });
      const r = await importarTarefas(lidas, duplicadasNoArquivo, (feito, total) =>
        setProgresso({
          etapa: `Gravando tarefas: ${feito} de ${total}`,
          valor: 20 + (total === 0 ? 70 : Math.round((feito / total) * 70)),
        }),
        atrasadas,
      );
      setProgresso({ etapa: "Atualizando os números...", valor: 95 });
      setResultado(r);
      aoConcluir(r, await carregarTarefas());
      setArquivo(null);
      toast.success("Importação concluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar a planilha.");
    } finally {
      setImportando(false);
      setProgresso(null);
    }
  }

  const importarRef = useRef(importar);
  importarRef.current = importar;
  useEffect(() => {
    if (!controle) return;
    controle.current = () => importarRef.current();
    return () => {
      controle.current = null;
    };
  }, [controle]);
  useEffect(() => {
    aoMudarArquivo?.(arquivo !== null);
  }, [arquivo, aoMudarArquivo]);

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-6">
      <h3 className="text-base font-semibold text-[#1F2937]">{titulo}</h3>
      <p className="mt-1 text-sm text-[#64748B]">{descricao}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => entradaRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            entradaRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setArrastando(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setArrastando(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setArrastando(false);
          const f = e.dataTransfer.files?.[0];
          if (!f) return;
          if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
            toast.error("Envie um arquivo .xlsx, .xls ou .csv.");
            return;
          }
          setArquivo(f);
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm text-[#475569] hover:bg-[#F1F5F9] ${
          arrastando ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#CBD5E1] bg-[#F8FAFC]"
        }`}
      >
        <Upload className="pointer-events-none h-6 w-6 text-[#94A3B8]" />
        <span className="pointer-events-none">
          {arquivo ? arquivo.name : "Arraste o arquivo aqui ou clique para escolher"}
        </span>
        <input
          ref={entradaRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button disabled={!arquivo || importando} onClick={() => void importar()}>
          <Upload className="h-4 w-4" />
          {importando ? "Importando..." : "Importar tarefas"}
        </Button>
        <span className="text-sm text-[#64748B]">{totalImportadas} tarefas já importadas</span>
      </div>
      {progresso ? (
        <div className="mt-4 max-w-xl">
          <div className="mb-1.5 flex justify-between text-sm text-[#475569]">
            <span>{progresso.etapa}</span>
            <span className="tabular-nums">{progresso.valor}%</span>
          </div>
          <Progress value={progresso.valor} />
        </div>
      ) : null}
      {resultado ? (
        <ul className="mt-4 space-y-1 text-sm text-[#475569]">
          <li>Linhas lidas: {resultado.lidas}</li>
          <li>Novas: {resultado.novas}</li>
          <li>Atualizadas: {resultado.atualizadas}</li>
          <li>Já existiam, sem mudança (ignoradas): {resultado.ignoradas}</li>
          <li>Repetidas dentro do arquivo: {resultado.duplicadasNoArquivo}</li>
        </ul>
      ) : null}
    </section>
  );
}
