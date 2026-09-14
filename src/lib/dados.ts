export const SETORES = [
  "Qualidade",
  "TI",
  "Fiscal",
  "Contábil",
  "Sucesso do Cliente",
  "Financeiro",
  "RH",
  "Operações",
  "Direção",
  "Técnico",
] as const;

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

export const UNIDADES = ["Matriz", "Filial 1", "Filial 2"] as const;

export type TipoAuditoria = "Interna" | "Externa";

export const TIPOS_AUDITORIA: TipoAuditoria[] = ["Interna", "Externa"];

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
}

export const COLABORADORES: Colaborador[] = [];
