/**
 * POPs — tipos, constantes e acesso a dados.
 *
 * A fonte preferencial é o banco do Lovable Cloud (`public.pop_setores` e
 * `public.pops`, criados em `supabase/migrations/20260915000000_pops.sql`).
 * Quando as variáveis do Cloud não estão configuradas, o módulo usa o conjunto
 * de demonstração em memória abaixo — inclusive para criar, editar, duplicar e
 * excluir, de modo que a tela continua utilizável em desenvolvimento.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { UserSession } from "@/lib/auth";
import { NIVEIS_FILTRAM_POR_SETOR } from "@/lib/niveis-acesso";
import { veSomenteLiberados } from "@/lib/permissoes";

type PopRow = Tables<"pops">;
type PopInsert = TablesInsert<"pops">;
type PopSetorRow = Tables<"pop_setores">;
type PopAnotacaoRow = Tables<"pop_anotacoes">;
type PopAnotacaoInsert = TablesInsert<"pop_anotacoes">;
type PopFavoritoInsert = TablesInsert<"pop_favoritos">;
type PopLeituraRow = Tables<"pop_leituras">;
type NotificacaoRow = Tables<"notificacoes">;

/** O Lovable Cloud está sempre disponível neste projeto. */
const lovableCloudConfigurado = true;

/** Devolve o cliente do Cloud. */
function exigirCloud() {
  return supabase;
}

/* -------------------------------------------------------------------------- */
/* Domínio                                                                    */
/* -------------------------------------------------------------------------- */

export interface SetorPop {
  id: string;
  nome: string;
  prefixo: string;
  categoria: string;
  /** Chave do ícone exibido na grade (ver `ICONES_SETOR` em `src/routes/pops.tsx`). */
  icone: string;
  ordem: number;
}

export interface Pop {
  id: string;
  setorId: string;
  codigo: string;
  titulo: string;
  descricao: string;
  departamento: string;
  categoria: string;
  frequencia: string;
  prazoReferencia: string;
  regime: string;
  dificuldade: string;
  cargoResponsavel: string;
  /** Dia do mês em que o prazo começa. */
  diaInicio: number | null;
  /** Dia ideal (meta) de conclusão. */
  metaDia: number | null;
  /** Data limite legal, no formato `aaaa-mm-dd`. */
  prazoLegal: string | null;
  favoritos: number;
  anotacoes: number;
  arquivo: string | null;
  /** Objetivo do procedimento (abertura do POP). */
  objetivo?: string;
  /** Materiais e sistemas necessários. */
  materiaisSistemas?: string;
  /** Documentos gerados ao final. */
  documentosGerados?: string;
  /** Links de apoio (vídeos, manuais, planilhas). */
  linksRelacionados?: string[];
  /** Observações e boas práticas. */
  observacoes?: string;
  /** Etapas do procedimento, com nível de recuo (0 = passo principal). */
  etapas?: PopEtapa[];
  /** Anexo (WORD/PDF) guardado no bucket privado `pop-anexos`. */
  anexo?: PopAnexo | null;
}

/** Um passo do procedimento. */
export interface PopEtapa {
  /** Nível de recuo: 0 = passo principal, 1 = subpasso, 2 = subsubpasso... */
  nivel: number;
  texto: string;
}

/** Anexo do POP armazenado no bucket privado (sem link público). */
export interface PopAnexo {
  path: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
}

/** Decisão registrada na leitura de um POP. */
export type DecisaoLeitura = "concordo" | "discordo";

/** Leitura/ciência de um usuário sobre um POP. */
export interface PopLeitura {
  id: string;
  popId: string;
  usuarioEmail: string;
  usuarioNome: string;
  decisao: DecisaoLeitura;
  justificativa: string;
  createdAt: string;
}

/** Notificação interna (ex.: discordância enviada à Qualidade). */
export interface Notificacao {
  id: string;
  destinatarioEmail: string;
  destinatarioNome: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  popId: string | null;
  autorNome: string;
  autorEmail: string;
  lida: boolean;
  createdAt: string;
}

/** Anotação/comentário registrado em um POP. */
export interface PopAnotacao {
  id: string;
  popId: string;
  autorNome: string;
  autorEmail: string;
  mensagem: string;
  createdAt: string;
}

/** Contadores reais de um POP: favoritos únicos + comentários registrados. */
export interface ContadoresPop {
  favoritos: number;
  anotacoes: number;
}

/** Contadores de um POP que ainda não recebeu favorito nem comentário. */
export const CONTADORES_ZERADOS: ContadoresPop = { favoritos: 0, anotacoes: 0 };

/** Identificação de quem está favoritando (vem da sessão do portal). */
export interface UsuarioFavorito {
  email: string;
  nome: string;
  /** Registro do colaborador (`colaboradores.id`), quando o login está vinculado. */
  colaboradorId?: string;
}

/** Dados editáveis de um POP (contadores entram com zero no cadastro). */
export type EntradaPop = Omit<Pop, "id" | "favoritos" | "anotacoes">;

export type FonteDados = "cloud" | "demonstracao";

/** De onde os dados estão vindo agora. */
export function fonteDados(): FonteDados {
  return lovableCloudConfigurado ? "cloud" : "demonstracao";
}

/* -------------------------------------------------------------------------- */
/* Opções aceitas pelo banco                                                  */
/* -------------------------------------------------------------------------- */

export const FREQUENCIAS = [
  "MENSAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
  "EVENTUAL",
] as const;

export const PRAZOS_REFERENCIA = ["MES_ATUAL", "MES_ANTERIOR", "ANO_ANTERIOR"] as const;

export const REGIMES = [
  "TODOS",
  "SIMPLES_NACIONAL",
  "LUCRO_PRESUMIDO",
  "LUCRO_REAL",
  "MEI",
  "IMUNE_ISENTA",
] as const;

export const DIFICULDADES = ["FACIL", "MEDIO", "DIFICIL"] as const;

export const CARGOS_RESPONSAVEIS = [
  "ESTAGIARIO",
  "AUXILIAR",
  "ASSISTENTE",
  "ANALISTA",
  "SUPERVISOR",
  "COORDENADOR",
] as const;

export const CATEGORIAS = [
  "FISCAL",
  "CONTABIL",
  "PESSOAL",
  "FINANCEIRO",
  "LEGALIZACAO",
  "QUALIDADE",
  "TI",
  "DIRECAO",
  "GERAL",
] as const;

/* -------------------------------------------------------------------------- */
/* Rótulos exibidos na interface                                              */
/* -------------------------------------------------------------------------- */

