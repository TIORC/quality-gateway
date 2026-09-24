/**
 * Indicadores — domínio, constante e regras puras.
 *
 * As tabelas (`indicadores` e `apuracoes`) vivem no Lovable Cloud
 * (migration `20260925000000_indicadores.sql`). Este arquivo concentra o que é
 * regra de negócio: cálculo de status pelo sentido do indicador, variação
 * contra o mês anterior, atraso da apuração e formatação por unidade.
 */

import type { UserSession } from "@/lib/auth";
import { normalizarSetor } from "@/lib/niveis-acesso";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Dia do mês corrente a partir do qual o mês anterior sem lançamento passa a
 * contar como apuração atrasada. Regra configurável em um lugar só.
 */
export const DIA_LIMITE_APURACAO = 10;

export const UNIDADES_INDICADOR = ["percentual", "numero", "moeda", "dias", "horas"] as const;
export type UnidadeIndicador = (typeof UNIDADES_INDICADOR)[number];

export const UNIDADE_LABELS: Record<UnidadeIndicador, string> = {
  percentual: "Percentual (%)",
  numero: "Número",
  moeda: "Moeda (R$)",
  dias: "Dias",
  horas: "Horas",
};

export const SENTIDOS_INDICADOR = ["maior_melhor", "menor_melhor"] as const;
export type SentidoIndicador = (typeof SENTIDOS_INDICADOR)[number];

export const SENTIDO_LABELS: Record<SentidoIndicador, string> = {
  maior_melhor: "Quanto maior, melhor",
  menor_melhor: "Quanto menor, melhor",
};

export const FONTES_INDICADOR = ["manual", "planilha", "sistema"] as const;
export type FonteIndicador = (typeof FONTES_INDICADOR)[number];

export const FONTE_LABELS: Record<FonteIndicador, string> = {
  manual: "Manual",
  planilha: "Planilha",
  sistema: "Sistema",
};

export const STATUS_APURACAO = ["pendente", "dentro_da_meta", "abaixo_da_meta"] as const;
export type StatusApuracao = (typeof STATUS_APURACAO)[number];

export const STATUS_APURACAO_LABELS: Record<StatusApuracao, string> = {
  pendente: "Pendente",
  dentro_da_meta: "Dentro da meta",
  abaixo_da_meta: "Abaixo da meta",
};

/**
 * Regras de cálculo automático. Só entram no seed da biblioteca os indicadores
 * cujos módulos (Ocorrências, Planos de Ação e Auditorias) já têm os dados.
 */
export const REGRAS_AUTOMATICAS = [
  "ocorrencias_encerradas",
  "planos_no_prazo",
  "auditorias_realizadas",
] as const;
export type RegraAutomatica = (typeof REGRAS_AUTOMATICAS)[number];

export const REGRA_AUTOMATICA_LABELS: Record<RegraAutomatica, string> = {
  ocorrencias_encerradas: "Ocorrências encerradas no mês",
  planos_no_prazo: "Planos de ação concluídos no prazo no mês",
  auditorias_realizadas: "Auditorias concluídas entre as planejadas no mês",
};

/** Periodicidade única do módulo (mantida no registro para histórico). */
export const PERIODICIDADE_MENSAL = "mensal";

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/* -------------------------------------------------------------------------- */

