/**
 * POPs — tipos, constantes e acesso a dados.
 *
 * Fonte: banco do Lovable Cloud (`public.pop_setores`, `public.pops`,
 * `public.pop_anotacoes`, `public.pop_favoritos` etc.).
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
  arquivo: null,
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

export async function criarPop(entrada: EntradaPop): Promise<Pop> {
  return criarPopCloud(entrada);
}

export async function atualizarPop(id: string, entrada: EntradaPop): Promise<Pop> {
  return atualizarPopCloud(id, entrada);
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