const ROTULOS: Record<string, string> = {
  MES_ATUAL: "MÊS ATUAL",
  MES_ANTERIOR: "MÊS ANTERIOR",
  ANO_ANTERIOR: "ANO ANTERIOR",
  TODOS: "TODOS",
  SIMPLES_NACIONAL: "SIMPLES NACIONAL",
  LUCRO_PRESUMIDO: "LUCRO PRESUMIDO",
  LUCRO_REAL: "LUCRO REAL",
  MEI: "MEI",
  IMUNE_ISENTA: "IMUNE / ISENTA",
  FACIL: "FÁCIL",
  MEDIO: "MÉDIO",
  DIFICIL: "DIFÍCIL",
  ESTAGIARIO: "ESTAGIÁRIO",
  AUXILIAR: "AUXILIAR",
  ASSISTENTE: "ASSISTENTE",
  ANALISTA: "ANALISTA",
  SUPERVISOR: "SUPERVISOR",
  COORDENADOR: "COORDENADOR",
  MENSAL: "MENSAL",
  BIMESTRAL: "BIMESTRAL",
  TRIMESTRAL: "TRIMESTRAL",
  SEMESTRAL: "SEMESTRAL",
  ANUAL: "ANUAL",
  EVENTUAL: "EVENTUAL",
  CONTABIL: "CONTÁBIL",
  PESSOAL: "PESSOAL",
  FINANCEIRO: "FINANCEIRO",
  LEGALIZACAO: "LEGALIZAÇÃO",
  QUALIDADE: "QUALIDADE",
  TI: "TI",
  DIRECAO: "DIREÇÃO",
  GERAL: "GERAL",
  FISCAL: "FISCAL",
};

/** Converte o valor gravado no banco no rótulo exibido (ex.: `MES_ANTERIOR`). */
export function rotuloDoValor(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULOS[valor] ?? valor.replace(/_/g, " ").toUpperCase();
}
/* -------------------------------------------------------------------------- */
/* Dataset de demonstração (offline / sem Lovable Cloud)                      */
/* -------------------------------------------------------------------------- */

const SETORES_POP_MOCK: SetorPop[] = [
  {
    id: "fiscal",
    nome: "Processos Fiscais",
    prefixo: "FIS",
    categoria: "FISCAL",
    icone: "receipt",
    ordem: 1,
  },
  {
    id: "contabil",
    nome: "Processos Contábeis",
    prefixo: "CTB",
    categoria: "CONTABIL",
    icone: "calculator",
    ordem: 2,
  },
  {
    id: "pessoal",
    nome: "Processos de Pessoal",
    prefixo: "RH",
    categoria: "PESSOAL",
    icone: "users",
    ordem: 3,
  },
  {
    id: "financeiro",
    nome: "Processos Financeiros",
    prefixo: "FIN",
    categoria: "FINANCEIRO",
    icone: "wallet",
    ordem: 4,
  },
  {
    id: "legalizacao",
    nome: "Processos de Legalização",
    prefixo: "LEG",
    categoria: "LEGALIZACAO",
    icone: "scale",
    ordem: 5,
  },
  {
    id: "qualidade",
    nome: "Processos da Qualidade",
    prefixo: "QUA",
    categoria: "QUALIDADE",
    icone: "shield",
    ordem: 6,
  },
  { id: "ti", nome: "Processos de TI", prefixo: "TI", categoria: "TI", icone: "monitor", ordem: 7 },
  {
    id: "direcao",
    nome: "Processos de Direção",
    prefixo: "DIR",
    categoria: "DIRECAO",
    icone: "building",
    ordem: 8,
  },
];

