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
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Ata, PeriodicidadeReuniao, TipoReuniao } from "@/lib/atas";
import type { AgendaEvento } from "@/lib/agenda-eventos";

/** Tolerância em dias após a data prevista antes de marcar como atrasada. */
export const TOLERANCIA_DIAS_ATRASO = 3;

/** Janela do card "Próximas reuniões": dias à frente a contar de hoje. */
export const JANELA_PROXIMAS_DIAS = 30;

/**
 * Soma `n` períodos de uma periodicidade à data base. Multiplica sobre a base
 * (em vez de encadear) para não acumular arredondamento de meses (ex.: 31/jan).
 * `null` para "avulsa".
 */
export function somarPeriodicidadeN(
  data: Date,
  periodicidade: PeriodicidadeReuniao,
  n: number,
): Date | null {
  switch (periodicidade) {
    case "semanal":
      return addDays(data, 7 * n);
    case "quinzenal":
      return addDays(data, 14 * n);
    case "mensal":
      return addMonths(data, n);
    case "bimestral":
      return addMonths(data, 2 * n);
    case "trimestral":
      return addMonths(data, 3 * n);
    case "semestral":
      return addMonths(data, 6 * n);
    case "anual":
      return addYears(data, n);
    case "avulsa":
      return null;
  }
  return null;
}

