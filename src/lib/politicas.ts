/**
 * Políticas — tipos, constantes e acesso a dados.
 *
 * Fonte: banco do Lovable Cloud (`public.politicas`, criada na migration
 * `supabase/migrations/20260917010000_politicas_validade.sql`). As datas são
 * gravadas no formato `dd/mm/aaaa` (texto), coerente com o restante da aba.
 */

import { exigirCloud } from "@/integrations/supabase/client";
import type { PoliticaInsert, PoliticaLeituraRow, PoliticaLeituraInsert, PoliticaRow, PoliticaSugestaoRow, PoliticaSugestaoInsert } from "@/integrations/supabase/db-types";
import type { UserSession } from "@/lib/auth";
import { NIVEIS_FILTRAM_POR_SETOR } from "@/lib/niveis-acesso";
import { organizacaoDisponivel, tabelaAusente, traduzErro } from "@/lib/organizacao";
import { temAcessoTotalPops, veSomenteLiberados } from "@/lib/permissoes";
import { ehSetorQualidade, listarDocumentosLiberados, type Pop, type UsuarioFavorito } from "@/lib/pops";
import { politicaVisivelPorSetor } from "@/lib/setor-documentos";

/* -------------------------------------------------------------------------- */
/* Domínio                                                                    */
/* -------------------------------------------------------------------------- */

export interface PoliticaAnexo {
  /** Caminho dentro do bucket (para gerar URL assinada). `null` quando o upload não foi possível (ex.: offline). */
  path: string | null;
  nome: string;
  tipo: string;
}

export interface RevisaoPolitica {
  id: string;
  numero: number;
  data: string;
  observacao: string;
}

export interface ParecerPolitica {
  tipo: "concordo" | "discordo";
  clausula: string;
  motivo: string;
  data: string;
}

export interface SugestaoPolitica {
  id: string;
  texto: string;
  data: string;
}

export interface PoliticaItem {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string;
  setores: string[];
  aplicabilidade: string;
  links: string[];
  dataPostagem: string;
  status: string;
  historico: RevisaoPolitica[];
  dataRevisao: string;
  revisao: number;
  observacaoRevisao: string;
  anexo: PoliticaAnexo | null;
  parecer: ParecerPolitica | null;
  sugestoes: SugestaoPolitica[];
  /** Data de validade da política (`dd/mm/aaaa`). Vazia quando não definida. */
  dataVencimento: string;
}

/* -------------------------------------------------------------------------- */
/* Acesso a dados — Lovable Cloud (Supabase)                                  */
/* -------------------------------------------------------------------------- */