const POPS_MOCK_BASE: Pop[] = [
  {
    id: "m-fis-01",
    setorId: "fiscal",
    codigo: "FIS-01",
    titulo: "Apuração do ICMS",
    descricao:
      "Conferência das notas de entrada e saída, cálculo do imposto devido e geração da guia de recolhimento estadual.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "LUCRO_PRESUMIDO",
    dificuldade: "MEDIO",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 5,
    prazoLegal: "2026-09-15",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-02",
    setorId: "fiscal",
    codigo: "FIS-02",
    titulo: "Apuração do PIS/COFINS",
    descricao:
      "Apuração das contribuições sobre o faturamento, conferência das retenções e envio das guias.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "LUCRO_PRESUMIDO",
    dificuldade: "MEDIO",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 6,
    prazoLegal: "2026-09-20",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-03",
    setorId: "fiscal",
    codigo: "FIS-03",
    titulo: "Escrituração do ISS",
    descricao:
      "Levantamento dos serviços prestados, cálculo do ISS por município e emissão das guias.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "SIMPLES_NACIONAL",
    dificuldade: "FACIL",
    cargoResponsavel: "AUXILIAR",
    diaInicio: 1,
    metaDia: 7,
    prazoLegal: "2026-09-18",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-04",
    setorId: "fiscal",
    codigo: "FIS-04",
    titulo: "Recolhimento do IRPJ/CSLL (estimativa)",
    descricao:
      "Cálculo da estimativa mensal com base no lucro real, controle das antecipações e diferenças a compensar.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "LUCRO_REAL",
    dificuldade: "DIFICIL",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 10,
    prazoLegal: "2026-09-25",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-05",
    setorId: "fiscal",
    codigo: "FIS-05",
    titulo: "Geração da DCTFWeb",
    descricao:
      "Conferência dos débitos declarados, vinculação das retenções e transmissão da declaração de débitos.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "ASSISTENTE",
    diaInicio: 5,
    metaDia: 12,
    prazoLegal: "2026-09-30",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-06",
    setorId: "fiscal",
    codigo: "FIS-06",
    titulo: "Declaração do Simples Nacional (PGDAS-D)",
    descricao:
      "Importação das receitas, segregação por anexo, comparação da partilha e transmissão do PGDAS-D.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "SIMPLES_NACIONAL",
    dificuldade: "FACIL",
    cargoResponsavel: "ASSISTENTE",
    diaInicio: 1,
    metaDia: 15,
    prazoLegal: "2026-09-30",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-07",
    setorId: "fiscal",
    codigo: "FIS-07",
    titulo: "EFD-Contribuições",
    descricao:
      "Escrituração fiscal digital das contribuições e conferência dos débitos apurados no mês.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "AUXILIAR",
    diaInicio: 1,
    metaDia: 12,
    prazoLegal: "2026-09-28",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-08",
    setorId: "fiscal",
    codigo: "FIS-08",
    titulo: "ECD / ECF — escrituração fiscal",
    descricao:
      "Geração e assinatura digital da escrituração contábil e fiscal do exercício anterior.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "ANUAL",
    prazoReferencia: "ANO_ANTERIOR",
    regime: "LUCRO_PRESUMIDO",
    dificuldade: "DIFICIL",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 20,
    prazoLegal: "2026-09-30",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fis-09",
    setorId: "fiscal",
    codigo: "FIS-09",
    titulo: "Restituição e compensação de tributos",
    descricao:
      "Levantamento de valores pagos a maior, preparação do pedido e acompanhamento no sistema da Receita.",
    departamento: "Fiscal",
    categoria: "FISCAL",
    frequencia: "EVENTUAL",
    prazoReferencia: "MES_ATUAL",
    regime: "TODOS",
    dificuldade: "DIFICIL",
    cargoResponsavel: "ANALISTA",
    diaInicio: null,
    metaDia: null,
    prazoLegal: "2026-10-10",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-ctb-01",
    setorId: "contabil",
    codigo: "CTB-01",
    titulo: "Conciliação bancária mensal",
    descricao: "Confronto dos extratos com os lançamentos contábeis e baixa dos itens pendentes.",
    departamento: "Contábil",
    categoria: "CONTABIL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "FACIL",
    cargoResponsavel: "AUXILIAR",
    diaInicio: 1,
    metaDia: 8,
    prazoLegal: "2026-09-20",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-ctb-02",
    setorId: "contabil",
    codigo: "CTB-02",
    titulo: "Balancete mensal e conferência de saldos",
    descricao: "Fechamento do balancete, análise das contas de resultado e ajustes de competência.",
    departamento: "Contábil",
    categoria: "CONTABIL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "ASSISTENTE",
    diaInicio: 3,
    metaDia: 12,
    prazoLegal: "2026-09-25",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-ctb-03",
    setorId: "contabil",
    codigo: "CTB-03",
    titulo: "Fechamento contábil anual",
    descricao:
      "Consolidação das contas do exercício, provisões, depreciação e demonstrações contábeis.",
    departamento: "Contábil",
    categoria: "CONTABIL",
    frequencia: "ANUAL",
    prazoReferencia: "ANO_ANTERIOR",
    regime: "TODOS",
    dificuldade: "DIFICIL",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 25,
    prazoLegal: "2026-09-30",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-rh-01",
    setorId: "pessoal",
    codigo: "RH-01",
    titulo: "Folha de pagamento mensal",
    descricao:
      "Processamento das rubricas fixas e variáveis, cálculo dos encargos e geração dos recibos.",
    departamento: "Pessoal",
    categoria: "PESSOAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ATUAL",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "ANALISTA",
    diaInicio: 20,
    metaDia: 28,
    prazoLegal: "2026-09-30",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-rh-02",
    setorId: "pessoal",
    codigo: "RH-02",
    titulo: "Envio do eSocial (S-1200 / S-1299)",
    descricao:
      "Conferência dos eventos periódicos, correção de inconsistentes e transmissão do fechamento.",
    departamento: "Pessoal",
    categoria: "PESSOAL",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "ASSISTENTE",
    diaInicio: 1,
    metaDia: 10,
    prazoLegal: "2026-09-15",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fin-01",
    setorId: "financeiro",
    codigo: "FIN-01",
    titulo: "Conciliação do fluxo de caixa",
    descricao:
      "Lançamento das movimentações diárias, conferência do saldo projetado e sinalização de desvios.",
    departamento: "Financeiro",
    categoria: "FINANCEIRO",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ATUAL",
    regime: "TODOS",
    dificuldade: "FACIL",
    cargoResponsavel: "AUXILIAR",
    diaInicio: 1,
    metaDia: 10,
    prazoLegal: "2026-09-25",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-fin-02",
    setorId: "financeiro",
    codigo: "FIN-02",
    titulo: "Fechamento e repasse de honorários",
    descricao:
      "Apuração das horas e serviços do mês, emissão da nota e programação do repasse ao cliente.",
    departamento: "Financeiro",
    categoria: "FINANCEIRO",
    frequencia: "MENSAL",
    prazoReferencia: "MES_ANTERIOR",
    regime: "TODOS",
    dificuldade: "MEDIO",
    cargoResponsavel: "ASSISTENTE",
    diaInicio: 5,
    metaDia: 15,
    prazoLegal: "2026-09-28",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
  {
    id: "m-qua-01",
    setorId: "qualidade",
    codigo: "QUA-01",
    titulo: "Controle de revisão dos POPs",
    descricao:
      "Revisão anual da carteira de POPs, atualização dos prazos e registro das evidências de aprovação.",
    departamento: "Qualidade",
    categoria: "QUALIDADE",
    frequencia: "ANUAL",
    prazoReferencia: "ANO_ANTERIOR",
    regime: "TODOS",
    dificuldade: "FACIL",
    cargoResponsavel: "ANALISTA",
    diaInicio: 1,
    metaDia: 15,
    prazoLegal: "2026-12-20",
    favoritos: 0,
    anotacoes: 0,
    arquivo: null,
  },
];

/** Cópia mutável usada pelo modo demonstração. */
const popsDemo = POPS_MOCK_BASE.map((pop) => ({ ...pop }));

/** Estado inicial de um novo POP (campos do formulário). */
export const ENTRADA_PADRAO: EntradaPop = {
  setorId: "fiscal",
  codigo: "FIS-00",
  titulo: "",
  descricao: "",
  departamento: "",
  categoria: "FISCAL",
  frequencia: "MENSAL",
  prazoReferencia: "MES_ANTERIOR",
  regime: "TODOS",
  dificuldade: "MEDIO",
  cargoResponsavel: "ANALISTA",
  diaInicio: null,
  metaDia: null,
  prazoLegal: null,
  arquivo: null,
};

/* -------------------------------------------------------------------------- */
/* Acesso a dados — Lovable Cloud (Supabase) com fallback demonstração        */
/* -------------------------------------------------------------------------- */

/** Conta, por `setor_id`, quantos POPs existem. */
export function contarPopsPorSetor(pops: Pop[]): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const pop of pops) {
    contagem[pop.setorId] = (contagem[pop.setorId] ?? 0) + 1;
  }
  return contagem;
}

