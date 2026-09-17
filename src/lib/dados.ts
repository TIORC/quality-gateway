/**
 * Constantes e tipos de domínio do portal.
 *
 * Os dados de setores, cargos, unidades, colaboradores e usuários de login
 * ficam no banco do Lovable Cloud — ver `src/lib/organizacao.ts` e
 * `supabase/migrations/20260915030000_org.sql`.
 */

/** Empresa representada por todos os colaboradores do portal. */
export const EMPRESA_ORCOMA = "ORCOMA ORGANIZACAO COMERCIAL E SERVICOS LTDA";

export const ORIGENS_ACAO = [
  "Auditoria Interna",
  "Não Conformidade",
  "Multas por Faltas",
  "Reclamação do Cliente",
  "Reunião Estratégica",
  "Indicadores",
  "Projetos",
  "Planejamento Estratégico",
  "Outros",
] as const;

export const PRIORIDADES = ["Crítica", "Alta", "Média", "Baixa"] as const;

export const NORMAS_AUDITORIA = [
  "ISO 9001:2015",
  "ISO 14001:2015",
  "ISO 45001:2018",
  "Outra",
] as const;

export type TipoAuditoria = "Interna" | "Externa";

export const TIPOS_AUDITORIA: TipoAuditoria[] = ["Interna", "Externa"];

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  email?: string;
  unidade?: string;
  cidade?: string;
  setor?: string;
  nivelAcesso?: string;
  grupos?: string;
  exclusao?: string;
  permAdicionarDocumentos?: boolean;
  permModificarDocumentos?: boolean;
  permExcluirDocumentos?: boolean;
}

export type StatusFuncionario = "Ativo" | "Inativo";

export const STATUS_FUNCIONARIO: StatusFuncionario[] = ["Ativo", "Inativo"];

export interface Funcionario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  setor: string;
  status: StatusFuncionario;
  /** Data e hora do último acesso (ISO). `null` quando nunca acessou. */
  ultimoAcesso: string | null;
  processosVisualizados: number;
  processosLidos: number;
}
