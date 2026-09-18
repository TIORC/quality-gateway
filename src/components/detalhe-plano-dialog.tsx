import { useEffect, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent } from "@/components/ui/select";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import { MARCOS_PROGRESSO, STATUS_ACAO_LABELS, formatarPrazo } from "@/lib/planos";
import { sugerirStatusPorProgresso } from "@/lib/planos";
import type { AnexoPlano, PlanoAcao, StatusAcao } from "@/lib/planos";
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
  const [comentarios, setComentarios] = useState<ComentarioPlano[]>([]);
  const [historico, setHistorico] = useState<HistoricoPlano[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [anexos, setAnexos] = useState<AnexoPlano[]>(plano.anexos);
  const [novoAnexoNome, setNovoAnexoNome] = useState("");
  const [novoAnexoUrl, setNovoAnexoUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setStatus(plano.status);
    setProgresso(plano.progresso);
    setAnexos(plano.anexos);
    let ativo = true;
    Promise.all([listarComentarios(plano.id), listarHistorico(plano.id)])
      .then(([c, h]) => { if (ativo) { setComentarios(c); setHistorico(h); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [plano.id]);

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
    if (!window.confirm(`Excluir ${plano.codigo || "esta ação"}?`)) return;
    try {
      await excluirPlano(plano.id);
      onExcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }
  return (
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
            <div className="grid gap-3 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-3 sm:grid-cols-[1fr_140px_auto]">
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
              <div className="space-y-1.5">
                <Label className="text-[12px]">Progresso %</Label>
                <Input type="number" min={0} max={100} value={progresso}
                  onChange={(e) => setProgresso(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
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
                </div>
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
          ) : null}
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
                        onClick={() => void salvarAnexos(anexos.filter((_, idx) => idx !== i))}
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
  );
}