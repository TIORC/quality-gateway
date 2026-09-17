/**
 * POPs — tipos, constantes e acesso a dados.
 *
 * Fonte: banco do Lovable Cloud (`public.pop_setores`, `public.pops`,
 * `public.pop_anotacoes`, `public.pop_favoritos` etc.).
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { getSession, type UserSession } from "@/lib/auth";
import { NIVEIS_FILTRAM_POR_SETOR } from "@/lib/niveis-acesso";
import { temAcessoTotalPops, veSomenteLiberados } from "@/lib/permissoes";

type PopRow = Tables<"pops">;
type PopInsert = TablesInsert<"pops">;
type PopRevisaoInsert = TablesInsert<"pop_revisoes">;
type PopSugestaoRow = Tables<"pop_sugestoes">;
type PopSugestaoInsert = TablesInsert<"pop_sugestoes">;
type PopSetorRow = Tables<"pop_setores">;
type PopAnotacaoRow = Tables<"pop_anotacoes">;
type PopAnotacaoInsert = TablesInsert<"pop_anotacoes">;
type PopFavoritoInsert = TablesInsert<"pop_favoritos">;
type PopLeituraRow = Tables<"pop_leituras">;
type NotificacaoRow = Tables<"notificacoes">;

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
  /** Data de validade do documento, no formato `aaaa-mm-dd` (próximos vencimentos). */
  dataVencimento: string | null;
  favoritos: number;
  anotacoes: number;
  arquivo: string | null;
  /** Revisão vigente (1 = Revisão 01). O código é mantido a cada nova versão. */
  revisao: number;
  /** Data da revisão vigente, no formato `aaaa-mm-dd`. */
  dataRevisao: string | null;
  /** O que foi alterado na revisão vigente (alimenta o histórico de modificações). */
  observacaoRevisao: string;
  /** Setores responsáveis pelo processo (ids de `public.pop_setores`). */
  setoresResponsaveis: string[];
  /** Quem pode visualizar (ACESSO): ids dos setores/unidades autorizados. */
  visualizadores: string[];
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
  /** Status do ciclo de vida (dupla aprovação antes de VIGENTE). */
  status: StatusPop;
  /** Identificação de quem criou/elaborou o POP. */
  criadoPor: string;
  /** Nome de quem criou/elaborou o POP. */
  criadoPorNome: string;
  /** Quem aprovou a 1ª etapa (líder do processo/setor). */
  aprovadoProcessoPor: string;
  aprovadoProcessoNome: string;
  /** Quando a 1ª etapa foi aprovada. */
  aprovadoProcessoEm: string | null;
  /** Quem aprovou a 2ª etapa (liderança da Qualidade). */
  aprovadoQualidadePor: string;
  aprovadoQualidadeNome: string;
  /** Quando a 2ª etapa foi aprovada. */
  aprovadoQualidadeEm: string | null;
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

/**
 * Decisão registrada na leitura de um POP.
 * `lido` é o botão atual ("Lido"); `concordo`/`discordo` são os registros
 * antigos ("Li e Concordo" / "Li e DISCORDO!"), mantidos no banco.
 */
export type DecisaoLeitura = "lido" | "concordo" | "discordo";

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

/** Uma revisão anterior do POP (histórico de modificações). */
export interface PopRevisao {
  id: string;
  popId: string;
  codigo: string;
  /** Número da revisão arquivada (1 = Revisão 01). */
  revisao: number;
  /** Data em que a revisão esteve vigente (`aaaa-mm-dd`). */
  dataRevisao: string | null;
  /** O que foi alterado naquela revisão. */
  observacao: string;
  /** Snapshot do documento naquela revisão (conteúdo completo). */
  conteudo: ConteudoRevisaoPop;
  criadoPor: string;
  criadoPorNome: string;
  createdAt: string;
}

/** Conteúdo guardado no snapshot de uma revisão. */
export interface ConteudoRevisaoPop {
  titulo?: string;
  objetivo?: string;
  materiais?: string;
  links?: string[];
  etapas?: PopEtapa[];
  setoresResponsaveis?: string[];
  visualizadores?: string[];
  [chave: string]: unknown;
}

