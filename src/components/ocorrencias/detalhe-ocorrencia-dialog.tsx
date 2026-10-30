/**
 * Detalhe da ocorrência — linha do metrô, formulário da etapa, ações,
 * movimentação manual (Qualidade), avaliação de eficácia, comentários e
 * histórico imutável.
 *
 * Visibilidade por papel (solicitante vê a viagem simplificada; Qualidade e
 * encarregado veem os detalhes internos e as ações permitidas).
 */
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Hand,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePanelSession } from "@/components/panel-shell";
import { formatarDataHoraBrasilia } from "@/lib/utils";

import { AnexosVisualizador, anexosDe } from "@/components/ocorrencias/anexos-visualizador";
import { MetroLinha } from "@/components/ocorrencias/metro-linha";
import { FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  agirNaOcorrencia,
  assumirOcorrencia,
  liberarOcorrencia,
  avaliarEficacia,
  carregarFluxoAtivo,
  carregarFormularioAtivo,
  comentarOcorrencia,
  decidirProcedencia,
  definirPrioridade,
  enviarAnexo,
  excluirOcorrencia,
  moverPara,
  urlAssinada,
  registrarCiencia,
  desconsiderarOcorrencia,
  DESCONSIDERAR_MOTIVO_MIN,
  RESULTADOS_APURACAO_CHAVE,
  RESULTADOS_APURACAO_MAX,
  RESULTADOS_APURACAO_MIN,
  salvarResultadosApuracao,
} from "@/lib/ocorrencias-crud";
import { listarHistorico, listarOcorrencias } from "@/lib/ocorrencias-base";
import {
  podeAgir,
  podeAssumirOcorrencia,
  podeDefinirPrioridade,
  podeLiberarOcorrencia,
  podeMoverEtapa,
  podeOperarOcorrencias,
  podeComentar,
  podeExcluir,
  podeGerenciar,
  podeVerInternos,
  papelNaOcorrencia,
  veVisaoCompleta,
} from "@/lib/ocorrencias-permissoes";
import { traduzErro } from "@/lib/organizacao";
import { normalizarSetor } from "@/lib/niveis-acesso";
import { cienciasDe, setoresEnvolvidosDe } from "@/lib/ocorrencias";
import {
  ACOES_ETAPA_LABELS,
  PROCEDENCIA_LABELS,
  PRIORIDADES_OCORRENCIA,
  PRIORIDADE_LABELS,
  type PrioridadeOcorrencia,
  STATUS_OCORRENCIA_LABELS,
  ehTipoNaoConformidade,
  formatarPrazo,
  nomeEtapaDoFluxo,
  ordenarSubetapas,
  subetapaDe,
  textoResposta,
  type AcaoEtapa,
  type AnexoOcorrencia,
  type CampoFormulario,
  type EventoOcorrencia,
  type MacroEtapa,
  type MacroFluxo,
  type Ocorrencia,
  type ProcedenciaOcorrencia,
  type Respostas,
} from "@/lib/ocorrencias";

interface DetalheOcorrenciaDialogProps {
  aberto: boolean;
  onClose: () => void;
  ocorrencia: Ocorrencia | null;
  /** Chamado após qualquer alteração para o pai atualizar a lista. */
  onAlterada?: () => void;
}

export function DetalheOcorrenciaDialog({
  aberto,
  onClose,
  ocorrencia,
  onAlterada,
}: DetalheOcorrenciaDialogProps) {
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onClose()}>
      {aberto && ocorrencia && (
        <DetalheCorpo
          key={ocorrencia.id}
          ocorrencia={ocorrencia}
          onFechar={onClose}
          onAlterada={onAlterada}
        />
      )}
    </Dialog>
  );
}

