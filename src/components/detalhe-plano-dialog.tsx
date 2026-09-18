import { useEffect, useState } from "react";
import { Pause, Paperclip, Play, Plus, TrainFront, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent } from "@/components/ui/select";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import { MARCOS_PROGRESSO, STATUS_ACAO_LABELS, formatarPrazo, formatarTempo, progressoDoChecklist, tempoTotalSegundos } from "@/lib/planos";
import { sugerirStatusPorProgresso } from "@/lib/planos";
import type { AnexoPlano, ItemChecklist, PlanoAcao, StatusAcao } from "@/lib/planos";
import { ConfirmarDialog, type ConfirmarDialogProps } from "@/components/confirmar-dialog";
import { atualizarPlano, excluirPlano } from "@/lib/planos-crud";
import { adicionarComentario, ehResponsavel } from "@/lib/planos-inter";
import { listarComentarios, listarHistorico } from "@/lib/planos-inter";
import { podeExcluirPlano } from "@/lib/permissoes";
import type { ComentarioPlano, HistoricoPlano } from "@/lib/planos";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import { StatusBadge } from "@/components/plano-badges";

interface Props {
  plano: PlanoAcao; podeGerenciar: boolean;
  onFechar: () => void; onAlterado: (p: PlanoAcao) => void; onExcluido: () => void;
}
export function DetalhePlanoDialog({ plano, podeGerenciar, onFechar, onAlterado, onExcluido }: Props) {
  const sessao = getSession();
  const possoEditar = podeGerenciar || ehResponsavel(plano, sessao);
  const [status, setStatus] = useState<StatusAcao>(plano.status);
  const [progresso, setProgresso] = useState(plano.progresso);
  const [checklist, setChecklist] = useState<ItemChecklist[]>(plano.checklist);
  const [novoItem, setNovoItem] = useState("");
  const [tempoSegundos, setTempoSegundos] = useState(plano.tempoSegundos);
  const [timerInicio, setTimerInicio] = useState<string | null>(plano.timerInicio);
  const [tick, setTick] = useState(0);
  const [comentarios, setComentarios] = useState<ComentarioPlano[]>([]);
  const [historico, setHistorico] = useState<HistoricoPlano[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [anexos, setAnexos] = useState<AnexoPlano[]>(plano.anexos);
  const [novoAnexoNome, setNovoAnexoNome] = useState("");
  const [novoAnexoUrl, setNovoAnexoUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState<ConfirmarDialogProps | null>(null);

  useEffect(() => {
    setStatus(plano.status);
    setProgresso(plano.progresso);
    setChecklist(plano.checklist);
    setTempoSegundos(plano.tempoSegundos);
    setTimerInicio(plano.timerInicio);
    setAnexos(plano.anexos);
    let ativo = true;
    Promise.all([listarComentarios(plano.id), listarHistorico(plano.id)])
      .then(([c, h]) => { if (ativo) { setComentarios(c); setHistorico(h); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [plano.id]);

  // Cronômetro ao vivo: re-renderiza a cada segundo enquanto estiver em execução.
  useEffect(() => {
    if (!timerInicio) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerInicio]);

  /** Progresso exibido: automático pelo checklist; sem itens, usa o manual. */
  const progressoExibido = checklist.length > 0 ? progressoDoChecklist(checklist) : progresso;
  const segundosAoVivo = tempoTotalSegundos(tempoSegundos, timerInicio);
  void tick; // força re-render a cada segundo com o timer rodando

  /** Salva o checklist recalculando progresso e status automaticamente. */
  async function salvarChecklist(lista: ItemChecklist[]) {
    if (!possoEditar) return;
    const novoProgresso = progressoDoChecklist(lista);
    const novoStatus = lista.length > 0 ? sugerirStatusPorProgresso(novoProgresso, status) : status;
    if (novoProgresso >= 100 && status !== "concluida") {
      setConfirmar({
        open: true, tom: "success", onOpenChange: (aberto) => (!aberto ? setConfirmar(null) : undefined),
        titulo: "Plano de ação concluído!",
        descricao: `Todos os itens foram feitos. O progresso vai para 100% e o status muda para “Concluído”. O responsável e os seguidores serão notificados.`,
        textoConfirmar: "Concluir ação",
        onConfirmar: () => void gravarChecklist(lista, novoProgresso, novoStatus),
      });
      return;
    }
    await gravarChecklist(lista, novoProgresso, novoStatus);
  }

  async function gravarChecklist(lista: ItemChecklist[], novoProgresso: number, novoStatus: StatusAcao) {
    setConfirmar(null);
    setChecklist(lista);
    setProgresso(novoProgresso);
    setStatus(novoStatus);
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await atualizarPlano(plano, { checklist: lista, progresso: novoProgresso, status: novoStatus }, sessao);
      onAlterado(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o checklist.");
    } finally {
      setSalvando(false);
    }
  }

  function adicionarItem() {
    const texto = novoItem.trim();
    if (!texto) return;
    setNovoItem("");
    void salvarChecklist([...checklist, { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, texto, feito: false }]);
  }

  function alternarItem(id: string) {
    void salvarChecklist(checklist.map((i) => (i.id === id ? { ...i, feito: !i.feito } : i)));
  }

  function removerItem(id: string) {
    void salvarChecklist(checklist.filter((i) => i.id !== id));
  }

  /** Inicia o cronômetro (guarda o instante de início). */
  async function iniciarTimer() {
    if (!possoEditar || timerInicio) return;
    const inicio = new Date().toISOString();
    setTimerInicio(inicio);
    setSalvando(true);
    setErro("");
    try {
      await atualizarPlano(plano, { timerInicio: inicio }, sessao);
    } catch (e) {
      setTimerInicio(null);
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o tempo.");
    } finally {
      setSalvando(false);
    }
  }

  /** Pausa o cronômetro: acumula o tempo decorrido no total salvo. */
  async function pausarTimer() {
    if (!possoEditar || !timerInicio) return;
    const total = tempoTotalSegundos(tempoSegundos, timerInicio);
    setTempoSegundos(total);
    setTimerInicio(null);
    setSalvando(true);
    setErro("");
    try {
      await atualizarPlano(plano, { tempoSegundos: total, timerInicio: null }, sessao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pausar o tempo.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!possoEditar) return;
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await atualizarPlano(plano, { status, progresso }, sessao);
      onAlterado(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Marco de progresso: grava progresso + status sugerido de uma vez. */
  async function aplicarMarco(valor: number) {
    if (!possoEditar) return;
    const novoStatus = sugerirStatusPorProgresso(valor, status);
    if (valor >= 100 && status !== "concluida") {
      setConfirmar({
        open: true, tom: "success", onOpenChange: (aberto) => (!aberto ? setConfirmar(null) : undefined),
        titulo: "Concluir esta ação?",
        descricao: `O progresso vai para 100% e o status muda para “Concluído”. O responsável e os seguidores serão notificados no sino do Painel.`,
        textoConfirmar: "Concluir ação",
        onConfirmar: () => void gravarMarco(valor, novoStatus),
      });
      return;
    }
    void gravarMarco(valor, novoStatus);
  }

  async function gravarMarco(valor: number, novoStatus: StatusAcao) {
    setConfirmar(null);
    setProgresso(valor);
    setStatus(novoStatus);
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await atualizarPlano(plano, { status: novoStatus, progresso: valor }, sessao);
      onAlterado(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Evidências: salva a lista de anexos da ação. */
  async function salvarAnexos(lista: AnexoPlano[]) {
    if (!possoEditar) return;
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await atualizarPlano(plano, { anexos: lista }, sessao);
      setAnexos(atualizado.anexos);
      onAlterado(atualizado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o anexo.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarAnexo() {
    const nome = novoAnexoNome.trim();
    const url = novoAnexoUrl.trim();
    if (!nome) {
      setErro("Informe o nome do anexo (ex.: evidência_foto.jpg).");
      return;
    }
    setNovoAnexoNome("");
    setNovoAnexoUrl("");
    const anexo: AnexoPlano = { nome };
    if (url) anexo.url = url;
    await salvarAnexos([...anexos, anexo]);
  }

  /** Remove um anexo das evidências (com confirmação, ver JSX). */
  async function removerAnexo(indice: number) {
    await salvarAnexos(anexos.filter((_, i) => i !== indice));
  }

  async function comentar() {
    if (!novoComentario.trim()) return;
    setSalvando(true);
    setErro("");
    try {
      const c = await adicionarComentario(plano, novoComentario, sessao);
      setComentarios((atual) => [...atual, c]);
      setNovoComentario("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível comentar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!podeExcluirPlano(sessao)) return;
    setConfirmar({
      open: true, tom: "danger", onOpenChange: (aberto) => (!aberto ? setConfirmar(null) : undefined),
      titulo: `Excluir ${plano.codigo || "esta ação"}?`,
      descricao: (
        <>
          <span className="block font-medium text-[#334155]">{plano.titulo}</span>
          A ação, seus comentários, anexos e o histórico de alterações serão
          <span className="font-medium text-rose-600"> apagados permanentemente</span>.
          O responsável e os seguidores perdem o acesso a ela. Esta ação não pode ser desfeita.
        </>
      ),
      textoConfirmar: "Excluir definitivamente",
      onConfirmar: () => void executarExclusao(),
    });
  }

  async function executarExclusao() {
    setConfirmar(null);
    try {
      await excluirPlano(plano.id);
      onExcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }
  return (
    <>
      <Dialog open onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
        <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-[11px] text-[#94A3B8]">
              {plano.codigo || "—"} · {plano.setor} · {plano.origem}
            </span>
            <span className="mt-1 block text-lg font-semibold">{plano.titulo}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={plano.status} />
            <span className="text-[12px] text-[#64748B]">Prazo {formatarPrazo(plano.prazo)}</span>
            <span className="text-[12px] text-[#64748B]">· {plano.progresso}%</span>
            <span className="text-[12px] text-[#64748B]">· {plano.responsavelNome}</span>
            {!possoEditar && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                Somente leitura (seguidor)
              </span>
            )}
          </div>
          {plano.detalhamento ? (
            <p className="whitespace-pre-wrap text-[14px] text-[#334155]">{plano.detalhamento}</p>
          ) : null}
          {plano.vinculoId ? (
            <p className="text-[12px] text-[#64748B]">Vinculado a: {plano.vinculoId}</p>
          ) : null}
          {possoEditar ? (
            <div className="space-y-3 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-3">
              {/* Linha de trem: progresso automático pelo checklist */}
              <div className="flex items-center justify-between">
                <Label className="text-[12px]">Progresso da ação</Label>
                <span className="text-[12px] font-semibold text-[#4F46E5]">
                  {progressoExibido}%{checklist.length > 0 ? ` (${checklist.filter((i) => i.feito).length}/${checklist.length} itens)` : ""}
                </span>
              </div>
              <div className="relative h-8 pr-2">
                {/* Trilho com dormentes */}
                <div className="absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 overflow-hidden rounded-full border border-[#D9E0EA] bg-[#FFFFFF]">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent 0px, transparent 9px, rgba(100,116,139,0.30) 9px, rgba(100,116,139,0.30) 12px)",
                    }}
                  />
                  {/* Trilho já percorrido */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#4F46E5]/45 to-[#7C3AED]/60 transition-[width] duration-500"
                    style={{ width: `${progressoExibido}%` }}
                  />
                </div>
                {/* Locomotiva na posição do progresso */}
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500"
                  style={{ left: `${progressoExibido}%` }}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm ${progressoExibido >= 100 ? "border-emerald-500" : "border-[#4F46E5]"}`}>
                    <TrainFront className={`h-4 w-4 ${progressoExibido >= 100 ? "text-emerald-600" : "text-[#4F46E5]"}`} />
                  </span>
                </div>
                {/* Estação final (100%) */}
                <span
                  className={`absolute right-0 top-1/2 z-0 h-3.5 w-1.5 -translate-y-1/2 rounded-sm ${progressoExibido >= 100 ? "bg-emerald-500" : "bg-[#D9E0EA]"}`}
                />
              </div>
              {/* Fallback: sem itens no checklist, mantém os marcos manuais */}
              {checklist.length === 0 ? (
                <div className="flex flex-wrap gap-1">
                  {MARCOS_PROGRESSO.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => void aplicarMarco(m)}
                      disabled={salvando}
                      className="rounded-full border border-[#D9E0EA] px-2 py-0.5 text-[11px] font-medium text-[#64748B] transition hover:border-[#4F46E5] hover:text-[#4F46E5] disabled:opacity-50"
                    >
                      {m}%
                    </button>
                  ))}
                  <span className="self-center pl-1 text-[11px] text-[#94A3B8]">
                    Adicione itens ao plano de ação abaixo para o progresso virar automático.
                  </span>
                </div>
              ) : null}
              {/* Status + ações */}
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as StatusAcao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_ACAO_LABELS) as StatusAcao[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_ACAO_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? "Salvando…" : "Salvar"}
                  </Button>
                  {podeExcluirPlano(sessao) ? (
                    <Button size="sm" variant="outline" onClick={() => void excluir()}>Excluir</Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {/* Checklist do plano de ação — marca o que já foi feito */}
          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#1F2937]">Plano de ação ({checklist.length})</p>
            {checklist.length > 0 ? (
              <ul className="space-y-1.5">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-[#E9EEF5] px-3 py-2">
                    <input
                      type="checkbox"
                      id={`check-${item.id}`}
                      checked={item.feito}
                      onChange={() => alternarItem(item.id)}
                      disabled={!possoEditar || salvando}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-[#4F46E5] disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor={`check-${item.id}`}
                      className={`min-w-0 flex-1 cursor-pointer truncate text-[13px] ${item.feito ? "text-[#94A3B8] line-through" : "text-[#334155]"} ${possoEditar ? "" : "cursor-default"}`}
                    >
                      {item.texto}
                    </label>
                    {possoEditar ? (
                      <button
                        type="button"
                        aria-label={`Remover ${item.texto}`}
                        onClick={() => removerItem(item.id)}
                        disabled={salvando}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#E11D48] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#94A3B8]">
                Nenhum item cadastrado. Cada item marcado como feito sobe o progresso automaticamente.
              </p>
            )}
            {possoEditar ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarItem(); } }}
                  placeholder="Novo item do plano de ação (ex.: revisar procedimento)"
                />
                <Button variant="outline" onClick={adicionarItem} disabled={salvando || !novoItem.trim()}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            ) : null}
          </div>
          {/* Controle de tempo — Iniciar / Pausar */}
          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#1F2937]">Tempo</p>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E9EEF5] px-3 py-2">
              <span className={`font-mono text-[18px] tabular-nums ${timerInicio ? "text-[#4F46E5]" : "text-[#334155]"}`}>
                {formatarTempo(segundosAoVivo)}
              </span>
              {timerInicio ? (
                <span className="flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#4F46E5]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4F46E5] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4F46E5]" />
                  </span>
                  Executando
                </span>
              ) : null}
              {possoEditar ? (
                timerInicio ? (
                  <Button size="sm" variant="outline" onClick={() => void pausarTimer()} disabled={salvando}>
                    <Pause className="h-4 w-4" /> Pausar
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void iniciarTimer()} disabled={salvando || progressoExibido >= 100}>
                    <Play className="h-4 w-4" /> Iniciar
                  </Button>
                )
              ) : null}
              <span className="text-[11px] text-[#94A3B8]">Tempo total registrado nesta ação.</span>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#1F2937]">Comentários ({comentarios.length})</p>
            {comentarios.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">Nenhum comentário ainda.</p>
            ) : (
              <ul className="space-y-2">
                {comentarios.map((c) => (
                  <li key={c.id} className="rounded-xl border border-[#E9EEF5] p-3">
                    <p className="text-[12px] font-semibold text-[#1F2937]">
                      {c.autorNome || "Usuário"}
                      <span className="ml-2 font-normal text-[#94A3B8]">
                        {c.createdAt ? formatarDataHoraBrasilia(c.createdAt) : ""}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#334155]">{c.mensagem}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <Textarea value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Escrever comentário…" className="min-h-[44px]" />
              <Button onClick={() => void comentar()} disabled={!novoComentario.trim() || salvando}>Enviar</Button>
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]">
              <Paperclip className="h-3.5 w-3.5" /> Anexos / evidências ({anexos.length})
            </p>
            {anexos.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">Nenhuma evidência anexada.</p>
            ) : (
              <ul className="space-y-1.5">
                {anexos.map((a, i) => (
                  <li key={`${a.nome}-${i}`} className="flex items-center gap-2 rounded-lg border border-[#E9EEF5] px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#334155]">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-[#4F46E5] hover:underline">
                          {a.nome}
                        </a>
                      ) : (
                        a.nome
                      )}
                    </span>
                    {possoEditar ? (
                      <button
                        type="button"
                        aria-label={`Remover ${a.nome}`}
                        onClick={() =>
                          setConfirmar({
                            open: true, tom: "warning",
                            onOpenChange: (aberto) => (!aberto ? setConfirmar(null) : undefined),
                            titulo: "Remover anexo?",
                            descricao: `“${a.nome}” será retirado das evidências desta ação.`,
                            textoConfirmar: "Remover anexo",
                            onConfirmar: () => void removerAnexo(i),
                          })
                        }
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#E11D48]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {possoEditar ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={novoAnexoNome} onChange={(e) => setNovoAnexoNome(e.target.value)}
                  placeholder="Nome do anexo" />
                <Input value={novoAnexoUrl} onChange={(e) => setNovoAnexoUrl(e.target.value)}
                  placeholder="Link do arquivo (opcional)" />
                <Button variant="outline" onClick={() => void adicionarAnexo()} disabled={salvando}>
                  Anexar
                </Button>
              </div>
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-[#1F2937]">Histórico ({historico.length})</p>
            {historico.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">Sem alterações registradas.</p>
            ) : (
              <ul className="space-y-1.5">
                {historico.map((h) => (
                  <li key={h.id} className="text-[12px] text-[#64748B]">
                    <span className="font-medium text-[#334155]">{h.autorNome || "Sistema"}</span>
                    {" · "}{h.campo}: {h.de || "—"} → <span className="font-medium">{h.para}</span>
                    <span className="text-[#94A3B8]"> · {h.createdAt ? formatarDataHoraBrasilia(h.createdAt) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {erro ? <p className="text-[13px] text-rose-600">{erro}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Cartão de confirmação (excluir, concluir, remover anexo…). */}
      {confirmar ? <ConfirmarDialog {...confirmar} /> : null}
    </>
  );
}