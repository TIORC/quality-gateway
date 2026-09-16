import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mascaraDataBr(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/* ------------------------------------------------------------------------- */
/* Datas e horários — fuso de Brasília                                        */
/* ------------------------------------------------------------------------- */

/** Fuso horário padrão do portal (horário de Brasília). */
export const FUSO_BRASILIA = "America/Sao_Paulo";

/*
 * Os formatadores são criados uma única vez (criar `Intl.DateTimeFormat` é
 * relativamente caro) e reaproveitados — importante porque o relógio do
 * cabeçalho formata a hora a cada segundo.
 */

const formatadorDataLongaBr = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_BRASILIA,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatadorHoraBr = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_BRASILIA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const formatadorHoraNumericaBr = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_BRASILIA,
  hour: "numeric",
  hourCycle: "h23",
});

/** Formata a data por extenso no fuso de Brasília: `quarta-feira, 16 de setembro de 2026`. */
export function formatarDataLongaBrasilia(data: Date = new Date()): string {
  return formatadorDataLongaBr.format(data);
}

/** Formata o horário no fuso de Brasília: `14:32:07`. */
export function formatarHoraBrasilia(data: Date = new Date()): string {
  return formatadorHoraBr.format(data);
}

/** Formata data + hora sempre no fuso de Brasília: `dd/mm/aaaa às HH:mm`. */
export function formatarDataHoraBrasilia(data: Date | string): string {
  const instante = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(instante.getTime())) return "—";
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
  const horaFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BRASILIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instante);
  return `${dataFormatada} às ${horaFormatada}`;
}

/** Devolve a hora atual (0–23) no fuso de Brasília. */
export function horaAtualBrasilia(data: Date = new Date()): number {
  const hora = Number(formatadorHoraNumericaBr.format(data));
  return Number.isNaN(hora) ? data.getHours() : hora;
}

/**
 * Saudação conforme o horário real de Brasília:
 * 05h–12h "Bom dia", 12h–18h "Boa tarde", demais horas "Boa noite".
 */
export function saudacaoPorHorarioBrasilia(data: Date = new Date()): string {
  const hora = horaAtualBrasilia(data);
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Formata uma data/hora ISO como `dd/mm/aaaa às HH:mm`. */
export function formatarDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);

  const horaFormatada = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);

  return `${dataFormatada} às ${horaFormatada}`;
}
