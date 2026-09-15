/**
 * POPs — tipos, constantes e acesso a dados.
 *
 * A fonte preferencial é o banco do Lovable Cloud (`public.pop_setores` e
 * `public.pops`, criados em `supabase/migrations/20260915000000_pops.sql`).
 * Quando as variáveis do Cloud não estão configuradas, o módulo usa o conjunto
 * de demonstração em memória abaixo — inclusive para criar, editar, duplicar e
 * excluir, de modo que a tela continua utilizável em desenvolvimento.
 */

import { exigirCloud, lovableCloudConfigurado, supabase } from "@/integrations/supabase/client";
import type { PopInsert, PopRow, PopSetorRow } from "@/integrations/supabase/types";

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
  { id: "fiscal", nome: "Processos Fiscais", prefixo: "FIS", categoria: "FISCAL", icone: "receipt", ordem: 1 },
  { id: "contabil", nome: "Processos Contábeis", prefixo: "CTB", categoria: "CONTABIL", icone: "calculator", ordem: 2 },
  { id: "pessoal", nome: "Processos de Pessoal", prefixo: "RH", categoria: "PESSOAL", icone: "users", ordem: 3 },
  { id: "financeiro", nome: "Processos Financeiros", prefixo: "FIN", categoria: "FINANCEIRO", icone: "wallet", ordem: 4 },
  { id: "legalizacao", nome: "Processos de Legalização", prefixo: "LEG", categoria: "LEGALIZACAO", icone: "scale", ordem: 5 },
  { id: "qualidade", nome: "Processos da Qualidade", prefixo: "QUA", categoria: "QUALIDADE", icone: "shield", ordem: 6 },
  { id: "ti", nome: "Processos de TI", prefixo: "TI", categoria: "TI", icone: "monitor", ordem: 7 },
  { id: "direcao", nome: "Processos de Direção", prefixo: "DIR", categoria: "DIRECAO", icone: "building", ordem: 8 },
];

