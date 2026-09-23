import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, List, Pencil, Plus, Settings2 } from "lucide-react";
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
  carregarUltimasVersoes,
  detectarAtrasos,
  type VersoesPublicadas,
} from "@/lib/ocorrencias-crud";
import {
  ICONES_OCORRENCIA,
  MACRO_ETAPAS,
  MACRO_ETAPA_LABELS,
  PROCEDENCIA_LABELS,
  ehTipoNaoConformidade,
  iconeTipoOcorrencia,
  type CampoFormulario,
  type MacroEtapa,
  type MacroFluxo,
  type Ocorrencia,
  type Respostas,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";
import { getSession } from "@/lib/auth";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import { papelNaOcorrencia, veTodasAsOcorrencias } from "@/lib/ocorrencias-permissoes";
import { traduzErro } from "@/lib/organizacao";

export const Route = createFileRoute("/ocorrencias")({
  head: () => ({
    meta: [{ title: "Ocorrências | Gestão da Qualidade" }],
  }),
  component: Ocorrencias,
});

const ABAS = [
  { valor: "andamento", rotulo: "Em andamento" },
  { valor: "abri", rotulo: "Que eu abri" },
  { valor: "setor", rotulo: "Do setor Qualidade" },
  { valor: "encerradas", rotulo: "Encerradas" },
] as const;

function Ocorrencias() {
  // O hook de contexto é nulo aqui: este componente RENDERIZA o PanelShell (e o
  // contexto só flui para baixo). Lemos a sessão persistida no navegador, como
  // as demais rotas (planos-de-acao/painel).
  const sessaoCtx = usePanelSession();
  const session = getSession() ?? sessaoCtx;
  const [modo, setModo] = useState<"lista" | "configurar">("lista");
  const [refreshToken, setRefreshToken] = useState(0);
  const [abrirAberto, setAbrirAberto] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<Ocorrencia | null>(null);

  const tipos = useAsync(listarTipos, [refreshToken]);
  const ocorrencias = useAsync(listarOcorrencias, [refreshToken]);
  const [listaAoVivo, setListaAoVivo] = useState<Ocorrencia[] | null>(null);
  const refreshTokenRef = useRef(0);
  const recarregar = () => {
    refreshTokenRef.current += 1;
    setListaAoVivo(null);
    setRefreshToken((v) => v + 1);
  };

  const podeConfigurar = ehUsuarioDaQualidade(session);
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

  const filtrar = (aba: (typeof ABAS)[number]["valor"], o: Ocorrencia): boolean => {
    const email = (session?.email ?? "").trim().toLowerCase();
    const colaboradorId = (session?.colaboradorId ?? "").trim();
    const propria =
      o.abertaPorEmail.toLowerCase() === email ||
      (!!o.abertaPorId && o.abertaPorId === colaboradorId);
    const encarregado =
      o.status !== "encerrada" &&
      ((!!o.responsavelEmail && o.responsavelEmail.toLowerCase() === email) ||
        (!!o.responsavelId && o.responsavelId === colaboradorId));
    const visivel = vêTudo || propria || encarregado;
    if (!visivel) return false;
    if (aba === "abri") return propria;
    if (aba === "setor") {
      if (o.status === "encerrada") return false;
      if (vêTudo) return true;
      return papelNaOcorrencia(session, o) !== "leitor";
    }
    if (aba === "encerradas") return o.status === "encerrada";
    return o.status !== "encerrada";
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
              Ocorrências
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#64748B]">
              Quem abre acompanha a etapa como quem acompanha o metrô: só sabe onde está e quando
              chega.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {podeConfigurar && (
              <div className="flex items-center gap-1 rounded-lg border border-[#D9E0EA] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setModo("lista")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                    modo === "lista"
                      ? "bg-[#1E3A8A] text-white"
                      : "text-[#64748B] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
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
              </div>
            )}
            <Button className="shrink-0" onClick={() => setAbrirAberto(true)}>
              <Plus className="h-4 w-4" />
              Abrir ocorrência
            </Button>
          </div>
        </div>

        {modo === "lista" ? (
          <Tabs defaultValue="andamento">
            <TabsList className="flex-wrap">
              {ABAS.map((aba) => {
                const total = porAba(aba.valor).length;
                return (
                  <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
                    {aba.rotulo}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                      {total}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {ABAS.map((aba) => (
              <TabsContent key={aba.valor} value={aba.valor}>
                <ListaOcorrencias
                  ocorrencias={porAba(aba.valor)}
                  tipos={tipos.data ?? []}
                  carregando={carregando}
                  onAbrir={() => setAbrirAberto(true)}
                  onDetalhar={(o) => setOcorrenciaSelecionada(o)}
                />
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
        onFechar={() => setAbrirAberto(false)}
        onCriado={(o) => {
          setAbrirAberto(false);
          recarregar();
          setOcorrenciaSelecionada(o);
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

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ocorrencias.map((o) => {
        const tipo = tipos.find((t) => t.id === o.tipoId);
        const Icone = iconeTipoOcorrencia(tipo?.icone);
        const sla = FormatadorSla.calcular(o.macroAtual, o.prazoEtapa);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onDetalhar(o)}
            className="group flex flex-col rounded-xl border border-[#E9EEF5] bg-white p-4 text-left shadow-sm transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: o.tipoCor }}
                title={o.tipoNome}
              >
                <Icone className="h-3 w-3 shrink-0" />
                <span className="truncate">{o.tipoNome}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-[#94A3B8]">{o.numero}</span>
            </div>

            <p className="mt-3 line-clamp-2 text-[14px] font-semibold leading-snug text-[#1F2937]">
              {o.titulo || "—"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: sla.atrasado
                    ? "#FDECEE"
                    : sla.critical
                      ? "#FFFBEB"
                      : "#ECFDF5",
                  color: sla.atrasado ? "#991A1A" : sla.critical ? "#92400E" : "#065F46",
                }}
              >
                {MACRO_ETAPA_LABELS[o.macroAtual]}
              </span>
              {o.procedencia !== "pendente" ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: o.procedencia === "procedente" ? "#ECFDF5" : "#FDECEE",
                    color: o.procedencia === "procedente" ? "#065F46" : "#991A1A",
                  }}
                >
                  {PROCEDENCIA_LABELS[o.procedencia]}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex-1 space-y-1 text-[12px] text-[#64748B]">
              <p>
                <span className="text-[#94A3B8]">Responsável:</span>{" "}
                {o.responsavelNome || "—"}
              </p>
              <p>
                <span className="text-[#94A3B8]">Abertura:</span>{" "}
                {FormatadorSla.formatarData(o.createdAt)}
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-[#EEF2F7] pt-3">
              <FormatadorSla.Icone sla={sla} />
              <span
                className="text-[12px] font-medium"
                style={{
                  color: sla.atrasado ? "#991A1A" : sla.critical ? "#92400E" : "#065F46",
                }}
              >
                {sla.label}
              </span>
              <span className="ml-auto text-[11px] font-semibold text-[#1E3A8A] opacity-0 transition group-hover:opacity-100">
                Detalhar →
              </span>
            </div>
          </button>
        );
      })}
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
  onFechar: () => void;
  onCriado: (o: Ocorrencia) => void;
}

function AbrirOcorrenciaDialog({ aberto, tipos, onFechar, onCriado }: AbrirOcorrenciaDialogProps) {
  const session = usePanelSession();
  const catalogo = useCatalogoOrganizacional();
  const [etapa, setEtapa] = useState<"tipo" | "formulario">("tipo");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [nc, setNc] = useState<EstadoNaoConformidade>(ESTADO_NC_VAZIO);
  const [ncErros, setNcErros] = useState<Record<string, string>>({});
  const [versoes, setVersoes] = useState<VersoesPublicadas | null>(null);
  const [carregandoForm, setCarregandoForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setEtapa("tipo");
      setTipoId(null);
      setRespostas({});
      setNc(ESTADO_NC_VAZIO);
      setNcErros({});
      setVersoes(null);
    }
  }, [aberto]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const naoConformidade = ehTipoNaoConformidade(tipo);

  async function escolherTipo(id: string) {
    setTipoId(id);
    setEtapa("formulario");
    setCarregandoForm(true);
    setVersoes(null);
    setRespostas({});
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
    if (naoConformidade) {
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
    const titulo = String(respostasLimpas["titulo"] ?? "").trim();
    if (!titulo) {
      toast.error("Informe o título curto da ocorrência.");
      return;
    }
    setSalvando(true);
    try {
      const criada = await abrirOcorrencia(
        {
          tipo,
          formularioVersao: versoes.formularioVersao,
          fluxoVersao: versoes.fluxoVersao,
          titulo,
          respostas: respostasLimpas,
        },
        session,
      );
      toast.success("Ocorrência aberta com sucesso");
      onCriado(criada);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abrir ocorrência</DialogTitle>
          <DialogDescription>
            {etapa === "tipo"
              ? "Escolha o tipo de ocorrência para carregar o formulário correspondente."
              : "Preencha o formulário do tipo escolhido."}
          </DialogDescription>
        </DialogHeader>

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
            ) : naoConformidade ? (
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
              <FormularioDinamico
                campos={versoes?.campos ?? ([] as CampoFormulario[])}
                respostas={respostas}
                onChange={(id, valor) => setRespostas((r) => ({ ...r, [id]: valor }))}
                colaboradores={catalogo.colaboradores.map((c) => ({
                  id: c.id,
                  nome: c.nome,
                  email: c.email ?? "",
                }))}
                onArquivos={(campoId, arquivos) =>
                  setRespostas((r) => ({
                    ...r,
                    [campoId]: arquivos
                      ? Array.from(arquivos).map((f) => ({
                          nome: f.name,
                          tipo: f.type,
                          tamanho: f.size,
                        }))
                      : [],
                  }))
                }
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          {etapa === "formulario" && (
            <Button
              type="button"
              disabled={salvando || carregandoForm}
              onClick={() => void confirmar()}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              {salvando ? "Abrindo…" : "Criar Ocorrência"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
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
                  {MACRO_ETAPAS.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[#E9EEF5]"
                      title={`SLA ${MACRO_ETAPA_LABELS[m]}`}
                    >
                      {t.slaDias[m] ?? "-"}d
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
  const [versao, setVersao] = useState(1);
  const [publicando, setPublicando] = useState(false);

  const tipo = tipos.find((t) => t.id === tipoId);

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
      await publicarFormulario(tipo.id, campos, {
        nome: session?.nome ?? "",
        email: session?.email ?? "",
      });
      toast.success("Formulário publicado em nova versão.");
      const v = await carregarUltimasVersoes(tipo.id);
      setCampos(v.campos);
      setVersao(v.formularioVersao);
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
          onPublicar={publicar}
          publicando={publicando}
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
          setEtapas(v.etapas);
          setVersao(v.fluxoVersao);
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
      await publicarFluxo(tipo.id, etapas, {
        nome: session?.nome ?? "",
        email: session?.email ?? "",
      });
      toast.success("Fluxo publicado em nova versão.");
      const v = await carregarUltimasVersoes(tipo.id);
      setEtapas(v.etapas);
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
  const [slaDias, setSlaDias] = useState<Partial<Record<MacroEtapa, number>>>(() => {
    const base: Partial<Record<MacroEtapa, number>> = {};
    for (const m of MACRO_ETAPAS) base[m] = tipo?.slaDias?.[m] ?? 5;
    return base;
  });
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true);
  const [ordem, setOrdem] = useState(tipo?.ordem ?? 0);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do tipo.");
      return;
    }
    const sla: Partial<Record<MacroEtapa, number>> = {};
    for (const m of MACRO_ETAPAS) sla[m] = Math.max(1, Number(slaDias[m]) || 5);
    setSalvando(true);
    try {
      await salvarTipo({
        id: tipo?.id,
        nome: nome.trim(),
        descricao: descricao.trim(),
        cor,
        icone,
        setorPadrao: setorPadrao || "Qualidade",
        slaDias: sla,
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

          <Campo rotulo="SLA (em dias por macro-etapa)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MACRO_ETAPAS.map((m) => (
                <div key={m} className="space-y-1">
                  <Label className="text-[11px] text-[#64748B]">{MACRO_ETAPA_LABELS[m]}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaDias[m] ?? ""}
                    onChange={(e) =>
                      setSlaDias((atual) => ({ ...atual, [m]: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              ))}
            </div>
          </Campo>

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
