import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Building2, CalendarDays, Check, RotateCcw, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { getSession } from "@/lib/auth";
import type { Ata, AtaAcao, AtaSetorCitado, StatusSugestaoAcao, TipoReuniao } from "@/lib/atas";
import { ORIGEM_ATA_LABELS, STATUS_ATA_LABELS, STATUS_SUGESTAO_ACAO_LABELS } from "@/lib/atas";
import {
  listarAcoesDaAta,
  listarSetoresCitadosDaAta,
  listarUsuariosDasAtas,
  type UsuarioAtaRow,
} from "@/lib/atas-base";
import type { PlanoAcao } from "@/lib/planos";
import { listarPlanos } from "@/lib/planos-base";
import { mudarStatusAcaoAta, salvarLeituraAssistida } from "@/lib/atas-crud";
import {
  gerarLeituraAssistida,
  type AcaoSugeridaAta,
  type SetorCitadoSugerido,
} from "@/lib/atas-ia";
import { carregarSetoresECargos, traduzErro, type SetorConfig } from "@/lib/organizacao";
import { podeEditarAta } from "@/lib/permissoes";

interface Props {
  aberto: boolean;
  ata: Ata | null;
  tipo: TipoReuniao | null;
  usuarioId: string | null;
  sessao: ReturnType<typeof getSession>;
  onFechar: () => void;
}

const CORES_SUGESTAO: Record<StatusSugestaoAcao, string> = {
  sugerida: "bg-[#FEF3C7] text-[#B45309]",
  confirmada: "bg-[#ECFDF3] text-[#047857]",
  descartada: "bg-[#F1F5F9] text-[#64748B]",
};

