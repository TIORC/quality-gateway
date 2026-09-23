/**
 * Projetos e Planejamento Estratégico — domínio e constantes.
 *
 * Espelha a migration `20260924000000_projetos_estrategicos.sql`.
 * Os registros vêm mapeados de `projetos_estrategicos` em `projetos-base.ts`,
 * seguindo o mesmo estilo do módulo de planos de ação (`lib/planos-base.ts`):
 * a query usa `.select("*")` e o mapeamento é feito via `Record<string, unknown>`
 * para não depender do types.ts auto-gerado.
 */
import type { PlanoAcao } from "@/lib/planos";

export type TipoProjeto = "Planejamento Estratégico" | "Projeto";
export const TIPOS_PROJETO: TipoProjeto[] = ["Planejamento Estratégico", "Projeto"];

export type StatusProjeto =
  | "planejamento"
  | "em_andamento"
  | "concluido"
  | "cancelado"
  | "pausado";

export const STATUS_PROJETO: StatusProjeto[] = [
  "planejamento",
  "em_andamento",
  "concluido",
  "cancelado",
  "pausado",
];

export const STATUS_PROJETO_LABELS: Record<StatusProjeto, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  pausado: "Pausado",
};

export const STATUS_PROJETO_COR: Record<StatusProjeto, string> = {
  planejamento: "bg-[#FEF3C7] text-[#B45309]",
  em_andamento: "bg-[#EEF2FF] text-[#4F46E5]",
  concluido: "bg-[#ECFDF3] text-[#047857]",
  cancelado: "bg-[#FEF2F2] text-[#B91C1C]",
  pausado: "bg-[#F1F5F9] text-[#475569]",
};

export const PRIORIDADES_PROJETO = ["Baixa", "Média", "Alta", "Crítica"] as const;
export type PrioridadeProjeto = (typeof PRIORIDADES_PROJETO)[number];

export interface Swot {
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
}
export const SWOT_CHAVES: (keyof Swot)[] = ["forcas", "fraquezas", "oportunidades", "ameacas"];
export const SWOT_LABELS: Record<keyof Swot, string> = {
  forcas: "Forças",
  fraquezas: "Fraquezas",
  oportunidades: "Oportunidades",
  ameacas: "Ameaças e riscos",
};

export interface FrenteTrabalho {
  id: string;
  nome: string;
  descricao: string;
  setores: string[];
}

export interface KanbanColuna {
  id: string;
  nome: string;
  /** Status de plano mapeados a esta coluna. */
  status: string[];
}

export const KANBAN_COLUNAS_DEFAULT: KanbanColuna[] = [
  { id: "afazer", nome: "A fazer", status: ["nao_iniciado", "aberta"] },
  { id: "andamento", nome: "Em andamento", status: ["em_andamento", "atrasada"] },
  { id: "concluido", nome: "Concluído", status: ["concluida", "cancelado"] },
];

export interface ProjetoEstrategico {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoProjeto;
  objetivo: string;
  setor: string;
  responsavelId: string;
  responsavelNome: string;
  responsavelEmail: string;
  grupoAlvo: string;
  inicio: string | null;
  fimPrevisto: string | null;
  fimReal: string | null;
  prioridade: PrioridadeProjeto;
  status: StatusProjeto;
  swot: Swot;
  frentes: FrenteTrabalho[];
  kanbanColunas: KanbanColuna[];
  /** Ações (planos) vinculadas a este projeto — carregadas separadamente. */
  acoes?: PlanoAcao[];
  createdAt: string;
  updatedAt: string;
}

/** Converte "01/09/2026" (BR) -> "2026-09-01" (ISO date). */
export function dataBrParaISO(valor: string): string | null {
  const m = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1]!;
  const mm = m[2]!;
  const aa = m[3]!;
  return `${aa}-${mm}-${dd}`;
}

/** Converte ISO date "2026-09-01" -> "01/09/2026" (BR). */
export function dataISOparaBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

/** Progresso do projeto pela média de status das ações vinculadas (0–100). */
export function progressoDoProjeto(projeto: ProjetoEstrategico): number {
  const acoes = projeto.acoes ?? [];
  if (acoes.length === 0) return projeto.status === "concluido" ? 100 : 0;
  const pesos: Record<string, number> = {
    nao_iniciado: 0, aberta: 5, em_andamento: 50, atrasada: 40,
    concluida: 100, cancelado: 0,
  };
  const soma = acoes.reduce((acc, a) => acc + (pesos[a.status] ?? 0), 0);
  return Math.round(soma / acoes.length);
}
