import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, CalendarDays, Library, Plus, TrainFront } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { PlanoAcao } from "@/lib/planos";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [{ title: "Indicadores | Gestão da Qualidade" }],
  }),
  component: Indicadores,
});

interface SummaryCardProps {
  label: string;
  value: string;
  valueClass: string;
  accent: string;
  footer: string;
}

function SummaryCard({ label, value, valueClass, accent, footer }: SummaryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <p className={valueClass}>{value}</p>
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

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [listaIndicadores, listaApuracoes, listaPlanos] = await Promise.all([
        listarIndicadores(),
        listarApuracoes(),
        listarPlanos().catch(() => [] as PlanoAcao[]),
      ]);
      setIndicadores(listaIndicadores);
      setApuracoes(listaApuracoes);
      setPlanos(listaPlanos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os indicadores.");
    } finally {
      setCarregando(false);
    }
  }, []);

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

  /** Volta para o padrão (últimos 12 meses) e limpa o calendário. */
  function limparPeriodo() {
    setIntervaloCal({ from: undefined });
    setPeriodo({ modo: "ultimos12" });
  }

  /** Números dos cards do topo: apurados, fechados e dentro do período. */
  const resumo = useMemo(() => {
    const noPeriodo = new Set(mesesPeriodo);
    const fechadas = apuracoes.filter(
      (a) => a.fechado && a.valorRealizado !== null && noPeriodo.has(a.mesReferencia),
    );
    const ultimoFechamento = fechadas.reduce(
      (max, a) => (a.mesReferencia > max ? a.mesReferencia : max),
      "",
    );
    const doMes = ultimoFechamento ? fechadas.filter((a) => a.mesReferencia === ultimoFechamento) : [];
    return {
      acompanhados: ativos.length,
      dentro: doMes.filter((a) => a.status === "dentro_da_meta").length,
      abaixo: doMes.filter((a) => a.status === "abaixo_da_meta").length,
      ultimoFechamento,
    };
  }, [ativos, apuracoes, mesesPeriodo]);

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
    const nomes = new Set(catalogo.setores);
    for (const indicador of ativos) if (indicador.setor) nomes.add(indicador.setor);
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalogo.setores, ativos]);

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

          {podeGerenciar ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setBibliotecaAberta(true)}>
                <Library className="h-4 w-4" />
                Usar indicador pronto
              </Button>
              <Button onClick={() => abrirFormulario(null)}>
                <Plus className="h-4 w-4" />
                Novo indicador
              </Button>
            </div>
          ) : null}
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Indicadores acompanhados"
            value={String(resumo.acompanhados)}
            valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
            accent="#1F2937"
            footer="indicadores ativos em toda a operação"
          />
          <SummaryCard
            label="Dentro da meta"
            value={String(resumo.dentro)}
            valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
            accent="#059669"
            footer={
              resumo.ultimoFechamento
                ? `no fechamento de ${rotuloMes(resumo.ultimoFechamento)}`
                : "sem fechamento ainda"
            }
          />
          <SummaryCard
            label="Abaixo da meta"
            value={String(resumo.abaixo)}
            valueClass="mt-3 text-[30px] font-semibold leading-none text-[#E11D48]"
            accent="#E11D48"
            footer="exigem plano de ação vinculado"
          />
          <SummaryCard
            label="Último fechamento"
            value={resumo.ultimoFechamento ? rotuloMes(resumo.ultimoFechamento) : "—"}
            valueClass="mt-3 text-[30px] font-semibold leading-none text-[#4F46E5]"
            accent="#4F46E5"
            footer={
              resumo.ultimoFechamento
                ? ehPadraoPeriodo
                  ? "mês de referência fechado"
                  : `fechado dentro de ${rotuloPeriodoAtual}`
                : ehPadraoPeriodo
                  ? "nenhum mês fechado até agora"
                  : `nenhum fechamento em ${rotuloPeriodoAtual}`
            }
          />
        </section>

        <Tabs value={aba} onValueChange={setAba}>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
                <TabsTrigger value="meu-setor">Meu setor</TabsTrigger>
                <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              </TabsList>

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

            {/* Filtro de período: recorta resumo, cards, gráficos e histórico. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                Período
              </span>
              <Select value={periodo.modo} onValueChange={mudarModoPeriodo}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODOS_PERIODO.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {periodo.modo === "mes" ? (
                <Select
                  value={mesEscolhido}
                  onValueChange={(valor) => {
                    setMesEscolhido(valor);
                    setPeriodo({ modo: "mes", mes: valor });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.map((mes) => (
                      <SelectItem key={mes} value={mes}>
                        {rotuloMes(mes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {periodo.modo === "ano" ? (
                <Select
                  value={String(anoEscolhido)}
                  onValueChange={(valor) => {
                    const ano = Number(valor);
                    setAnoEscolhido(ano);
                    setPeriodo({ modo: "ano", ano });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((ano) => (
                      <SelectItem key={ano} value={String(ano)}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {periodo.modo === "intervalo" ? (
                <Popover open={popoverIntervalo} onOpenChange={setPopoverIntervalo}>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarDays className="h-4 w-4" />
                      {periodo.inicio ? rotuloPeriodoAtual : "Selecionar datas"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={intervaloCal}
                      onSelect={(range) => aoSelecionarIntervalo(range)}
                      numberOfMonths={2}
                      locale={ptBR}
                      disabled={{ after: new Date() }}
                      resetOnSelect
                    />
                    <p className="border-t border-[#E9EEF5] px-4 py-2.5 text-[12px] text-[#64748B]">
                      1º clique marca a data inicial; arraste o mouse e dê o 2º clique para marcar a final.
                    </p>
                  </PopoverContent>
                </Popover>
              ) : null}

              {!ehPadraoPeriodo ? (
                <Button variant="ghost" size="sm" onClick={limparPeriodo}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </div>

          <TabsContent value="visao-geral">
            {conteudoLista(
              listaVisaoGeral,
              <EstadoVazioIndicadores
                podeGerenciar={podeGerenciar}
                temIndicadores={ativos.length > 0}
                onCriar={() => abrirFormulario(null)}
                onBiblioteca={() => setBibliotecaAberta(true)}
              />,
            )}
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
        <p className="mt-1.5 max-w-lg text-sm text-[#64748B]">
          Use um modelo pronto da biblioteca ou crie o indicador do zero: a Qualidade define a meta e como
          ele é apurado, e o setor lança o resultado todo mês.
        </p>
        {podeGerenciar ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={onBiblioteca}>
              <Library className="h-4 w-4" />
              Usar indicador pronto
            </Button>
            <Button onClick={onCriar}>
              <Plus className="h-4 w-4" />
              Criar indicador
            </Button>
          </div>
        ) : null}
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