function popDoRow(row: PopRow): Pop {
  return {
    id: row.id,
    setorId: row.setor_id,
    codigo: row.codigo,
    titulo: row.titulo,
    descricao: row.descricao,
    departamento: row.departamento,
    categoria: row.categoria,
    frequencia: row.frequencia,
    prazoReferencia: row.prazo_referencia,
    regime: row.regime,
    dificuldade: row.dificuldade,
    cargoResponsavel: row.cargo_responsavel,
    diaInicio: row.dia_inicio,
    metaDia: row.meta_dia,
    prazoLegal: row.prazo_legal,
    favoritos: row.favoritos,
    anotacoes: row.anotacoes,
    arquivo: row.arquivo,
    objetivo: row.objetivo,
    materiaisSistemas: row.materiais_sistemas,
    documentosGerados: row.documentos_gerados,
    linksRelacionados: row.links_relacionados ?? [],
    observacoes: row.observacoes,
    etapas: etapasDoRow(row.etapas),
    anexo: row.arquivo_path
      ? {
          path: row.arquivo_path,
          nome: row.arquivo_nome ?? row.arquivo_path,
          tipo: row.arquivo_tipo,
          tamanho: row.arquivo_tamanho,
        }
      : null,
  };
}

/** Converte o `jsonb etapas` em `PopEtapa[]` (tolerante a formatos antigos). */
function etapasDoRow(valor: unknown): PopEtapa[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((etapa) => {
      if (typeof etapa === "string") return { nivel: 0, texto: etapa };
      if (etapa && typeof etapa === "object" && "texto" in etapa) {
        const registro = etapa as { nivel?: unknown; texto?: unknown };
        return {
          nivel: typeof registro.nivel === "number" ? registro.nivel : 0,
          texto: typeof registro.texto === "string" ? registro.texto : "",
        };
      }
      return null;
    })
    .filter((etapa): etapa is PopEtapa => etapa !== null && etapa.texto.trim() !== "");
}

function setorDoRow(row: PopSetorRow): SetorPop {
  return {
    id: row.id,
    nome: row.nome,
    prefixo: row.prefixo,
    categoria: row.categoria,
    icone: row.icone,
    ordem: row.ordem,
  };
}

function anotacaoDoRow(row: PopAnotacaoRow): PopAnotacao {
  return {
    id: row.id,
    popId: row.pop_id,
    autorNome: row.autor_nome,
    autorEmail: row.autor_email,
    mensagem: row.mensagem,
    createdAt: row.created_at,
  };
}

function anotacaoParaInsercao(dados: {
  popId: string;
  autorNome: string;
  autorEmail: string;
  mensagem: string;
}): PopAnotacaoInsert {
  return {
    pop_id: dados.popId,
    autor_nome: dados.autorNome,
    autor_email: dados.autorEmail,
    mensagem: dados.mensagem,
  };
}

function popParaInsercao(entrada: EntradaPop): PopInsert {
  return {
    setor_id: entrada.setorId,
    codigo: entrada.codigo,
    titulo: entrada.titulo,
    descricao: entrada.descricao,
    departamento: entrada.departamento,
    categoria: entrada.categoria,
    frequencia: entrada.frequencia,
    prazo_referencia: entrada.prazoReferencia,
    regime: entrada.regime,
    dificuldade: entrada.dificuldade,
    cargo_responsavel: entrada.cargoResponsavel,
    dia_inicio: entrada.diaInicio,
    meta_dia: entrada.metaDia,
    prazo_legal: entrada.prazoLegal,
    arquivo: entrada.arquivo,
    objetivo: entrada.objetivo ?? "",
    materiais_sistemas: entrada.materiaisSistemas ?? "",
    documentos_gerados: entrada.documentosGerados ?? "",
    links_relacionados: entrada.linksRelacionados ?? [],
    observacoes: entrada.observacoes ?? "",
    etapas: (entrada.etapas ?? []) as unknown as NonNullable<PopInsert["etapas"]>,
  };
}