const POPS_MOCK_BASE: Pop[] = [
  { id: "m-fis-01", setorId: "fiscal", codigo: "FIS-01", titulo: "Apuração do ICMS", descricao: "Conferência das notas de entrada e saída, cálculo do imposto devido e geração da guia de recolhimento estadual.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "LUCRO_PRESUMIDO", dificuldade: "MEDIO", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 5, prazoLegal: "2026-09-15", favoritos: 12, anotacoes: 4, arquivo: null },
  { id: "m-fis-02", setorId: "fiscal", codigo: "FIS-02", titulo: "Apuração do PIS/COFINS", descricao: "Apuração das contribuições sobre o faturamento, conferência das retenções e envio das guias.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "LUCRO_PRESUMIDO", dificuldade: "MEDIO", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 6, prazoLegal: "2026-09-20", favoritos: 8, anotacoes: 2, arquivo: null },
  { id: "m-fis-03", setorId: "fiscal", codigo: "FIS-03", titulo: "Escrituração do ISS", descricao: "Levantamento dos serviços prestados, cálculo do ISS por município e emissão das guias.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "SIMPLES_NACIONAL", dificuldade: "FACIL", cargoResponsavel: "AUXILIAR", diaInicio: 1, metaDia: 7, prazoLegal: "2026-09-18", favoritos: 5, anotacoes: 1, arquivo: null },
  { id: "m-fis-04", setorId: "fiscal", codigo: "FIS-04", titulo: "Recolhimento do IRPJ/CSLL (estimativa)", descricao: "Cálculo da estimativa mensal com base no lucro real, controle das antecipações e diferenças a compensar.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "LUCRO_REAL", dificuldade: "DIFICIL", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 10, prazoLegal: "2026-09-25", favoritos: 9, anotacoes: 6, arquivo: null },
  { id: "m-fis-05", setorId: "fiscal", codigo: "FIS-05", titulo: "Geração da DCTFWeb", descricao: "Conferência dos débitos declarados, vinculação das retenções e transmissão da declaração de débitos.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "ASSISTENTE", diaInicio: 5, metaDia: 12, prazoLegal: "2026-09-30", favoritos: 14, anotacoes: 3, arquivo: null },
  { id: "m-fis-06", setorId: "fiscal", codigo: "FIS-06", titulo: "Declaração do Simples Nacional (PGDAS-D)", descricao: "Importação das receitas, segregação por anexo, comparação da partilha e transmissão do PGDAS-D.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "SIMPLES_NACIONAL", dificuldade: "FACIL", cargoResponsavel: "ASSISTENTE", diaInicio: 1, metaDia: 15, prazoLegal: "2026-09-30", favoritos: 21, anotacoes: 7, arquivo: null },
    { id: "m-fis-07", setorId: "fiscal", codigo: "FIS-07", titulo: "EFD-Contribuições", descricao: "Escrituração fiscal digital das contribuições e conferência dos débitos apurados no mês.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "AUXILIAR", diaInicio: 1, metaDia: 12, prazoLegal: "2026-09-28", favoritos: 6, anotacoes: 2, arquivo: null },
  { id: "m-fis-08", setorId: "fiscal", codigo: "FIS-08", titulo: "ECD / ECF — escrituração fiscal", descricao: "Geração e assinatura digital da escrituração contábil e fiscal do exercício anterior.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "ANUAL", prazoReferencia: "ANO_ANTERIOR", regime: "LUCRO_PRESUMIDO", dificuldade: "DIFICIL", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 20, prazoLegal: "2026-09-30", favoritos: 4, anotacoes: 5, arquivo: null },
  { id: "m-fis-09", setorId: "fiscal", codigo: "FIS-09", titulo: "Restituição e compensação de tributos", descricao: "Levantamento de valores pagos a maior, preparação do pedido e acompanhamento no sistema da Receita.", departamento: "Fiscal", categoria: "FISCAL", frequencia: "EVENTUAL", prazoReferencia: "MES_ATUAL", regime: "TODOS", dificuldade: "DIFICIL", cargoResponsavel: "ANALISTA", diaInicio: null, metaDia: null, prazoLegal: "2026-10-10", favoritos: 2, anotacoes: 3, arquivo: null },
  { id: "m-ctb-01", setorId: "contabil", codigo: "CTB-01", titulo: "Conciliação bancária mensal", descricao: "Confronto dos extratos com os lançamentos contábeis e baixa dos itens pendentes.", departamento: "Contábil", categoria: "CONTABIL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "FACIL", cargoResponsavel: "AUXILIAR", diaInicio: 1, metaDia: 8, prazoLegal: "2026-09-20", favoritos: 7, anotacoes: 2, arquivo: null },
  { id: "m-ctb-02", setorId: "contabil", codigo: "CTB-02", titulo: "Balancete mensal e conferência de saldos", descricao: "Fechamento do balancete, análise das contas de resultado e ajustes de competência.", departamento: "Contábil", categoria: "CONTABIL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "ASSISTENTE", diaInicio: 3, metaDia: 12, prazoLegal: "2026-09-25", favoritos: 10, anotacoes: 4, arquivo: null },
  { id: "m-ctb-03", setorId: "contabil", codigo: "CTB-03", titulo: "Fechamento contábil anual", descricao: "Consolidação das contas do exercício, provisões, depreciação e demonstrações contábeis.", departamento: "Contábil", categoria: "CONTABIL", frequencia: "ANUAL", prazoReferencia: "ANO_ANTERIOR", regime: "TODOS", dificuldade: "DIFICIL", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 25, prazoLegal: "2026-09-30", favoritos: 3, anotacoes: 8, arquivo: null },
  { id: "m-rh-01", setorId: "pessoal", codigo: "RH-01", titulo: "Folha de pagamento mensal", descricao: "Processamento das rubricas fixas e variáveis, cálculo dos encargos e geração dos recibos.", departamento: "Pessoal", categoria: "PESSOAL", frequencia: "MENSAL", prazoReferencia: "MES_ATUAL", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "ANALISTA", diaInicio: 20, metaDia: 28, prazoLegal: "2026-09-30", favoritos: 16, anotacoes: 5, arquivo: null },
  { id: "m-rh-02", setorId: "pessoal", codigo: "RH-02", titulo: "Envio do eSocial (S-1200 / S-1299)", descricao: "Conferência dos eventos periódicos, correção de inconsistentes e transmissão do fechamento.", departamento: "Pessoal", categoria: "PESSOAL", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "ASSISTENTE", diaInicio: 1, metaDia: 10, prazoLegal: "2026-09-15", favoritos: 11, anotacoes: 3, arquivo: null },
  { id: "m-fin-01", setorId: "financeiro", codigo: "FIN-01", titulo: "Conciliação do fluxo de caixa", descricao: "Lançamento das movimentações diárias, conferência do saldo projetado e sinalização de desvios.", departamento: "Financeiro", categoria: "FINANCEIRO", frequencia: "MENSAL", prazoReferencia: "MES_ATUAL", regime: "TODOS", dificuldade: "FACIL", cargoResponsavel: "AUXILIAR", diaInicio: 1, metaDia: 10, prazoLegal: "2026-09-25", favoritos: 6, anotacoes: 1, arquivo: null },
  { id: "m-fin-02", setorId: "financeiro", codigo: "FIN-02", titulo: "Fechamento e repasse de honorários", descricao: "Apuração das horas e serviços do mês, emissão da nota e programação do repasse ao cliente.", departamento: "Financeiro", categoria: "FINANCEIRO", frequencia: "MENSAL", prazoReferencia: "MES_ANTERIOR", regime: "TODOS", dificuldade: "MEDIO", cargoResponsavel: "ASSISTENTE", diaInicio: 5, metaDia: 15, prazoLegal: "2026-09-28", favoritos: 9, anotacoes: 2, arquivo: null },
  { id: "m-qua-01", setorId: "qualidade", codigo: "QUA-01", titulo: "Controle de revisão dos POPs", descricao: "Revisão anual da carteira de POPs, atualização dos prazos e registro das evidências de aprovação.", departamento: "Qualidade", categoria: "QUALIDADE", frequencia: "ANUAL", prazoReferencia: "ANO_ANTERIOR", regime: "TODOS", dificuldade: "FACIL", cargoResponsavel: "ANALISTA", diaInicio: 1, metaDia: 15, prazoLegal: "2026-12-20", favoritos: 5, anotacoes: 4, arquivo: null },
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
  };
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
    const [setores, pops] = await Promise.all([listarSetoresCloud(), listarPopsCloud("todos")]);
    return { setores, pops, fonte };
  }
    return { setores: setoresDemo(), pops: listarPopsDemo("todos"), fonte };
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
  };
  return criarPop(entrada);
}