/** Soma um período de uma periodicidade sobre a data base. `null` p/ "avulsa". */
export function somarPeriodicidade(data: Date, periodicidade: PeriodicidadeReuniao): Date | null {
  return somarPeriodicidadeN(data, periodicidade, 1);
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

/* -------------------------------------------------------------------------- */
/* Agenda — reuniões de um período (visão de calendário)                      */
/* -------------------------------------------------------------------------- */

export type SituacaoEvento = "prevista" | "atrasada" | "realizada" | "agendada";

export interface EventoAgenda {
  chave: string;
  /** Nome exibido: nome do tipo de reunião ou título do evento avulso. */
  titulo: string;
  /** Dia do evento (início do dia, horário local). */
  data: Date;
  /** Horário de início `HH:mm` (somente eventos avulsos com horário). */
  horario: string | null;
  situacao: SituacaoEvento;
  /** Tipo de reunião (somente reuniões recorrentes). */
  tipo: TipoReuniao | null;
  /** Ata registrada para esta reunião (somente quando "realizada"). */
  ata: Ata | null;
  /** Evento avulso da agenda (somente quando "agendada"). */
  agendado: AgendaEvento | null;
}

/** Limite de ocorrências projetadas por tipo, para evitar laços longos. */
const LIMITE_OCORRENCIAS = 1000;

/** O usuário (`id` de `public.usuarios`) é participante ou signatário do tipo. */
export function envolvidoNoTipo(tipo: TipoReuniao, usuarioId: string | null): boolean {
  if (!usuarioId) return false;
  return (
    tipo.participantes.some((pessoa) => pessoa.id === usuarioId) ||
    tipo.signatarios.some((pessoa) => pessoa.id === usuarioId)
  );
}

/**
 * Eventos da agenda entre `inicio` e `fim` (inclusive), apenas dos tipos em que
 * o usuário está envolvido.
 *
 *   * realizada: ata cuja data cai no intervalo (vale também para tipo desativado);
 *   * prevista / atrasada: ocorrências do ciclo a partir da base (última ata ou
 *     criação do tipo). A primeira ocorrência é a pendência atual (atrasada se
 *     vencida além da tolerância). As seguintes só aparecem se ainda não passaram,
 *     pois o passado sem ata seria a mesma pendência repetida.
 */
export function montarEventosAgenda(
  tipos: TipoReuniao[],
  atas: Ata[],
  inicio: Date,
  fim: Date,
  usuarioId: string | null,
  hoje: Date = startOfDay(new Date()),
): EventoAgenda[] {
  const inicioDia = startOfDay(inicio);
  const fimDia = startOfDay(fim);
  const tiposDoUsuario = tipos.filter((tipo) => envolvidoNoTipo(tipo, usuarioId));
  const tipoPorId = new Map(tiposDoUsuario.map((tipo) => [tipo.id, tipo]));
  const eventos: EventoAgenda[] = [];

  for (const ata of atas) {
    const tipo = ata.tipoReuniaoId ? tipoPorId.get(ata.tipoReuniaoId) : undefined;
    if (!tipo) continue;
    const data = dataInicial(ata.dataReuniao);
    if (!data || data < inicioDia || data > fimDia) continue;
    eventos.push({
      chave: `ata-${ata.id}`,
      titulo: tipo.nome,
      data,
      horario: null,
      situacao: "realizada",
      tipo,
      ata,
      agendado: null,
    });
  }

  for (const tipo of tiposDoUsuario) {
    if (!tipo.ativo) continue;
    const base = dataBaseDoTipo(tipo, atas);
    if (!base) continue;

    for (let n = 1; n <= LIMITE_OCORRENCIAS; n++) {
      const previsto = somarPeriodicidadeN(base, tipo.periodicidade, n);
      if (!previsto) break; // avulsa: sem ciclo fixo
      const dia = startOfDay(previsto);
      if (dia > fimDia) break;

      if (n > 1 && dia < hoje) continue; // passado sem ata = mesma pendência da primeira
      if (dia < inicioDia) continue;

      const vencida = n === 1 && differenceInCalendarDays(hoje, dia) > TOLERANCIA_DIAS_ATRASO;

      eventos.push({
        chave: `${tipo.id}-${format(dia, "yyyy-MM-dd")}`,
        titulo: tipo.nome,
        data: dia,
        horario: null,
        situacao: vencida ? "atrasada" : "prevista",
        tipo,
        ata: null,
        agendado: null,
      });
    }
  }

  return eventos.sort(compararEventos);
}

/** Ordem da agenda: dia, depois horário (dia inteiro primeiro), depois título. */
export function compararEventos(a: EventoAgenda, b: EventoAgenda): number {
  return (
    a.data.getTime() - b.data.getTime() ||
    (a.horario ?? "").localeCompare(b.horario ?? "") ||
    a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}

/**
 * Eventos avulsos da agenda entre `inicio` e `fim` (inclusive) em que o usuário
 * é criador ou convidado. O banco já filtra; a checagem aqui garante a regra no front.
 */
export function montarEventosAvulsos(
  eventos: AgendaEvento[],
  inicio: Date,
  fim: Date,
  usuarioId: string | null,
): EventoAgenda[] {
  if (!usuarioId) return [];
  const inicioDia = startOfDay(inicio);
  const fimDia = startOfDay(fim);
  const resultado: EventoAgenda[] = [];
  for (const agendado of eventos) {
    const visivel =
      agendado.criadoPor === usuarioId ||
      agendado.convidados.some((pessoa) => pessoa.id === usuarioId);
    if (!visivel) continue;
    const data = dataInicial(agendado.dataEvento);
    if (!data || data < inicioDia || data > fimDia) continue;
    resultado.push({
      chave: `evento-${agendado.id}`,
      titulo: agendado.titulo,
      data,
      horario: agendado.horaInicio,
      situacao: agendado.realizada ? "realizada" : "agendada",
      tipo: null,
      ata: null,
      agendado,
    });
  }
  return resultado;
}

/**
 * Atas em que o usuário foi marcado no documento. Cada ata aparece na agenda dele
 * na data da reunião (mesmo quando o tipo de reunião não é dele).
 */
export function montarEventosAtasMarcadas(
  atas: Ata[],
  inicio: Date,
  fim: Date,
  usuarioId: string | null,
): EventoAgenda[] {
  if (!usuarioId) return [];
  const inicioDia = startOfDay(inicio);
  const fimDia = startOfDay(fim);
  const resultado: EventoAgenda[] = [];
  for (const ata of atas) {
    const marcado = (ata.documento?.marcados ?? []).some((pessoa) => pessoa.id === usuarioId);
    if (!marcado) continue;
    const data = dataInicial(ata.dataReuniao);
    if (!data || data < inicioDia || data > fimDia) continue;
    resultado.push({
      chave: `ata-${ata.id}`,
      titulo: ata.titulo,
      data,
      horario: null,
      situacao: "realizada",
      tipo: null,
      ata,
      agendado: null,
    });
  }
  return resultado;
}

/** Agenda completa do usuário: reuniões de tipos, atas em que foi marcado e eventos avulsos. */
export function montarAgenda(
  tipos: TipoReuniao[],
  atas: Ata[],
  agendados: AgendaEvento[],
  inicio: Date,
  fim: Date,
  usuarioId: string | null,
  hoje: Date = startOfDay(new Date()),
): EventoAgenda[] {
  const todos = [
    ...montarEventosAgenda(tipos, atas, inicio, fim, usuarioId, hoje),
    ...montarEventosAtasMarcadas(atas, inicio, fim, usuarioId),
    ...montarEventosAvulsos(agendados, inicio, fim, usuarioId),
  ];
  // Uma ata pode chegar por dois caminhos (tipo do usuário e marcação): vale a primeira.
  const porChave = new Map<string, EventoAgenda>();
  for (const evento of todos) {
    if (!porChave.has(evento.chave)) porChave.set(evento.chave, evento);
  }
  return [...porChave.values()].sort(compararEventos);
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