function traduzErro(erro: unknown): Error {
  if (erro && typeof erro === "object" && "message" in erro) {
    return new Error(String((erro as { message: unknown }).message));
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

async function listarSetoresCloud(): Promise<SetorPop[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_setores")
    .select("id,nome,prefixo,categoria,icone,ordem,created_at")
    .order("ordem", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(setorDoRow);
}

async function listarPopsCloud(setorId: string | "todos"): Promise<Pop[]> {
  const client = exigirCloud();
  let query = client
    .from("pops")
    .select("*", { count: "exact" })
    .order("codigo", { ascending: true });

  if (setorId !== "todos") query = query.eq("setor_id", setorId);

  const { data, error } = await query;
  if (error) throw traduzErro(error);
  return (data ?? []).map(popDoRow);
}

/* -------------------------------------------------------------------------- */
/* Contadores reais (favoritos e comentários)                                 */
/* -------------------------------------------------------------------------- */

/** Soma 1 no contador indicado do POP (cria a entrada quando ainda não existe). */
function somarContador(
  contadores: Record<string, ContadoresPop>,
  popId: string,
  campo: keyof ContadoresPop,
): void {
  const atual = contadores[popId] ?? { ...CONTADORES_ZERADOS };
  atual[campo] += 1;
  contadores[popId] = atual;
}

/**
 * Indica que a tabela ainda não existe no Cloud (migration não aplicada).
 * Serve para o módulo seguir funcionando enquanto a migration é publicada.
 */
function tabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const info = erro as { code?: unknown; message?: unknown };
  const codigo = typeof info.code === "string" ? info.code : "";
  const mensagem = typeof info.message === "string" ? info.message : "";
  return codigo === "42P01" || codigo === "PGRST205" || mensagem.includes("does not exist");
}

/**
 * Conta, por POP, os comentários e favoritos realmente gravados no banco.
 * A origem é sempre `public.pop_anotacoes` e `public.pop_favoritos` — as
 * colunas `pops.anotacoes`/`pops.favoritos` são apenas cache mantido por
 * trigger (ver `supabase/migrations/20260916010000_pop_contadores.sql`).
 */
async function carregarContadoresCloud(): Promise<Record<string, ContadoresPop>> {
  const client = exigirCloud();
  const [anotacoes, favoritos] = await Promise.all([
    client.from("pop_anotacoes").select("pop_id"),
    client.from("pop_favoritos").select("pop_id"),
  ]);
  if (anotacoes.error) throw traduzErro(anotacoes.error);

  const contadores: Record<string, ContadoresPop> = {};
  for (const linha of anotacoes.data ?? []) somarContador(contadores, linha.pop_id, "anotacoes");
  if (!favoritos.error) {
    for (const linha of favoritos.data ?? []) {
      somarContador(contadores, linha.pop_id, "favoritos");
    }
  } else if (!tabelaAusente(favoritos.error)) {
    throw traduzErro(favoritos.error);
  }
  return contadores;
}

function carregarContadoresDemo(): Record<string, ContadoresPop> {
  const contadores: Record<string, ContadoresPop> = {};
  for (const pop of popsDemo) {
    contadores[pop.id] = { favoritos: pop.favoritos, anotacoes: pop.anotacoes };
  }
  return contadores;
}

/**
 * Contadores reais de cada POP na fonte configurada. POPs sem comentário ou
 * favorito aparecem com zero.
 */
export async function carregarContadoresPops(): Promise<Record<string, ContadoresPop>> {
  return fonteDados() === "cloud" ? carregarContadoresCloud() : carregarContadoresDemo();
}

/** Devolve os POPs com os contadores reais aplicados (sobrescreve o cache). */
export function aplicarContadores(pops: Pop[], contadores: Record<string, ContadoresPop>): Pop[] {
  return pops.map((pop) => {
    const reais = contadores[pop.id] ?? CONTADORES_ZERADOS;
    return { ...pop, favoritos: reais.favoritos, anotacoes: reais.anotacoes };
  });
}

function setoresDemo(): SetorPop[] {
  return SETORES_POP_MOCK;
}

function listarPopsDemo(setorId: string | "todos"): Pop[] {
  return setorId === "todos"
    ? popsDemo.slice()
    : popsDemo.filter((pop) => pop.setorId === setorId).slice();
}

/** Carrega setores e POPs na fonte configurada (Cloud ou demonstração). */
export async function carregarPops(): Promise<{
  setores: SetorPop[];
  pops: Pop[];
  fonte: FonteDados;
}> {
  const fonte = fonteDados();
  if (fonte === "cloud") {
    const [setores, pops, contadores] = await Promise.all([
      listarSetoresCloud(),
      listarPopsCloud("todos"),
      carregarContadoresCloud(),
    ]);
    return { setores, pops: aplicarContadores(pops, contadores), fonte };
  }
  return {
    setores: setoresDemo(),
    pops: aplicarContadores(listarPopsDemo("todos"), carregarContadoresDemo()),
    fonte,
  };
}

async function criarPopCloud(entrada: EntradaPop): Promise<Pop> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .insert(popParaInsercao(entrada))
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar o POP.");
  return popDoRow(data);
}

async function atualizarPopCloud(id: string, entrada: EntradaPop): Promise<Pop> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .update(popParaInsercao(entrada))
    .eq("id", id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("POP não encontrado.");
  return popDoRow(data);
}

function novoId(): string {
  return `pop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function criarPopDemo(entrada: EntradaPop): Pop {
  const pop: Pop = {
    id: novoId(),
    ...entrada,
    favoritos: 0,
    anotacoes: 0,
  };
  popsDemo.unshift(pop);
  return pop;
}

function atualizarPopDemo(id: string, entrada: EntradaPop): Pop {
  const indice = popsDemo.findIndex((pop) => pop.id === id);
  if (indice === -1) throw new Error("POP não encontrado.");
  const original = popsDemo[indice];
  if (!original) throw new Error("POP não encontrado.");
  const atualizado: Pop = {
    ...original,
    ...entrada,
    id,
    favoritos: original.favoritos,
    anotacoes: original.anotacoes,
  };
  popsDemo[indice] = atualizado;
  return atualizado;
}

function excluirPopDemo(id: string): void {
  const indice = popsDemo.findIndex((pop) => pop.id === id);
  if (indice === -1) throw new Error("POP não encontrado.");
  popsDemo.splice(indice, 1);
}

export async function criarPop(entrada: EntradaPop): Promise<Pop> {
  return fonteDados() === "cloud" ? criarPopCloud(entrada) : criarPopDemo(entrada);
}

export async function atualizarPop(id: string, entrada: EntradaPop): Promise<Pop> {
  return fonteDados() === "cloud" ? atualizarPopCloud(id, entrada) : atualizarPopDemo(id, entrada);
}

export async function excluirPop(id: string): Promise<void> {
  if (fonteDados() === "cloud") {
    const client = exigirCloud();
    const { error } = await client.from("pops").delete().eq("id", id);
    if (error) throw traduzErro(error);
  } else {
    excluirPopDemo(id);
  }
}

/** Duplica um POP: novo id, código com sufixo `-C` e título marcado como cópia. */
export async function duplicarPop(origem: Pop): Promise<Pop> {
  const entrada: EntradaPop = {
    setorId: origem.setorId,
    codigo: `${origem.codigo}-C`,
    titulo: `${origem.titulo} (cópia)`,
    descricao: origem.descricao,
    departamento: origem.departamento,
    categoria: origem.categoria,
    frequencia: origem.frequencia,
    prazoReferencia: origem.prazoReferencia,
    regime: origem.regime,
    dificuldade: origem.dificuldade,
    cargoResponsavel: origem.cargoResponsavel,
    diaInicio: origem.diaInicio,
    metaDia: origem.metaDia,
    prazoLegal: origem.prazoLegal,
    arquivo: origem.arquivo,
    objetivo: origem.objetivo ?? "",
    materiaisSistemas: origem.materiaisSistemas ?? "",
    documentosGerados: origem.documentosGerados ?? "",
    linksRelacionados: origem.linksRelacionados ?? [],
    observacoes: origem.observacoes ?? "",
    etapas: origem.etapas ?? [],
  };
  return criarPop(entrada);
}

/* -------------------------------------------------------------------------- */
/* Liberação individual de documentos e filtro por nível de acesso            */
/* -------------------------------------------------------------------------- */

/**
 * Ids dos documentos liberados individualmente a um colaborador.
 * @param tipo tipo de documento (hoje, apenas "pop").
 */
export async function listarDocumentosLiberados(
  colaboradorId: string,
  tipo = "pop",
): Promise<string[]> {
  if (!colaboradorId) return [];
  const client = exigirCloud();
  const { data, error } = await client
    .from("documentos_liberados")
    .select("documento_id")
    .eq("colaborador_id", colaboradorId)
    .eq("documento_tipo", tipo);
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map((linha) => linha.documento_id);
}

/**
 * Salva o conjunto de documentos liberados a um colaborador: apaga as
 * liberações anteriores e reinsere a lista informada (delete + insert).
 */
export async function salvarLiberacaoDocumentos(
  colaboradorId: string,
  popIds: string[],
  tipo = "pop",
  criadoPor = "",
): Promise<void> {
  if (!colaboradorId) throw new Error("Colaborador inválido para liberar documentos.");
  const client = exigirCloud();
  const { error: erroDelete } = await client
    .from("documentos_liberados")
    .delete()
    .eq("colaborador_id", colaboradorId)
    .eq("documento_tipo", tipo);
  if (erroDelete) throw traduzErro(erroDelete);
  if (popIds.length === 0) return;
  const registros = popIds.map((documentoId) => ({
    colaborador_id: colaboradorId,
    documento_tipo: tipo,
    documento_id: documentoId,
    criado_por: criadoPor,
  }));
  const { error } = await client.from("documentos_liberados").insert(registros);
  if (error) throw traduzErro(error);
}

/**
 * Mapa pragmático do nome do setor organizacional para o prefixo dos POPs
 * (ex.: "Fiscal" → "FIS"). Comparação por `pop.codigo.startsWith(prefixo)`.
 * Quando não há mapeamento, o POP não é filtrado.
 */
const SETOR_PARA_PREFIXO: Record<string, string> = {
  fiscal: "FIS",
  contabil: "CON",
  contábil: "CON",
  pessoal: "RH",
  rh: "RH",
  financeiro: "FIN",
  legalizacao: "LEG",
  legalização: "LEG",
  qualidade: "QUA",
  ti: "TI",
  tecnico: "TEC",
  técnico: "TEC",
  direcao: "DIR",
  direção: "DIR",
  geral: "GER",
};

function prefixoDoSetor(nomeSetor: string): string | null {
  const chave = nomeSetor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SETOR_PARA_PREFIXO[chave] ?? null;
}

/**
 * Carrega setores e POPs considerando o nível de acesso da sessão:
 * - "Colaborador de outra unidade": somente os POPs liberados individualmente.
 * - "Colaborador" / "Líder de setor": somente POPs do setor do colaborador
 *   (quando houver mapeamento de prefixo).
 * - Demais níveis (ou sem sessão): sem filtro.
 */
export async function carregarPopsAcessiveis(session: UserSession | null): Promise<{
  setores: SetorPop[];
  pops: Pop[];
  fonte: FonteDados;
}> {
  const base = await carregarPops();
  if (!session) return base;

  try {
    if (veSomenteLiberados(session)) {
      if (!session.colaboradorId) return { ...base, pops: [] };
      const ids = new Set(await listarDocumentosLiberados(session.colaboradorId, "pop"));
      return { ...base, pops: base.pops.filter((pop) => ids.has(pop.id)) };
    }

    const filtramPorSetor = NIVEIS_FILTRAM_POR_SETOR.has(session.nivelAcesso);
    const prefixo = filtramPorSetor ? prefixoDoSetor(session.setor ?? "") : null;
    if (prefixo) {
      return { ...base, pops: base.pops.filter((pop) => pop.codigo.startsWith(prefixo)) };
    }
  } catch {
    // Sem a tabela de liberações (migration pendente): segue sem filtro extra.
  }
  return base;
}

/** Mapa de anotações por POP (só usado no modo demonstração). */
const anotacoesDemo = new Map<string, PopAnotacao[]>();

async function listarAnotacoesCloud(popId: string): Promise<PopAnotacao[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_anotacoes")
    .select("*")
    .eq("pop_id", popId)
    .order("created_at", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(anotacaoDoRow);
}

function listarAnotacoesDemo(popId: string): PopAnotacao[] {
  return anotacoesDemo.get(popId) ?? [];
}

async function criarAnotacaoCloud(
  popId: string,
  dados: Omit<PopAnotacao, "id" | "popId" | "createdAt">,
): Promise<PopAnotacao> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_anotacoes")
    .insert(anotacaoParaInsercao({ popId, ...dados }))
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível registrar a anotação.");
  const anotacao = anotacaoDoRow(data);
  // O contador `pops.anotacoes` é recalculado pelo trigger do banco
  // (`public.pops_sincronizar_contadores`) — o front nunca soma na mão.
  return anotacao;
}

function criarAnotacaoDemo(
  popId: string,
  dados: Omit<PopAnotacao, "id" | "popId" | "createdAt">,
): PopAnotacao {
  const anotacao: PopAnotacao = {
    id: `anot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    popId,
    ...dados,
    createdAt: new Date().toISOString(),
  };
  const atuais = anotacoesDemo.get(popId) ?? [];
  anotacoesDemo.set(popId, [...atuais, anotacao]);
  const pop = popsDemo.find((p) => p.id === popId);
  if (pop) pop.anotacoes += 1;
  return anotacao;
}

