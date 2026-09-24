/**
 * Atas de Reunião — escrita de tipos de reunião e de atas.
 *
 * Tipos de reunião: criação, edição e ativação/desativação passam pelas
 * funções do banco (`criar_tipo_reuniao`, `atualizar_tipo_reuniao` e
 * `mudar_ativo_tipo_reuniao`), que validam no backend a permissão do usuário
 * (Qualidade/Admin) antes de gravar.
 *
 * Atas: criação e edição passam por `criar_ata` e `atualizar_ata`, que validam
 * no backend se o usuário participa do tipo de reunião (ou é Qualidade/Admin)
 * e se a ata ainda é rascunho. A leitura assistida usa `salvar_leitura_assistida`
 * (setores citados + ações sugeridas) e `mudar_status_acao`. Ao confirmar uma
 * ação (`mudar_status_acao` no banco), é criado o registro no módulo Planos de
 * Ação existente e o vínculo fica em `ata_acoes.plano_acao`. A escrita direta
 * nas tabelas é bloqueada pela RLS; apenas estas funções gravam.
 */
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import type {
  Ata,
  OrigemAta,
  PeriodicidadeReuniao,
  StatusSugestaoAcao,
  TipoReuniao,
  UsuarioRef,
} from "@/lib/atas";
import { ataDoRow, tipoReuniaoDoRow, type Rec } from "@/lib/atas-base";

export interface EntradaTipoReuniao {
  nome: string;
  periodicidade: PeriodicidadeReuniao;
  diaPrevisto: number | null;
  participantes: UsuarioRef[];
  signatarios: UsuarioRef[];
}

function emailDaSessao(sessao: UserSession | null): string {
  return (sessao?.email ?? "").trim().toLowerCase();
}

function resultadoRow(data: unknown): Rec {
  const linha: Rec = Array.isArray(data) ? ((data[0] ?? {}) as Rec) : ((data ?? {}) as Rec);
  if (!linha["id"]) throw new Error("Não foi possível gravar o tipo de reunião.");
  return linha;
}

/** Cadastra um novo tipo de reunião (somente Qualidade/Admin). */
export async function criarTipoReuniao(
  entrada: EntradaTipoReuniao,
  sessao: UserSession | null,
): Promise<TipoReuniao> {
  const client = clienteLivre();
  const nome = entrada.nome.trim();
  if (!nome) throw new Error("Informe o nome do tipo de reunião.");
  const { data, error } = await client.rpc("criar_tipo_reuniao", {
    email_caller: emailDaSessao(sessao),
    nome,
    periodicidade: entrada.periodicidade,
    dia_previsto: entrada.diaPrevisto,
    participantes: entrada.participantes,
    signatarios: entrada.signatarios,
  });
  if (error) throw traduzErro(error);
  return tipoReuniaoDoRow(resultadoRow(data));
}

/** Edita um tipo de reunião existente (somente Qualidade/Admin). */
export async function atualizarTipoReuniao(
  entrada: EntradaTipoReuniao,
  id: string,
  sessao: UserSession | null,
): Promise<TipoReuniao> {
  const client = clienteLivre();
  const nome = entrada.nome.trim();
  if (!nome) throw new Error("Informe o nome do tipo de reunião.");
  const { data, error } = await client.rpc("atualizar_tipo_reuniao", {
    email_caller: emailDaSessao(sessao),
    id,
    nome,
    periodicidade: entrada.periodicidade,
    dia_previsto: entrada.diaPrevisto,
    participantes: entrada.participantes,
    signatarios: entrada.signatarios,
  });
  if (error) throw traduzErro(error);
  return tipoReuniaoDoRow(resultadoRow(data));
}

/** Desativa (`ativo=false`) ou reativa (`ativo=true`) um tipo (Qualidade/Admin). */
export async function mudarAtivoTipoReuniao(
  id: string,
  ativo: boolean,
  sessao: UserSession | null,
): Promise<TipoReuniao> {
  const client = clienteLivre();
  const { data, error } = await client.rpc("mudar_ativo_tipo_reuniao", {
    email_caller: emailDaSessao(sessao),
    id,
    ativo,
  });
  if (error) throw traduzErro(error);
  return tipoReuniaoDoRow(resultadoRow(data));
}

/* -------------------------------------------------------------------------- */
/* Atas                                                                        */
/* -------------------------------------------------------------------------- */

/** Dados para criar ou editar uma ata. */
export interface EntradaAta {
  origem: OrigemAta;
  /** Obrigatório quando `origem = "sistema"`; nulo para ata simples. */
  tipoReuniaoId: string | null;
  titulo: string;
  /** Data da reunião no formato `AAAA-MM-DD`. */
  dataReuniao: string;
  texto: string;
}

