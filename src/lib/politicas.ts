/**
 * Políticas — tipos, constantes e acesso a dados.
 *
 * Fonte: banco do Lovable Cloud (`public.politicas`, criada na migration
 * `supabase/migrations/20260917010000_politicas_validade.sql`). As datas são
 * gravadas no formato `dd/mm/aaaa` (texto), coerente com o restante da aba.
 */

import { exigirCloud } from "@/integrations/supabase/client";
import type { PoliticaInsert, PoliticaLeituraRow, PoliticaLeituraInsert, PoliticaRow, PoliticaSugestaoRow, PoliticaSugestaoInsert } from "@/integrations/supabase/db-types";
import { getSession, type UserSession } from "@/lib/auth";
import { NIVEIS_FILTRAM_POR_SETOR } from "@/lib/niveis-acesso";
import { organizacaoDisponivel, tabelaAusente, traduzErro } from "@/lib/organizacao";
import {
  podeAdicionarDocumentos,
  podeExcluirDocumentos,
  podeModificarDocumentos,
  temAcessoTotalPops,
  veSomenteLiberados,
} from "@/lib/permissoes";
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
  /** Documento que estava vigente quando esta revisão foi substituída. */
  anexo?: PoliticaAnexo | null;
  /** Conteúdo da política na época em que a revisão foi substituída. */
  conteudo?: ConteudoRevisaoPolitica;
  /** Quem leu e concordou com esta revisão. Ausente em revisões anteriores ao arquivamento. */
  leitores?: LeitorRevisaoPolitica[];
}

/** Campos da política que entram na comparação entre revisões. */
export interface ConteudoRevisaoPolitica {
  codigo: string;
  titulo: string;
  objetivo: string;
  aplicabilidade: string;
  setores: string[];
  links: string[];
  status: string;
  dataVencimento: string;
}

export interface LeitorRevisaoPolitica {
  nome: string;
  email: string;
  decisao: "lido" | "concordo";
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
  if (!podeAdicionarDocumentos(getSession())) {
    throw new Error("Você não tem permissão para adicionar documentos.");
  }
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
  if (!podeModificarDocumentos(getSession())) {
    throw new Error("Você não tem permissão para modificar documentos.");
  }
  const client = exigirCloud();
  const anterior = await client
    .from("politicas")
    .select("revisao")
    .eq("id", item.id)
    .maybeSingle();
  const revisaoAnterior = typeof (anterior.data as { revisao?: unknown } | null)?.revisao === "number"
    ? ((anterior.data as { revisao: number }).revisao)
    : item.revisao;
  const { data, error } = await client
    .from("politicas")
    .update(politicaParaInsercao(item))
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Política não encontrada.");
  const salva = politicaDoRow(data);
  if (salva.revisao > revisaoAnterior) {
    void notificarNovaRevisaoPolitica(salva).catch(() => {});
  }
  return salva;
}

/** Notifica (via app) a nova revisão de uma política com o que mudou. */
async function notificarNovaRevisaoPolitica(politica: PoliticaItem): Promise<void> {
  const client = exigirCloud();
  const sessao = getSession();
  const mudanca = politica.observacaoRevisao.trim() || "O documento foi atualizado. Abra para ler a nova versão.";
  const rotulo = `Revisão ${String(politica.revisao).padStart(2, "0")}`;
  const titulo = `Nova revisão para reler: ${politica.codigo} — ${rotulo}`;
  const mensagem = `O que mudou na ${rotulo}: ${mudanca}`;
  const { data: leitores } = await client
    .from("politica_leituras")
    .select("usuario_email,usuario_nome")
    .eq("politica_id", politica.id);
  const mapa = new Map<string, string>();
  for (const l of (leitores ?? []) as { usuario_email: string; usuario_nome: string }[]) {
    const email = l.usuario_email.trim().toLowerCase();
    if (email && !mapa.has(email)) mapa.set(email, l.usuario_nome ?? "");
  }
  let destinos = [...mapa.entries()];
  if (destinos.length === 0) {
    const { data: ativos } = await client
      .from("colaboradores")
      .select("email,nome")
      .eq("status", "Ativo");
    destinos = ((ativos ?? []) as { email: string; nome: string }[])
      .map((c) => [c.email.trim().toLowerCase(), c.nome] as [string, string])
      .filter(([email]) => email && email !== (sessao?.email ?? "").trim().toLowerCase());
  }
  if (destinos.length === 0) return;
  for (const [email, nome] of destinos) {
    const { data: existente } = await client
      .from("notificacoes")
      .select("id")
      .eq("destinatario_email", email)
      .eq("tipo", "revisao")
      .eq("politica_id", politica.id)
      .eq("revisao", politica.revisao)
      .limit(1);
    if (existente && existente.length > 0) continue;
    const { error } = await client.from("notificacoes").insert({
      destinatario_email: email,
      destinatario_nome: nome,
      titulo,
      mensagem,
      tipo: "revisao",
      politica_id: politica.id,
      revisao: politica.revisao,
      autor_nome: sessao?.nome || "Qualidade",
      autor_email: sessao?.email ?? "",
    } as never);
    if (error && !tabelaAusente(error)) throw traduzErro(error);
  }
}