async function excluirAnotacaoCloud(anotacaoId: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("pop_anotacoes").delete().eq("id", anotacaoId);
  if (error) throw traduzErro(error);
}

function excluirAnotacaoDemo(anotacaoId: string): void {
  for (const [popId, lista] of anotacoesDemo) {
    const indice = lista.findIndex((a) => a.id === anotacaoId);
    if (indice === -1) continue;
    lista.splice(indice, 1);
    anotacoesDemo.set(popId, lista);
    const pop = popsDemo.find((p) => p.id === popId);
    if (pop) pop.anotacoes = Math.max(0, pop.anotacoes - 1);
    return;
  }
  throw new Error("Anotação não encontrada.");
}

/** Lista as anotações (comentários) de um POP, na fonte configurada. */
export async function listarAnotacoes(popId: string): Promise<PopAnotacao[]> {
  return fonteDados() === "cloud" ? listarAnotacoesCloud(popId) : listarAnotacoesDemo(popId);
}

/** Registra uma anotação no POP e atualiza o contador. */
export async function criarAnotacao(
  popId: string,
  dados: Omit<PopAnotacao, "id" | "popId" | "createdAt">,
): Promise<PopAnotacao> {
  return fonteDados() === "cloud"
    ? criarAnotacaoCloud(popId, dados)
    : criarAnotacaoDemo(popId, dados);
}

/** Exclui uma anotação do POP (o contador é sincronizado pelo banco). */
export async function excluirAnotacao(anotacao: PopAnotacao): Promise<void> {
  if (fonteDados() === "cloud") {
    await excluirAnotacaoCloud(anotacao.id);
  } else {
    excluirAnotacaoDemo(anotacao.id);
  }
}

/* -------------------------------------------------------------------------- */
/* Favoritos dos POPs                                                         */
/* -------------------------------------------------------------------------- */

/** Favoritos por e-mail (só usado no modo demonstração). */
const favoritosDemo = new Map<string, Set<string>>();

function favoritosDemoDoUsuario(email: string): Set<string> {
  const atual = favoritosDemo.get(email);
  if (atual) return atual;
  const novo = new Set<string>();
  favoritosDemo.set(email, novo);
  return novo;
}