function traduzirErro(erro: unknown): Error {
  if (erro && typeof erro === "object" && "message" in erro) {
    return new Error(String((erro as { message: unknown }).message));
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

function politicaDoRow(row: PoliticaRow): PoliticaItem {
  return {
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    objetivo: row.objetivo ?? "",
    setores: row.setores ?? [],
    aplicabilidade: row.aplicabilidade ?? "",
    links: row.links ?? [],
    dataPostagem: row.data_postagem ?? "",
    status: row.status ?? "Em aprovação",
    historico: Array.isArray(row.historico)
      ? (row.historico as unknown as RevisaoPolitica[])
      : [],
    dataRevisao: row.data_revisao ?? "",
    revisao: typeof row.revisao === "number" && row.revisao > 0 ? row.revisao : 1,
    observacaoRevisao: row.observacao_revisao ?? "",
    anexo:
      row.anexo && typeof row.anexo === "object" ? (row.anexo as unknown as PoliticaAnexo) : null,
    parecer:
      row.parecer && typeof row.parecer === "object"
        ? (row.parecer as unknown as ParecerPolitica)
        : null,
    sugestoes: Array.isArray(row.sugestoes)
      ? (row.sugestoes as unknown as SugestaoPolitica[])
      : [],
    dataVencimento: row.data_vencimento ?? "",
  };
}

function politicaParaInsercao(item: PoliticaItem): PoliticaInsert {
  return {
    codigo: item.codigo,
    titulo: item.titulo,
    objetivo: item.objetivo ?? "",
    setores: item.setores ?? [],
    aplicabilidade: item.aplicabilidade ?? "",
    links: item.links ?? [],
    data_postagem: item.dataPostagem ?? "",
    status: item.status ?? "Em aprovação",
    historico: (item.historico ?? []) as unknown as NonNullable<PoliticaInsert["historico"]>,
    data_revisao: item.dataRevisao ?? "",
    revisao: item.revisao,
    observacao_revisao: item.observacaoRevisao ?? "",
    anexo: item.anexo as unknown as NonNullable<PoliticaInsert["anexo"]>,
    parecer: item.parecer as unknown as NonNullable<PoliticaInsert["parecer"]>,
    sugestoes: (item.sugestoes ?? []) as unknown as NonNullable<PoliticaInsert["sugestoes"]>,
    data_vencimento: item.dataVencimento ?? "",
  };
}

/** Lista as políticas cadastradas, ordenadas pelo código. */
export async function carregarPoliticas(): Promise<PoliticaItem[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("politicas")
    .select("*")
    .order("codigo", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(politicaDoRow);
}

/**
 * Lista políticas visíveis ao usuário conforme nível de acesso e setor:
 * - Admin, Gestor da Qualidade e setor Qualidade: todas.
 * - Colaborador de outra unidade: somente liberadas individualmente.
 * - Colaborador, Líder de setor e Desenvolvedor: do próprio setor e gerais.
 * - Auxiliar da Qualidade, Diretoria e demais: todas (leitura irrestrita).
 */
export async function carregarPoliticasAcessiveis(
  session: UserSession | null,
): Promise<PoliticaItem[]> {
  const todas = await carregarPoliticas();
  if (!session) return todas;

  try {
    if (temAcessoTotalPops(session) || ehSetorQualidade(session)) {
      return todas;
    }

    if (veSomenteLiberados(session)) {
      if (!session.colaboradorId) return [];
      const ids = new Set(await listarDocumentosLiberados(session.colaboradorId, "politica"));
      return todas.filter((politica) => ids.has(politica.id));
    }

    if (NIVEIS_FILTRAM_POR_SETOR.has(session.nivelAcesso)) {
      const setorUsuario = session.setor ?? "";
      return todas.filter((politica) => politicaVisivelPorSetor(politica, setorUsuario));
    }

    return todas;
  } catch {
    return todas;
  }
}

/** Cria uma política no banco e devolve o registro persistido. */
export async function criarPolitica(item: PoliticaItem): Promise<PoliticaItem> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("politicas")
    .insert(politicaParaInsercao(item))
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar a política.");
  return politicaDoRow(data);
}

/** Atualiza uma política no banco e devolve o registro persistido. */
export async function atualizarPolitica(item: PoliticaItem): Promise<PoliticaItem> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("politicas")
    .update(politicaParaInsercao(item))
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Política não encontrada.");
  return politicaDoRow(data);
}

/** Remove uma política do banco. */
export async function excluirPolitica(id: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("politicas").delete().eq("id", id);
  if (error) throw traduzErro(error);
}

/* -------------------------------------------------------------------------- */
/* Próximos vencimentos                                                        */
/* -------------------------------------------------------------------------- */

/** Documento com data de validade próxima/vencida, para o painel. */
export interface DocumentoVencimento {
  id: string;
  codigo: string;
  titulo: string;
  tipo: "pop" | "politica";
  /** Data de vencimento em `aaaa-mm-dd` (normalizada para comparação). */
  dataVencimento: string;
  /** Data de vencimento formatada para exibição (`dd/mm/aaaa`). */
  dataVencimentoExibicao: string;
  /** Dias até vencer (negativo = já vencido). */
  diasRestantes: number;
}

/** Converte datas em `dd/mm/aaaa` ou `aaaa-mm-dd` para `Date` no início do dia. */
function dataParaComparar(valor: string): Date | null {
  if (!valor) return null;
  let ano = "";
  let mes = "";
  let dia = "";
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const partes = valor.slice(0, 10).split("-");
    ano = partes[0] ?? "";
    mes = partes[1] ?? "";
    dia = partes[2] ?? "";
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const partes = valor.split("/");
    dia = partes[0] ?? "";
    mes = partes[1] ?? "";
    ano = partes[2] ?? "";
  } else {
    return null;
  }
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

/** Exibe a data de vencimento como `dd/mm/aaaa`. */
function exibirData(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [ano, mes, dia] = valor.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return valor;
}

/**
 * Documentos (POPs e políticas) com data de validade definida e vencendo em
 * até 30 dias (incluindo os já vencidos), ordenados do mais urgente ao menos.
 */
export function documentosVencidosOuProximos(
  pops: Pop[],
  politicas: PoliticaItem[],
  janelaDias = 30,
): DocumentoVencimento[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const milissegundosPorDia = 24 * 60 * 60 * 1000;

  const itens: Omit<DocumentoVencimento, "dataVencimentoExibicao" | "diasRestantes">[] = [
    ...pops.map((pop) => ({
      id: pop.id,
      codigo: pop.codigo,
      titulo: pop.titulo,
      tipo: "pop" as const,
      dataVencimento: pop.dataVencimento ?? "",
    })),
    ...politicas.map((politica) => ({
      id: politica.id,
      codigo: politica.codigo,
      titulo: politica.titulo,
      tipo: "politica" as const,
      dataVencimento: politica.dataVencimento ?? "",
    })),
  ];

  const resultado: DocumentoVencimento[] = [];
  for (const item of itens) {
    const alvo = dataParaComparar(item.dataVencimento);
    if (!alvo) continue;
    const dias = Math.ceil((alvo.getTime() - hoje.getTime()) / milissegundosPorDia);
    if (dias > janelaDias) continue;
    resultado.push({
      ...item,
      dataVencimentoExibicao: exibirData(item.dataVencimento),
      diasRestantes: dias,
    });
  }

  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** `true` quando o Lovable Cloud está configurado (fonte de dados das políticas). */
export function politicasDisponiveis(): boolean {
  return organizacaoDisponivel();
}

/* -------------------------------------------------------------------------- */
/* Ciência da política: botão "Lido" (e registros de parecer)                */
/* -------------------------------------------------------------------------- */

/** Leitura do usuário informado em cada política (mapa politicaId -> leitura). */
export async function carregarLeiturasPoliticaDoUsuario(
  email: string,
): Promise<Record<string, PoliticaLeitura>> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado) return {};

  const client = exigirCloud();
  const { data, error } = await client
    .from("politica_leituras")
    .select("*")
    .eq("usuario_email", emailNormalizado);
  if (error) {
    if (tabelaAusente(error)) return {};
    throw traduzErro(error);
  }
  const mapa: Record<string, PoliticaLeitura> = {};
  for (const row of data ?? []) mapa[row.politica_id] = leituraPoliticaDoRow(row);
  return mapa;
}