function dataBonita(valor: string | null): string {
  if (!valor) return "—";
  try {
    return format(parseISO(valor), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

export function AtaLeituraDialog({ aberto, ata, tipo, usuarioId, sessao, onFechar }: Props) {
  const catalogo = useCatalogoOrganizacional();
  const podeEditar = podeEditarAta(sessao, ata, tipo, usuarioId);

  const [setoresCfg, setSetoresCfg] = useState<SetorConfig[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAtaRow[]>([]);
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [citados, setCitados] = useState<AtaSetorCitado[]>([]);
  const [acoes, setAcoes] = useState<AtaAcao[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [editando, setEditando] = useState(false);
  const [citadosPropostos, setCitadosPropostos] = useState<SetorCitadoSugerido[]>([]);
  const [acoesPropostas, setAcoesPropostas] = useState<AcaoSugeridaAta[]>([]);
  const [incluidas, setIncluidas] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const nomePorId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const s of setoresCfg) mapa.set(s.id, s.nome);
    return mapa;
  }, [setoresCfg]);

  const usuarioPorId = useMemo(() => {
    const mapa = new Map<string, (typeof usuarios)[number]>();
    for (const u of usuarios) mapa.set(u.id, u);
    return mapa;
  }, [usuarios]);

  const planoPorId = useMemo(() => {
    const mapa = new Map<string, PlanoAcao>();
    for (const p of planos) mapa.set(p.id, p);
    return mapa;
  }, [planos]);

  const recarregarDetalhes = useCallback(async () => {
    if (!ata) return;
    setCarregando(true);
    try {
      const [c, a] = await Promise.all([
        listarSetoresCitadosDaAta(ata.id),
        listarAcoesDaAta(ata.id),
      ]);
      setCitados(c);
      setAcoes(a);
      // Planos de ação vinculados (badge do plano na ação confirmada).
      listarPlanos()
        .then((lista) => setPlanos(lista))
        .catch(() => setPlanos([]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar a ata.");
    } finally {
      setCarregando(false);
    }
  }, [ata]);

  useEffect(() => {
    if (!aberto || !ata) return;
    setEditando(false);
    setCitadosPropostos([]);
    setAcoesPropostas([]);
    setIncluidas(new Set());
    void recarregarDetalhes();
  }, [aberto, ata, recarregarDetalhes]);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    carregarSetoresECargos()
      .then((lista) => {
        if (ativo) setSetoresCfg(lista);
      })
      .catch(() => {
        if (ativo) setSetoresCfg([]);
      });
    listarUsuariosDasAtas()
      .then((lista) => {
        if (ativo) setUsuarios(lista);
      })
      .catch(() => {
        if (ativo) setUsuarios([]);
      });
    return () => {
      ativo = false;
    };
  }, [aberto]);

  function gerarSugestoes() {
    if (!ata || !ata.texto.trim() || setoresCfg.length === 0) return;
    const resultado = gerarLeituraAssistida(
      ata.texto,
      setoresCfg.map((s) => s.nome),
    );
    const acoes = resultado.acoesSugeridas.map((acao) => ({
      ...acao,
      setorDestino: acao.setorDestino ?? "",
    }));
    setCitadosPropostos(resultado.setoresCitados);
    setAcoesPropostas(acoes);
    setIncluidas(
      new Set(acoes.map((acao, i) => (acao.setorDestino ? i : -1)).filter((i) => i >= 0)),
    );
    setEditando(true);
  }

  function editarAcaoProposta(idx: number, patch: Partial<AcaoSugeridaAta>) {
    setAcoesPropostas((atual) =>
      atual.map((acao, i) => (i === idx ? { ...acao, ...patch } : acao)),
    );
  }

  function alternarIncluida(idx: number) {
    setIncluidas((atual) => {
      const prox = new Set(atual);
      if (prox.has(idx)) prox.delete(idx);
      else prox.add(idx);
      return prox;
    });
  }

  async function salvarLeitura() {
    if (!ata || salvando) return;
    const escolhidas = acoesPropostas
      .map((acao, idx) => ({ acao, idx }))
      .filter(({ idx }) => incluidas.has(idx))
      .map(({ acao }) => acao);
    for (const acao of escolhidas) {
      const setorDestino = (acao.setorDestino ?? "").trim();
      if (!acao.descricao.trim()) {
        toast.error("Preencha a descrição das ações incluídas.");
        return;
      }
      if (!setorDestino) {
        toast.error("Escolha o setor destino de cada ação incluída.");
        return;
      }
    }
    if (escolhidas.length === 0 && citadosPropostos.length === 0) {
      toast.error("Nenhum setor citado ou ação para salvar.");
      return;
    }
    setSalvando(true);
    try {
      await salvarLeituraAssistida(
        ata.id,
        {
          setores: citadosPropostos,
          acoes: escolhidas.map((acao) => {
            const responsavel = (acao.responsavelEmail ?? "").trim();
            return {
              trechoOrigem: acao.trechoOrigem,
              descricao: acao.descricao.trim(),
              setorDestino: (acao.setorDestino ?? "").trim(),
              responsavelEmail: responsavel || null,
              prazo: acao.prazo || null,
            };
          }),
        },
        sessao,
      );
      toast.success("Leitura assistida salva.");
      setEditando(false);
      await recarregarDetalhes();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatusAcao(acaoId: string, status: StatusSugestaoAcao) {
    if (!ata) return;
    try {
      await mudarStatusAcaoAta(acaoId, status, sessao);
      await recarregarDetalhes();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  const temColaboradores = catalogo.colaboradores.some((c) => (c.email ?? "").trim());

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ata?.titulo ?? "Ata de reunião"}</DialogTitle>
          <DialogDescription>
            {ata
              ? `${dataBonita(ata.dataReuniao)} · ${ORIGEM_ATA_LABELS[ata.origem]} · ${
                  STATUS_ATA_LABELS[ata.status]
                }`
              : "Leitura da ata, setores citados e ações geradas."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Texto da ata -------------------------------------------------- */}
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              <Building2 className="h-3.5 w-3.5" />
              Texto da ata
            </h3>
            <div className="rounded-xl border border-[#E9EEF5] bg-[#FAFBFD] px-4 py-3">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#334155]">
                {ata?.texto.trim() ? ata.texto.trim() : "Nenhum texto registrado nesta ata."}
              </p>
            </div>
          </section>

          {carregando && (citados.length === 0 || acoes.length === 0) ? (
            <p className="rounded-xl border border-[#E9EEF5] px-4 py-6 text-center text-sm text-[#64748B]">
              Carregando…
            </p>
          ) : (
            <>
              {/* Setores citados (extrato por setor) -------------------------- */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  <Users className="h-3.5 w-3.5" />
                  Setores citados
                </h3>
                {citados.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#D9E0EA] px-4 py-3 text-[13px] text-[#94A3B8]">
                    Nenhum setor citado até o momento.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {citados.map((citado) => (
                      <li
                        key={citado.id}
                        className="rounded-xl border border-[#E9EEF5] px-3 py-2.5"
                      >
                        <span className="inline-flex items-center rounded-full bg-[#EEF2F7] px-2.5 py-0.5 text-[12px] font-semibold text-[#475569]">
                          {nomePorId.get(citado.setor) ?? citado.setor}
                        </span>
                        {citado.trecho ? (
                          <p className="mt-1.5 text-[12px] italic leading-relaxed text-[#64748B]">
                            “{citado.trecho}”
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Ações da ata ------------------------------------------------- */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  <Check className="h-3.5 w-3.5" />
                  Ações da ata
                </h3>
                {acoes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#D9E0EA] px-4 py-3 text-[13px] text-[#94A3B8]">
                    Nenhuma ação gerada até o momento.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {acoes.map((acao) => {
                      const responsavel = acao.responsavel
                        ? usuarioPorId.get(acao.responsavel)
                        : undefined;
                      return (
                        <li key={acao.id} className="rounded-xl border border-[#E9EEF5] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium leading-snug text-[#1F2937]">
                              {acao.descricao}
                            </p>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CORES_SUGESTAO[acao.statusSugestao]}`}
                            >
                              {STATUS_SUGESTAO_ACAO_LABELS[acao.statusSugestao]}
                            </span>
                          </div>
                          {acao.trechoOrigem ? (
                            <p className="mt-1 text-[12px] italic leading-relaxed text-[#64748B]">
                              “{acao.trechoOrigem}”
                            </p>
                          ) : null}
                          {acao.planoAcaoId ? (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E0E7FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#4338CA]">
                              <Check className="h-3 w-3" />
                              Plano de ação:{" "}
                              {planoPorId.get(acao.planoAcaoId)?.codigo ?? "vinculado"}
                            </span>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#475569]">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-[#94A3B8]" />
                              {nomePorId.get(acao.setorDestino) ?? acao.setorDestino}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3 text-[#94A3B8]" />
                              {responsavel?.nome ?? "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-[#94A3B8]" />
                              {dataBonita(acao.prazo)}
                            </span>
                          </div>
                          {podeEditar ? (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#EEF2F7] pt-2.5">
                              {acao.statusSugestao === "sugerida" ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 gap-1 text-[12px]"
                                    onClick={() => void mudarStatusAcao(acao.id, "confirmada")}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Confirmar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-[12px] text-[#B91C1C]"
                                    onClick={() => void mudarStatusAcao(acao.id, "descartada")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Descartar
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 text-[12px]"
                                  onClick={() => void mudarStatusAcao(acao.id, "sugerida")}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reabrir como sugestão
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* Leitura assistida ------------------------------------------------ */}
          {podeEditar && ata?.texto.trim() ? (
            <section className="rounded-2xl border border-[#E0E7FF] bg-[#F8FAFF] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]">
                  <Sparkles className="h-4 w-4 text-[#4F46E5]" />
                  Leitura assistida
                </h3>
                {!editando ? (
                  <Button type="button" size="sm" onClick={gerarSugestoes}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Gerar setores e ações
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={gerarSugestoes}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Gerar novamente
                  </Button>
                )}
              </div>

              {editando ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-[12px] font-medium text-[#475569]">
                      Setores citados ({citadosPropostos.length})
                    </Label>
                    {citadosPropostos.length === 0 ? (
                      <p className="mt-1 text-[12px] text-[#94A3B8]">
                        Nenhum setor do cadastro foi identificado no texto.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1.5">
                        {citadosPropostos.map((citado, idx) => (
                          <li
                            key={`${citado.setor}-${idx}`}
                            className="rounded-lg bg-white px-2.5 py-2"
                          >
                            <span className="inline-flex items-center rounded-full bg-[#E0E7FF] px-2.5 py-0.5 text-[12px] font-semibold text-[#4338CA]">
                              {citado.setor}
                            </span>
                            {citado.trecho ? (
                              <p className="mt-1 text-[12px] italic leading-relaxed text-[#64748B]">
                                “{citado.trecho}”
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <Label className="text-[12px] font-medium text-[#475569]">
                      Ações sugeridas ({acoesPropostas.length})
                    </Label>
                    <div className="mt-1.5 space-y-2">
                      {acoesPropostas.map((acao, idx) => (
                        <div key={idx} className="rounded-xl border border-[#E9EEF5] bg-white p-3">
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={incluidas.has(idx)}
                              onCheckedChange={() => alternarIncluida(idx)}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                              <Textarea
                                value={acao.descricao}
                                onChange={(e) =>
                                  editarAcaoProposta(idx, { descricao: e.target.value })
                                }
                                className="min-h-[52px] text-[13px]"
                              />
                              {acao.trechoOrigem ? (
                                <p className="text-[11px] italic leading-relaxed text-[#94A3B8]">
                                  “{acao.trechoOrigem}”
                                </p>
                              ) : null}
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-medium text-[#64748B]">
                                    Setor destino *
                                  </Label>
                                  <Select
                                    value={acao.setorDestino ?? ""}
                                    onValueChange={(v) =>
                                      editarAcaoProposta(idx, { setorDestino: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-[12px]">
                                      <SelectValue placeholder="Selecione…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {setoresCfg.map((s) => (
                                        <SelectItem key={s.id} value={s.nome}>
                                          {s.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-medium text-[#64748B]">
                                    Responsável
                                  </Label>
                                  <Select
                                    value={acao.responsavelEmail ?? ""}
                                    onValueChange={(v) =>
                                      editarAcaoProposta(idx, { responsavelEmail: v || undefined })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-[12px]">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {catalogo.colaboradores
                                        .filter((c) => (c.email ?? "").trim())
                                        .map((c) => (
                                          <SelectItem key={c.id} value={(c.email ?? "").trim()}>
                                            {c.nome}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-medium text-[#64748B]">
                                    Prazo
                                  </Label>
                                  <Input
                                    type="date"
                                    value={acao.prazo ?? ""}
                                    onChange={(e) =>
                                      editarAcaoProposta(idx, {
                                        prazo: e.target.value || undefined,
                                      })
                                    }
                                    className="h-8 text-[12px]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {acoesPropostas.length === 0 ? (
                        <p className="py-4 text-center text-[13px] text-[#94A3B8]">
                          Nenhuma frase de compromisso foi identificada no texto.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditando(false)}
                      disabled={salvando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1 bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                      onClick={() => void salvarLeitura()}
                      disabled={salvando}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {salvando ? "Salvando…" : "Salvar setores e ações"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[12px] leading-relaxed text-[#64748B]">
                  Leia o texto da ata e gere automaticamente os setores citados e as ações
                  {temColaboradores ? " já endereçadas, com trecho de origem preservado" : ""}. Você
                  revisa, ajusta e salva; depois confirma ou descarta cada ação.
                </p>
              )}
            </section>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