/**
 * Cadastra uma nova ata como rascunho. Ata simples exige Qualidade/Admin;
 * ata do sistema exige participação no tipo (ou Qualidade/Admin). A validação
 * acontece no banco (`criar_ata`).
 */
export async function criarAta(entrada: EntradaAta, sessao: UserSession | null): Promise<Ata> {
  const client = clienteLivre();
  const titulo = entrada.titulo.trim();
  if (!titulo) throw new Error("Informe o título da ata.");
  if (!entrada.dataReuniao) throw new Error("Informe a data da reunião.");
  const { data, error } = await client.rpc("criar_ata", {
    email_caller: emailDaSessao(sessao),
    origem: entrada.origem,
    tipo_reuniao: entrada.origem === "sistema" ? entrada.tipoReuniaoId : null,
    titulo,
    data_reuniao: entrada.dataReuniao,
    texto: entrada.texto ?? "",
  });
  if (error) throw traduzErro(error);
  return ataDoRow(resultadoRow(data));
}

/**
 * Edita título, data e texto de uma ata ainda em rascunho (origem e tipo são
 * fixos após o cadastro). Permissão validada no banco (`atualizar_ata`).
 */
export async function atualizarAta(
  id: string,
  entrada: EntradaAta,
  sessao: UserSession | null,
): Promise<Ata> {
  const client = clienteLivre();
  const titulo = entrada.titulo.trim();
  if (!titulo) throw new Error("Informe o título da ata.");
  if (!entrada.dataReuniao) throw new Error("Informe a data da reunião.");
  const { data, error } = await client.rpc("atualizar_ata", {
    email_caller: emailDaSessao(sessao),
    ata_id: id,
    titulo,
    data_reuniao: entrada.dataReuniao,
    texto: entrada.texto ?? "",
  });
  if (error) throw traduzErro(error);
  return ataDoRow(resultadoRow(data));
}

/* -------------------------------------------------------------------------- */
/* Leitura assistida — setores citados e ações geradas                        */
/* -------------------------------------------------------------------------- */

/** Setor citado no texto da ata (nome conforme `public.setores`). */
export interface EntradaSetorCitado {
  setor: string;
  trecho: string;
}

/** Ação endereçada extraída do texto da ata. */
export interface EntradaAcaoAta {
  trechoOrigem: string;
  descricao: string;
  /** Setor destino (nome conforme `public.setores`). */
  setorDestino: string;
  /** E-mail do responsável (login do portal); opcional. */
  responsavelEmail?: string | null;
  /** Prazo no formato `AAAA-MM-DD`; opcional. */
  prazo?: string | null;
}

function prazoValido(prazo: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw new Error("Prazo inválido (use AAAA-MM-DD).");
  return prazo;
}

/**
 * Grava a leitura assistida de uma ata rascunho: substitui os setores citados
 * e as ações ainda como sugestão, preservando as já confirmadas/descartadas.
 * Permissão (pode editar + rascunho) validada no banco (`salvar_leitura_assistida`).
 */
export async function salvarLeituraAssistida(
  ataId: string,
  entrada: { setores: EntradaSetorCitado[]; acoes: EntradaAcaoAta[] },
  sessao: UserSession | null,
): Promise<void> {
  if (!ataId) throw new Error("Ata não encontrada.");
  const setores = entrada.setores.filter((item) => item.setor.trim());
  const acoes = entrada.acoes.map((acao) => ({
    trechoOrigem: acao.trechoOrigem ?? "",
    descricao: acao.descricao.trim(),
    setorDestino: acao.setorDestino.trim(),
    responsavelEmail: acao.responsavelEmail?.trim() || "",
    prazo: acao.prazo ? prazoValido(acao.prazo) : "",
  }));
  const client = clienteLivre();
  const { data, error } = await client.rpc("salvar_leitura_assistida", {
    email_caller: emailDaSessao(sessao),
    ata_id: ataId,
    setores,
    acoes,
  });
  if (error) throw traduzErro(error);
}

/**
 * Move uma ação entre sugerida / confirmada / descartada. Permissão validada
 * no banco (`mudar_status_acao`).
 */
export async function mudarStatusAcaoAta(
  acaoId: string,
  status: StatusSugestaoAcao,
  sessao: UserSession | null,
): Promise<void> {
  if (!acaoId) throw new Error("Ação não encontrada.");
  const client = clienteLivre();
  const { data, error } = await client.rpc("mudar_status_acao", {
    email_caller: emailDaSessao(sessao),
    acao_id: acaoId,
    novo_status: status,
  });
  if (error) throw traduzErro(error);
}