/** Remove uma política do banco. */
export async function excluirPolitica(id: string): Promise<void> {
  if (!podeExcluirDocumentos(getSession())) {
    throw new Error("Você não tem permissão para excluir documentos.");
  }
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

/**
 * Dias até o vencimento da política (negativo = já vencida).
 * `null` quando não há data de vencimento válida.
 */
export function diasParaVencimento(dataVencimento: string): number | null {
  const alvo = dataParaComparar(dataVencimento);
  if (!alvo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

/** Política vencida ou que vence dentro da janela (padrão: 30 dias). */
export function politicaVencendo(item: PoliticaItem, janelaDias = 30): boolean {
  const dias = diasParaVencimento(item.dataVencimento ?? "");
  return dias !== null && dias <= janelaDias;
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
 * Foto da revisão vigente no momento em que ela é substituída por uma nova: conteúdo,
 * documento e quem leu e concordou. Chamada antes de gravar a nova revisão.
 */
export async function arquivarRevisaoPolitica(
  politica: PoliticaItem,
): Promise<Pick<RevisaoPolitica, "anexo" | "conteudo" | "leitores">> {
  let leitores: LeitorRevisaoPolitica[] | undefined;
  try {
    const leituras = await listarLeiturasPolitica(politica.id);
    leitores = leituras
      .filter((l) => l.revisaoLida === politica.revisao && l.decisao !== "discordo")
      .map((l) => ({
        nome: l.usuarioNome || l.usuarioEmail,
        email: l.usuarioEmail,
        decisao: l.decisao === "concordo" ? "concordo" : "lido",
      }));
  } catch {
    // Sem leituras arquivadas: a tela cai na lista atual de leitores da revisão.
    leitores = undefined;
  }
  return {
    anexo: politica.anexo,
    conteudo: {
      codigo: politica.codigo,
      titulo: politica.titulo,
      objetivo: politica.objetivo,
      aplicabilidade: politica.aplicabilidade,
      setores: politica.setores,
      links: politica.links,
      status: politica.status,
      dataVencimento: politica.dataVencimento,
    },
    leitores,
  };
}

/**
 * Registra (ou atualiza) a ciência do usuário sobre a política — botão "Lido".
 * Grava a revisão vigente em `revisao_lida`: nova revisão exige releitura.
 */
export async function registrarLeituraPolitica(
  politicaId: string,
  usuario: UsuarioFavorito,
  decisao: "lido" | "concordo" | "discordo",
  revisao?: number,
): Promise<void> {
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para registrar sua leitura.");

  const client = exigirCloud();
  let revisaoLida = revisao ?? 0;
  if (!revisaoLida) {
    const { data } = await client.from("politicas").select("revisao").eq("id", politicaId).maybeSingle();
    revisaoLida = typeof (data as { revisao?: unknown } | null)?.revisao === "number"
      ? ((data as { revisao: number }).revisao)
      : 1;
  }
  const linha: Record<string, unknown> = {
    politica_id: politicaId,
    usuario_email: email,
    usuario_nome: usuario.nome,
    decisao,
    revisao_lida: revisaoLida,
  };
  const { error } = await client.from("politica_leituras").upsert(
    linha as never,
    {
      onConflict: "politica_id,usuario_email",
    },
  );
  if (error) {
    if (String((error as { message?: unknown }).message ?? "").includes("revisao_lida")) {
      delete linha.revisao_lida;
      const { error: erro2 } = await client.from("politica_leituras").upsert(
        linha as never,
        { onConflict: "politica_id,usuario_email" },
      );
      if (erro2) throw traduzErro(erro2);
      return;
    }
    throw traduzErro(error);
  }
}

function leituraPoliticaDoRow(row: PoliticaLeituraRow): PoliticaLeitura {
  const decisao: "lido" | "concordo" | "discordo" =
    row.decisao === "discordo" ? "discordo" : row.decisao === "lido" ? "lido" : "concordo";
  const r = row as PoliticaLeituraRow & { revisao_lida?: unknown };
  return {
    id: row.id,
    politicaId: row.politica_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    decisao,
    revisaoLida: typeof r.revisao_lida === "number" ? r.revisao_lida : 1,
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
  const r = row as PoliticaSugestaoRow & { revisao?: unknown };
  return {
    id: row.id,
    politicaId: row.politica_id,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    sugestao: row.sugestao,
    status: row.status,
    createdAt: row.created_at,
    revisao: typeof r.revisao === "number" ? r.revisao : 1,
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
  revisao?: number,
): Promise<void> {
  const texto = sugestao.trim();
  if (!texto) throw new Error("Escreva a sugestão antes de enviar.");
  const email = usuario.email.trim().toLowerCase();
  if (!email) throw new Error("Entre no portal para sugerir uma melhoria.");

  const registro: Record<string, unknown> = {
    politica_id: politicaId,
    usuario_email: email,
    usuario_nome: usuario.nome,
    sugestao: texto,
    revisao: revisao ?? 1,
  };
  const client = exigirCloud();
  const { error } = await client.from("politica_sugestoes").insert(registro as never);
  if (error) {
    // Banco sem a coluna `revisao` (migration ainda não aplicada): grava sem ela.
    if (String((error as { message?: unknown }).message ?? "").includes("revisao")) {
      delete registro.revisao;
      const { error: erro2 } = await client
        .from("politica_sugestoes")
        .insert(registro as never);
      if (erro2) throw traduzErro(erro2);
      return;
    }
    throw traduzErro(error);
  }
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
  /** Revisão lida. Só vale quando = revisão vigente (exige releitura). */
  revisaoLida: number;
  createdAt: string;
}

/** `true` quando a leitura cobre a revisão vigente (sem releitura pendente). */
export function leituraPoliticaCobreRevisao(leitura: PoliticaLeitura, revisaoVigente: number): boolean {
  return (leitura.revisaoLida || 0) >= revisaoVigente;
}

export interface PoliticaSugestao {
  id: string;
  politicaId: string;
  usuarioEmail: string;
  usuarioNome: string;
  sugestao: string;
  status: string;
  createdAt: string;
  /** Revisão da política à qual a sugestão se refere. */
  revisao: number;
}