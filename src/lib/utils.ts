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

/** Formata a data por extenso no fuso de Brasília: `quarta-feira, 16 de setembro de 2026`. */
export function formatarDataLongaBrasilia(data: Date = new Date()): string {
  return formatadorDataLongaBr.format(data);
}

/** Formata o horário no fuso de Brasília: `14:32:07`. */
export function formatarHoraBrasilia(data: Date = new Date()): string {
  return formatadorHoraBr.format(data);
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