/** Sugestão de melhoria enviada por um colaborador em um POP. */
export interface PopSugestao {
  id: string;
  popId: string;
  usuarioEmail: string;
  usuarioNome: string;
  sugestao: string;
  status: string;
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
export type EntradaPop = Omit<
  Pop,
  | "id"
  | "favoritos"
  | "anotacoes"
  | "status"
  | "revisao"
  | "dataRevisao"
  | "observacaoRevisao"
  | "criadoPor"
  | "criadoPorNome"
  | "aprovadoProcessoPor"
  | "aprovadoProcessoNome"
  | "aprovadoProcessoEm"
  | "aprovadoQualidadePor"
  | "aprovadoQualidadeNome"
  | "aprovadoQualidadeEm"
>;

/* -------------------------------------------------------------------------- */
/* Ciclo de vida do POP (dupla aprovação)                                     */
/* -------------------------------------------------------------------------- */

/** Status do ciclo de vida do POP, gravado em `pops.status` (texto). */
export const STATUS_POP = {
  /** Aguardando o líder do processo/setor aprovar. */
  PENDENTE_LIDER_PROCESSO: "PENDENTE_APROVACAO_LIDER_PROCESSO",
  /** Aprovado pelo líder; aguardando a liderança da Qualidade. */
  PENDENTE_LIDER_QUALIDADE: "PENDENTE_APROVACAO_LIDER_QUALIDADE",
  /** Publicado e em vigor. */
  VIGENTE: "VIGENTE",
  /** POP vigente foi editado e está em revisão (aguardando o líder). */
  REVISANDO: "REVISANDO",
  /** Revisão aprovada pelo líder; aguardando a liderança da Qualidade. */
  REVISADO: "REVISADO",
} as const;

export type StatusPop = (typeof STATUS_POP)[keyof typeof STATUS_POP];

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
  "DIRECAO",
  "FISCAL",
  "CONTABIL",
  "QUALIDADE",
  "COMERCIAL",
  "TI",
  "RH",
  "FINANCEIRO",
  "BPO",
  "MARKETING",
  "SUCESSO",
  "TECNICO",
  "PESSOAL",
  "LEGALIZACAO",
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
  RH: "RH",
  COMERCIAL: "COMERCIAL",
  BPO: "BPO FINANCEIRO",
  MARKETING: "MARKETING M7",
  SUCESSO: "SUCESSO DO CLIENTE",
  TECNICO: "TÉCNICO",
  GERAL: "GERAL",
  FISCAL: "FISCAL",
  PENDENTE_APROVACAO_LIDER_PROCESSO: "PENDENTE APROVAÇÃO LIDER DO PROCESSO",
  PENDENTE_APROVACAO_LIDER_QUALIDADE: "PENDENTE APROVAÇÃO LIDER DA QUALIDADE",
  VIGENTE: "VIGENTE",
  REVISANDO: "REVISANDO",
  REVISADO: "REVISADO",
};

/** Converte o valor gravado no banco no rótulo exibido (ex.: `MES_ANTERIOR`). */
export function rotuloDoValor(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULOS[valor] ?? valor.replace(/_/g, " ").toUpperCase();
}

/** Estado inicial de um novo POP (campos do formulário). */
export const ENTRADA_PADRAO: EntradaPop = {
  setorId: "",
  codigo: "",
  titulo: "",
  descricao: "",
  departamento: "",
  categoria: "",
  frequencia: "MENSAL",
  prazoReferencia: "MES_ATUAL",
  regime: "TODOS",
  dificuldade: "MEDIO",
  cargoResponsavel: "ANALISTA",
  diaInicio: null,
  metaDia: null,
  prazoLegal: null,
  dataVencimento: null,
  arquivo: null,
  setoresResponsaveis: [],
  visualizadores: [],
};

/* -------------------------------------------------------------------------- */
/* Acesso a dados — Lovable Cloud (Supabase)                                  */
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
    dataVencimento: row.data_vencimento ?? null,
    favoritos: row.favoritos,
    anotacoes: row.anotacoes,
    arquivo: row.arquivo,
    // Campos da ficha em revisões (migration 20260917000000). Quando ela ainda
    // não foi aplicada, os valores caem nos padrões e nada quebra.
    revisao: typeof row.revisao === "number" && row.revisao > 0 ? row.revisao : 1,
    dataRevisao: row.data_revisao ?? null,
    observacaoRevisao: row.observacao_revisao ?? "",
    setoresResponsaveis: row.setores_responsaveis ?? [],
    visualizadores: row.visualizadores ?? [],
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
    status: (row.status ?? STATUS_POP.VIGENTE) as StatusPop,
    criadoPor: row.criado_por,
    criadoPorNome: row.criado_por_nome,
    aprovadoProcessoPor: row.aprovado_processo_por,
    aprovadoProcessoNome: row.aprovado_processo_nome,
    aprovadoProcessoEm: row.aprovado_processo_em,
    aprovadoQualidadePor: row.aprovado_qualidade_por,
    aprovadoQualidadeNome: row.aprovado_qualidade_nome,
    aprovadoQualidadeEm: row.aprovado_qualidade_em,
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

/**
 * Converte uma data digitada em `dd/mm/aaaa` para `aaaa-mm-dd` (formato aceito
 * pelo banco). Valores vazios viram `null` e datas já em ISO passam direto.
 */
