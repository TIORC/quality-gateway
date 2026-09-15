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

/**
 * Cargos organizados por setor. Cada setor tem as colunas com as suas próprias
 * funções — é daqui que sai a lista de cargos do cadastro de colaboradores.
 */
export const CARGOS_POR_SETOR: Record<string, string[]> = {
  Qualidade: ["Coordenador da Qualidade", "Assistente de Qualidade", "Auxiliar de Qualidade"],
  TI: [
    "Desenvolvedor Pleno",
    "Desenvolvedor Júnior",
    "Infraestrutura",
    "Analista de Suporte",
    "Administrador do Sistema",
  ],
  Fiscal: ["Operador(a) Fiscal", "Assistente Fiscal"],
  Contábil: ["Analista Contábil", "Assistente Contábil"],
  "Sucesso do Cliente": ["Analista de Sucesso do Cliente", "Assistente de Sucesso do Cliente"],
  Financeiro: ["Analista Financeiro", "Assistente Financeiro"],
  RH: ["Analista de RH", "Assistente de RH"],
  Operações: ["Supervisor de Operações", "Assistente Administrativo"],
  Direção: ["CEO", "Diretor(a)"],
  Técnico: ["Gerência Técnica", "Analista Técnico"],
};

/** Lista plana de todos os cargos, derivada de CARGOS_POR_SETOR. */
export const CARGOS: string[] = [...new Set(Object.values(CARGOS_POR_SETOR).flat())];

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
}

/** Mock de colaboradores (banco de dados em memória, por enquanto). */
export const COLABORADORES: Colaborador[] = [
  {
    id: "col_welder",
    nome: "Welder Silva",
    cargo: "Desenvolvedor Pleno",
    email: "welder@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "TI",
    nivelAcesso: "Líder de setor",
    exclusao: "Sem acesso",
  },
  {
    id: "col_jacson",
    nome: "Jacson Mascarenhas",
    cargo: "CEO",
    email: "jacson@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "Direção",
    nivelAcesso: "Diretoria",
    exclusao: "Sem acesso",
  },
  {
    id: "col_celso",
    nome: "Celso Alcantara",
    cargo: "Gerência Técnica",
    email: "celso.alcantara@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "Técnico",
    nivelAcesso: "Diretoria",
    exclusao: "Sem acesso",
  },
  {
    id: "col_kaylane",
    nome: "Kaylane Oliveira",
    cargo: "Assistente de Qualidade",
    email: "kaylane.oliveira@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "Qualidade",
    nivelAcesso: "Colaborador",
    exclusao: "Sem acesso",
  },
  {
    id: "col_gustavo",
    nome: "Gustavo Ronaldy",
    cargo: "Auxiliar de Qualidade",
    email: "ronaldy.souza@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "Qualidade",
    nivelAcesso: "Colaborador",
    exclusao: "Sem acesso",
  },
  {
    id: "col_olandson",
    nome: "Olandson de Jesus",
    cargo: "Coordenador da Qualidade",
    email: "olandson@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "Qualidade",
    nivelAcesso: "Gestor da Qualidade",
    exclusao: "Permitido",
  },
  {
    id: "col_gabriel",
    nome: "Gabriel Anacleto",
    cargo: "Desenvolvedor Júnior",
    email: "gabriel.anacleto@orcoma.com.br",
    unidade: "Matriz",
    cidade: "Maracás/BA",
    setor: "TI",
    nivelAcesso: "Desenvolvedor",
    exclusao: "Sem acesso",
  },
];

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

/**
 * Histórico de acesso e leitura de processos, por colaborador.
 *
 * Mock em memória — na versão de produção estes números virão da trilha de
 * auditoria da plataforma (quem abriu e quem leu cada processo e quando).
 */
const ACESSOS_FUNCIONARIOS: Record<
  string,
  Pick<Funcionario, "status" | "ultimoAcesso" | "processosVisualizados" | "processosLidos">
> = {
  col_welder: {
    status: "Ativo",
    ultimoAcesso: "2026-09-14T17:42:00",
    processosVisualizados: 38,
    processosLidos: 24,
  },
  col_jacson: {
    status: "Ativo",
    ultimoAcesso: "2026-09-15T08:05:00",
    processosVisualizados: 12,
    processosLidos: 9,
  },
  col_celso: {
    status: "Ativo",
    ultimoAcesso: "2026-09-12T16:20:00",
    processosVisualizados: 27,
    processosLidos: 15,
  },
  col_kaylane: {
    status: "Ativo",
    ultimoAcesso: "2026-09-15T07:58:00",
    processosVisualizados: 64,
    processosLidos: 58,
  },
  col_gustavo: {
    status: "Inativo",
    ultimoAcesso: null,
    processosVisualizados: 0,
    processosLidos: 0,
  },
  col_olandson: {
    status: "Ativo",
    ultimoAcesso: "2026-09-15T09:14:00",
    processosVisualizados: 96,
    processosLidos: 88,
  },
  col_gabriel: {
    status: "Ativo",
    ultimoAcesso: "2026-09-15T08:47:00",
    processosVisualizados: 18,
    processosLidos: 6,
  },
};

/**
 * Lista de funcionários cadastrados na plataforma.
 *
 * Derivada do cadastro de colaboradores (`COLABORADORES`) para manter uma única
 * fonte de verdade dos dados de identificação.
 */
export const FUNCIONARIOS: Funcionario[] = COLABORADORES.map((colaborador) => {
  const acesso = ACESSOS_FUNCIONARIOS[colaborador.id] ?? {
    status: "Ativo" as StatusFuncionario,
    ultimoAcesso: null,
    processosVisualizados: 0,
    processosLidos: 0,
  };

  return {
    id: colaborador.id,
    nome: colaborador.nome,
    email: colaborador.email ?? "",
    cargo: colaborador.cargo,
    setor: colaborador.setor ?? "",
    ...acesso,
  };
});