/** Leituras registradas em uma política (painel de ciência do detalhe). */
export async function listarLeiturasPolitica(politicaId: string): Promise<PoliticaLeitura[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("politica_leituras")
    .select("*")
    .eq("politica_id", politicaId)
    .order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(leituraPoliticaDoRow);
}

/**
 * Registra (ou atualiza) a ciência do usuário sobre a política — botão "Lido".
 */
export async function registrarLeituraPolitica(
  politicaId: string,
  usuario: UsuarioFavorito,
  decisao: "lido" | "concordo" | "discordo",
): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para registrar sua leitura.");

  const client = exigirCloud();
  const { error } = await client.from("politica_leituras").upsert(
    {
      politica_id: politicaId,
      usuario_email: email,
      usuario_nome: usuario.nome,
      decisao,
    },
    {
      onConflict: "politica_id,usuario_email",
    },
  );
  if (error) throw traduzErro(error);
}

function leituraPoliticaDoRow(row: PoliticaLeituraRow): PoliticaLeitura {
  const decisao: "lido" | "concordo" | "discordo" =
    row.decisao === "discordo" ? "discordo" : row.decisao === "lido" ? "lido" : "concordo";
  return {
    id: row.id,
    politicaId: row.politica_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    decisao,
    createdAt: row.created_at,
  };
}