export interface Indicador {
  id: string;
  nome: string;
  descricao: string;
  setor: string;
  responsavelId: string;
  responsavelNome: string;
  unidade: UnidadeIndicador;
  formulaDescricao: string;
  /** Meta vigente. `null` enquanto a Qualidade não definir (modelos da biblioteca). */
  meta: number | null;
  sentido: SentidoIndicador;
  periodicidade: string;
  fonte: FonteIndicador;
  automatico: boolean;
  regraAutomatica: string;
  ativo: boolean;
  criadoDeModelo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Apuracao {
  id: string;
  indicadorId: string;
  /** Mês de referência no formato `AAAA-MM`. */
  mesReferencia: string;
  valorRealizado: number | null;
  /** Meta vigente no momento do lançamento (histórico imutável). */
  metaNoMes: number | null;
  status: StatusApuracao;
  planoAcaoId: string | null;
  lancadoPor: string;
  lancadoEm: string | null;
  fechado: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Dados aceitos no formulário de criação/edição do indicador. */
export interface IndicadorForm {
  nome: string;
  descricao: string;
  setor: string;
  responsavelId: string;
  responsavelNome: string;
  unidade: UnidadeIndicador;
  formulaDescricao: string;
  meta: number | null;
  sentido: SentidoIndicador;
  fonte: FonteIndicador;
}

/* -------------------------------------------------------------------------- */
/* Meses de referência (AAAA-MM)                                               */
/* -------------------------------------------------------------------------- */

const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mês de referência (`AAAA-MM`) da data informada. */
export function mesReferenciaDe(data: Date = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

/** Mês de referência corrente. */
export function mesReferenciaAtual(): string {
  return mesReferenciaDe(new Date());
}

/** Mês anterior ao informado (`AAAA-MM`). */
export function mesAnterior(mes: string): string {
  const [ano, mesNumero] = mes.split("-").map(Number);
  if (!ano || !mesNumero) return mes;
  const data = new Date(ano, mesNumero - 2, 1);
  return mesReferenciaDe(data);
}

/** Mês seguinte ao informado (`AAAA-MM`). */
export function proximoMes(mes: string): string {
  const [ano, mesNumero] = mes.split("-").map(Number);
  if (!ano || !mesNumero) return mes;
  return mesReferenciaDe(new Date(ano, mesNumero, 1));
}

/** Rótulo curto do mês: `jul/26`. */
export function rotuloMes(mes: string): string {
  const [ano, mesNumero] = mes.split("-").map(Number);
  if (!ano || !mesNumero) return mes;
  return `${MESES_CURTOS[mesNumero - 1] ?? mes}/${String(ano).slice(-2)}`;
}

/** Rótulo por extenso do mês: `julho de 2026`. */
export function rotuloMesLongo(mes: string): string {
  const [ano, mesNumero] = mes.split("-").map(Number);
  if (!ano || !mesNumero) return mes;
  return `${MESES_LONGOS[mesNumero - 1] ?? mes} de ${ano}`;
}

/** Últimos `quantidade` meses terminando em `mesFinal` (ordem cronológica). */
export function ultimosMeses(quantidade: number, mesFinal: string = mesReferenciaAtual()): string[] {
  const lista: string[] = [mesFinal];
  while (lista.length < quantidade) lista.unshift(mesAnterior(lista[0] ?? mesFinal));
  return lista;
}

/* -------------------------------------------------------------------------- */
/* Período de exibição (filtro dos gráficos/cards/histórico)                   */
/* -------------------------------------------------------------------------- */

/**
 * Filtro de período da tela de indicadores. É sempre um RECORTE sobre os
 * lançamentos mensais (`AAAA-MM`) — nunca agrega (soma/média) valores entre
 * meses: o status e a variação continuam mensais e exatos.
 */
export type FiltroPeriodo =
  | { modo: "ultimos12" }
  | { modo: "mes"; mes: string }
  | { modo: "ano"; ano: number }
  | { modo: "intervalo"; inicio: string; fim: string };

/** Modos do seletor de período (valor do campo + rótulo). */
export const MODOS_PERIODO: { valor: FiltroPeriodo["modo"]; rotulo: string }[] = [
  { valor: "ultimos12", rotulo: "Últimos 12 meses" },
  { valor: "mes", rotulo: "Mês específico" },
  { valor: "ano", rotulo: "Ano" },
  { valor: "intervalo", rotulo: "Intervalo de datas" },
];

/** Garante `inicio <= fim` (comparação lexicográfica de `AAAA-MM`). */
export function normalizarIntervalo(inicio: string, fim: string): { inicio: string; fim: string } {
  return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio };
}

const FORMATO_MES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Lista cronológica de meses coberta pelo filtro (sem meses futuros).
 * Intervalo incompleto/inválido volta para os últimos 12 meses.
 */
export function mesesDoPeriodo(filtro: FiltroPeriodo): string[] {
  const atual = mesReferenciaAtual();
  if (filtro.modo === "mes") {
    return FORMATO_MES_PERIODO.test(filtro.mes) && filtro.mes <= atual ? [filtro.mes] : [];
  }
  if (filtro.modo === "ano") {
    return Array.from({ length: 12 }, (_, i) => `${filtro.ano}-${String(i + 1).padStart(2, "0")}`).filter(
      (mes) => mes <= atual,
    );
  }
  if (filtro.modo === "intervalo") {
    const { inicio, fim } = normalizarIntervalo(filtro.inicio, filtro.fim);
    if (!FORMATO_MES_PERIODO.test(inicio) || !FORMATO_MES_PERIODO.test(fim)) return ultimosMeses(12);
    const meses: string[] = [];
    let mes = inicio;
    while (mes <= fim && meses.length < 120) {
      meses.push(mes);
      mes = proximoMes(mes);
    }
    return meses.filter((m) => m <= atual);
  }
  return ultimosMeses(12);
}

/** Rótulo do período para exibição (`set/25`, `2025`, `jan/25 – mar/25`). */
export function rotuloPeriodo(filtro: FiltroPeriodo): string {
  if (filtro.modo === "mes") return rotuloMes(filtro.mes);
  if (filtro.modo === "ano") return String(filtro.ano);
  if (filtro.modo === "intervalo") {
    const { inicio, fim } = normalizarIntervalo(filtro.inicio, filtro.fim);
    if (!FORMATO_MES_PERIODO.test(inicio) || !FORMATO_MES_PERIODO.test(fim)) return "Intervalo incompleto";
    return `${rotuloMes(inicio)} – ${rotuloMes(fim)}`;
  }
  return "Últimos 12 meses";
}

/* -------------------------------------------------------------------------- */
/* Regras de negócio                                                           */
/* -------------------------------------------------------------------------- */

/** Status da apuração conforme o sentido do indicador. */
export function calcularStatus(
  valor: number | null,
  meta: number | null,
  sentido: SentidoIndicador,
): StatusApuracao {
  if (valor === null || meta === null) return "pendente";
  const dentro = sentido === "menor_melhor" ? valor <= meta : valor >= meta;
  return dentro ? "dentro_da_meta" : "abaixo_da_meta";
}

/** `true`/`false` quando dá para comparar; `null` quando falta valor ou meta. */
export function dentroDaMeta(
  valor: number | null,
  meta: number | null,
  sentido: SentidoIndicador,
): boolean | null {
  if (valor === null || meta === null) return null;
  return calcularStatus(valor, meta, sentido) === "dentro_da_meta";
}

export interface Variacao {
  /** Diferença absoluta (valor atual − mês anterior). */
  absoluta: number;
  /** Variação percentual, ou `null` quando o mês anterior é zero. */
  percentual: number | null;
  /** `true` quando o movimento é favorável ao indicador (menor_melhor: queda). */
  melhorou: boolean;
  /** `true` quando houve mudança (evita flechas em meses idênticos). */
  mudou: boolean;
}

/**
 * Compara o valor atual com o do mês anterior considerando o sentido do
 * indicador: para `menor_melhor`, a queda é melhora.
 */
export function calcularVariacao(
  valorAtual: number | null,
  valorAnterior: number | null,
  sentido: SentidoIndicador,
): Variacao | null {
  if (valorAtual === null || valorAnterior === null) return null;
  const absoluta = valorAtual - valorAnterior;
  const percentual =
    valorAnterior === 0 ? null : Number(((absoluta / Math.abs(valorAnterior)) * 100).toFixed(1));
  const melhorou = sentido === "menor_melhor" ? absoluta < 0 : absoluta > 0;
  return { absoluta, percentual, melhorou, mudou: absoluta !== 0 };
}

/** Mês anterior ao corrente, usado na conferência de atraso. */
export function mesAnteriorRef(hoje: Date = new Date()): string {
  return mesReferenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
}

/** Apuração com valor lançado referente ao mês informado (ou `null`). */
export function apuracaoDoMes(apuracoes: Apuracao[], mes: string): Apuracao | null {
  return apuracoes.find((a) => a.mesReferencia === mes && a.valorRealizado !== null) ?? null;
}

/**
 * Apuração atrasada: depois do dia `DIA_LIMITE_APURACAO` do mês corrente, o mês
 * anterior ainda sem lançamento conta como atrasado.
 */
export function apuracaoAtrasada(apuracoes: Apuracao[], hoje: Date = new Date()): boolean {
  if (hoje.getDate() <= DIA_LIMITE_APURACAO) return false;
  return apuracaoDoMes(apuracoes, mesAnteriorRef(hoje)) === null;
}

/** Apurações do indicador em ordem cronológica crescente. */
export function apuracoesOrdenadas(apuracoes: Apuracao[]): Apuracao[] {
  return [...apuracoes].sort((a, b) => (a.mesReferencia < b.mesReferencia ? -1 : 1));
}

/** Último mês com valor lançado (ou `null` quando nunca houve lançamento). */
export function ultimaApuracao(apuracoes: Apuracao[]): Apuracao | null {
  const comValor = apuracoesOrdenadas(apuracoes).filter((a) => a.valorRealizado !== null);
  return comValor[comValor.length - 1] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Formatação e digitação                                                      */
/* -------------------------------------------------------------------------- */

/** Número com até 2 casas, sem zeros à direita (pt-BR). */
export function formatarNumero(valor: number, casas = 2): string {
  return valor
    .toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas })
    .trim();
}

/** Valor do indicador formatado conforme a unidade cadastrada. */
export function formatarValor(valor: number | null, unidade: UnidadeIndicador): string {
  if (valor === null) return "—";
  switch (unidade) {
    case "percentual":
      return `${formatarNumero(valor)}%`;
    case "moeda":
      return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "dias":
      return `${formatarNumero(valor)} ${valor === 1 ? "dia" : "dias"}`;
    case "horas":
      return `${formatarNumero(valor)} h`;
    default:
      return formatarNumero(valor);
  }
}

/** Mantém apenas dígitos, sinal negativo e separadores decimais. */
export function mascaraNumero(texto: string): string {
  const limpo = texto.replace(/[^\d.,-]/g, "").replace(/(?!^)-/g, "");
  return limpo.slice(0, 16);
}

/**
 * Converte texto digitado em número. Aceita `1.234,56` (pt-BR) e `1234.56`.
 * Devolve `null` quando não há número válido.
 */
export function paraNumero(texto: string): number | null {
  const bruto = texto.trim();
  if (!bruto) return null;
  const temVirgula = bruto.includes(",");
  const temPonto = bruto.includes(".");
  let normalizado = bruto;
  if (temVirgula && temPonto) normalizado = bruto.replace(/\./g, "").replace(",", ".");
  else if (temVirgula) normalizado = bruto.replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return null;
  return Number(numero.toFixed(4));
}

/* -------------------------------------------------------------------------- */
/* Permissões                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cria, edita, arquiva indicadores, define meta e fecha o mês: Qualidade/Admin
 * (`ehUsuarioDaQualidade`), conforme o perfil definido no portal.
 */
export function podeGerenciarIndicadores(session: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(session);
}

/**
 * Lança a apuração do mês: Qualidade/Admin ou o líder do setor do indicador.
 * A mesma regra é revalidada em `indicadores-crud.ts` antes de gravar — a tela
 * apenas esconde o botão.
 */
export function podeLancarApuracao(
  session: UserSession | null | undefined,
  indicador: Pick<Indicador, "setor">,
): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session)) return true;
  const setorSessao = normalizarSetor(session.setor);
  if (session.nivelAcesso !== "Líder de setor" || !setorSessao) return false;
  return setorSessao === normalizarSetor(indicador.setor);
}

/** Fechamento do mês é ato da Qualidade/Admin. */
export function podeFecharMes(session: UserSession | null | undefined): boolean {
  return podeGerenciarIndicadores(session);
}


