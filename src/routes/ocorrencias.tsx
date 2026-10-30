import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  LayoutGrid,
  ClipboardList,
  List,
  Pencil,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelShell, usePanelSession } from "@/components/panel-shell";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useAsync } from "@/hooks/use-async";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { FormBuilder } from "@/components/ocorrencias/form-builder";
import { FlowBuilder } from "@/components/ocorrencias/flow-builder";
import { FormatadorSla } from "@/components/ocorrencias/formatador-sla";
import { DetalheOcorrenciaDialog } from "@/components/ocorrencias/detalhe-ocorrencia-dialog";
import { FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  ESTADO_NC_VAZIO,
  FormularioNaoConformidade,
  LIMITE_ANEXOS_NC,
  LIMITE_TEXTO_NC,
  TAMANHO_MAX_ANEXO_NC,
  type EstadoNaoConformidade,
} from "@/components/ocorrencias/formulario-nao-conformidade";
import {
  publicarFluxo,
  publicarFormulario,
  listarOcorrencias,
  listarTipos,
  salvarTipo,
} from "@/lib/ocorrencias-base";
import {
  abrirOcorrencia,
  adicionarAnexosAbertura,
  anexarArquivosDosCampos,
  carregarUltimasVersoes,
  detectarAtrasos,
  type VersoesPublicadas,
} from "@/lib/ocorrencias-crud";
import {
  ETAPAS_FIXAS,
  ICONES_OCORRENCIA,
  PROCEDENCIA_LABELS,
  PRIORIDADE_LABELS,
  alinharFluxoAoTipo,
  ehTipoNaoConformidade,
  etapasDoTipo,
  PRAZOS_EFICACIA,
  ETAPA_RETORNO_CLIENTE,
  CHAVE_SETORES_ENVOLVIDOS,
  setoresDoFormulario,
  setoresEnvolvidosDe,
  tituloDaOcorrencia,
  ocorrenciaAtrasada,
  formatarPrazo,
  iconeTipoOcorrencia,
  idCurto,
  nomeEtapaDoTipo,
  type CampoFormulario,
  type EtapaTipo,
  type MacroFluxo,
  type Ocorrencia,
  type Respostas,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";
import { getSession } from "@/lib/auth";
import { NIVEL_LIDER_SETOR, normalizarSetor } from "@/lib/niveis-acesso";
import {
  acompanhaTodosOsSetores,
  ehAdministrador,
  ehUsuarioDaQualidade,
  liderDoSetor,
  setoresLiderados,
} from "@/lib/permissoes";
import { podeConfigurarOcorrencias, veTodasAsOcorrencias } from "@/lib/ocorrencias-permissoes";
import { traduzErro } from "@/lib/organizacao";

export const Route = createFileRoute("/ocorrencias")({
  head: () => ({
    meta: [{ title: "Ocorrências | Gestão da Qualidade" }],
  }),
  component: Ocorrencias,
});

const ABAS = [
  { valor: "abertura", rotulo: "Abertura de Ocorrência" },
  { valor: "todas", rotulo: "Todas as Ocorrências" },
  { valor: "abri", rotulo: "Que eu abri" },
  { valor: "equipe", rotulo: "Minha equipe" },
] as const;

/** Página "Minha equipe": mesma lista, só com as ocorrências dos setores que a pessoa lidera. */
export function OcorrenciasEquipe() {
  return <Ocorrencias equipe />;
}

function Ocorrencias({ equipe = false }: { equipe?: boolean } = {}) {
  // O hook de contexto é nulo aqui: este componente RENDERIZA o PanelShell (e o
  // contexto só flui para baixo). Lemos a sessão persistida no navegador, como
  // as demais rotas (planos-de-acao/painel).
  const sessaoCtx = usePanelSession();
  const session = getSession() ?? sessaoCtx;
  const [modo, setModo] = useState<"lista" | "configurar">("lista");
  // Como as ocorrências aparecem nas abas: lista ou kanban.
  const [visao, setVisao] = useState<"lista" | "kanban">("lista");
  const [refreshToken, setRefreshToken] = useState(0);
  const [abrirAberto, setAbrirAberto] = useState(false);
  const [tipoInicialId, setTipoInicialId] = useState<string | null>(null);
  // Cartão expandido na aba de abertura ("nao-conformidade" ou "reclamacao").
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string | null>(null);
  // Aba ativa; depois de abrir uma ocorrência, a tela vai para "Que eu abri".
  const [abaAtiva, setAbaAtiva] = useState<string>(equipe ? "equipe" : "abertura");
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<Ocorrencia | null>(null);
  // Aviso de ocorrência registrada (fica na tela até ser dispensado).
  const [avisoCriada, setAvisoCriada] = useState<Ocorrencia | null>(null);

  const tipos = useAsync(listarTipos, [refreshToken]);
  const ocorrencias = useAsync(listarOcorrencias, [refreshToken]);
  const [listaAoVivo, setListaAoVivo] = useState<Ocorrencia[] | null>(null);
  const refreshTokenRef = useRef(0);
  const recarregar = () => {
    refreshTokenRef.current += 1;
    setListaAoVivo(null);
    setRefreshToken((v) => v + 1);
  };

  const podeConfigurar = podeConfigurarOcorrencias(session);
  const vêTudo = veTodasAsOcorrencias(session);
  const carregando = ocorrencias.loading;
  const lista = listaAoVivo ?? ocorrencias.data ?? [];

  useEffect(() => {
    if (!ocorrencias.loading && ocorrencias.data) {
      void detectarAtrasos(ocorrencias.data, session).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocorrencias.data, ocorrencias.loading]);

  useEffect(() => {
    if (ocorrencias.loading) return;
    const id = window.setInterval(() => {
      // Captura a geração da lista no início do poll: se `recarregar()` rodar
      // enquanto este fetch está em andamento (ex.: ocorrência recém-aberta),
      // o resultado obsoleto NÃO pode sobrescrever a lista fresca.
      const geracao = refreshTokenRef.current;
      listarOcorrencias()
        .then((nova) => {
          if (geracao !== refreshTokenRef.current) return;
          setListaAoVivo(nova);
          void detectarAtrasos(nova, session).catch(() => undefined);
        })
        .catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocorrencias.loading, refreshToken]);

  // A aba "Minha equipe" existe para quem lidera setor e para quem acompanha todos os setores.
  const ehLiderDeSetor = setoresLiderados(session).length > 0 || acompanhaTodosOsSetores(session);
  const abasVisiveis = ABAS.filter((aba) => {
    if (equipe) return aba.valor === "equipe";
    if (aba.valor === "equipe") return ehLiderDeSetor;
    return aba.valor !== "todas" || veTodasAsOcorrencias(session);
  });

  // Ocorrência de um setor que a pessoa lidera (aberta por alguém dele ou com ele envolvido).
  // Gestor da Qualidade e Desenvolvedor do Sistema acompanham todos os setores.
  const setorDaEquipe = (o: Ocorrencia): boolean =>
    acompanhaTodosOsSetores(session) ||
    liderDoSetor(session, o.abertaPorSetor) ||
    setoresEnvolvidosDe(o).some((s) => liderDoSetor(session, s));

  const filtrar = (aba: (typeof ABAS)[number]["valor"], o: Ocorrencia): boolean => {
    const email = (session?.email ?? "").trim().toLowerCase();
    const colaboradorId = (session?.colaboradorId ?? "").trim();
    const propria =
      (!!email && o.abertaPorEmail.trim().toLowerCase() === email) ||
      (!!o.abertaPorId && o.abertaPorId === colaboradorId);
    const encarregado =
      o.status !== "encerrada" &&
      ((!!o.responsavelEmail && o.responsavelEmail.toLowerCase() === email) ||
        (!!o.responsavelId && o.responsavelId === colaboradorId));
    if (aba === "abertura") return false;
    if (aba === "todas") return true;
    if (aba === "equipe") return setorDaEquipe(o);
    // Setor envolvido (marcado no formulário) acompanha para dar ciência.
    const meuSetor = normalizarSetor(session?.setor);
    const setorEnvolvido =
      o.status !== "encerrada" &&
      !!meuSetor &&
      setoresEnvolvidosDe(o).some((s) => normalizarSetor(s) === meuSetor);
    // Líder de setor também vê as ocorrências abertas por pessoas dos setores que lidera.
    const lidera = new Set(
      [session?.setor, ...(session?.setoresLiderados ?? [])]
        .map((x) => normalizarSetor(x))
        .filter(Boolean),
    );
    const doSetorLiderado =
      session?.nivelAcesso === NIVEL_LIDER_SETOR && lidera.has(normalizarSetor(o.abertaPorSetor));
    const visivel = vêTudo || propria || encarregado || setorEnvolvido || doSetorLiderado;
    if (!visivel) return false;
    // Quem abriu, é responsável ou é setor envolvido acompanha por esta aba.
    return propria || encarregado || setorEnvolvido || doSetorLiderado;
  };

  const abrirNovaOcorrencia = (tipoId: string | null = null) => {
    setTipoInicialId(tipoId);
    setAbrirAberto(true);
  };

  const porAba = (aba: string) =>
    lista.filter((o) => filtrar(aba as (typeof ABAS)[number]["valor"], o));

  return (
    <PanelShell wide>
      <div className="flex min-h-[calc(100vh-6rem)] flex-col">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Tratativa
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
              {equipe ? "Minha equipe" : "Ocorrências"}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#64748B]">
              {equipe
                ? "Acompanhe junto com a Qualidade as ocorrências dos setores que você lidera."
                : "Quem abre acompanha a etapa como quem acompanha o metrô: só sabe onde está e quando chega."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[#D9E0EA] bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setModo("lista");
                  setVisao("lista");
                }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                  modo === "lista" && visao === "lista"
                    ? "bg-[#1E3A8A] text-white"
                    : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo("lista");
                  setVisao("kanban");
                }}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                  modo === "lista" && visao === "kanban"
                    ? "bg-[#1E3A8A] text-white"
                    : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
              {podeConfigurar && (
                <button
                  type="button"
                  onClick={() => setModo("configurar")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                    modo === "configurar"
                      ? "bg-[#1E3A8A] text-white"
                      : "text-[#64748B] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Configurar
                </button>
              )}
            </div>
          </div>
        </div>

        {avisoCriada && (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-[#047857] bg-[#059669] p-4 text-white shadow-sm"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-white" />
            <p className="flex-1 text-[14px] leading-relaxed">
              Sua ocorrência <strong>{avisoCriada.titulo || avisoCriada.numero}</strong>{" "}
              <span className="font-mono text-[12px] opacity-80">({avisoCriada.numero})</span> foi
              registrada. Acompanhe na aba ao lado e aguarde a resolutiva do setor da Qualidade!
            </p>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setAvisoCriada(null)}
              className="rounded-md p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {modo === "lista" ? (
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="flex-wrap">
              {abasVisiveis.map((aba) => {
                const total = porAba(aba.valor).length;
                return (
                  <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
                    {aba.rotulo}
                    {aba.valor !== "abertura" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                        {total}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {abasVisiveis.map((aba) => (
              <TabsContent key={aba.valor} value={aba.valor}>
                {aba.valor === "abertura" ? (
                  <AberturaOcorrencia
                    tipos={tipos.data ?? []}
                    selecionado={cartaoSelecionado}
                    onSelecionar={setCartaoSelecionado}
                    renderFormulario={(tipoId) => (
                      <AbrirOcorrenciaDialog
                        variante="tela"
                        aberto
                        tipos={tipos.data ?? []}
                        tipoInicialId={tipoId}
                        onFechar={() => setCartaoSelecionado(null)}
                        onCriado={(o) => {
                          setCartaoSelecionado(null);
                          setAbaAtiva("abri");
                          recarregar();
                          setAvisoCriada(o);
                        }}
                      />
                    )}
                  />
                ) : visao === "kanban" ? (
                  <KanbanOcorrencias
                    ocorrencias={porAba(aba.valor)}
                    carregando={carregando}
                    onDetalhar={(o) => setOcorrenciaSelecionada(o)}
                  />
                ) : (
                  <ListaOcorrencias
                    ocorrencias={porAba(aba.valor)}
                    tipos={tipos.data ?? []}
                    carregando={carregando}
                    onAbrir={() => abrirNovaOcorrencia()}
                    onDetalhar={(o) => setOcorrenciaSelecionada(o)}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <ConfigurarOcorrencias tipos={tipos.data ?? []} recarregar={recarregar} />
        )}
      </div>

      <AbrirOcorrenciaDialog
        aberto={abrirAberto}
        tipos={tipos.data ?? []}
        tipoInicialId={tipoInicialId}
        onFechar={() => setAbrirAberto(false)}
        onCriado={(o) => {
          setAbrirAberto(false);
          setAbaAtiva("abri");
          recarregar();
          setAvisoCriada(o);
        }}
      />

      <DetalheOcorrenciaDialog
        aberto={!!ocorrenciaSelecionada}
        onClose={() => setOcorrenciaSelecionada(null)}
        ocorrencia={ocorrenciaSelecionada}
        onAlterada={() => recarregar()}
      />
    </PanelShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Lista                                                                       */
/* -------------------------------------------------------------------------- */

/** Pontos de um hexágono centrado em (100, 100) com raio `r`. */
function hexagono(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const angulo = (Math.PI / 3) * k;
    return `${(100 + r * Math.cos(angulo)).toFixed(1)},${(100 + r * Math.sin(angulo)).toFixed(1)}`;
  }).join(" ");
}

const ENTRADA_FUNDO = {
  initial: { opacity: 0 },
  animate: { opacity: 0.22 },
  transition: { duration: 0.8, ease: "easeOut" as const },
};

/*
 * Origem das transformações no SVG. Com `transformBox: view-box`, a origem é
 * medida na viewBox (0 a 200), então giros e escalas acontecem em torno do centro
 * do desenho e não se deslocam como aconteceria com a caixa de cada elemento.
 */
const CENTRO_FUNDO = {
  transformBox: "view-box" as const,
  originX: 0.5,
  originY: 0.5,
};

/**
 * Desenho de fundo dos cards de tipo, animado com framer-motion. Cada card recebe
 * uma variante (0 a 3), para que os desenhos sejam diferentes entre si.
 */
function FundoAnimado({ variante }: { variante: number }) {
  const classe = "pointer-events-none absolute -bottom-14 -right-14 h-48 w-48 text-white";

  if (variante === 1) {
    // Ondas que deslizam na horizontal.
    return (
      <motion.svg aria-hidden="true" viewBox="0 0 200 200" className={classe} {...ENTRADA_FUNDO}>
        {[50, 100, 150].map((y, i) => (
          <motion.path
            key={y}
            d={`M-60 ${y} Q -20 ${y - 25} 20 ${y} T 100 ${y} T 180 ${y} T 260 ${y}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ x: [0, -40, 0] }}
            transition={{ duration: 6 + i, ease: "easeInOut", repeat: Infinity }}
          />
        ))}
      </motion.svg>
    );
  }

  if (variante === 2) {
    // Grade de pontos que pulsam em ondas.
    return (
      <motion.svg aria-hidden="true" viewBox="0 0 200 200" className={classe} {...ENTRADA_FUNDO}>
        {Array.from({ length: 25 }, (_, i) => {
          const x = 20 + (i % 5) * 40;
          const y = 20 + Math.floor(i / 5) * 40;
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              fill="currentColor"
              animate={{ scale: [1, 1.8, 1], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                repeat: Infinity,
                delay: (i % 5) * 0.2 + Math.floor(i / 5) * 0.15,
              }}
              style={{ transformBox: "view-box", originX: x / 200, originY: y / 200 }}
            />
          );
        })}
      </motion.svg>
    );
  }

  if (variante === 3) {
    // Hexágonos concêntricos girando em sentidos opostos.
    return (
      <motion.svg aria-hidden="true" viewBox="0 0 200 200" className={classe} {...ENTRADA_FUNDO}>
        <motion.polygon
          points={hexagono(90)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          style={CENTRO_FUNDO}
        />
        <motion.polygon
          points={hexagono(55)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 8"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          style={CENTRO_FUNDO}
        />
        <motion.polygon
          points={hexagono(20)}
          fill="currentColor"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          style={CENTRO_FUNDO}
        />
      </motion.svg>
    );
  }

  // Variante 0: anéis que giram, com um círculo central que pulsa.
  return (
    <motion.svg aria-hidden="true" viewBox="0 0 200 200" className={classe} {...ENTRADA_FUNDO}>
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 60, ease: "linear", repeat: Infinity }}
        style={CENTRO_FUNDO}
      >
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" />
      </motion.g>
      <motion.circle
        cx="100"
        cy="100"
        r="28"
        fill="currentColor"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
        style={CENTRO_FUNDO}
      />
    </motion.svg>
  );
}

/** Colunas do kanban: cada uma reúne as etapas do metrô que ela representa. */
const COLUNAS_KANBAN: { rotulo: string; etapas: string[] }[] = [
  { rotulo: "Em aberto", etapas: ["abertura"] },
  { rotulo: "Apuração", etapas: ["apuracao"] },
  { rotulo: "Julgamento", etapas: ["julgamento"] },
  { rotulo: "Plano de ação", etapas: ["plano_acao"] },
  { rotulo: "Implementação", etapas: ["implementacao", "comunicacao", ETAPA_RETORNO_CLIENTE] },
  { rotulo: "Finalização", etapas: ["fechamento"] },
  { rotulo: "Eficácia", etapas: ["avaliacao_eficacia"] },
];

/** Cards visíveis por coluna do kanban; o resto fica atrás de "Mostrar mais". */
const LIMITE_CARDS_COLUNA = 3;

const COR_PRIORIDADE: Record<string, string> = {
  alta: "#E11D48",
  media: "#F59E0B",
  baixa: "#2563EB",
  a_definir: "#64748B",
};

function iniciaisDe(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

/** Visão "Todas as Ocorrências" em kanban, uma coluna por etapa. */
function KanbanOcorrencias({
  ocorrencias,
  carregando,
  onDetalhar,
}: {
  ocorrencias: Ocorrencia[];
  carregando: boolean;
  onDetalhar: (o: Ocorrencia) => void;
}) {
  const [expandidas, setExpandidas] = useState<Record<number, boolean>>({});
  if (carregando) {
    return <div className="py-12 text-center text-sm text-[#64748B]">Carregando ocorrências…</div>;
  }
  const colunaDe =(o: Ocorrencia) =>
    COLUNAS_KANBAN.findIndex((c) => c.etapas.includes(o.macroAtual));
  const porColuna = COLUNAS_KANBAN.map((_, i) =>
    ocorrencias.filter((o) => colunaDe(o) === i),
  );
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUNAS_KANBAN.map((coluna, i) => {
        const aberta = expandidas[i] === true;
        const total = porColuna[i]?.length ?? 0;
        const visiveis = aberta ? porColuna[i] ?? [] : (porColuna[i] ?? []).slice(0, LIMITE_CARDS_COLUNA);
        return (
        <div key={coluna.rotulo} className="flex w-72 shrink-0 flex-col rounded-2xl border border-[#D9E0EA] bg-white p-3 dark:border-transparent dark:bg-[#1E3A8A]">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1F2937] dark:text-white">
              {coluna.rotulo}
            </h3>
            <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[11px] font-bold text-[#1F2937] dark:bg-white/15 dark:text-white">
              {porColuna[i]?.length ?? 0}
            </span>
          </div>
          <div className="space-y-3">
            {visiveis.map((o) => {
              const impedida = !!o.impedidaEm;
              const encerrada = o.status === "encerrada";
              const atrasada = ocorrenciaAtrasada(o);
              const responsavel = o.responsavelNome || o.donoQualidadeNome || "—";
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onDetalhar(o)}
                  style={{ backgroundColor: o.tipoCor || "#1E293B" }}
                  className="w-full rounded-xl p-3 text-left text-white shadow-sm transition hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#94A3B8]">{o.numero}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ backgroundColor: COR_PRIORIDADE[o.prioridade] ?? "#64748B" }}
                    >
                      {PRIORIDADE_LABELS[o.prioridade]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {encerrada ? (
                      <span className="rounded-full bg-[#059669]/20 px-2 py-0.5 text-[10px] font-semibold text-[#6EE7B7]">
                        Encerrada
                      </span>
                    ) : impedida ? (
                      <span className="rounded-full bg-[#E11D48]/20 px-2 py-0.5 text-[10px] font-semibold text-[#FDA4AF]">
                        Impedida
                      </span>
                    ) : o.macroAtual === "abertura" ? (
                      <span className="rounded-full bg-[#2563EB]/20 px-2 py-0.5 text-[10px] font-semibold text-[#93C5FD]">
                        Nova
                      </span>
                    ) : null}
                    {atrasada && (
                      <span className="rounded-full bg-[#E11D48]/20 px-2 py-0.5 text-[10px] font-semibold text-[#FDA4AF]">
                        Atrasada
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{o.titulo}</p>
                  <p className="mt-1 truncate text-[11px] text-[#94A3B8]">
                    {o.tipoNome} · {o.abertaPorSetor || "—"}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#CBD5E1]">
                      {encerrada ? "Concluído" : o.prazoEtapa ? `Prazo ${formatarPrazo(o.prazoEtapa)}` : ""}
                    </span>
                    <span
                      title={responsavel}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#334155] text-[10px] font-bold text-white"
                    >
                      {iniciaisDe(responsavel === "—" ? "?" : responsavel)}
                    </span>
                  </div>
                </button>
              );
            })}
            {total > LIMITE_CARDS_COLUNA && (
              <button
                type="button"
                onClick={() => setExpandidas((atual) => ({ ...atual, [i]: !aberta }))}
                className="w-full rounded-lg border border-dashed border-[#94A3B8] py-1.5 text-[12px] font-semibold text-[#334155] hover:bg-[#F1F5F9] dark:border-white/40 dark:text-white dark:hover:bg-white/10"
              >
                {aberta ? "Mostrar menos" : `Mostrar mais (${total - LIMITE_CARDS_COLUNA})`}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function ListaOcorrencias({
  ocorrencias,
  tipos,
  carregando,
  onAbrir,
  onDetalhar,
}: {
  ocorrencias: Ocorrencia[];
  tipos: TipoOcorrencia[];
  carregando: boolean;
  onAbrir: () => void;
  onDetalhar: (o: Ocorrencia) => void;
}) {
  if (carregando) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-[#F1F5F9] animate-pulse" />
        ))}
      </div>
    );
  }

  if (ocorrencias.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#94A3B8]">
            Formulários e fluxos
          </p>
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <ClipboardList className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
            Nenhuma ocorrência nesta lista
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Ao abrir uma ocorrência, ela segue o fluxo do tipo escolhido até a avaliação de
            eficácia.
          </p>
          <Button variant="outline" className="mt-5" onClick={onAbrir}>
            <Plus className="h-4 w-4" />
            Abrir ocorrência
          </Button>
        </div>
      </div>
    );
  }

  const COLUNAS = "grid grid-cols-[90px_minmax(200px,2fr)_100px_minmax(120px,1fr)_90px_minmax(220px,1.6fr)_minmax(130px,1fr)] items-center gap-4";
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="min-w-[1000px]">
        <div
          className={`${COLUNAS} px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748B]`}
        >
          <span>Código</span>
          <span>Assunto</span>
          <span>Aberta em</span>
          <span>Responsável</span>
          <span>Prioridade</span>
          <span>Andamento</span>
          <span>Prazo</span>
        </div>
        <div className="space-y-2">
          {ocorrencias.map((o, indice) => {
            const tipo = tipos.find((t) => t.id === o.tipoId);
            const Icone = iconeTipoOcorrencia(tipo?.icone);
            const sla = FormatadorSla.calcular(o.macroAtual, o.prazoEtapa);
            // Se a lista salva do tipo é antiga e não tem a etapa atual, usa a padrão do tipo.
            const salvas = etapasDoTipo(tipo);
            const etapas = salvas.some((e) => e.id === o.macroAtual)
              ? salvas
              : etapasDoTipo({ nome: tipo?.nome });
            const encerrada = o.status === "encerrada";
            const idxAtual = Math.max(
              0,
              etapas.findIndex((e) => e.id === o.macroAtual),
            );
            const origemAuditoria =
              typeof o.respostas["origem_nc"] === "string"
                ? (o.respostas["origem_nc"] as string)
                : "";
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onDetalhar(o)}
                className={`${COLUNAS} ocorrencia-card-entrada group w-full rounded-xl border border-black/10 px-4 py-3 text-left text-white shadow-sm transition hover:brightness-110`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${o.tipoCor} 88%, black)`,
                  animationDelay: `${Math.min(indice, 11) * 80}ms`,
                }}
              >
                <span className="font-mono text-[13px] font-bold">{o.numero}</span>

                <span className="min-w-0">
                  <span className="line-clamp-2 text-[14px] font-semibold leading-snug">
                    {o.titulo || "—"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium"
                      title={o.tipoNome}
                    >
                      <Icone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.tipoNome}</span>
                    </span>
                    {origemAuditoria ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A8A]"
                        title={`Origem: ${origemAuditoria}`}
                      >
                        <ClipboardCheck className="h-3 w-3 shrink-0" />
                        {origemAuditoria}
                      </span>
                    ) : null}
                    {o.procedencia !== "pendente" ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: o.procedencia === "procedente" ? "#ECFDF5" : "#FDECEE",
                          color: o.procedencia === "procedente" ? "#065F46" : "#991A1A",
                        }}
                      >
                        {PROCEDENCIA_LABELS[o.procedencia]}
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="text-[13px] text-white/90">
                  {FormatadorSla.formatarData(o.createdAt)}
                </span>

                <span className="truncate text-[13px] text-white/90" title={o.responsavelNome}>
                  {o.responsavelNome || "—"}
                </span>

                <span>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white/70"
                    style={{
                      backgroundColor:
                        o.prioridade === "alta"
                          ? "#DC2626"
                          : o.prioridade === "media"
                            ? "#F59E0B"
                            : o.prioridade === "baixa"
                              ? "#2563EB"
                              : "#64748B",
                    }}
                  >
                    {PRIORIDADE_LABELS[o.prioridade]}
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="flex gap-1.5">
                    {etapas.map((e, i) => {
                      const feita = encerrada || i < idxAtual;
                      const atual = !encerrada && i === idxAtual;
                      return (
                        <span
                          key={e.id}
                          title={e.nome}
                          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
                        >
                          {(feita || atual) && (
                            <motion.span
                              className="absolute inset-y-0 left-0 rounded-full bg-white"
                              initial={{ width: "0%" }}
                              animate={
                                atual
                                  ? { width: "100%", opacity: [1, 0.55, 1] }
                                  : { width: "100%", opacity: 1 }
                              }
                              transition={{
                                width: {
                                  duration: 0.5,
                                  delay: i * 0.12 + Math.min(indice, 11) * 0.08,
                                  ease: "easeOut",
                                },
                                opacity: atual
                                  ? {
                                      duration: 1.6,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                      delay: i * 0.12 + 0.6,
                                    }
                                  : { duration: 0 },
                              }}
                            />
                          )}
                        </span>
                      );
                    })}
                  </span>
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + Math.min(indice, 11) * 0.08 }}
                    className="mt-1.5 block truncate text-[12px] font-semibold"
                  >
                    {encerrada ? etapas.length : idxAtual + 1} ·{" "}
                    {encerrada ? "Concluído" : nomeEtapaDoTipo(tipo, o.macroAtual)}
                  </motion.span>
                </span>

                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-white p-1">
                    <FormatadorSla.Icone sla={sla} />
                  </span>
                  <span className="text-[12px] font-medium">{sla.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Abertura de ocorrência (primeira aba)                                       */
/* -------------------------------------------------------------------------- */

/** Cada cartão expande na própria aba e mostra o formulário configurado para o tipo. */
function AberturaOcorrencia({
  tipos,
  selecionado,
  onSelecionar,
  renderFormulario,
}: {
  tipos: TipoOcorrencia[];
  selecionado: string | null;
  onSelecionar: (chave: string | null) => void;
  renderFormulario: (tipoId: string | null) => ReactNode;
}) {
  // Um cartão por tipo ativo cadastrado em "Configurar", na ordem definida lá.
  const cartoes = tipos
    .filter((t) => t.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((t, posicao) => ({
      chave: t.id,
      rotulo: t.nome,
      descricao: t.descricao || "Sem descrição",
      icone: iconeTipoOcorrencia(t.icone),
      cor: t.cor,
      tipoId: t.id,
      // Fixo pela posição no cadastro, para o desenho do fundo não trocar ao filtrar.
      variante: posicao % 4,
    }));
  const visiveis = cartoes.filter((c) => !selecionado || c.chave === selecionado);

  return (
    <div className="mt-6">
      {selecionado && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => onSelecionar(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D9E0EA] bg-white px-4 py-2 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F1F5F9]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </button>
        </div>
      )}

      <motion.div layout className="grid gap-6 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {visiveis.map((c) => {
            const aberto = selecionado === c.chave;
            const Icone = c.icone;
            return (
              <motion.div
                key={c.chave}
                layout
                role={aberto ? undefined : "button"}
                tabIndex={aberto ? undefined : 0}
                onClick={aberto ? undefined : () => onSelecionar(c.chave)}
                onKeyDown={
                  aberto
                    ? undefined
                    : (evento) => {
                        if (evento.key === "Enter" || evento.key === " ") onSelecionar(c.chave);
                      }
                }
                whileHover={aberto ? {} : { scale: 1.03 }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={`relative flex flex-col overflow-hidden rounded-2xl p-6 text-left text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
                  aberto ? "min-h-[60vh] md:col-span-2" : "cursor-pointer hover:shadow-lg"
                }`}
                style={{ backgroundColor: c.cor }}
              >
                <FundoAnimado variante={c.variante} />
                <div className="relative flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-white/15">
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <h2 className="text-xl font-bold">{c.rotulo}</h2>
                </div>
                <p className="relative mt-4 text-sm font-medium opacity-90">
                  {c.descricao}
                </p>

                {aberto && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                    className="mt-6 cursor-default rounded-xl bg-white p-5 text-[#1F2937]"
                  >
                    {renderFormulario(c.tipoId)}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Abertura                                                                    */
/* -------------------------------------------------------------------------- */

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface AbrirOcorrenciaDialogProps {
  aberto: boolean;
  tipos: TipoOcorrencia[];
  tipoInicialId: string | null;
  onFechar: () => void;
  onCriado: (o: Ocorrencia) => void;
  /** "tela": formulário embutido no cartão expandido, sem diálogo. */
  variante?: "dialog" | "tela";
}

function AbrirOcorrenciaDialog({
  aberto,
  tipos,
  tipoInicialId,
  onFechar,
  onCriado,
  variante = "dialog",
}: AbrirOcorrenciaDialogProps) {
  const sessaoCtx = usePanelSession();
  const session = getSession() ?? sessaoCtx;
  const catalogo = useCatalogoOrganizacional();
  const [etapa, setEtapa] = useState<"tipo" | "formulario">("tipo");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [nc, setNc] = useState<EstadoNaoConformidade>(ESTADO_NC_VAZIO);
  const [ncErros, setNcErros] = useState<Record<string, string>>({});
  const [versoes, setVersoes] = useState<VersoesPublicadas | null>(null);
  const [telaAtual, setTelaAtual] = useState(0);
  const titulosTelas = versoes?.telas?.length ? versoes.telas : ["Tela 1"];
  const totalTelas = titulosTelas.length;
  const [carregandoForm, setCarregandoForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Arquivos escolhidos nos campos "arquivo" (enviados ao Storage após criar a ocorrência).
  const arquivosCampos = useRef<Record<string, File[]>>({});

  useEffect(() => {
    if (aberto) {
      arquivosCampos.current = {};
      setEtapa("tipo");
      setTipoId(null);
      setRespostas({});
      setNc(ESTADO_NC_VAZIO);
      setNcErros({});
      setVersoes(null);
      if (tipoInicialId) void escolherTipo(tipoInicialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const tipo = tipos.find((t) => t.id === tipoId);
  // Tipo Não Conformidade: usa o formulário publicado no construtor; sem formulário, cai na abertura fixa.
  const usaAberturaFixa = ehTipoNaoConformidade(tipo) && !(versoes?.campos?.length);

  /** Valida só os campos da tela atual e avança para a próxima. */
  function avancarTela() {
    if (!versoes) return;
    const { __erros, ...limpas } = respostas;
    const doTela = versoes.campos.filter((c) => (c.tela ?? 0) === telaAtual);
    const erros = validarCampos(doTela, limpas);
    if (Object.keys(erros).length > 0) {
      setRespostas((r) => ({ ...r, __erros: erros }));
      toast.error("Preencha os campos obrigatórios desta tela.");
      return;
    }
    setTelaAtual((t) => Math.min(t + 1, totalTelas - 1));
  }

  async function escolherTipo(id: string) {
    setTipoId(id);
    setEtapa("formulario");
    setCarregandoForm(true);
    setVersoes(null);
    setRespostas({});
    setTelaAtual(0);
    setNc(ESTADO_NC_VAZIO);
    setNcErros({});
    try {
      setVersoes(await carregarUltimasVersoes(id));
    } catch {
      toast.error("Não foi possível carregar o formulário do tipo.");
    } finally {
      setCarregandoForm(false);
    }
  }

  async function confirmarNc() {
    if (!tipo || !versoes) return;
    const erros: Record<string, string> = {};
    if (!nc.area.trim()) erros.area = "Informe a área envolvida.";
    if (!nc.descricao.trim()) erros.descricao = "Descreva a não conformidade.";
    else if (nc.descricao.length > LIMITE_TEXTO_NC)
      erros.descricao = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (!nc.consequencia.trim()) erros.consequencia = "Informe a consequência.";
    else if (nc.consequencia.length > LIMITE_TEXTO_NC)
      erros.consequencia = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (nc.sugestao.length > LIMITE_TEXTO_NC)
      erros.sugestao = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (nc.multa === "sim" && !nc.assinouMulta)
      erros.termoMulta = "É obrigatório assinar o termo de multa para gerar a ocorrência.";
    if (nc.arquivos.length > LIMITE_ANEXOS_NC)
      erros.anexos = `Máximo de ${LIMITE_ANEXOS_NC} anexos.`;
    else if (nc.arquivos.some((a) => a.size > TAMANHO_MAX_ANEXO_NC))
      erros.anexos = "Cada anexo deve ter até 10 MB.";
    if (Object.keys(erros).length > 0) {
      setNcErros(erros);
      toast.error("Verifique os campos obrigatórios do formulário.");
      return;
    }
    const descricao = nc.descricao.trim();
    const titulo = descricao.length > 80 ? `${descricao.slice(0, 80)}…` : descricao;
    setSalvando(true);
    try {
      const criada = await abrirOcorrencia(
        {
          tipo,
          formularioVersao: versoes.formularioVersao,
          fluxoVersao: versoes.fluxoVersao,
          titulo,
          respostas: {
            area_envolvida: nc.area.trim(),
            descricao_nc: descricao,
            consequencia: nc.consequencia.trim(),
            sugestao_solucao: nc.sugestao.trim(),
            gerou_multa: nc.multa === "sim",
            assinou_termo_multa: nc.assinouMulta,
            anexos: nc.arquivos.map((a) => ({ nome: a.name })),
          },
        },
        session,
      );
      const final =
        nc.arquivos.length > 0
          ? await adicionarAnexosAbertura(criada, nc.arquivos, session)
          : criada;
      toast.success("Não conformidade aberta com sucesso");
      onCriado(final);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmar() {
    if (!tipo || !versoes) return;
    if (usaAberturaFixa) {
      await confirmarNc();
      return;
    }
    const { __erros, ...respostasLimpas } = respostas;
    const erros = validarCampos(versoes.campos, respostasLimpas);
    if (Object.keys(erros).length > 0) {
      setRespostas((r) => ({ ...r, __erros: erros }));
      toast.error("Verifique os campos obrigatórios do formulário.");
      return;
    }
    const titulo = tituloDaOcorrencia(versoes.campos, respostasLimpas, tipo.nome);
    setSalvando(true);
    try {
      const criada = await abrirOcorrencia(
        {
          tipo,
          formularioVersao: versoes.formularioVersao,
          fluxoVersao: versoes.fluxoVersao,
          titulo,
          respostas: {
            ...respostasLimpas,
            [CHAVE_SETORES_ENVOLVIDOS]: setoresDoFormulario(versoes.campos, respostasLimpas),
          },
        },
        session,
      );
      let final = criada;
      const pendentes = Object.fromEntries(
        Object.entries(arquivosCampos.current).filter(([id]) => id in respostasLimpas),
      );
      if (Object.keys(pendentes).length > 0) {
        try {
          final = await anexarArquivosDosCampos(criada, pendentes, session);
        } catch (e) {
          toast.error(`Ocorrência aberta, mas o envio dos arquivos falhou: ${traduzErro(e).message}`);
        }
      }
      toast.success("Ocorrência aberta com sucesso");
      onCriado(final);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  // Na tela cheia não há contexto do Radix Dialog: título e descrição viram tags comuns.
  const Titulo = variante === "tela" ? "h2" : DialogTitle;
  const Descricao = variante === "tela" ? "p" : DialogDescription;

  const conteudo = (
    <>
      <DialogHeader>
        <Titulo>Abrir ocorrência</Titulo>
        <Descricao>
          {etapa === "tipo"
            ? "Escolha o tipo de ocorrência para carregar o formulário correspondente."
            : "Preencha o formulário do tipo escolhido."}
        </Descricao>
      </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-2">
          {etapa === "tipo" ? (
            tipos.length === 0 ? (
              <p className="rounded-lg border border-[#E9EEF5] bg-[#F8FAFC] px-4 py-8 text-center text-[13px] text-[#64748B]">
                Nenhum tipo cadastrado. Peça à Qualidade para cadastrar os tipos na aba
                &quot;Configurar&quot;.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {tipos.map((t) => {
                  const Icone = iconeTipoOcorrencia(t.icone);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="flex flex-col items-start gap-2 rounded-lg border border-[#D9E0EA] p-3 text-left transition hover:border-[#1E3A8A] hover:bg-[#F0F4FF]"
                      onClick={() => void escolherTipo(t.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: t.cor }}
                        >
                          <Icone className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[13px] font-semibold text-[#1F2937]">{t.nome}</span>
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        {t.descricao || "Sem descrição"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {tipo && (
                <div className="flex items-center gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: tipo.cor }}
                  >
                    {(() => {
                      const I = iconeTipoOcorrencia(tipo.icone);
                      return <I className="h-4 w-4" />;
                    })()}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1F2937]">{tipo.nome}</p>
                    <p className="text-[11px] text-[#64748B]">{tipo.descricao}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={salvando}
                    onClick={() => {
                      setTipoId(null);
                      setVersoes(null);
                      setEtapa("tipo");
                    }}
                  >
                    Trocar tipo
                  </Button>
                </div>
              )}

              {carregandoForm ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#64748B]">
                  Carregando formulário…
                </div>
              ) : usaAberturaFixa ? (
                <FormularioNaoConformidade
                  setores={catalogo.setores}
                  valor={nc}
                  onChange={(estado) => {
                    setNc(estado);
                    if (Object.keys(ncErros).length > 0) setNcErros({});
                  }}
                  erros={ncErros}
                  desabilitado={salvando}
                />
              ) : (
                <div className="space-y-4">
                {totalTelas > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <span className="text-[12px] font-semibold text-[#1F2937]">
                      Tela {telaAtual + 1} de {totalTelas} — {titulosTelas[telaAtual]}
                    </span>
                    <span className="flex gap-1.5">
                      {titulosTelas.map((titulo, i) => (
                        <span
                          key={`${titulo}-${i}`}
                          title={titulo}
                          className={`h-2 w-6 rounded-full ${i <= telaAtual ? "bg-[#1E3A8A]" : "bg-[#D9E0EA]"}`}
                        />
                      ))}
                    </span>
                  </div>
                )}
                <FormularioDinamico
                  campos={versoes?.campos ?? ([] as CampoFormulario[])}
                  telaAtual={telaAtual}
                  respostas={respostas}
                  onChange={(id, valor) => setRespostas((r) => ({ ...r, [id]: valor }))}
                  colaboradores={catalogo.colaboradores.map((c) => ({
                    id: c.id,
                    nome: c.nome,
                    email: c.email ?? "",
                  }))}
                  onArquivos={(campoId, arquivos) => {
                    arquivosCampos.current[campoId] = arquivos ? Array.from(arquivos) : [];
                    setRespostas((r) => ({
                      ...r,
                      [campoId]: arquivos
                        ? Array.from(arquivos).map((f) => ({
                            nome: f.name,
                            tipo: f.type,
                            tamanho: f.size,
                          }))
                        : [],
                    }));
                  }}
                />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          {etapa === "formulario" && !usaAberturaFixa && totalTelas > 1 && telaAtual > 0 && (
            <Button type="button" variant="outline" onClick={() => setTelaAtual((t) => t - 1)}>
              Anterior
            </Button>
          )}
          {etapa === "formulario" && !usaAberturaFixa && telaAtual < totalTelas - 1 ? (
            <Button
              type="button"
              disabled={carregandoForm}
              onClick={avancarTela}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              Próximo
            </Button>
          ) : etapa === "formulario" ? (
            <Button
              type="button"
              disabled={salvando || carregandoForm}
              onClick={() => void confirmar()}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              {salvando ? "Abrindo…" : "Criar Ocorrência"}
            </Button>
          ) : null}
        </DialogFooter>
    </>
  );

  if (variante === "tela") return <div>{conteudo}</div>;

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">{conteudo}</DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Configuração (Qualidade): tipos, formulário e fluxo                          */
/* -------------------------------------------------------------------------- */

function ConfigurarOcorrencias({
  tipos,
  recarregar,
}: {
  tipos: TipoOcorrencia[];
  recarregar: () => void;
}) {
  const catalogo = useCatalogoOrganizacional();
  const [subAba, setSubAba] = useState("tipos");
  const [tipoDialogo, setTipoDialogo] = useState<{ tipo: TipoOcorrencia | null } | null>(null);

  return (
    <div className="mt-2">
      <Tabs value={subAba} onValueChange={setSubAba}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="tipos">Tipos de Ocorrência</TabsTrigger>
          <TabsTrigger value="formulario">Formulário de abertura</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos">
          <TiposTab
            tipos={tipos}
            onNovo={() => setTipoDialogo({ tipo: null })}
            onEditar={(t) => setTipoDialogo({ tipo: t })}
          />
        </TabsContent>

        <TabsContent value="formulario">
          <FormularioTab tipos={tipos} />
        </TabsContent>

        <TabsContent value="fluxo">
          <FluxoTab tipos={tipos} catalogo={catalogo} />
        </TabsContent>
      </Tabs>

      {tipoDialogo && (
        <TipoDialog
          tipo={tipoDialogo.tipo}
          setores={catalogo.setores}
          onFechar={() => setTipoDialogo(null)}
          onSalvo={() => {
            setTipoDialogo(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function TiposTab({
  tipos,
  onNovo,
  onEditar,
}: {
  tipos: TipoOcorrencia[];
  onNovo: () => void;
  onEditar: (t: TipoOcorrencia) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#E9EEF5] p-4">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1F2937]">Tipos de ocorrência</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Cada tipo carrega o formulário de abertura e o fluxo próprios.
          </p>
        </div>
        <Button onClick={onNovo} className="shrink-0 bg-[#1E3A8A] text-white hover:bg-[#1E40AF]">
          <Plus className="h-4 w-4" />
          Novo tipo
        </Button>
      </div>

      {tipos.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <Settings2 className="h-6 w-6 text-[#94A3B8]" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Nenhum tipo cadastrado</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Crie o primeiro tipo para começar a abrir ocorrências.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {tipos.map((t) => {
            const Icone = iconeTipoOcorrencia(t.icone);
            return (
              <div
                key={t.id}
                className="group rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-4 transition hover:border-[#D9E0EA]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: t.cor }}
                  >
                    <Icone className="h-4.5 w-4.5" />
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Editar tipo"
                      onClick={() => onEditar(t)}
                      className="rounded-md p-1.5 text-[#64748B] transition hover:bg-white hover:text-[#1E3A8A]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[#1F2937]">{t.nome}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                  {t.descricao || "Sem descrição"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#94A3B8]">
                  <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[#E9EEF5]">
                    {t.setorPadrao}
                  </span>
                  {etapasDoTipo(t).map((e) => (
                    <span
                      key={e.id}
                      className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[#E9EEF5]"
                      title={`SLA ${e.nome}`}
                    >
                      {e.slaDias}d
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormularioTab({ tipos }: { tipos: TipoOcorrencia[] }) {
  const session = usePanelSession();
  const [tipoId, setTipoId] = useState("");
  const [campos, setCampos] = useState<CampoFormulario[]>([]);
  const [telas, setTelas] = useState<string[]>([]);
  const [versao, setVersao] = useState(1);
  const [publicando, setPublicando] = useState(false);
  // Assinatura (campos + telas) da última versão publicada nesta tela. Se o formulário
  // mudar depois, deixa de bater e o botão volta ao normal.
  const [publicadoAssinatura, setPublicadoAssinatura] = useState<string | null>(null);

  const tipo = tipos.find((t) => t.id === tipoId);
  const assinaturaAtual = JSON.stringify([campos, telas]);

  useEffect(() => {
    if (!tipoId) {
      setCampos([]);
      return;
    }
    let ativo = true;
    carregarUltimasVersoes(tipoId)
      .then((v) => {
        if (ativo) {
          setCampos(v.campos);
          setTelas(v.telas);
          setVersao(v.formularioVersao);
        }
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [tipoId]);

  async function publicar() {
    if (!tipo) return;
    setPublicando(true);
    try {
      await publicarFormulario(
        tipo.id,
        campos,
        {
          nome: session?.nome ?? "",
          email: session?.email ?? "",
        },
        telas,
      );
      toast.success("Formulário publicado em nova versão.");
      const v = await carregarUltimasVersoes(tipo.id);
      setCampos(v.campos);
      setTelas(v.telas);
      setVersao(v.formularioVersao);
      setPublicadoAssinatura(JSON.stringify([v.campos, v.telas]));
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoId} onValueChange={setTipoId}>
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue placeholder="Selecione o tipo de ocorrência…" />
          </SelectTrigger>
          <SelectContent>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipo && (
          <span className="text-[12px] text-[#94A3B8]">
            Versão atual: <span className="font-semibold text-[#1F2937]">{versao}</span>
          </span>
        )}
      </div>

      {!tipo ? (
        <div className="rounded-xl border border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-6 py-10 text-center text-[13px] text-[#64748B]">
          Selecione um tipo para montar o formulário de abertura. Ao publicar, uma nova versão é
          criada — ocorrências já abertas continuam no formulário original.
        </div>
      ) : (
        <FormBuilder
          campos={campos}
          onChangeCampos={setCampos}
          telas={telas}
          onChangeTelas={setTelas}
          onPublicar={publicar}
          publicando={publicando}
          publicado={publicadoAssinatura === assinaturaAtual}
        />
      )}
    </div>
  );
}

function FluxoTab({
  tipos,
  catalogo,
}: {
  tipos: TipoOcorrencia[];
  catalogo: ReturnType<typeof useCatalogoOrganizacional>;
}) {
  const session = usePanelSession();
  const [tipoId, setTipoId] = useState("");
  const [etapas, setEtapas] = useState<MacroFluxo[]>([]);
  const [versao, setVersao] = useState(1);
  const [publicando, setPublicando] = useState(false);

  const tipo = tipos.find((t) => t.id === tipoId);

  useEffect(() => {
    if (!tipoId) {
      setEtapas([]);
      return;
    }
    let ativo = true;
    carregarUltimasVersoes(tipoId)
      .then((v) => {
        if (ativo) {
          setEtapas(tipo ? alinharFluxoAoTipo(tipo, v.etapas) : v.etapas);
          setVersao(v.fluxoVersao);
        }
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId]);

  async function publicar() {
    if (!tipo) return;
    setPublicando(true);
    try {
      await publicarFluxo(tipo.id, etapas, {
        nome: session?.nome ?? "",
        email: session?.email ?? "",
      });
      toast.success("Fluxo publicado em nova versão.");
      const v = await carregarUltimasVersoes(tipo.id);
      setEtapas(alinharFluxoAoTipo(tipo, v.etapas));
      setVersao(v.fluxoVersao);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoId} onValueChange={setTipoId}>
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue placeholder="Selecione o tipo de ocorrência…" />
          </SelectTrigger>
          <SelectContent>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipo && (
          <span className="text-[12px] text-[#94A3B8]">
            Versão atual: <span className="font-semibold text-[#1F2937]">{versao}</span>
          </span>
        )}
      </div>

      {!tipo ? (
        <div className="rounded-xl border border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-6 py-10 text-center text-[13px] text-[#64748B]">
          Selecione um tipo para montar as subetapas dentro das macro-etapas fixas da linha do
          metrô.
        </div>
      ) : (
        <FlowBuilder
          etapas={etapas}
          onChange={setEtapas}
          onPublicar={publicar}
          publicando={publicando}
          colaboradores={catalogo.colaboradores.map((c) => ({
            id: c.id,
            nome: c.nome,
            email: c.email ?? "",
          }))}
          setores={catalogo.setores}
          cargos={catalogo.cargos}
        />
      )}
    </div>
  );
}

function TipoDialog({
  tipo,
  setores,
  onFechar,
  onSalvo,
}: {
  tipo: TipoOcorrencia | null;
  setores: string[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(tipo?.nome ?? "");
  const [descricao, setDescricao] = useState(tipo?.descricao ?? "");
  const [cor, setCor] = useState(tipo?.cor ?? "#1E3A8A");
  const [icone, setIcone] = useState(tipo?.icone ?? "AlertTriangle");
  // Regra do portal: todo tipo é do setor Qualidade (campo travado).
  const setorPadrao = "Qualidade";
  const [etapas, setEtapas] = useState<EtapaTipo[]>(() =>
    etapasDoTipo(tipo).map((e) => ({ ...e })),
  );
  const [eficaciaDias, setEficaciaDias] = useState(tipo?.eficaciaDias ?? 30);
  const [retornoCliente, setRetornoCliente] = useState(tipo?.retornoCliente ?? false);
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true);
  const [ordem, setOrdem] = useState(tipo?.ordem ?? 0);
  const [salvando, setSalvando] = useState(false);

  function atualizarEtapa(id: string, patch: Partial<EtapaTipo>) {
    setEtapas((atual) => atual.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removerEtapa(id: string) {
    setEtapas((atual) => atual.filter((e) => e.id !== id));
  }

  function adicionarEtapa() {
    const nova: EtapaTipo = { id: `etapa-${idCurto()}`, nome: "Nova etapa", slaDias: 5 };
    setEtapas((atual) => {
      // A Avaliação de Eficácia continua sendo a última etapa da linha.
      const pos = atual.findIndex((e) => e.id === "avaliacao_eficacia");
      return pos < 0 ? [...atual, nova] : [...atual.slice(0, pos), nova, ...atual.slice(pos)];
    });
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do tipo.");
      return;
    }
    let etapasSalvas = etapas.map((e) => ({
      ...e,
      nome: e.nome.trim() || "Etapa",
      slaDias: Math.max(1, Number(e.slaDias) || 5),
    }));
    // Retorno ao cliente: etapa obrigatória antes do fechamento (criada/removida pela opção).
    etapasSalvas = etapasSalvas.filter((e) => e.id !== ETAPA_RETORNO_CLIENTE);
    if (retornoCliente) {
      const pos = etapasSalvas.findIndex((e) => e.id === "fechamento");
      const retorno: EtapaTipo = {
        id: ETAPA_RETORNO_CLIENTE,
        nome: "Retorno ao cliente",
        slaDias: 5,
      };
      const idx = pos < 0 ? etapasSalvas.length : pos;
      etapasSalvas = [...etapasSalvas.slice(0, idx), retorno, ...etapasSalvas.slice(idx)];
    }
    setSalvando(true);
    try {
      await salvarTipo({
        id: tipo?.id,
        nome: nome.trim(),
        descricao: descricao.trim(),
        cor,
        icone,
        setorPadrao: setorPadrao || "Qualidade",
        etapas: etapasSalvas,
        eficaciaDias,
        retornoCliente,
        ativo,
        ordem,
      });
      toast.success(tipo ? "Tipo atualizado." : "Tipo criado.");
      onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  const Cores = [
    "#1E3A8A",
    "#B91C1C",
    "#B45309",
    "#0369A1",
    "#7C3AED",
    "#059669",
    "#DB2777",
    "#334155",
  ];

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {tipo ? "Editar tipo de ocorrência" : "Novo tipo de ocorrência"}
          </DialogTitle>
          <DialogDescription>
            Define o formulário de abertura e o SLA por macro-etapa da linha do metrô.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Reclamação de Cliente"
              />
            </Campo>
            <Campo rotulo="Setor responsável padrão">
              <Input value="Qualidade" disabled />
              <p className="text-[11px] text-[#64748B]">
                Toda ocorrência (qualquer tipo) é do setor Qualidade.
              </p>
            </Campo>
          </div>

          <Campo rotulo="Descrição">
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva quando este tipo deve ser usado…"
              className="min-h-[70px]"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Ícone">
              <Select value={icone} onValueChange={setIcone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(ICONES_OCORRENCIA).map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Cor">
              <div className="flex flex-wrap items-center gap-2">
                {Cores.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setCor(c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition ${
                      cor === c ? "ring-2 ring-[#1E3A8A]" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[#D9E0EA] bg-white p-0.5"
                  aria-label="Cor personalizada"
                />
              </div>
            </Campo>
          </div>

          <Campo rotulo="Etapas da linha do metrô (nome e SLA em dias)">
            <div className="space-y-2">
              {etapas.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Input
                    value={e.nome}
                    placeholder="Nome da etapa"
                    onChange={(ev) => atualizarEtapa(e.id, { nome: ev.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    className="w-24 shrink-0"
                    aria-label={`SLA de ${e.nome} em dias`}
                    value={e.slaDias}
                    onChange={(ev) =>
                      atualizarEtapa(e.id, { slaDias: Number(ev.target.value) || 1 })
                    }
                  />
                  {!ETAPAS_FIXAS.includes(e.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover etapa ${e.nome}`}
                      onClick={() => removerEtapa(e.id)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={adicionarEtapa}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar etapa
              </Button>
            </div>
          </Campo>

          <Campo rotulo="Avaliação de eficácia após o fechamento">
            <Select value={String(eficaciaDias)} onValueChange={(v) => setEficaciaDias(Number(v))}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRAZOS_EFICACIA.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] text-[#64748B]">
              Passado esse prazo, a Qualidade avalia se houve reincidência. Se houve, a ocorrência
              volta para o plano de ação em um novo ciclo.
            </p>
          </Campo>

          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[#334155]">
            <input
              type="checkbox"
              checked={retornoCliente}
              onChange={(e) => setRetornoCliente(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[#1E3A8A]"
            />
            <span>
              Exige retorno ao cliente
              <span className="block text-[12px] text-[#64748B]">
                Cria a etapa obrigatória “Retorno ao cliente” antes do fechamento. Ela não pode ser
                pulada e exige o registro do que foi retornado.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-6 text-[13px] text-[#334155]">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1E3A8A]"
              />
              Ativo
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <span>Ordem de exibição:</span>
              <Input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(Number(e.target.value) || 0)}
                className="w-20"
              />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={salvando}
            onClick={() => void salvar()}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Salvando…" : "Salvar tipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
