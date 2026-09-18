/**
 * Linha do Metrô — visualização das 6 macro-etapas de uma ocorrência.
 *
 * Estados de cada estação: não iniciada (cinza), em andamento (cor de destaque
 * com pulso), concluída (check verde), atrasada (vermelho). Clique na estação
 * expande os detalhes (filtrados pelo papel: visão simplificada do solicitante
 * vs. visão completa da Qualidade/encarregados).
 */
import { useState } from "react";
import {
  CalendarClock, CheckCircle2, Clock, MessageSquare, Paperclip, TrainFront,
} from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import {
  MACRO_ETAPAS, MACRO_ETAPA_LABELS, MACRO_ETAPA_DESCRICAO,
  formatarPrazo, ocorrenciaAtrasada, progressoOcorrencia, rotuloRelativoPrazo,
  rotuloResponsavel,
  type EventoOcorrencia, type MacroEtapa, type MacroFluxo, type Ocorrencia,
} from "@/lib/ocorrencias";

export interface MetroLinhaProps {
  ocorrencia: Ocorrencia;
  etapas: MacroFluxo[];
  eventos: EventoOcorrencia[];
  visao: "simplificada" | "completa";
}

type EstadoEstacao = "pendente" | "em_andamento" | "concluida" | "atrasada";

function tempoDecorrido(desdeISO: string): string {
  const t = Date.parse(desdeISO);
  if (Number.isNaN(t)) return "—";
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} dias`;
}

export function MetroLinha({ ocorrencia: o, etapas, eventos, visao }: MetroLinhaProps) {
  const [expandida, setExpandida] = useState<MacroEtapa | null>(null);
  const idxAtual = MACRO_ETAPAS.indexOf(o.macroAtual);
  const atrasada = ocorrenciaAtrasada(o);
  const progresso = progressoOcorrencia(o, etapas);

  function estadoDa(macro: MacroEtapa): EstadoEstacao {
    const idx = MACRO_ETAPAS.indexOf(macro);
    if (o.status === "encerrada") return "concluida";
    if (idx < idxAtual) return "concluida";
    if (idx === idxAtual) return atrasada ? "atrasada" : "em_andamento";
    return "pendente";
  }

  return (
    <div className="rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm">
      {/* Cabeçalho: progresso e tempo total */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrainFront className="h-4 w-4" style={{ color: o.tipoCor }} />
          <p className="text-[13px] font-semibold text-[#1F2937]">
            {o.status === "encerrada"
              ? "Jornada concluída"
              : `Estação atual: ${MACRO_ETAPA_LABELS[o.macroAtual]}`}
          </p>
        </div>
        <p className="text-[12px] text-[#64748B]">
          Tempo decorrido: {tempoDecorrido(o.createdAt)} · {rotuloRelativoPrazo(o.prazoEtapa)}
        </p>
      </div>

      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF2F7]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progresso}%`, backgroundColor: o.tipoCor }}
        />
      </div>
      <p className="mb-4 text-right text-[11px] text-[#94A3B8]">{progresso}% do trajeto</p>

      {/* Painel expandido da estação */}
      {expandida && (
        <div className="mt-4 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-4">
          <p className="text-[13px] font-semibold text-[#1F2937]">
            {MACRO_ETAPA_LABELS[expandida]}
          </p>
          <p className="mt-0.5 text-[12px] text-[#64748B]">{MACRO_ETAPA_DESCRICAO[expandida]}</p>

          {(() => {
            const macroEtapas = etapas.find((e) => e.macro === expandida);
            const subs = macroEtapas?.subetapas ?? [];
            const eventosDaEtapa = eventos.filter((e) => e.macro === expandida);
            const simplificada = visao === "simplificada";

            if (simplificada) {
              // Solicitante: só previsão — nada dos detalhes internos.
              if (expandida !== o.macroAtual && estadoDa(expandida) === "pendente") {
                return (
                  <p className="mt-3 text-[12px] text-[#94A3B8]">
                    Previsão de chegada nesta estação conforme o fluxo do tipo escolhido.
                  </p>
                );
              }
              return (
                <p className="mt-3 text-[12px] text-[#475569]">
                  {estadoDa(expandida) === "concluida"
                    ? "Estação concluída."
                    : `Responsável atual: ${o.responsavelNome || "a definir"} · previsão: ${formatarPrazo(o.prazoEtapa)}`}
                </p>
              );
            }

            return (
              <div className="mt-3 space-y-3">
                {subs.length > 0 ? (
                  <ul className="space-y-1.5">
                    {subs.map((s) => {
                      const ehAtual = expandida === o.macroAtual && s.id === o.subetapaAtualId;
                      return (
                        <li
                          key={s.id}
                          className={`rounded-lg border px-3 py-2 text-[12px] ${
                            ehAtual ? "border-[#1E3A8A] bg-white" : "border-[#E9EEF5] bg-white"
                          }`}
                        >
                          <span className="font-semibold text-[#1F2937]">{s.nome}</span>
                          <span className="ml-2 text-[#64748B]">
                            {rotuloResponsavel(s.responsavel)} · SLA {s.prazoDias}d
                          </span>
                          {ehAtual && (
                            <span className="ml-2 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-[#1E3A8A]">
                              agora
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] text-[#64748B]">
                    Sem subetapas customizadas — tratada como etapa única.
                  </p>
                )}

                {eventosDaEtapa.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                      Movimentações
                    </p>
                    <ul className="space-y-1.5">
                      {eventosDaEtapa.map((ev) => (
                        <li key={ev.id} className="flex items-start gap-2 text-[12px] text-[#475569]">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                          <span>
                            <span className="font-medium text-[#1F2937]">{ev.acao}</span>
                            {ev.de && ` · de ${ev.de}`} {ev.para && `→ ${ev.para}`}
                            {ev.comentario && (
                              <span className="mt-0.5 flex items-start gap-1 text-[#64748B]">
                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                {ev.comentario}
                              </span>
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
                      ))}
                    </ul>
                  </div>
                )}

                {expandida === o.macroAtual && !atrasada && (
                  <p className="flex items-center gap-1.5 text-[12px] text-[#475569]">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Prazo da etapa: {formatarPrazo(o.prazoEtapa)}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