export function dataBrParaIso(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (texto === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return null;
  return `${partes[3]}-${partes[2]}-${partes[1]}`;
}

/** Converte `aaaa-mm-dd` para `dd/mm/aaaa` (usado nos formulários). */
export function dataIsoParaBr(valor: string | null | undefined): string {
  const texto = (valor ?? "").trim();
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return texto;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
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
    prazo_legal: dataBrParaIso(entrada.prazoLegal),
    data_vencimento: dataBrParaIso(entrada.dataVencimento),
    arquivo: entrada.arquivo,
    objetivo: entrada.objetivo ?? "",
    materiais_sistemas: entrada.materiaisSistemas ?? "",
    documentos_gerados: entrada.documentosGerados ?? "",
    links_relacionados: entrada.linksRelacionados ?? [],
    observacoes: entrada.observacoes ?? "",
    etapas: (entrada.etapas ?? []) as unknown as NonNullable<PopInsert["etapas"]>,
    setores_responsaveis: entrada.setoresResponsaveis ?? [],
    visualizadores: entrada.visualizadores ?? [],
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

/**
 * Contadores reais de cada POP. POPs sem comentário ou favorito aparecem com zero.
 */
export async function carregarContadoresPops(): Promise<Record<string, ContadoresPop>> {
  return carregarContadoresCloud();
}

/** Devolve os POPs com os contadores reais aplicados (sobrescreve o cache). */
export function aplicarContadores(pops: Pop[], contadores: Record<string, ContadoresPop>): Pop[] {
  return pops.map((pop) => {
    const reais = contadores[pop.id] ?? CONTADORES_ZERADOS;
    return { ...pop, favoritos: reais.favoritos, anotacoes: reais.anotacoes };
  });
}

/** Carrega setores e POPs do banco (Lovable Cloud). */
export async function carregarPops(): Promise<{
  setores: SetorPop[];
  pops: Pop[];
}> {
  const [setores, pops, contadores] = await Promise.all([
    listarSetoresCloud(),
    listarPopsCloud("todos"),
    carregarContadoresCloud(),
  ]);
  return { setores, pops: aplicarContadores(pops, contadores) };
}

/** Nome de setor normalizado (sem acentos, minúsculo) para comparações. */
function normalizarSetor(nome: string | null | undefined): string {
  return (nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Indica se o usuário pertence ao setor da Qualidade. */
export function ehSetorQualidade(sessao: UserSession | null | undefined): boolean {
  return normalizarSetor(sessao?.setor) === "qualidade";
}

/**
 * Nome normalizado do setor a partir do id guardado em `pops.visualizadores`.
 * Ids desconhecidos são comparados como vieram (permite gravar unidades).
 */
function setorDeId(id: string, setores: SetorPop[]): string {
  const nome = setores.find((setor) => setor.id === id)?.nome ?? id;
  return normalizarSetor(nome);
}

/** Nomes dos setores/unidades de uma lista de ids (para exibição). */
export function nomesDosSetores(ids: string[], setores: SetorPop[]): string[] {
  return ids.map((id) => setores.find((setor) => setor.id === id)?.nome ?? id);
}

/** Quem pode criar/editar/excluir POPs: admins e gestores, além do setor da Qualidade. */
export function podeElaborarPops(sessao: UserSession | null | undefined): boolean {
  if (!sessao) return false;
  if (sessao.role === "admin" || sessao.role === "gestor") return true;
  return ehSetorQualidade(sessao);
}

/**
 * Liderança da Qualidade: aprova a 2ª etapa. O Auxiliar da Qualidade
 * elabora/apura, mas não libera (não passa por aqui).
 */
export function podeAprovarLiderQualidade(sessao: UserSession | null | undefined): boolean {
  if (!sessao) return false;
  if (sessao.nivelAcesso === "Auxiliar da Qualidade") return false;
  return (
    sessao.role === "admin" ||
    sessao.role === "gestor" ||
    sessao.nivelAcesso === "Gestor da Qualidade"
  );
}

/**
 * Líder do processo/setor: aprova a 1ª etapa. Em POP setorial, precisa ser
 * "Líder de setor" do mesmo setor do POP. Em POP geral, qualquer líder de
 * setor (ou a liderança da Qualidade) pode aprovar.
 */
export function podeAprovarLiderProcesso(
  sessao: UserSession | null | undefined,
  pop: Pick<Pop, "setorId">,
  nomeSetorDoPop: string | null | undefined,
): boolean {
  if (!sessao || sessao.nivelAcesso === "Auxiliar da Qualidade") return false;
  if (sessao.role === "admin") return true;
  const ehLiderDeSetor = sessao.nivelAcesso === "Líder de setor";
  if (pop.setorId === "geral") return ehLiderDeSetor || podeAprovarLiderQualidade(sessao);
  return ehLiderDeSetor && normalizarSetor(sessao.setor) === normalizarSetor(nomeSetorDoPop);
}

/** Sessão usada como autor na criação e nas aprovações. */
function autorDaSessao(): { id: string; nome: string } {
  const sessao = getSession();
  return {
    id: sessao?.colaboradorId || sessao?.id || "",
    nome: sessao?.nome ?? "",
  };
}

/** Busca um POP pelo id (linha crua, sem normalização de contadores). */
async function buscarPopCloud(id: string): Promise<Pop> {
  const client = exigirCloud();
  const { data, error } = await client.from("pops").select("*").eq("id", id).maybeSingle();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("POP não encontrado.");
  return popDoRow(data);
}

async function criarPopCloud(entrada: EntradaPop): Promise<Pop> {
  const autor = autorDaSessao();
  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .insert({
      ...popParaInsercao(entrada),
      status: STATUS_POP.PENDENTE_LIDER_PROCESSO,
      revisao: 1,
      data_revisao: hojeIso(),
      observacao_revisao: "Versão inicial do procedimento.",
      criado_por: autor.id,
      criado_por_nome: autor.nome,
    })
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar o POP.");
  return popDoRow(data);
}

/** Data de hoje no formato `aaaa-mm-dd`. */
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Snapshot do documento guardado no histórico de modificações. */
function conteudoParaHistorico(pop: Pop): ConteudoRevisaoPop {
  return {
    titulo: pop.titulo,
    objetivo: pop.objetivo ?? "",
    materiais: pop.materiaisSistemas ?? "",
    links: pop.linksRelacionados ?? [],
    etapas: pop.etapas ?? [],
    setoresResponsaveis: pop.setoresResponsaveis,
    visualizadores: pop.visualizadores,
    descricao: pop.descricao,
    documentosGerados: pop.documentosGerados ?? "",
    observacoes: pop.observacoes ?? "",
  };
}

/**
 * Arquiva a revisão que está sendo substituída.
 *
 * O código do POP é mantido; a versão anterior permanece no histórico
 * (`public.pop_revisoes`) para consulta apenas do gestor, e a nova versão
 * passa a valer para os setores e unidades definidos em "Quem pode visualizar".
 */
async function arquivarRevisao(pop: Pop, autor: { id: string; nome: string }): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("pop_revisoes").upsert(
    {
      pop_id: pop.id,
      codigo: pop.codigo,
      revisao: pop.revisao,
      data_revisao: pop.dataRevisao ?? hojeIso(),
      observacao: pop.observacaoRevisao || "Versão inicial do procedimento.",
      conteudo: conteudoParaHistorico(pop) as unknown as Json,
      criado_por: autor.id,
      criado_por_nome: autor.nome,
    },
    { onConflict: "pop_id,revisao" },
  );
  // Sem a tabela (migration pendente) a edição continua funcionando normalmente.
  if (error && !tabelaAusente(error)) throw traduzErro(error);
}

/** Status após uma edição: vigente/revisado voltam ao início da revisão. */
function statusAposEdicao(statusAtual: StatusPop): StatusPop {
  if (statusAtual === STATUS_POP.VIGENTE || statusAtual === STATUS_POP.REVISADO) {
    return STATUS_POP.REVISANDO;
  }
  return statusAtual;
}

async function atualizarPopCloud(
  id: string,
  entrada: EntradaPop,
  observacaoRevisao = "",
): Promise<Pop> {
  const atual = await buscarPopCloud(id);
  const status = statusAposEdicao(atual.status);
  const atualizacao: PopInsert = { ...popParaInsercao(entrada), status };

  // Editar um POP VIGENTE (ou já revisado) gera uma NOVA REVISÃO: o código é
  // mantido, a versão anterior vai para o histórico e a nova passa a valer.
  const geraNovaRevisao =
    atual.status === STATUS_POP.VIGENTE || atual.status === STATUS_POP.REVISADO;

  if (status === STATUS_POP.REVISANDO) {
    atualizacao.aprovado_processo_por = "";
    atualizacao.aprovado_processo_nome = "";
    atualizacao.aprovado_processo_em = null;
    atualizacao.aprovado_qualidade_por = "";
    atualizacao.aprovado_qualidade_nome = "";
    atualizacao.aprovado_qualidade_em = null;
  }

  if (geraNovaRevisao) {
    await arquivarRevisao(atual, autorDaSessao());
    atualizacao.revisao = atual.revisao + 1;
    atualizacao.data_revisao = hojeIso();
    atualizacao.observacao_revisao =
      observacaoRevisao.trim() || "Revisão sem alterações descritas.";
  } else if (observacaoRevisao.trim() !== "") {
    atualizacao.observacao_revisao = observacaoRevisao.trim();
  }

  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .update(atualizacao)
    .eq("id", id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("POP não encontrado.");
  return popDoRow(data);
}

/** Aprova a 1ª etapa (líder do processo/setor). */
export async function aprovarPopLiderProcesso(id: string): Promise<Pop> {
  const atual = await buscarPopCloud(id);
  let proximo: StatusPop;
  if (atual.status === STATUS_POP.PENDENTE_LIDER_PROCESSO) {
    proximo = STATUS_POP.PENDENTE_LIDER_QUALIDADE;
  } else if (atual.status === STATUS_POP.REVISANDO) {
    proximo = STATUS_POP.REVISADO;
  } else {
    throw new Error("Este POP não aguarda aprovação do líder do processo.");
  }
  const autor = autorDaSessao();
  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .update({
      status: proximo,
      aprovado_processo_por: autor.id,
      aprovado_processo_nome: autor.nome,
      aprovado_processo_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("POP não encontrado.");
  return popDoRow(data);
}

/** Aprova a 2ª etapa (liderança da Qualidade) — o POP passa a VIGENTE. */
export async function aprovarPopLiderQualidade(id: string): Promise<Pop> {
  const atual = await buscarPopCloud(id);
  if (
    atual.status !== STATUS_POP.PENDENTE_LIDER_QUALIDADE &&
    atual.status !== STATUS_POP.REVISADO
  ) {
    throw new Error("Este POP não aguarda aprovação da liderança da Qualidade.");
  }
  const autor = autorDaSessao();
  const client = exigirCloud();
  const { data, error } = await client
    .from("pops")
    .update({
      status: STATUS_POP.VIGENTE,
      aprovado_qualidade_por: autor.id,
      aprovado_qualidade_nome: autor.nome,
      aprovado_qualidade_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("POP não encontrado.");
  return popDoRow(data);
}

export async function criarPop(entrada: EntradaPop): Promise<Pop> {
  return criarPopCloud(entrada);
}

/**
 * Salva as alterações de um POP.
 *
 * @param observacaoRevisao o que mudou nesta revisão (aparece no histórico de
 *   modificações). Quando o POP está vigente, a versão anterior é arquivada e
 *   o número da revisão avança, mantendo o mesmo código.
 */
export async function atualizarPop(
  id: string,
  entrada: EntradaPop,
  observacaoRevisao = "",
): Promise<Pop> {
  return atualizarPopCloud(id, entrada, observacaoRevisao);
}

export async function excluirPop(id: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("pops").delete().eq("id", id);
  if (error) throw traduzErro(error);
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
    dataVencimento: origem.dataVencimento,
    arquivo: origem.arquivo,
    objetivo: origem.objetivo ?? "",
    materiaisSistemas: origem.materiaisSistemas ?? "",
    documentosGerados: origem.documentosGerados ?? "",
    linksRelacionados: origem.linksRelacionados ?? [],
    observacoes: origem.observacoes ?? "",
    etapas: origem.etapas ?? [],
    setoresResponsaveis: origem.setoresResponsaveis,
    visualizadores: origem.visualizadores,
  };
  return criarPop(entrada);
}

/* -------------------------------------------------------------------------- */
/* Revisões do POP (histórico de modificações)                                */
/* -------------------------------------------------------------------------- */

/**
 * Quem pode consultar as versões anteriores de um POP: apenas o gestor —
 * Administrador, Gestor da Qualidade (perfil "gestor") e o nível de acesso
 * "Gestor da Qualidade". Os demais vêem somente a revisão vigente.
 */
export function podeVerVersoesAnteriores(sessao: UserSession | null | undefined): boolean {
  if (!sessao) return false;
  if (sessao.role === "admin" || sessao.role === "gestor") return true;
  return sessao.nivelAcesso === "Gestor da Qualidade";
}

function revisaoDoRow(row: Tables<"pop_revisoes">): PopRevisao {
  return {
    id: row.id,
    popId: row.pop_id,
    codigo: row.codigo,
    revisao: row.revisao,
    dataRevisao: row.data_revisao,
    observacao: row.observacao,
    conteudo: (row.conteudo ?? {}) as ConteudoRevisaoPop,
    criadoPor: row.criado_por,
    criadoPorNome: row.criado_por_nome,
    createdAt: row.created_at,
  };
}

/** Revisões anteriores arquivadas de um POP, da mais recente para a mais antiga. */
export async function listarRevisoesPop(popId: string): Promise<PopRevisao[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_revisoes")
    .select("*")
    .eq("pop_id", popId)
    .order("revisao", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(revisaoDoRow);
}

/** Data da revisão pronta para exibir (ex.: `17/09/2026`). */
export function formatarDataRevisao(valor: string | null | undefined): string {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

/** Rótulo da revisão no formato oficial do documento (ex.: `Revisão 02`). */
export function rotuloRevisao(numero: number): string {
  return `Revisão ${String(numero).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Sugestões de melhoria (botão "Sugerir melhoria")                            */
/* -------------------------------------------------------------------------- */

function sugestaoDoRow(row: PopSugestaoRow): PopSugestao {
  return {
    id: row.id,
    popId: row.pop_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    sugestao: row.sugestao,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Sugestões de melhoria já enviadas para um POP (mais recentes primeiro). */
export async function listarSugestoesPop(popId: string): Promise<PopSugestao[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("pop_sugestoes")
    .select("*")
    .eq("pop_id", popId)
    .order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(sugestaoDoRow);
}

/**
 * Envia uma sugestão de melhoria para o POP. O banco avisa automaticamente o
 * Gestor da Qualidade e o setor Qualidade (trigger da migration 20260917000000).
 */
export async function enviarSugestaoPop(
  popId: string,
  usuario: UsuarioFavorito,
  sugestao: string,
): Promise<void> {
  const texto = sugestao.trim();
  if (!texto) throw new Error("Escreva a sugestão antes de enviar.");
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para sugerir uma melhoria.");

  const registro: PopSugestaoInsert = {
    pop_id: popId,
    usuario_email: email,
    usuario_nome: usuario.nome,
    sugestao: texto,
  };
  const client = exigirCloud();
  const { error } = await client.from("pop_sugestoes").insert(registro);
  if (error) throw traduzErro(error);
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
  pessoal: "PES",
  rh: "RH",
  financeiro: "FIN",
  "bpo financeiro": "BPO",
  bpo: "BPO",
  comercial: "COM",
  marketing: "MKT",
  "marketing m7": "MKT",
  "sucesso do cliente": "SUC",
  sucesso: "SUC",
  legalizacao: "LEG",
  legalização: "LEG",
  qualidade: "QUA",
  ti: "TI",
  "ti/desenvolvimento": "TI",
  desenvolvimento: "TI",
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
}> {
  const base = await carregarPops();
  if (!session) return base;

  try {
    // Só o setor da Qualidade e os aprovadores (líder de setor / liderança da
    // Qualidade) enxergam POPs fora de VIGENTE; os demais veem só os vigentes.
    const setorQualidade = ehSetorQualidade(session);
    const vePendentes =
      setorQualidade ||
      session.nivelAcesso === "Líder de setor" ||
      podeAprovarLiderQualidade(session);

    let pops = base.pops.filter((pop) => vePendentes || pop.status === STATUS_POP.VIGENTE);

    if (veSomenteLiberados(session)) {
      if (!session.colaboradorId) return { ...base, pops: [] };
      const ids = new Set(await listarDocumentosLiberados(session.colaboradorId, "pop"));
      return { ...base, pops: pops.filter((pop) => ids.has(pop.id)) };
    }

    // Colaboradores e líderes seguem vendo apenas o próprio setor (e o "Geral");
    // o setor da Qualidade vê todos os setores.
    if (!setorQualidade) {
      const filtramPorSetor = NIVEIS_FILTRAM_POR_SETOR.has(session.nivelAcesso);
      const prefixo = filtramPorSetor ? prefixoDoSetor(session.setor ?? "") : null;
      if (prefixo) {
        pops = pops.filter((pop) => pop.codigo.startsWith(prefixo) || pop.codigo.startsWith("GER"));
      }
    }

    // "Quem pode visualizar" (ACESSO): quando o POP define setores/unidades
    // autorizados, só eles enxergam o documento. Sem definição, nada muda.
    if (!temAcessoTotalPops(session)) {
      const meuSetor = normalizarSetor(session.setor);
      const minhaUnidade = normalizarSetor(session.unidade);
      pops = pops.filter((pop) => {
        const autorizados = pop.visualizadores ?? [];
        if (autorizados.length === 0) return true;
        return autorizados
          .map((id) => setorDeId(id, base.setores))
          .some((nome) => nome === meuSetor || nome === minhaUnidade);
      });
    }

    return { ...base, pops };
  } catch {
    // Sem a tabela de liberações (migration pendente): segue sem filtro extra.
  }
  return base;
}

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

async function excluirAnotacaoCloud(anotacaoId: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("pop_anotacoes").delete().eq("id", anotacaoId);
  if (error) throw traduzErro(error);
}

/** Lista as anotações (comentários) de um POP. */
export async function listarAnotacoes(popId: string): Promise<PopAnotacao[]> {
  return listarAnotacoesCloud(popId);
}

/** Registra uma anotação no POP e atualiza o contador. */
export async function criarAnotacao(
  popId: string,
  dados: Omit<PopAnotacao, "id" | "popId" | "createdAt">,
): Promise<PopAnotacao> {
  return criarAnotacaoCloud(popId, dados);
}

/** Exclui uma anotação do POP (o contador é sincronizado pelo banco). */
export async function excluirAnotacao(anotacao: PopAnotacao): Promise<void> {
  await excluirAnotacaoCloud(anotacao.id);
}

/* -------------------------------------------------------------------------- */
/* Favoritos dos POPs                                                         */
/* -------------------------------------------------------------------------- */

/** Ids dos POPs que o colaborador já favoritou (0 quando não há nenhum). */
export async function carregarFavoritosDoUsuario(
  email: string,
  colaboradorId?: string,
): Promise<string[]> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return [];

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
  if (typeof window === "undefined") return () => {};
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
  if (typeof window === "undefined") return () => {};
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
/* Ciência do POP: botão "Lido" (e registros antigos de concordo/discordo)     */
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
 * Registra (ou atualiza) a ciência do usuário sobre o POP — botão "Lido".
 * As decisões antigas (`concordo`/`discordo`) continuam aceitas e, ao discordar,
 * o banco notifica o Coordenador da Qualidade e o setor Qualidade (trigger da
 * migration 20260916020000).
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
    {
      pop_id: popId,
      usuario_email: email,
      usuario_nome: usuario.nome,
      decisao,
      justificativa: decisao === "discordo" ? justificativa : "",
    },
    {
      onConflict: "pop_id,usuario_email",
    },
  );
  if (error) throw traduzErro(error);
}

function leituraDoRow(row: PopLeituraRow): PopLeitura {
  const decisao: DecisaoLeitura =
    row.decisao === "discordo" ? "discordo" : row.decisao === "lido" ? "lido" : "concordo";
  return {
    id: row.id,
    popId: row.pop_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    decisao,
    justificativa: row.justificativa,
    createdAt: row.created_at,
  };
}

/** Quantas pessoas já registraram leitura (botão "Lido" e registros antigos). */
export function contarLeituras(leituras: PopLeitura[]): number {
  return leituras.length;
}

/* -------------------------------------------------------------------------- */
/* Visualizações (quem abriu cada POP)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Registra (ou atualiza) a visualização de um POP pelo usuário. Usada quando o
 * detalhe do POP é aberto — a contagem real sai de `public.pop_visualizacoes`
 * (ver `supabase/migrations/20260916180000_pop_visualizacoes.sql`).
 */
export async function registrarVisualizacao(
  popId: string,
  usuario: UsuarioFavorito,
): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) return;

  const client = exigirCloud();
  const { error } = await client
    .from("pop_visualizacoes")
    .upsert(
      { pop_id: popId, usuario_email: email, usuario_nome: usuario.nome },
      { onConflict: "pop_id,usuario_email" },
    );
  if (error && !tabelaAusente(error)) throw traduzErro(error);
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

/* -------------------------------------------------------------------------- */
/* Visualização embutida de anexos (DOCX e DOC legado)                        */
/* -------------------------------------------------------------------------- */

function lerU16(b: Uint8Array, d: number): number {
  return (b[d] ?? 0) | ((b[d + 1] ?? 0) << 8);
}

function lerU32(b: Uint8Array, d: number): number {
  return (
    ((b[d] ?? 0) | ((b[d + 1] ?? 0) << 8) | ((b[d + 2] ?? 0) << 16)) + (b[d + 3] ?? 0) * 0x1000000
  );
}

/** Remove caracteres de controle, mantendo tab, quebra de linha e retorno. */
function limparControlesDoTexto(texto: string): string {
  let saida = "";
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    if (c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c !== 0x7f)) saida += texto[i];
  }
  return saida;
}

interface EntradaZip {
  nome: string;
  metodo: number;
  tamanhoCompactado: number;
  offsetLocal: number;
}

/** Localiza a assinatura de fim de ZIP (EOCD) a partir do final do arquivo. */
function localizarFimZip(b: Uint8Array): number {
  for (let i = b.length - 22; i >= 0 && i >= b.length - 66000; i -= 1) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return i;
  }
  return -1;
}

/** Indexa as entradas do ZIP a partir do diretório central. */
function entradasDoZip(b: Uint8Array): EntradaZip[] {
  const fim = localizarFimZip(b);
  if (fim === -1) return [];
  const total = lerU16(b, fim + 10);
  let cursor = lerU32(b, fim + 16);
  const entradas: EntradaZip[] = [];
  for (let i = 0; i < total && cursor + 46 <= b.length; i += 1) {
    if (
      b[cursor] !== 0x50 ||
      b[cursor + 1] !== 0x4b ||
      b[cursor + 2] !== 0x01 ||
      b[cursor + 3] !== 0x02
    ) {
      break;
    }
    const nomeLen = lerU16(b, cursor + 28);
    const extraLen = lerU16(b, cursor + 30);
    const comentarioLen = lerU16(b, cursor + 32);
    entradas.push({
      nome: new TextDecoder().decode(b.subarray(cursor + 46, cursor + 46 + nomeLen)),
      metodo: lerU16(b, cursor + 10),
      tamanhoCompactado: lerU32(b, cursor + 20),
      offsetLocal: lerU32(b, cursor + 42),
    });
    cursor += 46 + nomeLen + extraLen + comentarioLen;
  }
  return entradas;
}

/** Conteúdo bruto de uma entrada do ZIP (método 0 = sem compressão; 8 = deflate). */
async function dadosDaEntradaZip(b: Uint8Array, entrada: EntradaZip): Promise<Uint8Array | null> {
  const nomeLocal = lerU16(b, entrada.offsetLocal + 26);
  const extraLocal = lerU16(b, entrada.offsetLocal + 28);
  const inicio = entrada.offsetLocal + 30 + nomeLocal + extraLocal;
  const bruto = b.subarray(inicio, Math.min(inicio + entrada.tamanhoCompactado, b.length));
  if (entrada.metodo === 0) return bruto;
  if (entrada.metodo === 8) {
    try {
      return await inflar(bruto);
    } catch {
      return null;
    }
  }
  return null;
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

/**
 * Extrai o texto de um anexo DOCX (ou DOC legado) para exibição embutida
 * (sem download). DOCX é um ZIP com `word/document.xml`; DOC é um arquivo
 * composto OLE com o fluxo `WordDocument`.
 */
export async function textoDoAnexoOffice(caminho: string): Promise<string | null> {
  try {
    const client = exigirCloud();
    const { data, error } = await client.storage.from(BUCKET_ANEXOS).download(caminho);
    if (error || !data) return null;

    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length < 4) return null;

    const ehZip =
      (bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        (bytes[2] === 0x03 || bytes[2] === 0x05) &&
        bytes[3] === 0x04) ||
      localizarFimZip(bytes) !== -1;

    if (!ehZip) return textoDoAnexoDoc(bytes);

    const entrada = entradasDoZip(bytes).find((e) => e.nome === "word/document.xml");
    if (!entrada) return null;
    const xmlBytes = await dadosDaEntradaZip(bytes, entrada);
    if (!xmlBytes) return null;

    const xml = new TextDecoder("utf-8")
      .decode(xmlBytes)
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p\b[^>]*>/g, "\n")
      .replace(/<\/w:tc\b[^>]*>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");

    const pronto = limparControlesDoTexto(xml).trim();
    return pronto.length > 0 ? pronto : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* DOC legado (Word 97-2003, arquivo composto OLE)                            */
/* -------------------------------------------------------------------------- */

const ASSINATURA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Segue a cadeia de setores de um arquivo composto OLE e devolve o fluxo. */
function fluxoPorCadeia(
  b: Uint8Array,
  fat: Map<number, number>,
  setorInicial: number,
  tamanho: number,
  tamanhoSetor: number,
): Uint8Array | null {
  if (tamanho <= 0 || setorInicial === 0xfffffffe || setorInicial === 0xffffffff) return null;
  const partes: Uint8Array[] = [];
  let setor = setorInicial;
  let restante = tamanho;
  let guarda = 0;
  while (setor !== 0xfffffffe && setor !== 0xffffffff) {
    if (guarda++ > 100000) return null;
    const inicio = (setor + 1) * tamanhoSetor;
    const parte = b
      .subarray(inicio, Math.min(inicio + tamanhoSetor, b.length))
      .slice(0, Math.min(tamanhoSetor, restante));
    partes.push(parte);
    restante -= parte.length;
    if (restante <= 0) break;
    setor = fat.get(setor) ?? 0xfffffffe;
  }
  if (restante > 0) return null;
  const total = partes.reduce((acc, p) => acc + p.length, 0);
  const resultado = new Uint8Array(total);
  let desloc = 0;
  for (const p of partes) {
    resultado.set(p, desloc);
    desloc += p.length;
  }
  return resultado;
}

/** Lê o fluxo `WordDocument`, inclusive quando guardado como mini-stream. */
function fluxoWordDocument(b: Uint8Array): Uint8Array | null {
  if (b.length < 512) return null;
  for (let i = 0; i < 8; i += 1) if (b[i] !== ASSINATURA_OLE[i]) return null;

  const tamanhoSetor = 1 << lerU16(b, 0x1e);
  const porSetor = Math.floor(tamanhoSetor / 4);
  const tamanhoMini = 1 << lerU16(b, 0x20);
  const numeroFat = lerU32(b, 0x2c);
  const primeiroDir = lerU32(b, 0x30);
  const corteMini = lerU32(b, 0x38) || 4096;
  const primeiroMiniFat = lerU32(b, 0x3c);
  const numeroMiniFat = lerU32(b, 0x40);

  const difat: number[] = [];
  for (let i = 0; i < 109; i += 1) {
    const id = lerU32(b, 0x4c + i * 4);
    if (id === 0xffffffff) break;
    difat.push(id);
  }

  const fat = new Map<number, number>();
  for (let k = 0; k < difat.length && k < numeroFat; k += 1) {
    const setorFat = difat[k];
    if (setorFat === undefined) break;
    const base = (setorFat + 1) * tamanhoSetor;
    for (let i = 0; i < porSetor; i += 1) {
      fat.set(k * porSetor + i, lerU32(b, base + i * 4));
    }
  }

  const numeroDir = lerU32(b, 0x28) || 1;
  const dirBytes = fluxoPorCadeia(b, fat, primeiroDir, numeroDir * tamanhoSetor, tamanhoSetor);
  if (!dirBytes) return null;

  let setorRaiz = -1;
  let tamanhoRaiz = 0;
  let alvo: { setor: number; tamanho: number } | null = null;

  for (let i = 0; i + 128 <= dirBytes.length; i += 128) {
    const caracteres = lerU16(dirBytes, i + 0x40) & 0xfffe;
    const nome = new TextDecoder("utf-16le")
      .decode(dirBytes.subarray(i, i + caracteres))
      .split("\u0000")
      .join("");
    const tipo = dirBytes[i + 0x42];
    const setor = lerU32(dirBytes, i + 0x74);
    const tamanho = lerU32(dirBytes, i + 0x78);
    if (nome === "Root Entry" && tipo === 5) {
      setorRaiz = setor;
      tamanhoRaiz = tamanho;
    }
    if (nome === "WordDocument") alvo = { setor, tamanho };
  }
  if (!alvo) return null;

  if (alvo.tamanho < corteMini && numeroMiniFat > 0 && setorRaiz !== -1) {
    return fluxoMiniStream(
      b,
      fat,
      primeiroMiniFat,
      numeroMiniFat,
      setorRaiz,
      tamanhoRaiz,
      tamanhoSetor,
      tamanhoMini,
      alvo.setor,
      alvo.tamanho,
    );
  }
  return fluxoPorCadeia(b, fat, alvo.setor, alvo.tamanho, tamanhoSetor);
}

/** Lê um fluxo guardado no mini-stream do arquivo OLE (arquivos pequenos). */
function fluxoMiniStream(
  b: Uint8Array,
  fat: Map<number, number>,
  primeiroMiniFat: number,
  numeroMiniFat: number,
  setorRaiz: number,
  tamanhoRaiz: number,
  tamanhoSetor: number,
  tamanhoMini: number,
  setorInicial: number,
  tamanho: number,
): Uint8Array | null {
  const raiz = fluxoPorCadeia(b, fat, setorRaiz, tamanhoRaiz, tamanhoSetor);
  if (!raiz) return null;
  const porMiniFat = Math.floor(tamanhoSetor / 4);

  const miniFat = new Map<number, number>();
  let setor = primeiroMiniFat;
  let guarda = 0;
  for (let k = 0; k < numeroMiniFat && setor !== 0xfffffffe && setor !== 0xffffffff; k += 1) {
    if (guarda++ > 100000) break;
    const base = (setor + 1) * tamanhoSetor;
    for (let i = 0; i < porMiniFat; i += 1) {
      miniFat.set(k * porMiniFat + i, lerU32(b, base + i * 4));
    }
    setor = fat.get(setor) ?? 0xfffffffe;
  }

  const partes: Uint8Array[] = [];
  let atual = setorInicial;
  let restante = tamanho;
  guarda = 0;
  while (atual !== 0xfffffffe && atual !== 0xffffffff) {
    if (guarda++ > 100000) return null;
    if (restante <= 0) break;
    const inicio = atual * tamanhoMini;
    if (inicio >= raiz.length) return null;
    const parte = raiz.subarray(
      inicio,
      Math.min(inicio + Math.min(tamanhoMini, restante), raiz.length),
    );
    partes.push(parte);
    restante -= parte.length;
    atual = miniFat.get(atual) ?? 0xfffffffe;
  }
  if (restante > 0) return null;
  const total = partes.reduce((acc, p) => acc + p.length, 0);
  const resultado = new Uint8Array(total);
  let desloc = 0;
  for (const p of partes) {
    resultado.set(p, desloc);
    desloc += p.length;
  }
  return resultado;
}

/** Extrai o texto principal de um .doc legado (Word 97-2003 / OLE). */
function textoDoAnexoDoc(b: Uint8Array): string | null {
  try {
    const word = fluxoWordDocument(b);
    if (!word || word.length < 0x1c + 4) return null;

    const fcMin = lerU32(word, 0x18);
    const fcMac = lerU32(word, 0x1c);
    if (fcMac <= fcMin || fcMac > word.length) return null;

    const limpo = limparControlesDoTexto(
      new TextDecoder("windows-1252").decode(word.subarray(fcMin, fcMac)),
    )
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return limpo.length > 0 ? limpo : null;
  } catch {
    return null;
  }
}
