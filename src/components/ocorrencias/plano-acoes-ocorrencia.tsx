/**
 * Plano de ação da ocorrência (etapa 4). As ações são registros de Planos de Ação
 * vinculados à ocorrência (origem "Ocorrência"). Quem pode sugerir: a Qualidade e a
 * liderança do setor de quem abriu. Sugestões do líder aguardam validação da Qualidade.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { UserSession } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import { atualizarPlano, criarPlano } from "@/lib/planos-crud";
import { listarPlanos } from "@/lib/planos-base";
import { listarHistorico } from "@/lib/planos-inter";
import { formatarPrazo, prazoBrParaISO, STATUS_ACAO_LABELS, type PlanoAcao } from "@/lib/planos";
import type { Ocorrencia } from "@/lib/ocorrencias";
import { NIVEL_LIDER_SETOR } from "@/lib/niveis-acesso";
import { traduzErro } from "@/lib/organizacao";

const ORIGEM_OCORRENCIA = "Ocorrência";

interface PlanoAcoesOcorrenciaProps {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  colaboradores: Colaborador[];
  podeSugerir: boolean;
  podeValidar: boolean;
}

/** Quem criou a ação e quando (primeiro registro do histórico do plano). */
interface SugestaoLider {
  plano: PlanoAcao;
  autorNome: string;
  criadaEm: string;
}

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase();
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function PlanoAcoesOcorrencia({
  ocorrencia: o,
  session,
  colaboradores,
  podeSugerir,
  podeValidar,
}: PlanoAcoesOcorrenciaProps) {
  const [acoes, setAcoes] = useState<PlanoAcao[]>([]);
  const [sugestoesLider, setSugestoesLider] = useState<SugestaoLider[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Resumo do que foi sugerido, mostrado no modal depois do envio.
  const [enviada, setEnviada] = useState<{ titulo: string; responsavel: string; prazo: string; motivo: string; validacao: boolean } | null>(null);

  async function carregar() {
    try {
      const todos = await listarPlanos();
      const desta = todos.filter((p) => p.vinculoTipo === "ocorrencia" && p.vinculoId === o.id);
      setAcoes(desta);
      // Autor de cada ação: o registro "Criação" do histórico. Mostra só quem é líder de setor.
      const sugestoes: SugestaoLider[] = [];
      for (const plano of desta) {
        const historico = await listarHistorico(plano.id);
        const criacao = historico.find((h) => h.campo === "Criação");
        if (!criacao) continue;
        const autor = colaboradores.find(
          (c) => (c.email ?? "").toLowerCase() === criacao.autorEmail.toLowerCase(),
        );
        const ehLider = autor?.nivelAcesso === NIVEL_LIDER_SETOR;
        if (ehLider) {
          sugestoes.push({ plano, autorNome: criacao.autorNome, criadaEm: criacao.createdAt });
        }
      }
      setSugestoesLider(sugestoes);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id, colaboradores.length]);

  function fecharModal() {
    setModalAberto(false);
    setEnviada(null);
    setTitulo("");
    setResponsavelId("");
    setPrazo("");
    setMotivo("");
  }

  async function sugerir() {
    const responsavel = colaboradores.find((c) => c.id === responsavelId);
    const prazoIso = prazoBrParaISO(prazo);
    if (!titulo.trim()) {
      toast.error("Informe o que fazer.");
      return;
    }
    if (!responsavel) {
      toast.error("Escolha o responsável.");
      return;
    }
    if (!prazoIso) {
      toast.error("Informe um prazo válido (dd/mm/aaaa).");
      return;
    }
    setSalvando(true);
    try {
      const criada = await criarPlano(
        {
          titulo: titulo.trim(),
          descricao: motivo.trim(),
          origem: ORIGEM_OCORRENCIA,
          origemOutros: o.numero,
          setor: o.abertaPorSetor || "Qualidade",
          prioridade: "Média",
          responsavelId: responsavel.id,
          responsavelNome: responsavel.nome,
          responsavelEmail: responsavel.email ?? "",
          seguidoresIds: [],
          seguidoresEmails: [],
          prazo: prazoIso,
          vinculoTipo: "ocorrencia",
          vinculoId: o.id,
        },
        session,
      );
      // Sugestão da Qualidade já entra aberta; a do líder fica como "nao_iniciado" até validação.
      if (podeValidar) await atualizarPlano(criada, { status: "aberta" }, session);
      setEnviada({
        titulo: titulo.trim(),
        responsavel: responsavel.nome,
        prazo: formatarPrazo(prazoIso),
        motivo: motivo.trim(),
        validacao: !podeValidar,
      });
      await carregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function validar(plano: PlanoAcao) {
    try {
      await atualizarPlano(plano, { status: "aberta" }, session);
      toast.success("Ação validada pela Qualidade.");
      await carregar();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  return (
    <>
      <section className="space-y-4 rounded-xl border border-[#D9E0EA] bg-white p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E3A8A]">
            Plano de ação
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#64748B]">A Qualidade valida e encaminha as ações</span>
            {podeSugerir && (
              <Button
                type="button"
                size="sm"
                onClick={() => setModalAberto(true)}
                className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              >
                + Sugerir ação
              </Button>
            )}
          </div>
        </header>

        {carregando ? (
          <p className="text-[13px] text-[#94A3B8]">Carregando ações…</p>
        ) : acoes.length === 0 ? (
          <p className="text-[13px] text-[#94A3B8]">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-[#E9EEF5] rounded-lg border border-[#E9EEF5]">
            {acoes.map((a) => {
              const sugestaoDoLider = a.status === "nao_iniciado";
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[#1F2937]">{a.titulo}</span>
                    <span className="text-[12px] text-[#64748B]">
                      {a.responsavelNome || "Sem responsável"} · {formatarPrazo(a.prazo)} ·{" "}
                      {STATUS_ACAO_LABELS[a.status]}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      sugestaoDoLider ? "bg-[#EDE9FE] text-[#6D28D9]" : "bg-[#FEF3C7] text-[#92400E]"
                    }`}
                  >
                    {sugestaoDoLider ? "Sugestão do líder" : "Qualidade"}
                  </span>
                  {sugestaoDoLider && podeValidar && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void validar(a)}>
                      Validar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {sugestoesLider.length > 0 && (
          <div className="space-y-3 rounded-xl border border-[#DDD6FE] bg-[#FAF5FF] p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D28D9]">
              Sugestões do líder do setor
            </h4>
            <ul className="space-y-2">
              {sugestoesLider.map((s) => (
                <li key={s.plano.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6D28D9] text-[13px] font-bold text-white"
                  >
                    {iniciais(s.autorNome)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#1F2937]">{s.autorNome}</span>
                    <span className="block text-[12px] text-[#64748B]">
                      Publicado em {dataHora(s.criadaEm)}
                    </span>
                    <span className="mt-1 block text-[13px] text-[#334155]">{s.plano.titulo}</span>
                    <span className="block text-[12px] text-[#64748B]">
                      Responsável: {s.plano.responsavelNome || "—"} · Prazo: {formatarPrazo(s.plano.prazo)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Dialog open={modalAberto} onOpenChange={(a) => !a && fecharModal()}>
        <DialogContent className="max-w-lg">
          {enviada ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {enviada.validacao ? "Sugestão enviada" : "Ação criada"}
                </DialogTitle>
                <DialogDescription>
                  {enviada.validacao
                    ? "A Qualidade vai validar e encaminhar esta sugestão."
                    : "A ação foi registrada no plano desta ocorrência."}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 rounded-lg bg-[#F8FAFC] p-4 text-[13px]">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">O que fazer</dt>
                  <dd className="text-[#1F2937]">{enviada.titulo}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Responsável</dt>
                  <dd className="text-[#1F2937]">{enviada.responsavel}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Prazo</dt>
                  <dd className="text-[#1F2937]">{enviada.prazo}</dd>
                </div>
                {enviada.motivo && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Por quê / como</dt>
                    <dd className="whitespace-pre-wrap text-[#1F2937]">{enviada.motivo}</dd>
                  </div>
                )}
              </dl>
              <DialogFooter>
                <Button type="button" onClick={fecharModal}>Fechar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Sugerir ação</DialogTitle>
                <DialogDescription>
                  Descreva o que deve ser feito nesta ocorrência.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">O que fazer</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: treinar equipe contábil" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Responsável</Label>
                    <Select value={responsavelId} onValueChange={setResponsavelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradores.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Prazo</Label>
                    <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="dd/mm/aaaa" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Por quê / como (opcional)</Label>
                  <Textarea
                    className="min-h-[90px]"
                    maxLength={12000}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Explique o motivo ou como a ação será feita…"
                  />
                  <p className="text-right text-[11px] text-[#94A3B8]">{motivo.length}/12000 caracteres</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={fecharModal}>Cancelar</Button>
                <Button
                  type="button"
                  disabled={salvando}
                  onClick={() => void sugerir()}
                  className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                >
                  {salvando ? "Enviando…" : "Enviar sugestão"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