function DetalheCorpo({
  ocorrencia: inicial,
  onFechar,
  onAlterada,
}: {
  ocorrencia: Ocorrencia;
  onFechar: () => void;
  onAlterada?: () => void;
}) {
  const session = usePanelSession();
  const [o, setO] = useState<Ocorrencia>(inicial);
  const [etapas, setEtapas] = useState<MacroFluxo[]>([]);
  const [formulario, setFormulario] = useState<CampoFormulario[]>([]);
  const [eventos, setEventos] = useState<EventoOcorrencia[]>([]);
  const [etapaRespostas, setEtapaRespostas] = useState<Respostas>({});
  const [comentario, setComentario] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Resultados da Apuração (Qualidade).
  const salvosApuracao = o.respostas[RESULTADOS_APURACAO_CHAVE] as
    | { texto?: string; anexos?: AnexoOcorrencia[] }
    | undefined;
  const [resultados, setResultados] = useState(salvosApuracao?.texto ?? "");
  const [anexosSalvos, setAnexosSalvos] = useState<AnexoOcorrencia[]>(
    salvosApuracao?.anexos ?? [],
  );
  const [novosAnexosResultado, setNovosAnexosResultado] = useState<File[]>([]);
  const [salvandoResultados, setSalvandoResultados] = useState(false);

  // Avaliação de eficácia (diálogo da Qualidade).
  const [avaliacaoAberta, setAvaliacaoAberta] = useState(false);
  const [eficaz, setEficaz] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);

  // Desconsiderar (Qualidade).
  const [desconsiderarAberto, setDesconsiderarAberto] = useState(false);
  const [motivoDesconsiderar, setMotivoDesconsiderar] = useState("");
  const [desconsiderando, setDesconsiderando] = useState(false);

  // Exclusão (Qualidade/administradores).
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      carregarFluxoAtivo(o.tipoId, o.fluxoVersao),
      carregarFormularioAtivo(o.tipoId, o.formularioVersao),
      listarHistorico(o.id),
    ])
      .then(([etapasCarregadas, formularioCarregado, historico]) => {
        if (!ativo) return;
        setEtapas(etapasCarregadas);
        setFormulario(formularioCarregado);
        setEventos(historico);
        setEtapaRespostas(
          (o.respostas[`__etapa_${o.macroAtual}_${o.subetapaAtualId}`] as Respostas | undefined) ??
            {},
        );
        setCarregando(false);
      })
      .catch(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id]);

  const visao = veVisaoCompleta(session, o) ? "completa" : "simplificada";
  const ehSolicitante = papelNaOcorrencia(session, o) === "solicitante";
  const subEtapa = subetapaDe(etapas, o.macroAtual, o.subetapaAtualId);
  // Na avaliação de eficácia a decisão é o botão "Avaliar eficácia" (eficaz encerra; ineficaz abre novo ciclo).
  const acoes =
    o.status === "encerrada"
      ? []
      : (subEtapa?.acoes ?? []).filter(
          (a) => !(o.macroAtual === "avaliacao_eficacia" && (a === "aprovar" || a === "reprovar")),
        );
  const noFechamento = o.macroAtual === "fechamento";
  const setoresEnvolvidos = setoresEnvolvidosDe(o);
  const ciencias = cienciasDe(o);
  const meuSetor = normalizarSetor(session?.setor);
  const pode = podeAgir(session, o);
  const gerencia = podeGerenciar(session, o);
  const podeMover = podeMoverEtapa(session, o);
  const podeAssumir = podeAssumirOcorrencia(session, o);
  const podeLiberar = podeLiberarOcorrencia(session, o);
  const macrosFluxo = etapas.map((e) => e.macro);
  const idxMacro = macrosFluxo.indexOf(o.macroAtual);
  const proximaMacro = o.status === "encerrada" || idxMacro < 0 ? undefined : etapas[idxMacro + 1];
  const verInternos = podeVerInternos(session, o);
  const comentar = podeComentar(session, o);
  const camposEtapa = subEtapa?.campos ?? [];

  async function recarregar() {
    const [lista, historico] = await Promise.all([
      listarOcorrencias().catch(() => []),
      listarHistorico(o.id).catch(() => [] as EventoOcorrencia[]),
    ]);
    const atualizada = lista.find((x) => x.id === o.id);
    if (atualizada) {
      setO(atualizada);
      setEtapaRespostas(
        (atualizada.respostas[`__etapa_${atualizada.macroAtual}_${atualizada.subetapaAtualId}`] as
          Respostas | undefined) ?? {},
      );
    }
    setEventos(historico);
    onAlterada?.();
  }

  async function executarAcao(acao: AcaoEtapa) {
    const respostasEtapa = { ...etapaRespostas };
    delete (respostasEtapa as Respostas)["__erros"];
    const erros = validarCampos(camposEtapa, respostasEtapa);
    if (Object.keys(erros).length > 0) {
      setEtapaRespostas((r) => ({ ...r, __erros: erros }));
      toast.error("Preencha o formulário da etapa antes de agir.");
      return;
    }
    try {
      await agirNaOcorrencia(
        o,
        etapas,
        {
          acao,
          respostasEtapa: Object.keys(respostasEtapa).length ? respostasEtapa : undefined,
          comentario: comentario.trim() || undefined,
        },
        session,
      );
      toast.success(`${ACOES_ETAPA_LABELS[acao]} registrado.`);
      setComentario("");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function mover(macro: MacroEtapa, subetapaId: string) {
    if (
      o.macroAtual === "apuracao" &&
      macro !== "apuracao" &&
      (salvosApuracao?.texto?.trim().length ?? 0) < RESULTADOS_APURACAO_MIN
    ) {
      toast.error(
        `Salve os Resultados da Etapa (mínimo de ${RESULTADOS_APURACAO_MIN} caracteres) antes de sair da Apuração.`,
      );
      return;
    }
    try {
      await moverPara(o, etapas, macro, subetapaId, session, "Movimentação manual pela Qualidade.");
      toast.success("Ocorrência movida de etapa.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function enviarComentario() {
    if (!comentario.trim() && anexos.length === 0) return;
    try {
      const anexosEnviados = [];
      for (const arquivo of anexos) {
        anexosEnviados.push(await enviarAnexo(o.id, arquivo));
      }
      await comentarOcorrencia(o, comentario.trim(), anexosEnviados, session);
      toast.success("Comentário enviado.");
      setComentario("");
      setAnexos([]);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function salvarResultados() {
    setSalvandoResultados(true);
    try {
      const enviados = [...anexosSalvos];
      for (const arquivo of novosAnexosResultado) {
        enviados.push(await enviarAnexo(o.id, arquivo));
      }
      await salvarResultadosApuracao(o, resultados, enviados, session);
      setAnexosSalvos(enviados);
      setNovosAnexosResultado([]);
      toast.success("Resultados da etapa salvos.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoResultados(false);
    }
  }

  async function confirmarAvaliacao() {
    setSalvandoAvaliacao(true);
    try {
      await avaliarEficacia(o, etapas, { eficaz, observacao: observacao.trim() }, session);
      toast.success(eficaz ? "Eficácia confirmada." : "Ocorrência reaberta por ineficácia.");
      setAvaliacaoAberta(false);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoAvaliacao(false);
    }
  }

  async function darCiencia(setor: string) {
    try {
      await registrarCiencia(o, setor, session);
      toast.success(`Ciência registrada: ${setor}.`);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function decidir(procedencia: Exclude<ProcedenciaOcorrencia, "pendente">) {
    try {
      await decidirProcedencia(o, procedencia, "", session);
      toast.success(`${PROCEDENCIA_LABELS[procedencia]} registrado.`);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function mudarPrioridade(valor: PrioridadeOcorrencia) {
    try {
      await definirPrioridade(o, valor, session);
      toast.success(`Prioridade: ${PRIORIDADE_LABELS[valor]}.`);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function puxarTratativa() {
    try {
      await assumirOcorrencia(o, session);
      toast.success("Tratativa assumida: a ocorrência é sua até o encerramento.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function soltarTratativa() {
    try {
      await liberarOcorrencia(o, session);
      toast.success("Tratativa liberada para a Qualidade.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function abrirAnexo(caminho: string) {
    try {
      window.open(await urlAssinada(caminho), "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o anexo.");
    }
  }

  async function confirmarDesconsiderar() {
    setDesconsiderando(true);
    try {
      await desconsiderarOcorrencia(o, etapas, motivoDesconsiderar, session);
      toast.success(`Ocorrência ${o.numero} desconsiderada.`);
      setDesconsiderarAberto(false);
      setMotivoDesconsiderar("");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setDesconsiderando(false);
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    try {
      await excluirOcorrencia(o);
      toast.success(`Ocorrência ${o.numero} excluída.`);
      setExcluirAberto(false);
      onAlterada?.();
      onFechar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setExcluindo(false);
    }
  }

  const mostraAbertura = verInternos || ehSolicitante;
  const moverOpcoes = ordenarSubetapas(etapas);
  const mostraAvaliacao =
    gerencia && (o.macroAtual === "avaliacao_eficacia" || o.status !== "em_andamento");
  const mostraDecisao =
    o.status === "em_andamento" &&
    o.macroAtual === "julgamento" &&
    o.procedencia === "pendente" &&
    pode;

  return (
    <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[#1E3A8A]">{o.numero}</span>
          <span className="font-normal text-[#1F2937]">— {o.titulo || "Sem título"}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              o.status === "encerrada"
                ? "bg-[#ECFDF5] text-[#065F46]"
                : o.status === "reaberta"
                  ? "bg-[#FFFBEB] text-[#92400E]"
                  : "bg-[#EEF2FF] text-[#1E3A8A]"
            }`}
          >
            {STATUS_OCORRENCIA_LABELS[o.status]}
          </span>
          {o.procedencia !== "pendente" && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                o.procedencia === "procedente"
                  ? "bg-[#ECFDF5] text-[#065F46]"
                  : "bg-[#FDECEE] text-[#991A1A]"
              }`}
            >
              {PROCEDENCIA_LABELS[o.procedencia]}
            </span>
          )}
          {o.reaberturas > 0 && (
            <span className="rounded-full bg-[#FDECEE] px-2.5 py-0.5 text-[11px] font-semibold text-[#991A1A]">
              Ciclo {o.reaberturas + 1}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          {o.tipoNome} · aberto por {o.abertaPorNome || o.abertaPorSetor || "—"} · responsável:{" "}
          {o.responsavelNome || "a definir"}
        </DialogDescription>
      </DialogHeader>

      {carregando ? (
        <div className="py-12 text-center text-sm text-[#64748B]">Carregando a viagem…</div>
      ) : (
        <div className="space-y-4">
          {(o.donoQualidadeNome || podeOperarOcorrencias(session)) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D9E0EA] bg-white px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Tratativa
              </span>
              <span className="text-[13px] font-semibold text-[#1F2937]">
                {o.donoQualidadeNome
                  ? `Com ${o.donoQualidadeNome}`
                  : o.status === "encerrada"
                    ? "Sem responsável"
                    : "Aguardando alguém da Qualidade"}
              </span>
              {podeAssumir && !o.donoQualidadeNome && (
                <Button type="button" size="sm" onClick={() => void puxarTratativa()}>
                  <Hand className="h-4 w-4" />
                  Puxar tratativa
                </Button>
              )}
              {podeLiberar && (
                <Button type="button" size="sm" variant="outline" onClick={() => void soltarTratativa()}>
                  Liberar tratativa
                </Button>
              )}
            </div>
          )}

          {podeDefinirPrioridade(session) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D9E0EA] bg-white px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Prioridade
              </span>
              <Select
                value={o.prioridade}
                onValueChange={(v) => void mudarPrioridade(v as PrioridadeOcorrencia)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES_OCORRENCIA.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[12px] text-[#64748B]">Definida pela Qualidade.</span>
            </div>
          )}

          {!podeDefinirPrioridade(session) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D9E0EA] bg-white px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Prioridade
              </span>
              <span className="text-[13px] font-semibold text-[#1F2937]">
                {PRIORIDADE_LABELS[o.prioridade]}
              </span>
              <span className="text-[12px] text-[#64748B]">Definida pela Qualidade.</span>
            </div>
          )}

          <MetroLinha ocorrencia={o} etapas={etapas} eventos={eventos} visao={visao} />

          {mostraAbertura && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Dados da abertura
              </h3>
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                {ehTipoNaoConformidade({ nome: o.tipoNome }) && formulario.length === 0 ? (
                  <>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">Origem</dt>
                      <dd className="text-[#334155]">{textoResposta(o.respostas["origem_nc"])}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">Área envolvida</dt>
                      <dd className="text-[#334155]">
                        {textoResposta(o.respostas["area_envolvida"])}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">Descrição da Não Conformidade</dt>
                      <dd className="whitespace-pre-wrap text-[#334155]">
                        {textoResposta(o.respostas["descricao_nc"])}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">
                        Consequência
                        <span className="ml-1 text-[#C7D2E0]">· Qual o impacto dessa NC?</span>
                      </dt>
                      <dd className="whitespace-pre-wrap text-[#334155]">
                        {textoResposta(o.respostas["consequencia"])}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">Sugestão de Solução</dt>
                      <dd className="whitespace-pre-wrap text-[#334155]">
                        {textoResposta(o.respostas["sugestao_solucao"])}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#94A3B8]">Gerou multa?</dt>
                      <dd className="text-[#334155]">
                        {o.respostas["gerou_multa"] === true
                          ? o.respostas["assinou_termo_multa"] === true
                            ? "Sim — termo de multa assinado"
                            : "Sim"
                          : o.respostas["gerou_multa"] === false
                            ? "Não"
                            : "—"}
                      </dd>
                    </div>
                  </>
                ) : formulario.length > 0 ? (
                  formulario.map((c) => (
                    <div key={c.id} className={c.tipo === "arquivo" ? "sm:col-span-2" : undefined}>
                      <dt className="text-[11px] text-[#94A3B8]">{c.label}</dt>
                      {c.tipo === "arquivo" && anexosDe(o.respostas[c.id]).length > 0 ? (
                        <dd>
                          <AnexosVisualizador anexos={anexosDe(o.respostas[c.id])} />
                        </dd>
                      ) : (
                        <dd className="text-[#334155]">
                          {c.tipo === "moeda" && typeof o.respostas[c.id] === "number"
                            ? (o.respostas[c.id] as number).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : textoResposta(o.respostas[c.id])}
                        </dd>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-[#64748B]">
                    Sem formulário publicado — dados registrados na abertura.
                  </div>
                )}
                <div>
                  <dt className="text-[11px] text-[#94A3B8]">Abertura</dt>
                  <dd className="text-[#334155]">{formatarDataHoraBrasilia(o.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-[#94A3B8]">Etapa atual</dt>
                  <dd className="text-[#334155]">
                    {nomeEtapaDoFluxo(etapas, o.macroAtual)}
                    {o.subetapaAtualNome ? ` › ${o.subetapaAtualNome}` : ""}
                    {o.prazoEtapa ? ` · prazo ${formatarPrazo(o.prazoEtapa)}` : ""}
                  </dd>
                </div>
              </dl>
              {!formulario.some((c) => c.id === "anexos" && c.tipo === "arquivo") &&
              anexosDe(o.respostas["anexos"]).length > 0 ? (
                <div className="mt-3 border-t border-[#E9EEF5] pt-3">
                  <h4 className="text-[11px] font-semibold text-[#64748B]">Anexos da abertura</h4>
                  <AnexosVisualizador anexos={anexosDe(o.respostas["anexos"])} />
                </div>
              ) : null}
            </section>
          )}

          {o.status !== "encerrada" && camposEtapa.length > 0 && verInternos && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Formulário da etapa · {subEtapa?.nome}
              </h3>
              <div className="mt-3">
                <FormularioDinamico
                  campos={camposEtapa}
                  respostas={etapaRespostas}
                  onChange={(id, valor) => setEtapaRespostas((r) => ({ ...r, [id]: valor }))}
                  desabilitado={!pode}
                />
              </div>
            </section>
          )}

          {pode && acoes.length > 0 && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Ações da etapa
              </h3>
              <Textarea
                className="mt-2 min-h-[60px]"
                placeholder={
                  noFechamento
                    ? "Parecer final (obrigatório para fechar a ocorrência)…"
                    : o.macroAtual === "retorno_cliente"
                      ? "Registre o retorno dado ao cliente (obrigatório)…"
                      : "Observação da ação (opcional)…"
                }
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {acoes.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={a === "aprovar" ? "default" : "outline"}
                    size="sm"
                    className={a === "aprovar" ? "bg-[#1E3A8A] text-white hover:bg-[#1E40AF]" : ""}
                    onClick={() => void executarAcao(a)}
                  >
                    {ACOES_ETAPA_LABELS[a]}
                  </Button>
                ))}
              </div>
            </section>
          )}

          {mostraDecisao && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Julgamento — decisão de procedência
              </h3>
              <p className="mt-1 text-[13px] text-[#64748B]">
                Registra se a não conformidade foi procedente ou não. O solicitante verá a decisão
                em tempo real.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#059669] text-white hover:bg-[#047857]"
                  onClick={() => void decidir("procedente")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Procedente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#E11D48]/40 text-[#E11D48] hover:bg-[#FDECEE]"
                  onClick={() => void decidir("nao_procedente")}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Não-procedente
                </Button>
              </div>
            </section>
          )}

          {podeMover && o.status !== "encerrada" && o.macroAtual === "apuracao" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Resultados da Etapa (Qualidade)
              </h3>
              <Textarea
                className="mt-2 min-h-[160px]"
                maxLength={RESULTADOS_APURACAO_MAX}
                placeholder="Descreva os resultados da apuração (mínimo de 100 caracteres)…"
                value={resultados}
                onChange={(e) => setResultados(e.target.value)}
              />
              <p
                className={`mt-1 text-[11px] ${
                  resultados.trim().length < RESULTADOS_APURACAO_MIN
                    ? "text-[#E11D48]"
                    : "text-[#64748B]"
                }`}
              >
                {resultados.trim().length}/{RESULTADOS_APURACAO_MAX} caracteres · mínimo{" "}
                {RESULTADOS_APURACAO_MIN}
              </p>
              {anexosSalvos.length > 0 && (
                <div className="mt-3">
                  <AnexosVisualizador anexos={anexosSalvos} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]">
                  <Paperclip className="h-3.5 w-3.5" />
                  {novosAnexosResultado.length > 0
                    ? `${novosAnexosResultado.length} arquivo(s) a enviar`
                    : "Anexar imagens, vídeos ou documentos"}
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    className="hidden"
                    onChange={(e) =>
                      setNovosAnexosResultado((atual) => [
                        ...atual,
                        ...Array.from(e.target.files ?? []),
                      ])
                    }
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    salvandoResultados || resultados.trim().length < RESULTADOS_APURACAO_MIN
                  }
                  className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                  onClick={() => void salvarResultados()}
                >
                  {salvandoResultados ? "Salvando…" : "Salvar resultados"}
                </Button>
              </div>
            </section>
          )}

          {podeMover && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Gestão (Qualidade)
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {proximaMacro && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                    onClick={() =>
                      void mover(proximaMacro.macro, proximaMacro.subetapas?.[0]?.id ?? "")
                    }
                  >
                    Avançar para {proximaMacro.nome}
                  </Button>
                )}
                <div className="w-full sm:w-[260px]">
                  <Label className="text-[12px]">Mover para etapa</Label>
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!v) return;
                      const [macro, ...resto] = v.split("::");
                      void mover(macro as MacroEtapa, resto.join("::"));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher etapa…" />
                    </SelectTrigger>
                    <SelectContent>
                      {moverOpcoes.length === 0 ? (
                        <SelectItem value={"_sem"} disabled>
                          Nenhuma subetapa no fluxo
                        </SelectItem>
                      ) : (
                        moverOpcoes.map(({ macro, subetapa }) => (
                          <SelectItem
                            key={`${macro}::${subetapa.id}`}
                            value={`${macro}::${subetapa.id}`}
                          >
                            {nomeEtapaDoFluxo(etapas, macro)} › {subetapa.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {mostraAvaliacao && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEficaz(true);
                      setObservacao("");
                      setAvaliacaoAberta(true);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Avaliar eficácia
                  </Button>
                )}
              </div>

              {o.avaliacao && (
                <div className="mt-3 rounded-lg border border-[#E9EEF5] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#475569]">
                  <span className="font-semibold">
                    Avaliação:{" "}
                    {o.avaliacao.eficaz === null
                      ? "pendente"
                      : o.avaliacao.eficaz
                        ? "eficaz"
                        : "ineficaz"}
                    {o.avaliacao.verificacaoEm
                      ? ` · verificação ${formatarPrazo(o.avaliacao.verificacaoEm)}`
                      : ""}
                  </span>
                  {o.avaliacao.observacao && <p className="mt-0.5">{o.avaliacao.observacao}</p>}
                </div>
              )}
            </section>
          )}

          {setoresEnvolvidos.length > 0 &&
            (verInternos || setoresEnvolvidos.some((x) => normalizarSetor(x) === meuSetor)) && (
              <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Ciência dos setores envolvidos
                </h3>
                <ul className="mt-2 space-y-2">
                  {setoresEnvolvidos.map((setor) => {
                    const c = ciencias[setor];
                    const podeMarcar =
                      !c &&
                      o.status !== "encerrada" &&
                      (gerencia || normalizarSetor(setor) === meuSetor);
                    return (
                      <li
                        key={setor}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[13px]"
                      >
                        <span className="font-medium text-[#1F2937]">{setor}</span>
                        {c ? (
                          <span className="text-[12px] text-[#065F46]">
                            Ciente · {c.por || "—"} · {formatarDataHoraBrasilia(c.em)}
                          </span>
                        ) : podeMarcar ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void darCiencia(setor)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Marcar ciência
                          </Button>
                        ) : (
                          <span className="text-[12px] text-[#92400E]">Aguardando ciência</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

          {o.parecerFinal && (
            <section className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">
                Parecer final
                {o.parecerEm ? ` · ${formatarPrazo(o.parecerEm)}` : ""}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-[13px] text-[#14532D]">
                {o.parecerFinal}
              </p>
              {o.eficaciaPrevistaEm && o.status !== "encerrada" && (
                <p className="mt-2 text-[12px] text-[#166534]">
                  Avaliação de eficácia prevista para {formatarPrazo(o.eficaciaPrevistaEm)} (
                  {o.eficaciaDias} dias após o fechamento).
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
              Comentários &amp; histórico
            </h3>
            <ul className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
              {eventos
                .filter((ev) => verInternos || eventoVisivelParaSolicitante(ev.acao))
                .map((ev) => {
                  const Icone = iconeEvento(ev.acao);
                  return (
                    <li key={ev.id} className="flex items-start gap-2 text-[12px] text-[#475569]">
                      <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                      <span className="min-w-0">
                        <span className="font-medium text-[#1F2937]">{ev.acao}</span>
                        {ev.de && ` · de ${ev.de}`} {ev.para && `→ ${ev.para}`}
                        {ev.comentario && (
                          <span className="mt-0.5 block whitespace-pre-wrap">{ev.comentario}</span>
                        )}
                        {ev.anexos.length > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-[#64748B]">
                            <Paperclip className="h-3 w-3" />
                            {ev.anexos.map((a) => a.nome).join(", ")}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-[#94A3B8]">
                          {ev.autorNome} · {formatarDataHoraBrasilia(ev.createdAt)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              {eventos.length === 0 && (
                <li className="text-[13px] text-[#94A3B8]">Sem movimentações registradas.</li>
              )}
            </ul>

            {comentar && (
              <div className="mt-3 flex items-start gap-2">
                <Textarea
                  className="min-h-[60px] flex-1"
                  placeholder="Adicionar comentário…"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]">
                    <Paperclip className="h-3.5 w-3.5" />
                    {anexos.length > 0 ? `${anexos.length} anexo(s)` : "Anexar"}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => setAnexos(Array.from(e.target.files ?? []))}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                    onClick={() => void enviarComentario()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <DialogFooter>
        {podeMover && o.status !== "encerrada" && (
          <Button
            type="button"
            className="bg-[#C2410C] text-white hover:bg-[#9A3412]"
            onClick={() => setDesconsiderarAberto(true)}
          >
            Desconsiderar ocorrência
          </Button>
        )}
        {podeExcluir(session) && (
          <Button
            type="button"
            className="bg-[#E11D48] text-white hover:bg-[#BE123C]"
            onClick={() => setExcluirAberto(true)}
          >
            Excluir ocorrência
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </DialogFooter>

      <Dialog open={desconsiderarAberto} onOpenChange={(a) => !a && setDesconsiderarAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desconsiderar a ocorrência {o.numero}?</DialogTitle>
            <DialogDescription>
              A ocorrência será encerrada e o motivo ficará registrado no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Motivo (obrigatório)</Label>
            <Textarea
              className="min-h-[90px]"
              placeholder="Explique por que a ocorrência está sendo desconsiderada…"
              value={motivoDesconsiderar}
              onChange={(e) => setMotivoDesconsiderar(e.target.value)}
            />
            <p
              className={`text-[11px] ${
                motivoDesconsiderar.trim().length < DESCONSIDERAR_MOTIVO_MIN
                  ? "text-[#E11D48]"
                  : "text-[#64748B]"
              }`}
            >
              {motivoDesconsiderar.trim().length} caracteres · mínimo {DESCONSIDERAR_MOTIVO_MIN}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={desconsiderando}
              onClick={() => setDesconsiderarAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                desconsiderando || motivoDesconsiderar.trim().length < DESCONSIDERAR_MOTIVO_MIN
              }
              onClick={() => void confirmarDesconsiderar()}
              className="bg-[#C2410C] text-white hover:bg-[#9A3412]"
            >
              {desconsiderando ? "Salvando…" : "Desconsiderar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluirAberto} onOpenChange={(a) => !a && setExcluirAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir a ocorrência {o.numero}?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível: remove a ocorrência, seus anexos e todo o histórico de
              tratativa. Apenas Qualidade e administradores podem excluir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={excluindo}
              onClick={() => setExcluirAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={excluindo}
              onClick={() => void confirmarExclusao()}
              className="bg-[#E11D48] text-white hover:bg-[#BE123C]"
            >
              {excluindo ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={avaliacaoAberta} onOpenChange={(a) => !a && setAvaliacaoAberta(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Avaliar eficácia</DialogTitle>
            <DialogDescription>
              {eficaz
                ? "Não houve reincidência: a ocorrência é encerrada."
                : "Houve reincidência: a ocorrência volta para o plano de ação e abre um novo ciclo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={eficaz ? "default" : "outline"}
                size="sm"
                className={eficaz ? "bg-[#059669] text-white hover:bg-[#047857]" : ""}
                onClick={() => setEficaz(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Eficaz
              </Button>
              <Button
                type="button"
                variant={!eficaz ? "default" : "outline"}
                size="sm"
                className={!eficaz ? "bg-[#E11D48] text-white hover:bg-[#BE123C]" : ""}
                onClick={() => setEficaz(false)}
              >
                <AlertTriangle className="h-4 w-4" />
                Ineficaz
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Observação</Label>
              <Textarea
                className="min-h-[80px]"
                placeholder="O que foi verificado / por que a ação não resolveu…"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAvaliacaoAberta(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoAvaliacao}
              onClick={() => void confirmarAvaliacao()}
              className={
                eficaz
                  ? "bg-[#059669] text-white hover:bg-[#047857]"
                  : "bg-[#E11D48] text-white hover:bg-[#BE123C]"
              }
            >
              {salvandoAvaliacao
                ? "Salvando…"
                : eficaz
                  ? "Confirmar eficácia"
                  : "Reabrir por ineficácia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}

function iconeEvento(acao: string): LucideIcon {
  if (acao.toLowerCase().includes("aprova") || acao.toLowerCase().includes("eficaz"))
    return CheckCircle2;
  if (acao.toLowerCase().includes("atraso") || acao.toLowerCase().includes("reprova"))
    return AlertTriangle;
  if (acao.toLowerCase().includes("coment")) return MessageSquare;
  if (acao.toLowerCase().includes("reabert") || acao.toLowerCase().includes("escal")) return Plus;
  return ArrowRight;
}

/** Eventos que o solicitante (visão simplificada) pode acompanhar. */
function eventoVisivelParaSolicitante(acao: string): boolean {
  const visiveis = [
    "criação",
    "comentário",
    "parecer",
    "encerramento",
    "atraso",
    "reabert",
    "escalad",
    "julgamento",
  ];
  const normalizada = acao.toLowerCase();
  return visiveis.some((v) => normalizada.includes(v));
}
