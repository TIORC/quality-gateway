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

import { MetroLinha } from "@/components/ocorrencias/metro-linha";
import { FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  agirNaOcorrencia,
  avaliarEficacia,
  carregarFluxoAtivo,
  carregarFormularioAtivo,
  comentarOcorrencia,
  decidirProcedencia,
  enviarAnexo,
  moverPara,
} from "@/lib/ocorrencias-crud";
import { listarHistorico, listarOcorrencias } from "@/lib/ocorrencias-base";
import {
  podeAgir,
  podeComentar,
  podeGerenciar,
  podeVerInternos,
  papelNaOcorrencia,
  veVisaoCompleta,
} from "@/lib/ocorrencias-permissoes";
import { traduzErro } from "@/lib/organizacao";
import {
  ACOES_ETAPA_LABELS,
  MACRO_ETAPA_LABELS,
  PROCEDENCIA_LABELS,
  STATUS_OCORRENCIA_LABELS,
  formatarPrazo,
  ordenarSubetapas,
  subetapaDe,
  textoResposta,
  type AcaoEtapa,
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

  // Avaliação de eficácia (diálogo da Qualidade).
  const [avaliacaoAberta, setAvaliacaoAberta] = useState(false);
  const [prazoDias, setPrazoDias] = useState(30);
  const [eficaz, setEficaz] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);

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
        setEtapaRespostas(o.respostas[`__etapa_${o.macroAtual}_${o.subetapaAtualId}`] ?? {});
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
  const acoes = o.status === "encerrada" ? [] : (subEtapa?.acoes ?? []);
  const pode = podeAgir(session, o);
  const gerencia = podeGerenciar(session);
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
        atualizada.respostas[`__etapa_${atualizada.macroAtual}_${atualizada.subetapaAtualId}`] ??
          {},
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

  async function confirmarAvaliacao() {
    setSalvandoAvaliacao(true);
    try {
      await avaliarEficacia(
        o,
        etapas,
        { eficaz, observacao: observacao.trim(), prazoDias },
        session,
      );
      toast.success(eficaz ? "Eficácia confirmada." : "Ocorrência reaberta por ineficácia.");
      setAvaliacaoAberta(false);
      await recarregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvandoAvaliacao(false);
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
              Reaberta {o.reaberturas}×
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
          <MetroLinha ocorrencia={o} etapas={etapas} eventos={eventos} visao={visao} />

          {mostraAbertura && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Dados da abertura
              </h3>
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                {formulario.length > 0 ? (
                  formulario.map((c) => (
                    <div key={c.id}>
                      <dt className="text-[11px] text-[#94A3B8]">{c.label}</dt>
                      <dd className="text-[#334155]">{textoResposta(o.respostas[c.id])}</dd>
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
                    {MACRO_ETAPA_LABELS[o.macroAtual]}
                    {o.subetapaAtualNome ? ` › ${o.subetapaAtualNome}` : ""}
                    {o.prazoEtapa ? ` · prazo ${formatarPrazo(o.prazoEtapa)}` : ""}
                  </dd>
                </div>
              </dl>
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
                placeholder="Observação da ação (opcional)…"
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

          {gerencia && (
            <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Gestão (Qualidade)
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-2">
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
                            {MACRO_ETAPA_LABELS[macro]} › {subetapa.nome}
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
                      setPrazoDias(30);
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
        <Button type="button" variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </DialogFooter>

      <Dialog open={avaliacaoAberta} onOpenChange={(a) => !a && setAvaliacaoAberta(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Avaliar eficácia</DialogTitle>
            <DialogDescription>
              {eficaz
                ? "Confirmar que a ação resolveu o problema e manter a ocorrência encerrada."
                : "Ineficaz reabre a ocorrência automaticamente em Apuração (conta como reincidência)."}
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
              <Label className="text-[13px]">Verificação após</Label>
              <Select value={String(prazoDias)} onValueChange={(v) => setPrazoDias(Number(v))}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
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
  const visiveis = ["criação", "encerramento", "atraso", "reabert", "escalad", "julgamento"];
  const normalizada = acao.toLowerCase();
  return visiveis.some((v) => normalizada.includes(v));
}
