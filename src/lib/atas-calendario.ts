/**
 * Atas de Reunião — calendário (próximas reuniões previstas).
 *
 * Regra do calendário:
 *   * a próxima data prevista = data da última ata do tipo + periodicidade;
 *   * se o tipo nunca teve ata, a base é a data de criação do tipo;
 *   * passou da data prevista sem nova ata => reunião "atrasada";
 *   * tolerância (em dias) é configurável por uma constante;
 *   * tipo desativado não gera previsão.
 *
 * Periodicidade "avulsa" não tem ciclo fixo: não gera previsão futura.
 */
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Ata, PeriodicidadeReuniao, TipoReuniao } from "@/lib/atas";

/** Tolerância em dias após a data prevista antes de marcar como atrasada. */
export const TOLERANCIA_DIAS_ATRASO = 3;

/** Janela do card "Próximas reuniões": dias à frente a contar de hoje. */
export const JANELA_PROXIMAS_DIAS = 30;

/** Soma um período de uma periodicidade sobre a data base. `null` p/ "avulsa". */
export function somarPeriodicidade(data: Date, periodicidade: PeriodicidadeReuniao): Date | null {
  switch (periodicidade) {
    case "semanal":
      return addDays(data, 7);
    case "quinzenal":
      return addDays(data, 14);
    case "mensal":
      return addMonths(data, 1);
    case "bimestral":
      return addMonths(data, 2);
    case "trimestral":
      return addMonths(data, 3);
    case "semestral":
      return addMonths(data, 6);
    case "anual":
      return addYears(data, 1);
    case "avulsa":
      return null;
  }
  return null;
}

function dataInicial(data: string): Date | null {
  if (!data) return null;
  const instante = parseISO(data);
  if (Number.isNaN(instante.getTime())) return null;
  return startOfDay(instante);
}

/** Base do cálculo: última data de ata do tipo (ou criação do tipo). */
function dataBaseDoTipo(tipo: TipoReuniao, atas: Ata[]): Date | null {
  const datas = atas
    .filter((ata) => ata.tipoReuniaoId === tipo.id)
    .map((ata) => dataInicial(ata.dataReuniao))
    .filter((valor): valor is Date => valor !== null);
  if (datas.length > 0) {
    datas.sort((a, b) => b.getTime() - a.getTime());
    return datas[0] ?? null;
  }
  return dataInicial(tipo.createdAt);
}

/** Próxima data prevista de um tipo (base + periodicidade) ou `null`. */
export function proximaDataPrevista(tipo: TipoReuniao, atas: Ata[]): Date | null {
  if (!tipo.ativo) return null;
  const base = dataBaseDoTipo(tipo, atas);
  if (!base) return null;
  return somarPeriodicidade(base, tipo.periodicidade);
}

export interface ReuniaoPrevista {
  tipo: TipoReuniao;
  dataPrevista: Date;
  /** Reunião cuja data prevista já passou além da tolerância sem nova ata. */
  atrasada: boolean;
}

/** Todas as previsões dos tipos ativos, ordenadas pela data prevista. */
export function montarReunioesPrevistas(
  tipos: TipoReuniao[],
  atas: Ata[],
  hoje: Date = startOfDay(new Date()),
): ReuniaoPrevista[] {
  const previstas: ReuniaoPrevista[] = [];
  for (const tipo of tipos) {
    if (!tipo.ativo) continue;
    const dataPrevista = proximaDataPrevista(tipo, atas);
    if (!dataPrevista) continue;
    const inicioDoDia = startOfDay(dataPrevista);
    const atrasada = differenceInCalendarDays(hoje, inicioDoDia) > TOLERANCIA_DIAS_ATRASO;
    previstas.push({ tipo, dataPrevista: inicioDoDia, atrasada });
  }
  return previstas.sort((a, b) => a.dataPrevista.getTime() - b.dataPrevista.getTime());
}

/** Quantidade de reuniões previstas nos próximos `dias` (padrão 30). */
export function quantidadeProximasDias(
  previstas: ReuniaoPrevista[],
  hoje: Date = startOfDay(new Date()),
  dias: number = JANELA_PROXIMAS_DIAS,
): number {
  return previstas.filter((reuniao) => {
    const diff = differenceInCalendarDays(reuniao.dataPrevista, hoje);
    return diff >= 0 && diff <= dias;
  }).length;
}
