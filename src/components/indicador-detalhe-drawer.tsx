/**
 * Detalhe do indicador (drawer lateral): dados cadastrais, histórico mês a mês,
 * status, plano de ação vinculado e as ações permitidas ao perfil da sessão.
 */
import { Archive, ArchiveRestore, CalendarCheck, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusApuracaoBadge, Pill, SeloAtraso, SeloAutomatico } from "@/components/indicador-badges";
import {
  DIA_LIMITE_APURACAO,
  FONTE_LABELS,
  SENTIDO_LABELS,
  UNIDADE_LABELS,
  apuracaoAtrasada,
  apuracaoDoMes,
  formatarValor,
  mesAnteriorRef,
  rotuloMes,
  rotuloMesLongo,
  ultimosMeses,
  type Apuracao,
  type Indicador,
} from "@/lib/indicadores";
import type { PlanoAcao } from "@/lib/planos";
import { formatarDataHoraBrasilia } from "@/lib/utils";

interface Props {
  indicador: Indicador | null;
  /** Apurações do indicador (qualquer ordem). */
  apuracoes: Apuracao[];
  planosPorId: Map<string, PlanoAcao>;
  podeGerenciar: boolean;
  podeLancar: boolean;
  onFechar: () => void;
  onLancar: (indicador: Indicador) => void;
  onEditar: (indicador: Indicador) => void;
  onAlternarArquivamento: (indicador: Indicador, arquivado: boolean) => void;
  onFecharMes: (apuracao: Apuracao) => void;
  onVincularPlano: (indicador: Indicador, apuracao: Apuracao) => void;
  onAbrirPlano: (planoId: string) => void;
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">{rotulo}</p>
      <p className="mt-1 text-[13px] leading-snug text-[#334155]">{valor}</p>
    </div>
  );
}

