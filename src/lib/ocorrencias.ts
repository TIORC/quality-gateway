/**
 * Ocorrências — domínio, constantes e helpers.
 *
 * Macro-etapas fixas (a "linha do metrô"): Abertura → Apuração → Julgamento →
 * Comunicação → Fechamento → Avaliação de Eficácia. Dentro de cada macro-etapa
 * o tipo de ocorrência pode ter subetapas próprias (fluxo customizado).
 */
import {
  AlertTriangle,
  FileWarning,
  Flame,
  GitBranch,
  HardHat,
  MessageSquareWarning,
  OctagonAlert,
  PackageX,
  ShieldAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { hojeISO } from "@/lib/planos";

/** Ícones disponíveis para tipos de ocorrência (string → componente lucide). */
export const ICONES_OCORRENCIA: Record<string, LucideIcon> = {
  AlertTriangle,
  MessageSquareWarning,
  OctagonAlert,
  GitBranch,
  HardHat,
  ShieldAlert,
  FileWarning,
  PackageX,
  Flame,
  UserX,
};

/** Resolve o componente do ícone informado (fallback: AlertTriangle). */
export function iconeTipoOcorrencia(nome: string | null | undefined): LucideIcon {
  return ICONES_OCORRENCIA[nome ?? ""] ?? AlertTriangle;
}

export const MACRO_ETAPAS = [
  "abertura",
  "apuracao",
  "julgamento",
  "comunicacao",
  "fechamento",
  "avaliacao_eficacia",
] as const;

export type MacroEtapa = (typeof MACRO_ETAPAS)[number];

export const MACRO_ETAPA_LABELS: Record<MacroEtapa, string> = {
  abertura: "Abertura",
  apuracao: "Apuração",
  julgamento: "Julgamento",
  comunicacao: "Comunicação",
  fechamento: "Fechamento",
  avaliacao_eficacia: "Avaliação de Eficácia",
};

export const MACRO_ETAPA_DESCRICAO: Record<MacroEtapa, string> = {
  abertura: "Registro inicial da ocorrência via formulário.",
  apuracao: "Investigação, coleta de evidências e causa raiz (5 Porquês, Ishikawa).",
  julgamento: "Decisão sobre procedência, gravidade e responsabilização.",
  comunicacao: "Notificação às partes envolvidas e áreas afetadas sobre a decisão e plano de ação.",
  fechamento: "Execução das ações corretivas e encerramento formal.",
  avaliacao_eficacia:
    "Verificação posterior (30/60/90 dias) se a ação resolveu o problema. Reabre automática se ineficaz.",
};

export type StatusOcorrencia = "em_andamento" | "encerrada" | "reaberta";

export const STATUS_OCORRENCIA_LABELS: Record<StatusOcorrencia, string> = {
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  reaberta: "Reaberta",
};

/** Resultado do julgamento da ocorrência (visível ao solicitante). */
export type ProcedenciaOcorrencia = "pendente" | "procedente" | "nao_procedente";

export const PROCEDENCIA_LABELS: Record<ProcedenciaOcorrencia, string> = {
  pendente: "Em análise",
  procedente: "Procedente",
  nao_procedente: "Não-procedente",
};

/** Ações permitidas em uma etapa. */
export const ACOES_ETAPA = ["aprovar", "reprovar", "solicitar_info", "escalar"] as const;
export type AcaoEtapa = (typeof ACOES_ETAPA)[number];

export const ACOES_ETAPA_LABELS: Record<AcaoEtapa, string> = {
  aprovar: "Aprovar",
  reprovar: "Reprovar",
  solicitar_info: "Solicitar mais informação",
  escalar: "Escalar",
};

/* -------------------------------------------------------------------------- */
/* Formulários (schema)                                                        */
/* -------------------------------------------------------------------------- */

export const TIPOS_CAMPO = [
  "texto",
  "textarea",
  "numero",
  "data",
  "select",
  "multi",
  "arquivo",
  "assinatura",
  "responsavel",
  "checkbox",
] as const;

export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const TIPO_CAMPO_LABELS: Record<TipoCampo, string> = {
  texto: "Texto curto",
  textarea: "Texto longo",
  numero: "Número",
  data: "Data",
  select: "Seletor único",
  multi: "Seletor múltiplo",
  arquivo: "Upload de arquivo/foto",
  assinatura: "Assinatura",
  responsavel: "Setor/Responsável (Funcionários)",
  checkbox: "Checkbox",
};

export interface CampoFormulario {
  id: string;
  tipo: TipoCampo;
  label: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  regex?: string;
  min?: number | null;
  max?: number | null;
  /** "inteira" (1 coluna) ou "metade" (2 colunas). */
  largura?: "inteira" | "metade";
  /** Mostrar somente quando o campo `campoId` responder `valor`. */
  condicao?: { campoId: string; valor: string } | null;
}

export type Respostas = Record<string, unknown>;

export interface AnexoOcorrencia {
  nome: string;
  caminho: string;
  tipo?: string;
  tamanho?: number;
}

/* -------------------------------------------------------------------------- */
/* Fluxo                                                                       */
/* -------------------------------------------------------------------------- */

export type ResponsavelTipo = "pessoa" | "cargo" | "setor";

export interface ResponsavelEtapa {
  tipo: ResponsavelTipo;
  id: string;
  nome: string;
  email?: string;
}

export interface SubetapaFluxo {
  id: string;
  nome: string;
  responsavel: ResponsavelEtapa;
  prazoDias: number;
  acoes: AcaoEtapa[];
  campos: CampoFormulario[];
  notificar: boolean;
  /** Ao reprovar: "voltar" (etapa anterior) ou "encerrar". */
  reprovarPara: "voltar" | "encerrar";
}

export interface MacroFluxo {
  macro: MacroEtapa;
  subetapas: SubetapaFluxo[];
}

export function fluxoVazio(): MacroFluxo[] {
  return MACRO_ETAPAS.map((macro) => ({ macro, subetapas: [] }));
}

export function fluxoDefault(tipo: TipoOcorrencia): MacroFluxo[] {
  // Fluxo mínimo: 1 subetapa por macro-etapa sob o setor responsável padrão,
  // herdando o SLA configurado no tipo.
  return MACRO_ETAPAS.map((macro) => ({
    macro,
    subetapas: [
      {
        id: `${macro}-padrao`,
        nome: MACRO_ETAPA_LABELS[macro],
        responsavel: { tipo: "setor" as const, id: "", nome: tipo.setorPadrao },
        prazoDias: tipo.slaDias[macro] ?? 5,
        acoes:
          macro === "abertura"
            ? (["aprovar"] as AcaoEtapa[])
            : (["aprovar", "reprovar", "solicitar_info"] as AcaoEtapa[]),
        campos: [],
        notificar: true,
        reprovarPara: "voltar" as const,
      },
    ],
  }));
}

/* -------------------------------------------------------------------------- */
/* Tipos de ocorrência e ocorrência                                            */
/* -------------------------------------------------------------------------- */

export type SlaPorEtapas = Record<MacroEtapa, number>;

export interface TipoOcorrencia {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  setorPadrao: string;
  slaDias: Partial<SlaPorEtapas>;
  ativo: boolean;
  ordem: number;
}

export interface AvaliacaoEficacia {
  prazoDias: number;
  verificacaoEm: string | null;
  eficaz: boolean | null;
  observacao: string;
}

export interface Ocorrencia {
  id: string;
  numero: string;
  titulo: string;
  tipoId: string;
  tipoNome: string;
  tipoCor: string;
  procedencia: ProcedenciaOcorrencia;
  formularioVersao: number;
  fluxoVersao: number;
  respostas: Respostas;
  macroAtual: MacroEtapa;
  subetapaAtualId: string;
  subetapaAtualNome: string;
  status: StatusOcorrencia;
  abertaPorId: string;
  abertaPorNome: string;
  abertaPorEmail: string;
  abertaPorSetor: string;
  responsavelId: string;
  responsavelNome: string;
  responsavelEmail: string;
  prazoEtapa: string | null;
  etapaEntrouEm: string;
  avaliacao: AvaliacaoEficacia | null;
  reaberturas: number;
  encerradaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormularioVersao {
  id: string;
  tipoId: string;
  versao: number;
  campos: CampoFormulario[];
  publicada: boolean;
  criadoPorNome: string;
  criadoPorEmail: string;
  createdAt: string;
}

export interface FluxoVersao {
  id: string;
  tipoId: string;
  versao: number;
  etapas: MacroFluxo[];
  publicada: boolean;
  criadoPorNome: string;
  criadoPorEmail: string;
  createdAt: string;
}

export interface EventoOcorrencia {
  id: string;
  ocorrenciaId: string;
  autorId: string;
  autorNome: string;
  autorEmail: string;
  acao: string;
  macro: string;
  subetapa: string;
  de: string;
  para: string;
  comentario: string;
  anexos: AnexoOcorrencia[];
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function idCurto(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function proximoNumero(ocorrencias: Ocorrencia[]): string {
  const ano = new Date().getFullYear();
  let max = 0;
  for (const o of ocorrencias) {
    const m = /^OCR-(\d{4})-(\d+)$/.exec(o.numero);
    if (!m) continue;
    const anoM = m[1];
    const numM = m[2];
    if (anoM === undefined || numM === undefined) continue;
    if (Number(anoM) === ano) max = Math.max(max, Number(numM));
  }
  return `OCR-${ano}-${String(max + 1).padStart(3, "0")}`;
}

/** Data (ISO dia) em que o prazo da etapa atual estoura. */
export function calcularPrazoEtapa(dias: number | undefined): string | null {
  const n = Number(dias);
  if (!n || n <= 0) return null;
  const base = new Date(`${hojeISO()}T12:00:00`);
  base.setDate(base.getDate() + Math.round(n));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/** Dias restantes até o prazo (negativo = estourado). */
export function diasParaPrazo(prazo: string | null): number | null {
  if (!prazo) return null;
  const base = new Date(`${hojeISO()}T12:00:00`);
  const alvo = new Date(`${prazo}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

export function ocorrenciaAtrasada(o: Ocorrencia): boolean {
  if (o.status === "encerrada") return false;
  const dias = diasParaPrazo(o.prazoEtapa);
  return dias !== null && dias < 0;
}

export function formatarPrazo(prazo: string | null): string {
  if (!prazo) return "—";
  const partes = prazo.split("-");
  const a = partes[0];
  const m = partes[1];
  const d = partes[2];
  return d && m && a ? `${d}/${m}/${a}` : prazo;
}

export function rotuloRelativoPrazo(prazo: string | null): string {
  const dias = diasParaPrazo(prazo);
  if (dias === null) return "Sem prazo";
  if (dias === 0) return "Vence hoje";
  if (dias < 0) return `Atrasado há ${Math.abs(dias)}d`;
  return `Faltam ${dias}d`;
}

/** Subetapas "achatadas" na ordem do fluxo (para navegar de/para). */
export function ordenarSubetapas(
  etapas: MacroFluxo[],
): { macro: MacroEtapa; subetapa: SubetapaFluxo }[] {
  const lista: { macro: MacroEtapa; subetapa: SubetapaFluxo }[] = [];
  for (const e of etapas) {
    for (const s of e.subetapas) lista.push({ macro: e.macro, subetapa: s });
  }
  return lista;
}

export function subetapaDe(
  etapas: MacroFluxo[],
  macro: MacroEtapa,
  subetapaId: string,
): SubetapaFluxo | null {
  const e = etapas.find((x) => x.macro === macro);
  if (!e) return null;
  return e.subetapas.find((s) => s.id === subetapaId) ?? e.subetapas[0] ?? null;
}

/** Responsável em texto legível (pessoa / cargo / setor). */
export function rotuloResponsavel(r: ResponsavelEtapa): string {
  if (!r || (!r.nome && !r.email)) return "A definir";
  const sufixo = r.tipo === "setor" ? "" : r.tipo === "cargo" ? " (cargo)" : "";
  return `${r.nome || "—"}${sufixo}`;
}

/** Texto que resume a resposta de um campo (para resumo/preview). */
export function textoResposta(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return v
      .map((i) =>
        typeof i === "object" && i && "nome" in i ? String((i as AnexoOcorrencia).nome) : String(i),
      )
      .join(", ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return typeof o["nome"] === "string" ? o["nome"] : "—";
  }
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

/** Progresso geral (0–100): posição atual do fluxo sobre o total de etapas. */
export function progressoOcorrencia(
  o: Pick<Ocorrencia, "macroAtual" | "subetapaAtualId" | "status">,
  etapas: MacroFluxo[],
): number {
  if (o.status === "encerrada") return 100;
  const ordenadas = ordenarSubetapas(etapas);
  const total = ordenadas.length;
  if (total === 0) return 0;
  const idx = ordenadas.findIndex(
    (x) => x.macro === o.macroAtual && x.subetapa.id === o.subetapaAtualId,
  );
  return Math.round(((idx < 0 ? 0 : idx) / total) * 100);
}
