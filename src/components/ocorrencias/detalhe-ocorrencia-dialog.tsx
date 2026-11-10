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
  ExternalLink,
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
import { Input } from "@/components/ui/input";
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
import { RelatorioJulgamento } from "@/components/ocorrencias/relatorio-julgamento";
import { JulgamentoPartes } from "@/components/ocorrencias/julgamento-partes";
import { CampoSetores, FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  agirNaOcorrencia,
  assumirOcorrencia,
  liberarOcorrencia,
  marcarImpedida,
  retomarImpedida,
  avaliarEficacia,
  carregarFluxoAtivo,
  carregarFormularioAtivo,
  comentarOcorrencia,
  definirPrioridade,
  enviarAnexo,
  excluirOcorrencia,
  moverPara,
  urlAssinada,
  registrarCiencia,
  desconsiderarOcorrencia,
  DESCONSIDERAR_MOTIVO_MIN,
  RESULTADOS_APURACAO_CHAVE,
  salvarFerramentaApuracao,
  enviarRetornoParcial,
  RETORNO_PARCIAL_ACAO,
  salvarParecerApuracao,
  adicionarSetoresEnvolvidos,
} from "@/lib/ocorrencias-crud";
import {
  definirParecerApuracaoTipo,
  listarHistorico,
  listarOcorrencias,
  listarTipos,
} from "@/lib/ocorrencias-base";
import {
  podeAgir,
  podeAssumirOcorrencia,
  podeSugerirAcao,
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
import {
  causaRaizDaApuracao,
  cienciasDe,
  apuracaoFerramentasDe,
  parecerApuracaoDe,
  setoresEnvolvidosDe,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";
import { FerramentaApuracao } from "@/components/ocorrencias/ferramenta-apuracao";
import { EvidenciasApuracao } from "@/components/ocorrencias/evidencias-apuracao";
import { AcoesExecutadas } from "@/components/ocorrencias/acoes-executadas";
import { marcarRetornoVisto } from "@/lib/ocorrencias-retorno";
import { PlanoAcoesOcorrencia } from "@/components/ocorrencias/plano-acoes-ocorrencia";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
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
  type SubetapaFluxo,
  subetapaDe,
  textoResposta,
  type AcaoEtapa,
  type AnexoOcorrencia,
  type CampoFormulario,
  type EventoOcorrencia,
  type MacroEtapa,
  type MacroFluxo,
  type Ocorrencia,
  LIMITE_TEXTO_OCORRENCIA,
  type ResultadoEficacia,
  type Respostas,
} from "@/lib/ocorrencias";

interface DetalheOcorrenciaDialogProps {
  aberto: boolean;
  onClose: () => void;
  ocorrencia: Ocorrencia | null;
  /** Chamado após qualquer alteração para o pai atualizar a lista. */
  onAlterada?: () => void;
}

/** Tamanho máximo de cada anexo do relatório de eficácia (fotos, vídeos e documentos). */
const TAMANHO_MAX_ANEXO_EFICACIA = 50 * 1024 * 1024;

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

  // Ferramenta de apuração (Qualidade). Anexos da versão antiga ficam só para leitura.
  const anexosApuracaoAntiga =
    (o.respostas[RESULTADOS_APURACAO_CHAVE] as { anexos?: AnexoOcorrencia[] } | undefined)?.anexos ??
    [];
  const [salvandoApuracao, setSalvandoApuracao] = useState(false);
  // Tipo da ocorrência (define se o parecer final da Apuração é obrigatório).
  const [tipoDaOcorrencia, setTipoDaOcorrencia] = useState<TipoOcorrencia | null>(null);
  useEffect(() => {
    let ativo = true;
    listarTipos()
      .then((lista) => {
        if (ativo) setTipoDaOcorrencia(lista.find((t) => t.id === o.tipoId) ?? null);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [o.tipoId]);

  // Parecer final da Apuração (texto livre; obrigatório conforme o tipo).
  const parecerSalvo = parecerApuracaoDe(o);
  const [textoParecer, setTextoParecer] = useState(parecerSalvo?.texto ?? "");
  const [salvandoParecer, setSalvandoParecer] = useState(false);

  // Setores envolvidos acrescentados depois da abertura.
  const [novosSetores, setNovosSetores] = useState<string[]>([]);
  const [salvandoSetores, setSalvandoSetores] = useState(false);

  async function adicionarSetores() {
    setSalvandoSetores(true);
    try {
      await adicionarSetoresEnvolvidos(o, novosSetores, session);
      setNovosSetores([]);
      toast.success("Setores envolvidos adicionados.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoSetores(false);
    }
  }

  /** Liga/desliga a exigência do parecer para o tipo (vale para todas as ocorrências dele). */
  async function alternarParecerObrigatorio() {
    if (!tipoDaOcorrencia) return;
    const novo = !tipoDaOcorrencia.parecerApuracao;
    try {
      await definirParecerApuracaoTipo(tipoDaOcorrencia.id, novo);
      setTipoDaOcorrencia({ ...tipoDaOcorrencia, parecerApuracao: novo });
      toast.success(
        novo ? "Parecer final passou a ser obrigatório neste tipo." : "Parecer final deixou de ser obrigatório.",
      );
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function salvarParecer() {
    setSalvandoParecer(true);
    try {
      await salvarParecerApuracao(o, textoParecer, session);
      toast.success("Parecer final da apuração salvo.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoParecer(false);
    }
  }

  // Retorno parcial ao solicitante (durante a Apuração).
  const [retornoParcialAberto, setRetornoParcialAberto] = useState(false);
  const [textoRetornoParcial, setTextoRetornoParcial] = useState("");
  const [enviandoRetornoParcial, setEnviandoRetornoParcial] = useState(false);

  // Avaliação de eficácia (diálogo da Qualidade).
  const [avaliacaoAberta, setAvaliacaoAberta] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEficacia>("eficaz");
  const [observacao, setObservacao] = useState("");
  // Ocorrências agrupadas no novo plano (só quando a eficácia não é confirmada).
  const [agrupadasTexto, setAgrupadasTexto] = useState("");
  const [novosAnexosEficacia, setNovosAnexosEficacia] = useState<File[]>([]);
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);
  // Marcar a etapa como impedida (o prazo para de contar).
  const [impedindoAberto, setImpedindoAberto] = useState(false);
  const [motivoImpedimento, setMotivoImpedimento] = useState("");
  const [salvandoImpedimento, setSalvandoImpedimento] = useState(false);
  const catalogo = useCatalogoOrganizacional();
  // Retorno da Qualidade: abre sozinho quando a ocorrência é encerrada.
  const [retornoAberto, setRetornoAberto] = useState(false);
  useEffect(() => {
    if (o.status !== "encerrada") return;
    setRetornoAberto(true);
    marcarRetornoVisto(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id, o.status]);

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
  // Etapa anterior à eficácia: é nela que o parecer final é registrado.
  const noFechamento = proximaMacro?.macro === "avaliacao_eficacia";
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
      !causaRaizDaApuracao(apuracaoFerramentasDe(o)).trim()
    ) {
      toast.error("Salve a causa raiz na ferramenta de apuração antes de sair da Apuração.");
      return;
    }
    if (
      o.macroAtual === "apuracao" &&
      macro !== "apuracao" &&
      tipoDaOcorrencia?.parecerApuracao &&
      !parecerApuracaoDe(o)
    ) {
      toast.error("Registre o parecer final da Apuração antes de sair dela (exigido neste tipo).");
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

  async function enviarRetornoParcialAgora() {
    setEnviandoRetornoParcial(true);
    try {
      await enviarRetornoParcial(o, textoRetornoParcial, session);
      toast.success("Retorno enviado ao solicitante.");
      setTextoRetornoParcial("");
      setRetornoParcialAberto(false);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setEnviandoRetornoParcial(false);
    }
  }

  async function salvarApuracao(apuracao: Parameters<typeof salvarFerramentaApuracao>[1]) {
    setSalvandoApuracao(true);
    try {
      await salvarFerramentaApuracao(o, apuracao, session);
      toast.success("Apuração salva.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoApuracao(false);
    }
  }

  async function confirmarAvaliacao() {
    const grandes = novosAnexosEficacia.filter((f) => f.size > TAMANHO_MAX_ANEXO_EFICACIA);
    if (grandes.length > 0) {
      toast.error("Cada anexo deve ter até 50 MB.");
      return;
    }
    setSalvandoAvaliacao(true);
    try {
      const anexos: AnexoOcorrencia[] = [];
      for (const arquivo of novosAnexosEficacia) {
        anexos.push(await enviarAnexo(o.id, arquivo));
      }
      await avaliarEficacia(
        o,
        etapas,
        {
          resultado,
          observacao: observacao.trim(),
          anexos,
          agrupadas:
            resultado === "nao_eficaz"
              ? agrupadasTexto
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        },
        session,
      );
      setNovosAnexosEficacia([]);
      toast.success(
        resultado === "eficaz"
          ? "Eficácia confirmada."
          : resultado === "nao_eficaz"
            ? "Ocorrência reaberta por ineficácia."
            : "Etapa marcada como impedida.",
      );
      setAvaliacaoAberta(false);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoAvaliacao(false);
    }
  }

  async function confirmarImpedimento() {
    setSalvandoImpedimento(true);
    try {
      await marcarImpedida(o, session, motivoImpedimento);
      toast.success("Etapa marcada como impedida. O prazo está parado.");
      setImpedindoAberto(false);
      setMotivoImpedimento("");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoImpedimento(false);
    }
  }

  async function retomarEtapa() {
    try {
      await retomarImpedida(o, session);
      toast.success("Impedimento resolvido. O prazo voltou a contar.");
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
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
  // Etapas sem subetapas configuradas também aparecem (movem para a etapa inteira).
  const moverOpcoes = etapas.flatMap((e): { macro: MacroEtapa; subetapa: SubetapaFluxo | null }[] =>
    e.subetapas.length > 0
      ? e.subetapas.map((s) => ({ macro: e.macro, subetapa: s }))
      : [{ macro: e.macro, subetapa: null }],
  );
  const mostraAvaliacao =
    gerencia && (o.macroAtual === "avaliacao_eficacia" || o.status !== "em_andamento");

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
                  : o.procedencia === "parcialmente_procedente"
                    ? "bg-[#FEF3C7] text-[#92400E]"
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

      {tipoDaOcorrencia?.linkExterno && (
        <a
          href={tipoDaOcorrencia.linkExterno}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-[#D9E0EA] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir link externo
        </a>
      )}

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
                <Button
                  type="button"
                  size="sm"
                  className="ocorrencia-botao-tremer"
                  onClick={() => void puxarTratativa()}
                >
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

          {o.impedidaEm && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B] bg-[#FFFBEB] px-4 py-3">
              <div className="text-[13px] text-[#92400E]">
                <p className="font-semibold">
                  Etapa impedida desde {formatarPrazo(o.impedidaEm.slice(0, 10))}
                </p>
                {o.impedidaMotivo && <p className="mt-0.5 whitespace-pre-wrap">{o.impedidaMotivo}</p>}
              </div>
              {podeMover && (
                <Button type="button" size="sm" variant="outline" onClick={() => void retomarEtapa()}>
                  Retomar prazo
                </Button>
              )}
            </div>
          )}
          {!o.impedidaEm && podeMover && o.status !== "encerrada" && (
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => setImpedindoAberto(true)}>
                Marcar etapa como impedida
              </Button>
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

          {verInternos && o.macroAtual === "julgamento" && (
            <RelatorioJulgamento
              key={`relatorio-${o.id}`}
              ocorrencia={o}
              session={session}
              editavel={podeMover && o.status !== "encerrada"}
              onSalvo={recarregar}
            />
          )}

          {verInternos && o.macroAtual === "julgamento" && (
            <JulgamentoPartes
              key={`julgamento-${o.id}`}
              ocorrencia={o}
              session={session}
              editavel={podeMover && o.status !== "encerrada"}
              gerencia={gerencia}
              onSalvo={recarregar}
            />
          )}

          {verInternos && o.macroAtual === "apuracao" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Ferramenta de apuração
              </h3>
              <FerramentaApuracao
                key={o.id}
                ocorrencia={o}
                editavel={podeMover && o.status !== "encerrada"}
                salvando={salvandoApuracao}
                onSalvar={salvarApuracao}
              />
              {anexosApuracaoAntiga.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] text-[#64748B]">Anexos da apuração anterior</p>
                  <AnexosVisualizador anexos={anexosApuracaoAntiga} />
                </div>
              )}
            </section>
          )}

          {verInternos && o.macroAtual === "apuracao" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Retorno para quem abriu
              </h3>
              <p className="mt-1 text-[13px] text-[#64748B]">
                Envia um recado parcial ao solicitante agora. O retorno final segue na finalização.
              </p>
              {eventos.some((ev) => ev.acao === RETORNO_PARCIAL_ACAO) && (
                <ul className="mt-3 space-y-2">
                  {eventos
                    .filter((ev) => ev.acao === RETORNO_PARCIAL_ACAO)
                    .map((ev) => (
                      <li key={ev.id} className="rounded-lg bg-[#F8FAFC] p-3 text-[13px] text-[#334155]">
                        <p className="whitespace-pre-wrap">{ev.comentario}</p>
                        <p className="mt-1 text-[11px] text-[#94A3B8]">
                          {ev.autorNome} · {formatarDataHoraBrasilia(ev.createdAt)}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
              {podeMover &&
                o.status !== "encerrada" &&
                (retornoParcialAberto ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      className="min-h-[100px]"
                      maxLength={LIMITE_TEXTO_OCORRENCIA}
                      placeholder="Escreva o recado para quem abriu…"
                      value={textoRetornoParcial}
                      onChange={(e) => setTextoRetornoParcial(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRetornoParcialAberto(false);
                          setTextoRetornoParcial("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={enviandoRetornoParcial || !textoRetornoParcial.trim()}
                        className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                        onClick={() => void enviarRetornoParcialAgora()}
                      >
                        {enviandoRetornoParcial ? "Enviando…" : "Enviar retorno"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRetornoParcialAberto(true)}
                    className="mt-3 w-full rounded-lg border border-[#D9E0EA] px-4 py-3 text-left text-[14px] font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]"
                  >
                    + Escrever retorno parcial
                  </button>
                ))}
            </section>
          )}

          {verInternos && o.macroAtual === "avaliacao_eficacia" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Ações que foram executadas
              </h3>
              <div className="mt-2">
                <AcoesExecutadas
                  key={o.id}
                  ocorrencia={o}
                  editavel={podeMover && o.status !== "encerrada"}
                  onAlterada={recarregar}
                />
              </div>
            </section>
          )}

          {verInternos && o.macroAtual === "apuracao" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Evidências levantadas
              </h3>
              <div className="mt-2">
                <EvidenciasApuracao
                  key={o.id}
                  ocorrencia={o}
                  editavel={podeMover && o.status !== "encerrada"}
                  permiteAnexos={tipoDaOcorrencia?.permiteAnexos !== false}
                  onAlterada={recarregar}
                />
              </div>
            </section>
          )}

          {(setoresEnvolvidos.length > 0 || (podeMover && o.status !== "encerrada")) &&
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
                {podeMover && o.status !== "encerrada" && (
                  <div className="mt-4 space-y-2 border-t border-[#E9EEF5] pt-3">
                    <p className="text-[12px] font-semibold text-[#475569]">Adicionar setores envolvidos</p>
                    <CampoSetores valor={novosSetores} onChange={(v) => setNovosSetores(Array.isArray(v) ? (v as string[]) : [])} />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={salvandoSetores || novosSetores.length === 0}
                        className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                        onClick={() => void adicionarSetores()}
                      >
                        {salvandoSetores ? "Adicionando…" : "Adicionar setores"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}

          {o.macroAtual === "plano_acao" && o.status !== "encerrada" && (
            <PlanoAcoesOcorrencia
              ocorrencia={o}
              session={session}
              colaboradores={catalogo.colaboradores}
              podeSugerir={podeSugerirAcao(session, o)}
              podeValidar={podeOperarOcorrencias(session)}
            />
          )}

          {o.status === "encerrada" && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setRetornoAberto(true)}>
                Ver retorno da Qualidade
              </Button>
            </div>
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
                  <label
                    hidden={tipoDaOcorrencia?.permiteAnexos === false}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]"
                  >
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

          {verInternos && o.macroAtual === "apuracao" && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Parecer final
                </h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!tipoDaOcorrencia?.parecerApuracao}
                  disabled={!podeOperarOcorrencias(session) || !tipoDaOcorrencia}
                  onClick={() => void alternarParecerObrigatorio()}
                  className="inline-flex items-center gap-2 text-[12px] text-[#334155] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      tipoDaOcorrencia?.parecerApuracao ? "bg-[#1E3A8A]" : "bg-[#CBD5E1]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        tipoDaOcorrencia?.parecerApuracao ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  Obrigatório neste tipo
                </button>
              </div>
              <p className="mt-1 text-[12px] text-[#64748B]">
                Quando ativo, a Apuração só avança com o parecer registrado. Alterável pela Qualidade e pelo Desenvolvedor do Sistema; vale para todas as ocorrências deste tipo.
              </p>
              {podeMover && o.status !== "encerrada" ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    className="min-h-[110px]"
                    maxLength={LIMITE_TEXTO_OCORRENCIA}
                    placeholder="Escreva o parecer final da apuração…"
                    value={textoParecer}
                    onChange={(e) => setTextoParecer(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-[#64748B]">
                      {parecerSalvo
                        ? `Último registro: ${parecerSalvo.salvoPorNome || "—"} · ${formatarDataHoraBrasilia(parecerSalvo.salvoEm)}`
                        : "Ainda não registrado."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={salvandoParecer || !textoParecer.trim()}
                      className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                      onClick={() => void salvarParecer()}
                    >
                      {salvandoParecer ? "Salvando…" : "Salvar parecer"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#F8FAFC] p-3 text-[13px] text-[#334155]">
                  {parecerSalvo?.texto || "Não registrado."}
                </p>
              )}
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
                            key={`${macro}::${subetapa?.id ?? ""}`}
                            value={`${macro}::${subetapa?.id ?? ""}`}
                          >
                            {subetapa
                              ? `${nomeEtapaDoFluxo(etapas, macro)} › ${subetapa.nome}`
                              : nomeEtapaDoFluxo(etapas, macro)}
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
                      setResultado("eficaz");
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
                    Relatório de eficácia:{" "}
                    {o.avaliacao.resultado === "impedida"
                      ? "impedida"
                      : o.avaliacao.resultado === "nao_eficaz" || o.avaliacao.eficaz === false
                        ? "não eficaz"
                        : o.avaliacao.resultado === "eficaz" || o.avaliacao.eficaz === true
                          ? "eficaz"
                          : "pendente"}
                    {o.avaliacao.verificacaoEm
                      ? ` · verificação ${formatarPrazo(o.avaliacao.verificacaoEm)}`
                      : ""}
                  </span>
                  {o.avaliacao.observacao && (
                    <p className="mt-0.5 whitespace-pre-wrap">{o.avaliacao.observacao}</p>
                  )}
                  {o.avaliacao.anexos.length > 0 && (
                    <div className="mt-2">
                      <AnexosVisualizador anexos={o.avaliacao.anexos} />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
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
              {resultado === "eficaz"
                ? "Não houve reincidência: a ocorrência é encerrada."
                : resultado === "nao_eficaz"
                  ? "Houve reincidência: a ocorrência volta para o plano de ação e abre um novo ciclo."
                  : "A etapa depende de alguém ou de algo: o prazo para de contar até ser retomada."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={resultado === "eficaz" ? "default" : "outline"}
                size="sm"
                className={resultado === "eficaz" ? "bg-[#059669] text-white hover:bg-[#047857]" : ""}
                onClick={() => setResultado("eficaz")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Eficaz
              </Button>
              <Button
                type="button"
                variant={resultado === "nao_eficaz" ? "default" : "outline"}
                size="sm"
                className={resultado === "nao_eficaz" ? "bg-[#E11D48] text-white hover:bg-[#BE123C]" : ""}
                onClick={() => setResultado("nao_eficaz")}
              >
                <AlertTriangle className="h-4 w-4" />
                Não eficaz
              </Button>
              <Button
                type="button"
                variant={resultado === "impedida" ? "default" : "outline"}
                size="sm"
                className={resultado === "impedida" ? "bg-[#F59E0B] text-white hover:bg-[#D97706]" : ""}
                onClick={() => setResultado("impedida")}
              >
                Impedida
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">
                {resultado === "impedida" ? "Motivo do impedimento" : "Justificativa"}
              </Label>
              <Textarea
                className="min-h-[80px]"
                maxLength={LIMITE_TEXTO_OCORRENCIA}
                placeholder={
                  resultado === "impedida"
                    ? "Do que a etapa depende e por que está parada…"
                    : "O que foi verificado / por que a ação resolveu ou não resolveu…"
                }
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
              <p className="text-right text-[11px] text-[#94A3B8]">
                {observacao.length}/{LIMITE_TEXTO_OCORRENCIA} caracteres
              </p>
            </div>

            {resultado === "nao_eficaz" && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Ocorrências a agrupar no novo plano (opcional)</Label>
                <Input
                  maxLength={300}
                  placeholder="Ex.: ANC-1252"
                  value={agrupadasTexto}
                  onChange={(e) => setAgrupadasTexto(e.target.value)}
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Separe por vírgula. Elas ficam vinculadas ao plano que começa agora.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[13px]">Fotos, vídeos e documentos (opcional)</Label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]">
                <Paperclip className="h-3.5 w-3.5" />
                {novosAnexosEficacia.length > 0
                  ? `${novosAnexosEficacia.length} arquivo(s) a enviar`
                  : "Anexar imagens, vídeos ou documentos (até 50 MB cada)"}
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  className="hidden"
                  onChange={(e) =>
                    setNovosAnexosEficacia((atual) => [...atual, ...Array.from(e.target.files ?? [])])
                  }
                />
              </label>
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
                resultado === "eficaz"
                  ? "bg-[#059669] text-white hover:bg-[#047857]"
                  : resultado === "nao_eficaz"
                    ? "bg-[#E11D48] text-white hover:bg-[#BE123C]"
                    : "bg-[#F59E0B] text-white hover:bg-[#D97706]"
              }
            >
              {salvandoAvaliacao
                ? "Salvando…"
                : resultado === "eficaz"
                  ? "Confirmar eficácia"
                  : resultado === "nao_eficaz"
                    ? "Reabrir por ineficácia"
                    : "Marcar como impedida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={impedindoAberto} onOpenChange={(a) => !a && setImpedindoAberto(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Marcar etapa como impedida</DialogTitle>
            <DialogDescription>
              O prazo desta etapa para de contar até o impedimento ser resolvido e a etapa ser retomada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Motivo do impedimento</Label>
            <Textarea
              className="min-h-[100px]"
              maxLength={LIMITE_TEXTO_OCORRENCIA}
              placeholder="Do que a etapa depende e por que está parada…"
              value={motivoImpedimento}
              onChange={(e) => setMotivoImpedimento(e.target.value)}
            />
            <p className="text-right text-[11px] text-[#94A3B8]">
              {motivoImpedimento.length}/{LIMITE_TEXTO_OCORRENCIA} caracteres
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImpedindoAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoImpedimento || !motivoImpedimento.trim()}
              onClick={() => void confirmarImpedimento()}
              className="bg-[#F59E0B] text-white hover:bg-[#D97706]"
            >
              {salvandoImpedimento ? "Salvando…" : "Marcar como impedida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retornoAberto} onOpenChange={(a) => !a && setRetornoAberto(false)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Retorno da Qualidade</DialogTitle>
            <DialogDescription>
              {o.numero} · {o.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {verInternos && (
              <section className="space-y-2">
                <h3 className="text-[15px] font-bold text-[#1F2937]">O que foi identificado:</h3>
                <p className="whitespace-pre-wrap rounded-xl bg-[#F8FAFC] p-4 text-[14px] leading-relaxed text-[#334155]">
                  {causaRaizDaApuracao(apuracaoFerramentasDe(o)).trim() ||
                    (o.respostas[RESULTADOS_APURACAO_CHAVE] as { texto?: string } | undefined)?.texto?.trim() ||
                    "Não registrado."}
                </p>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-[15px] font-bold text-[#1F2937]">Como resolvemos:</h3>
              <p className="whitespace-pre-wrap rounded-xl bg-[#F0FDF4] p-4 text-[14px] leading-relaxed text-[#14532D]">
                {o.parecerFinal || "Não registrado."}
              </p>
            </section>
          </div>

          <p className="border-t border-[#E2E8F0] pt-4 text-[14px] text-[#475569]">
            Encerrado por{" "}
            <strong className="text-[#1F2937]">
              {eventos.filter((e) => e.acao === "Encerramento").slice(-1)[0]?.autorNome ||
                "a Qualidade"}
            </strong>{" "}
            — Obrigado pelo registro, ele ajudou a melhorar o processo.
          </p>
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
    "plano de ação",
  ];
  const normalizada = acao.toLowerCase();
  return visiveis.some((v) => normalizada.includes(v));
}
