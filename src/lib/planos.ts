/**
 * Planos de Ação — domínio e constantes (Fase 1).
 *
 * Origens: lista fixa/parametrizável. Os nomes aqui espelham exatamente o
 * `seed` da tabela `public.plano_origens` (migration
 * 20260919010000_planos_painel_notificacoes.sql) para que o fallback local
 * (quando a tabela ainda não existe) produza os mesmos valores.
 */
export const ORIGENS_ACAO_FIXAS = [
  "Auditoria Interna",
  "Auditoria Externa",
  "Não Conformidade",
  "Reclamação de Cliente",
  "Análise Crítica",
  "Indicador de Desempenho",
  "Risco / Oportunidade",
  "Melhoria Contínua",
  "Solicitação de Cliente",
] as const;

/**
 * Origens ATIVAS por padrão (usadas na Fase 1). As demais ficam cadastradas
 * na tabela com `ativa = false`, disponíveis para uso futuro — basta
 * atualizar a flag em `plano_origens` que elas aparecem no formulário.
 */
export const ORIGENS_ATIVAS_PADRAO: ReadonlySet<string> = new Set([
  "Auditoria Interna",
  "Auditoria Externa",
  "Não Conformidade",
  "Reclamação de Cliente",
  "Análise Crítica",
  "Indicador de Desempenho",
  "Melhoria Contínua",
]);

/** Origem livre, usada quando a causa não está na lista parametrizada. */
export const ORIGEM_OUTROS = "Outros";

/** Tipos de registro do sistema aos quais uma ação pode ser vinculada. */
export const VINCULOS_ACAO = [
  "Não conformidade",
  "Auditoria",
  "Reclamação de cliente",
  "Análise crítica",
  "Indicador",
  "Risco / oportunidade",
  "POP",
  "Política",
  "Outro",
] as const;

export type VinculoAcao = (typeof VINCULOS_ACAO)[number];

export const STATUS_ACAO = [
  "nao_iniciado",
  "aberta",
  "em_andamento",
  "concluida",
  "atrasada",
  "cancelado",
] as const;

export type StatusAcao = (typeof STATUS_ACAO)[number];

export const STATUS_ACAO_LABELS: Record<StatusAcao, string> = {
  nao_iniciado: "Não iniciado",
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  atrasada: "Atrasado",
  cancelado: "Cancelado",
};

/** Status que não entram em atraso nem contam como pendentes. */
export const STATUS_ACAO_ENCERRADOS: ReadonlySet<StatusAcao> = new Set(["concluida", "cancelado"]);

export const PRIORIDADES_ACAO = ["Baixa", "Média", "Alta", "Crítica"] as const;

/** Marcos de progresso (atualização rápida por marcos, 0–100%). */
export const MARCOS_PROGRESSO = [0, 25, 50, 75, 100] as const;

/**
 * Sugere o status coerente com o progresso informado (usado nos marcos).
 * Não sobrescreve "cancelado"/"atrasada" — são decisões explícitas do usuário.
 */
export function sugerirStatusPorProgresso(progresso: number, atual: StatusAcao): StatusAcao {
  if (atual === "cancelado") return atual;
  if (progresso >= 100) return "concluida";
  if (progresso > 0) return atual === "atrasada" ? "atrasada" : "em_andamento";
  return atual === "atrasada" ? "atrasada" : "nao_iniciado";
}

export interface OrigemAcao { id: string; nome: string; ativa: boolean; ordem: number; }
export type AnexoPlano = { nome: string; url?: string; tipo?: string; tamanho?: number };

export interface PlanoAcao {
  id: string; codigo: string; titulo: string; descricao: string;
  detalhamento: string; status: StatusAcao; origem: string;
  origemOutros: string; setor: string; prioridade: string;
  responsavelId: string; responsavelNome: string; responsavelEmail: string;
  seguidores: string[]; seguidoresIds: string[];
  prazo: string | null; progresso: number;
  vinculoTipo: string; vinculoId: string; anexos: AnexoPlano[];
  concluidaEm: string | null; createdAt: string; updatedAt: string;
}

export interface ComentarioPlano {
  id: string; planoId: string; autorId: string; autorNome: string;
  autorEmail: string; mensagem: string; createdAt: string;
}

export interface HistoricoPlano {
  id: string; planoId: string; autorId: string; autorNome: string;
  autorEmail: string; campo: string; de: string; para: string; createdAt: string;
}

export function hojeISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function diasParaPrazo(prazo: string | null): number | null {
  if (!prazo) return null;
  const base = new Date(`${hojeISO()}T12:00:00`);
  const alvo = new Date(`${prazo}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

export function planoAtrasado(plano: Pick<PlanoAcao, "status" | "prazo">): boolean {
  if (plano.status === "concluida" || plano.status === "cancelado") return false;
  if (plano.status === "atrasada") return true;
  const dias = diasParaPrazo(plano.prazo);
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

export function prazoBrParaISO(valor: string): string | null {
  const m = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const aa = m[3];
  if (!dd || !mm || !aa) return null;
  return `${aa}-${mm}-${dd}`;
}