export function DetalheIndicadorDrawer(props: Props) {
  const { indicador, apuracoes, planosPorId, podeGerenciar, podeLancar } = props;
  const { onFechar, onLancar, onEditar, onAlternarArquivamento } = props;
  const { onFecharMes, onVincularPlano, onAbrirPlano } = props;

  if (!indicador) return null;

  const meses = [...ultimosMeses(24)].reverse();
  const atrasada = indicador.ativo && apuracaoAtrasada(apuracoes);
  const mesAtrasado = mesAnteriorRef();

  return (
    <Sheet open onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="text-[19px] leading-tight">{indicador.nome}</SheetTitle>
          <SheetDescription>
            {indicador.setor || "Sem setor definido"}
            {indicador.responsavelNome ? ` · ${indicador.responsavelNome}` : ""}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {indicador.automatico ? <SeloAutomatico /> : null}
            {!indicador.ativo ? <Pill tom="neutro">Arquivado</Pill> : null}
            {indicador.criadoDeModelo ? <Pill tom="neutro">Veio da biblioteca</Pill> : null}
            {atrasada ? <SeloAtraso mes={rotuloMes(mesAtrasado)} /> : null}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {indicador.descricao ? (
            <p className="text-[13px] leading-relaxed text-[#64748B]">{indicador.descricao}</p>
          ) : null}

          <div className="grid gap-4 rounded-xl border border-[#D9E0EA] bg-white p-4 sm:grid-cols-2">
            <Info rotulo="Meta vigente" valor={formatarValor(indicador.meta, indicador.unidade)} />
            <Info rotulo="Unidade" valor={UNIDADE_LABELS[indicador.unidade]} />
            <Info rotulo="Sentido" valor={SENTIDO_LABELS[indicador.sentido]} />
            <Info rotulo="Periodicidade" valor="Mensal" />
            <Info rotulo="Fonte do dado" valor={FONTE_LABELS[indicador.fonte]} />
            <Info
              rotulo="Apuração atrasada"
              valor={atrasada ? `Sim (após o dia ${DIA_LIMITE_APURACAO})` : "Não"}
            />
          </div>

          <div className="rounded-xl border border-[#D9E0EA] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
              Como é apurado
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#334155]">
              {indicador.formulaDescricao || "Não informado."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                Histórico mês a mês
              </p>
              {podeLancar && indicador.ativo ? (
                <Button size="sm" variant="outline" onClick={() => onLancar(indicador)}>
                  <Plus className="h-3.5 w-3.5" />
                  Lançar apuração
                </Button>
              ) : null}
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-[#D9E0EA] bg-white">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E9EEF5] text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">
                    <th className="px-3 py-2 font-semibold">Mês</th>
                    <th className="px-3 py-2 font-semibold">Valor</th>
                    <th className="px-3 py-2 font-semibold">Meta</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Plano de ação</th>
                    <th className="px-3 py-2 font-semibold">Fechamento</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((mes) => {
                    const apuracao = apuracaoDoMes(apuracoes, mes);
                    const plano = apuracao?.planoAcaoId ? planosPorId.get(apuracao.planoAcaoId) : undefined;
                    const abaixoSemPlano = apuracao?.status === "abaixo_da_meta" && !apuracao.planoAcaoId;
                    return (
                      <tr key={mes} className="border-b border-[#F1F5F9] last:border-0">
                        <td className="px-3 py-2 text-[13px] font-medium text-[#1F2937]">{rotuloMes(mes)}</td>
                        <td className="px-3 py-2 text-[13px] text-[#334155]">
                          {formatarValor(apuracao?.valorRealizado ?? null, indicador.unidade)}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-[#64748B]">
                          {formatarValor(apuracao?.metaNoMes ?? null, indicador.unidade)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusApuracaoBadge
                            status={apuracao?.status ?? "pendente"}
                            fechado={apuracao?.fechado}
                          />
                        </td>
                        <td className="px-3 py-2 text-[12px]">
                          {plano ? (
                            <button
                              type="button"
                              onClick={() => onAbrirPlano(plano.id)}
                              className="text-left font-semibold text-[#1E3A8A] hover:underline"
                            >
                              {plano.codigo || "Plano"} · {plano.titulo}
                            </button>
                          ) : abaixoSemPlano && apuracao ? (
                            <button
                              type="button"
                              onClick={() => onVincularPlano(indicador, apuracao)}
                              className="font-semibold text-[#E11D48] hover:underline"
                            >
                              Vincular plano obrigatório
                            </button>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-[#64748B]">
                          {apuracao?.fechado ? (
                            <span className="font-semibold text-[#059669]">Fechado</span>
                          ) : apuracao && apuracao.valorRealizado !== null ? (
                            podeGerenciar ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onFecharMes(apuracao)}
                                title={
                                  abaixoSemPlano
                                    ? "Vincule um plano de ação para liberar o fechamento"
                                    : undefined
                                }
                              >
                                <CalendarCheck className="h-3.5 w-3.5" />
                                Fechar mês
                              </Button>
                            ) : (
                              <span>Aberto</span>
                            )
                          ) : (
                            <span className="text-[#94A3B8]">Sem lançamento</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {atrasada ? (
              <p className="mt-2 text-[12px] text-[#64748B]">
                {rotuloMesLongo(mesAtrasado)} segue sem lançamento depois do dia {DIA_LIMITE_APURACAO} — a
                apuração está atrasada.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#E9EEF5] pt-4">
            {podeLancar && indicador.ativo ? (
              <Button onClick={() => onLancar(indicador)}>
                <Plus className="h-4 w-4" />
                Lançar apuração
              </Button>
            ) : null}
            {podeGerenciar ? (
              <>
                <Button variant="outline" onClick={() => onEditar(indicador)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                {indicador.ativo ? (
                  <Button variant="outline" onClick={() => onAlternarArquivamento(indicador, true)}>
                    <Archive className="h-4 w-4" />
                    Arquivar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => onAlternarArquivamento(indicador, false)}>
                    <ArchiveRestore className="h-4 w-4" />
                    Reativar
                  </Button>
                )}
              </>
            ) : null}
            {indicador.updatedAt ? (
              <span className="ml-auto text-[11px] text-[#94A3B8]">
                Atualizado em {formatarDataHoraBrasilia(indicador.updatedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