function alternarFavoritoDemo(popId: string, email: string, favoritar: boolean): void {
  const doUsuario = favoritosDemoDoUsuario(email);
  const pop = popsDemo.find((p) => p.id === popId);
  if (favoritar) {
    if (doUsuario.has(popId)) return;
    doUsuario.add(popId);
    if (pop) pop.favoritos += 1;
    return;
  }
  if (!doUsuario.delete(popId)) return;
  if (pop) pop.favoritos = Math.max(0, pop.favoritos - 1);
}

/** Ids dos POPs que o colaborador já favoritou (0 quando não há nenhum). */
export async function carregarFavoritosDoUsuario(
  email: string,
  colaboradorId?: string,
): Promise<string[]> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return [];
  if (fonteDados() !== "cloud") return [...favoritosDemoDoUsuario(emailNormalizado)];

  const client = exigirCloud();
  if (colaboradorId) {
    // Cobre os favoritos salvos com o colaborador vinculado e os favoritos
    // antigos (pré-migration) que só têm o e-mail.
    const { data, error } = await client
      .from("pop_favoritos")
      .select("pop_id")
      .or(
        `colaborador_id.eq.${colaboradorId},and(usuario_email.eq.${emailNormalizado},colaborador_id.is.null)`,
      );
    if (error) {
      if (tabelaAusente(error)) {
        // Migration ainda não aplicada: lista apenas pelo e-mail.
        const semColuna = await client
          .from("pop_favoritos")
          .select("pop_id")
          .eq("usuario_email", emailNormalizado);
        if (semColuna.error) throw traduzErro(semColuna.error);
        return (semColuna.data ?? []).map((linha) => linha.pop_id);
      }
      throw traduzErro(error);
    }
    return (data ?? []).map((linha) => linha.pop_id);
  }

  const { data, error } = await client
    .from("pop_favoritos")
    .select("pop_id")
    .eq("usuario_email", emailNormalizado);
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map((linha) => linha.pop_id);
}

/** Favorita um POP (idempotente: favoritar duas vezes não soma dois). */
export async function favoritarPop(popId: string, usuario: UsuarioFavorito): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para favoritar um POP.");
  if (fonteDados() !== "cloud") {
    alternarFavoritoDemo(popId, email, true);
    return;
  }

  const client = exigirCloud();
  const registro: PopFavoritoInsert = {
    pop_id: popId,
    usuario_email: email,
    usuario_nome: usuario.nome,
  };
  // Com o `colaborador_id`, o favorito fica salvo no registro do colaborador.
  const comColaborador: PopFavoritoInsert = usuario.colaboradorId
    ? { ...registro, colaborador_id: usuario.colaboradorId }
    : registro;
  const { error } = await client
    .from("pop_favoritos")
    .upsert(comColaborador, { onConflict: "pop_id,usuario_email", ignoreDuplicates: true });
  if (error) {
    if (usuario.colaboradorId && tabelaAusente(error)) {
      // Migration ainda não aplicada: grava apenas com o e-mail.
      const semColuna = await client
        .from("pop_favoritos")
        .upsert(registro, { onConflict: "pop_id,usuario_email", ignoreDuplicates: true });
      if (semColuna.error) throw traduzErro(semColuna.error);
      return;
    }
    throw traduzErro(error);
  }
}

/** Remove o favorito do usuário (idempotente). */
export async function desfavoritarPop(popId: string, email: string): Promise<void> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return;
  if (fonteDados() !== "cloud") {
    alternarFavoritoDemo(popId, emailNormalizado, false);
    return;
  }

  const client = exigirCloud();
  const { error } = await client
    .from("pop_favoritos")
    .delete()
    .eq("pop_id", popId)
    .eq("usuario_email", emailNormalizado);
  if (error) throw traduzErro(error);
}

/* -------------------------------------------------------------------------- */
/* Tempo real (Supabase Realtime)                                             */
/* -------------------------------------------------------------------------- */
/* As tabelas `public.pop_anotacoes` e `public.pop_favoritos` são publicadas no
   Realtime pela migration `20260916010000_pop_contadores.sql`. Cada assinatura
   devolve a função que cancela o canal. */

/** Cancela uma assinatura de tempo real. */
export type CancelarAssinatura = () => void;

/** Observa novos comentários e favoritos de qualquer POP para atualizar os números. */
export function assinarContadoresPops(aoMudar: () => void): CancelarAssinatura {
  if (fonteDados() !== "cloud" || typeof window === "undefined") return () => {};
  const client = exigirCloud();
  const canal = client
    .channel("pop-contadores")
    .on("postgres_changes", { event: "*", schema: "public", table: "pop_anotacoes" }, () =>
      aoMudar(),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "pop_favoritos" }, () =>
      aoMudar(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(canal);
  };
}