/** Quantas pessoas já registraram leitura da política. */
export function contarLeiturasPolitica(leituras: PoliticaLeitura[]): number {
  return leituras.length;
}

/* -------------------------------------------------------------------------- */
/* Sugestões de melhoria (botão "Sugerir melhoria")                           */
/* -------------------------------------------------------------------------- */

function sugestaoPoliticaDoRow(row: PoliticaSugestaoRow): PoliticaSugestao {
  return {
    id: row.id,
    politicaId: row.politica_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    sugestao: row.sugestao,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Sugestões de melhoria já enviadas para uma política (mais recentes primeiro). */
export async function listarSugestoesPolitica(politicaId: string): Promise<PoliticaSugestao[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("politica_sugestoes")
    .select("*")
    .eq("politica_id", politicaId)
    .order("created_at", { ascending: false });
  if (error) {
    if (tabelaAusente(error)) return [];
    throw traduzErro(error);
  }
  return (data ?? []).map(sugestaoPoliticaDoRow);
}

/**
 * Envia uma sugestão de melhoria para a política. O banco avisa automaticamente
 * o Gestor da Qualidade e o setor Qualidade (trigger da migration).
 */
export async function enviarSugestaoPolitica(
  politicaId: string,
  usuario: UsuarioFavorito,
  sugestao: string,
): Promise<void> {
  const texto = sugestao.trim();
  if (!texto) throw new Error("Escreva a sugestão antes de enviar.");
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para sugerir uma melhoria.");

  const registro: PoliticaSugestaoInsert = {
    politica_id: politicaId,
    usuario_email: email,
    usuario_nome: usuario.nome,
    sugestao: texto,
  };
  const client = exigirCloud();
  const { error } = await client.from("politica_sugestoes").insert(registro);
  if (error) throw traduzErro(error);
}

export async function marcarSugestaoConcluidaPolitica(
  sugestaoId: string,
  usuario: UsuarioFavorito,
): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para gerenciar sugestões.");

  const client = exigirCloud();

  // Atualiza o status para "aplicada" (compat: updated_at pode não existir)
  const { error } = await client
    .from("politica_sugestoes")
    .update({ status: "aplicada" } as never)
    .eq("id", sugestaoId);
  if (error) throw traduzErro(error);

  // Notifica o autor da sugestão
  const { data: sugestao } = await (client
    .from("politica_sugestoes")
    .select("usuario_email, usuario_nome, sugestao, politica_id")
    .eq("id", sugestaoId)
    .maybeSingle() as unknown as Promise<{ data: { usuario_email: string; usuario_nome: string; sugestao: string; politica_id: string } | null }>);

  if (sugestao) {
    const { data: politica } = await (client
      .from("politicas")
      .select("codigo, titulo")
      .eq("id", sugestao.politica_id)
      .maybeSingle() as unknown as Promise<{ data: { codigo: string; titulo: string } | null }>);

    await (client.from("notificacoes").insert({
      destinatario_email: sugestao.usuario_email,
      destinatario_nome: sugestao.usuario_nome,
      titulo: `Sugestão aplicada: ${politica?.codigo ?? "POLÍTICA"}`,
      mensagem: `${usuario.nome} marcou sua sugestão "${sugestao.sugestao.substring(0, 50)}${sugestao.sugestao.length > 50 ? "..." : ""}" como aplicada na política ${politica?.codigo ?? ""}.`,
      tipo: "sugestao_aplicada",
      pop_id: null,
      autor_nome: usuario.nome,
      autor_email: email,
    } as never) as unknown as Promise<unknown>);
  }
}

/* -------------------------------------------------------------------------- */
/* Tipos públicos                                                              */
/* -------------------------------------------------------------------------- */

export interface PoliticaLeitura {
  id: string;
  politicaId: string;
  usuarioEmail: string;
  usuarioNome: string;
  decisao: "lido" | "concordo" | "discordo";
  createdAt: string;
}

export interface PoliticaSugestao {
  id: string;
  politicaId: string;
  usuarioEmail: string;
  usuarioNome: string;
  sugestao: string;
  status: string;
  createdAt: string;
}