/** Observa, em tempo real, os comentários de um POP específico. */
export function assinarAnotacoesPop(popId: string, aoMudar: () => void): CancelarAssinatura {
  if (fonteDados() !== "cloud" || typeof window === "undefined") return () => {};
  const client = exigirCloud();
  const canal = client
    .channel(`pop-anotacoes-${popId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pop_anotacoes", filter: `pop_id=eq.${popId}` },
      () => aoMudar(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(canal);
  };
}

/* -------------------------------------------------------------------------- */
/* Anexo do POP (WORD/PDF) em bucket privado                                  */
/* -------------------------------------------------------------------------- */

export const BUCKET_ANEXOS = "pop-anexos";

/** Tipos aceitos no anexo do POP. */
export const TIPOS_ANEXO_ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ROTULO_TIPO_ANEXO: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

/**
 * Envia o anexo para o bucket privado e grava os metadados no POP.
 * O arquivo fica inacessível por link público; a leitura acontece só dentro
 * do sistema, por URL assinada efêmera (sem download).
 */
export async function enviarAnexoPop(popId: string, arquivo: File): Promise<void> {
  if (!(TIPOS_ANEXO_ACEITOS as readonly string[]).includes(arquivo.type)) {
    throw new Error("Formato não suportado. Envie um arquivo WORD (doc/docx) ou PDF.");
  }
  if (arquivo.size > 20 * 1024 * 1024) {
    throw new Error("O anexo deve ter no máximo 20 MB.");
  }

  const client = exigirCloud();
  const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
  const caminho = `${popId}/${Date.now()}.${(extensao ?? "bin").toLowerCase()}`;

  const { error: erroUpload } = await client.storage.from(BUCKET_ANEXOS).upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (erroUpload) throw traduzErro(erroUpload);

  const { error: erroUpdate } = await client
    .from("pops")
    .update({
      arquivo_path: caminho,
      arquivo_nome: arquivo.name,
      arquivo_tipo: arquivo.type,
      arquivo_tamanho: arquivo.size,
    })
    .eq("id", popId);
  if (erroUpdate) {
    await client.storage.from(BUCKET_ANEXOS).remove([caminho]);
    throw traduzErro(erroUpdate);
  }
}

/** Busca uma URL assinada, efêmera, para exibir o anexo dentro do sistema. */
export async function urlAssinadaDoAnexo(caminho: string): Promise<string> {
  const client = exigirCloud();
  const { data, error } = await client.storage.from(BUCKET_ANEXOS).createSignedUrl(caminho, 60 * 5);
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível abrir o anexo.");
  return data.signedUrl;
}

/* -------------------------------------------------------------------------- */
/* "Li e Concordo" / "Li e DISCORDO!"                                         */
/* -------------------------------------------------------------------------- */

/** Leitura do usuário informado em cada POP (mapa popId -> leitura). */
export async function carregarLeiturasDoUsuario(
  email: string,
): Promise<Record<string, PopLeitura>> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return {};

  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_leituras")
    .select("*")
    .eq("usuario_email", emailNormalizado);
  if (error) {
    if (tabelaAusente(error)) return {};
    throw traduzErro(error);
  }
  const mapa: Record<string, PopLeitura> = {};
  for (const row of data ?? []) mapa[row.pop_id] = leituraDoRow(row);
  return mapa;
}

/** Leituras registradas em um POP (painel de ciência do detalhe). */
export async function listarLeiturasPop(popId: string): Promise<PopLeitura[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_leituras")
    .select("*")
    .eq("pop_id", popId)
    .order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(leituraDoRow);
}

/**
 * Registra (ou atualiza) a ciência do usuário sobre o POP.
 * Ao discordar, o banco notifica automaticamente o Coordenador da Qualidade e
 * os colaboradores do setor Qualidade (trigger da migration 20260916020000).
 */
export async function registrarLeitura(
  popId: string,
  usuario: UsuarioFavorito,
  decisao: DecisaoLeitura,
  justificativa = "",
): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para registrar sua leitura.");

  const client = exigirCloud();
  const { error } = await client.from("pop_leituras").upsert(
    { pop_id: popId, usuario_email: email, usuario_nome: usuario.nome, decisao, justificativa },
    {
      onConflict: "pop_id,usuario_email",
    },
  );
  if (error) throw traduzErro(error);
}

function leituraDoRow(row: PopLeituraRow): PopLeitura {
  return {
    id: row.id,
    popId: row.pop_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    decisao: row.decisao === "discordo" ? "discordo" : "concordo",
    justificativa: row.justificativa,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Notificações (discordâncias -> Qualidade)                                  */
/* -------------------------------------------------------------------------- */

/** Notificações destinadas ao usuário informado (mais recentes primeiro). */
export async function carregarNotificacoes(email: string): Promise<Notificacao[]> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return [];

  const client = exigirCloud();
  const { data, error } = await client
    .from("notificacoes")
    .select("*")
    .eq("destinatario_email", emailNormalizado)
    .order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(notificacaoDoRow);
}

/** Conta as notificações ainda não lidas do usuário. */
export async function contarNaoLidas(email: string): Promise<number> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return 0;

  const client = exigirCloud();
  const { count, error } = await client
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_email", emailNormalizado)
    .eq("lida", false);
  if (error) {
    if (tabelaAusente(error)) return 0;
    throw traduzErro(error);
  }
  return count ?? 0;
}

/** Marca uma notificação como lida. */
export async function marcarNotificacaoLida(id: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("notificacoes").update({ lida: true }).eq("id", id);
  if (error) throw traduzErro(error);
}

function notificacaoDoRow(row: NotificacaoRow): Notificacao {
  return {
    id: row.id,
    destinatarioEmail: row.destinatario_email,
    destinatarioNome: row.destinatario_nome,
    titulo: row.titulo,
    mensagem: row.mensagem,
    tipo: row.tipo,
    popId: row.pop_id,
    autorNome: row.autor_nome,
    autorEmail: row.autor_email,
    lida: row.lida,
    createdAt: row.created_at,
  };
}

/** Observa, em tempo real, notificações destinadas ao usuário informado. */
export function assinarNotificacoes(email: string, aoMudar: () => void): CancelarAssinatura {
  if (typeof window === "undefined") return () => {};
  const client = exigirCloud();
  const emailNormalizado = email.trim().toLowerCase();
  const canal = client
    .channel(`notificacoes-${emailNormalizado || "anon"}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notificacoes",
        filter: `destinatario_email=eq.${emailNormalizado}`,
      },
      () => aoMudar(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(canal);
  };
}

/**
 * Extrai o texto de um anexo DOCX para exibição embutida (sem download).
 * Baixa o arquivo do bucket privado, encontra a entrada `word/document.xml`
 * no ZIP e descompacta com o `DecompressionStream` nativo do navegador.
 */
export async function textoDoAnexoDocx(caminho: string): Promise<string | null> {
  try {
    if (typeof DecompressionStream === "undefined") return null;
    const client = exigirCloud();
    const { data, error } = await client.storage.from(BUCKET_ANEXOS).download(caminho);
    if (error || !data) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    let fimCentral = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i -= 1) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        fimCentral = i;
        break;
      }
    }
    if (fimCentral === -1) return null;

    const view = new DataView(bytes.buffer);
    const total = view.getUint16(fimCentral + 10, true);
    let cursor = fimCentral + 22;
    for (let i = 0; i < total; i += 1) {
      const nomeLen = view.getUint16(cursor + 28, true);
      const extraLen = view.getUint16(cursor + 30, true);
      const comentarioLen = view.getUint16(cursor + 32, true);
      const offsetLocal = view.getUint32(cursor + 42, true);
      const nome = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nomeLen));
      if (nome === "word/document.xml") {
        const nomeLocalLen = view.getUint16(offsetLocal + 26, true);
        const extraLocalLen = view.getUint16(offsetLocal + 28, true);
        const compactado = bytes.subarray(
          offsetLocal + 30 + nomeLocalLen + extraLocalLen,
          offsetLocal + 30 + nomeLocalLen + extraLocalLen + view.getUint32(offsetLocal + 22, true),
        );
        const xml = await inflar(compactado);
        return new TextDecoder("utf-8")
          .decode(xml)
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab[^>]*\/>/g, "\t")
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/\n{3,}/g, "\n\n");
      }
      cursor += 46 + nomeLen + extraLen + comentarioLen;
    }
    return null;
  } catch {
    return null;
  }
}

/** Descompacta um stream DEFLATE raw com a API nativa do navegador. */
async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const copia = new Uint8Array(dados.byteLength);
  copia.set(dados);
  const stream = new Blob([copia.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
