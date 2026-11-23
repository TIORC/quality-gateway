/**
 * Agenda — eventos avulsos criados pelos usuários (estilo Google Agenda).
 *
 * Diferente dos tipos de reunião (recorrentes), cada evento tem data e horário
 * próprios e convida pessoas marcadas com @. Leitura e escrita passam pelas
 * funções do banco (`listar_agenda_eventos`, `criar_agenda_evento` e
 * `excluir_agenda_evento`), que validam o usuário pelo e-mail. A RLS bloqueia a
 * escrita direta na tabela `agenda_eventos`.
 */
import { exigirCloud } from "@/integrations/supabase/client";
import type { UserSession } from "@/lib/auth";
import type { UsuarioRef } from "@/lib/atas";
import { str, type Rec } from "@/lib/atas-base";
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";

/**
 * Arquivo anexado a um evento. O arquivo fica no bucket privado `pop-anexos`,
 * em `agenda/<id do evento>/...`, e só é aberto por URL assinada.
 */
export interface AnexoAgenda {
  nome: string;
  caminho: string;
  tipo: string;
  tamanho: number;
}

/** Limite de tamanho por arquivo anexado (10 MB). */
export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

const BUCKET_ANEXOS = "pop-anexos";

export interface AgendaEvento {
  id: string;
  titulo: string;
  /** Data no formato `AAAA-MM-DD`. */
  dataEvento: string;
  /** Horário de início `HH:mm`; `null` para evento de dia inteiro. */
  horaInicio: string | null;
  /** Horário de término `HH:mm`; `null` quando não informado. */
  horaFim: string | null;
  descricao: string;
  /** Usuário que criou o evento (`id` de `public.usuarios`). */
  criadoPor: string;
  /** Pessoas marcadas com @ (`id` de `public.usuarios`). */
  convidados: UsuarioRef[];
  /** Marcado como realizado pelo criador (ou pela Qualidade). */
  realizada: boolean;
  anexos: AnexoAgenda[];
  createdAt: string;
}

/** Entrada do formulário "Alimentar Agenda". */
export interface EntradaAgendaEvento {
  titulo: string;
  /** Data no formato `AAAA-MM-DD`. */
  dataEvento: string;
  horaInicio: string | null;
  horaFim: string | null;
  descricao: string;
  convidados: UsuarioRef[];
}

/** Erros que indicam banco ainda sem a migration de agenda aplicada. */
const ERRO_SEM_MIGRATION = /não configurado|does not exist|42P01|PGRST205|PGRST202/i;

function emailDaSessao(sessao: UserSession | null): string {
  return (sessao?.email ?? "").trim().toLowerCase();
}

/** Converte o horário do banco (`HH:mm:ss`) para `HH:mm`. */
function horaDoBanco(valor: unknown): string | null {
  const texto = str(valor);
  return texto ? texto.slice(0, 5) : null;
}

function convidadosDoJson(valor: unknown): UsuarioRef[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id = str(o["id"]);
    const nome = str(o["nome"]).trim();
    return id && nome ? [{ id, nome }] : [];
  });
}

function anexosDoJson(valor: unknown): AnexoAgenda[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const caminho = str(o["caminho"]);
    const nome = str(o["nome"]).trim();
    if (!caminho || !nome) return [];
    return [
      {
        nome,
        caminho,
        tipo: str(o["tipo"]),
        tamanho: typeof o["tamanho"] === "number" ? o["tamanho"] : Number(o["tamanho"]) || 0,
      },
    ];
  });
}

/** Mapeia uma linha de `agenda_eventos` para o modelo `AgendaEvento`. */
export function agendaEventoDoRow(row: Rec): AgendaEvento {
  return {
    id: str(row["id"]),
    titulo: str(row["titulo"]),
    dataEvento: str(row["data_evento"]),
    horaInicio: horaDoBanco(row["hora_inicio"]),
    horaFim: horaDoBanco(row["hora_fim"]),
    descricao: str(row["descricao"]),
    criadoPor: str(row["criado_por"]),
    convidados: convidadosDoJson(row["convidados"]),
    realizada: row["realizada"] === true,
    anexos: anexosDoJson(row["anexos"]),
    createdAt: str(row["created_at"]),
  };
}

/** Eventos em que o usuário logado é criador ou convidado. */
export async function listarAgendaEventos(sessao: UserSession | null): Promise<AgendaEvento[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client.rpc("listar_agenda_eventos", {
      email_caller: emailDaSessao(sessao),
    });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => agendaEventoDoRow(row as Rec));
  } catch (e) {
    if (e instanceof Error && ERRO_SEM_MIGRATION.test(e.message)) return [];
    throw e;
  }
}

/** Cria um evento na agenda com as pessoas marcadas como convidados. */
export async function criarAgendaEvento(
  entrada: EntradaAgendaEvento,
  sessao: UserSession | null,
): Promise<AgendaEvento> {
  const titulo = entrada.titulo.trim();
  if (!titulo) throw new Error("Informe o título do evento.");
  if (!entrada.dataEvento) throw new Error("Informe a data do evento.");
  if (entrada.horaInicio && entrada.horaFim && entrada.horaFim <= entrada.horaInicio) {
    throw new Error("O horário de término deve ser depois do início.");
  }

  const client = clienteLivre();
  const { data, error } = await client.rpc("criar_agenda_evento", {
    email_caller: emailDaSessao(sessao),
    titulo,
    data_evento: entrada.dataEvento,
    hora_inicio: entrada.horaInicio || null,
    hora_fim: entrada.horaFim || null,
    descricao: entrada.descricao.trim(),
    convidados: entrada.convidados.map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome })),
  });
  if (error) throw traduzErro(error);

  const linha = (Array.isArray(data) ? (data[0] ?? null) : data) as Rec | null;
  if (!linha || !linha["id"]) throw new Error("Não foi possível criar o evento.");
  return agendaEventoDoRow(linha);
}

/** Atualiza um evento existente (criador ou Qualidade/Admin, validado no banco). */
export async function atualizarAgendaEvento(
  id: string,
  entrada: EntradaAgendaEvento,
  sessao: UserSession | null,
): Promise<AgendaEvento> {
  if (!id) throw new Error("Evento não encontrado.");
  const titulo = entrada.titulo.trim();
  if (!titulo) throw new Error("Informe o título do evento.");
  if (!entrada.dataEvento) throw new Error("Informe a data do evento.");
  if (entrada.horaInicio && entrada.horaFim && entrada.horaFim <= entrada.horaInicio) {
    throw new Error("O horário de término deve ser depois do início.");
  }

  const client = clienteLivre();
  const { data, error } = await client.rpc("atualizar_agenda_evento", {
    email_caller: emailDaSessao(sessao),
    evento_id: id,
    p_titulo: titulo,
    p_data_evento: entrada.dataEvento,
    p_hora_inicio: entrada.horaInicio || null,
    p_hora_fim: entrada.horaFim || null,
    p_descricao: entrada.descricao.trim(),
    p_convidados: entrada.convidados.map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome })),
  });
  if (error) throw traduzErro(error);

  const linha = (Array.isArray(data) ? (data[0] ?? null) : data) as Rec | null;
  if (!linha || !linha["id"]) throw new Error("Não foi possível salvar o evento.");
  return agendaEventoDoRow(linha);
}

/** Marca (ou desmarca) um evento como realizado. Quem pode é validado no banco. */
export async function marcarAgendaEventoRealizada(
  id: string,
  marcar: boolean,
  sessao: UserSession | null,
): Promise<void> {
  if (!id) throw new Error("Evento não encontrado.");
  const client = clienteLivre();
  const { error } = await client.rpc("marcar_agenda_evento_realizada", {
    email_caller: emailDaSessao(sessao),
    evento_id: id,
    marcar,
  });
  if (error) throw traduzErro(error);
}

function eventoDoRetorno(data: unknown): AgendaEvento {
  const linha = (Array.isArray(data) ? (data[0] ?? null) : data) as Rec | null;
  if (!linha || !linha["id"]) throw new Error("Não foi possível atualizar o evento.");
  return agendaEventoDoRow(linha);
}

/** Envia um arquivo ao Storage e registra o anexo no evento. */
export async function enviarAnexoAgenda(
  eventoId: string,
  arquivo: File,
  sessao: UserSession | null,
): Promise<AgendaEvento> {
  if (!eventoId) throw new Error("Evento não encontrado.");
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) throw new Error("O arquivo passa de 10 MB.");

  const extensao = arquivo.name.includes(".")
    ? (arquivo.name.split(".").pop() ?? "bin").toLowerCase()
    : "bin";
  const caminho = `agenda/${eventoId}/${Date.now()}.${extensao}`;
  const storage = exigirCloud().storage.from(BUCKET_ANEXOS);
  const { error: erroEnvio } = await storage.upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  });
  if (erroEnvio) throw traduzErro(erroEnvio);

  const anexo: AnexoAgenda = {
    nome: arquivo.name,
    caminho,
    tipo: arquivo.type,
    tamanho: arquivo.size,
  };
  const client = clienteLivre();
  const { data, error } = await client.rpc("adicionar_anexo_agenda_evento", {
    email_caller: emailDaSessao(sessao),
    evento_id: eventoId,
    p_anexo: anexo,
  });
  if (error) {
    // Sem registro no banco, o arquivo enviado não deve ficar órfão no Storage.
    await storage.remove([caminho]);
    throw traduzErro(error);
  }
  return eventoDoRetorno(data);
}

/** Remove o registro do anexo e apaga o arquivo do Storage. */
export async function removerAnexoAgenda(
  eventoId: string,
  caminho: string,
  sessao: UserSession | null,
): Promise<AgendaEvento> {
  const client = clienteLivre();
  const { data, error } = await client.rpc("remover_anexo_agenda_evento", {
    email_caller: emailDaSessao(sessao),
    evento_id: eventoId,
    p_caminho: caminho,
  });
  if (error) throw traduzErro(error);
  await exigirCloud().storage.from(BUCKET_ANEXOS).remove([caminho]);
  return eventoDoRetorno(data);
}

/** URL assinada, válida por 5 minutos, para abrir um anexo do evento. */
export async function urlAnexoAgenda(caminho: string): Promise<string> {
  const { data, error } = await exigirCloud()
    .storage.from(BUCKET_ANEXOS)
    .createSignedUrl(caminho, 60 * 5);
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível abrir o anexo.");
  return data.signedUrl;
}

/** Exclui um evento (criador ou Qualidade/Admin, validado no banco). */
export async function excluirAgendaEvento(id: string, sessao: UserSession | null): Promise<void> {
  if (!id) throw new Error("Evento não encontrado.");
  const client = clienteLivre();
  const { error } = await client.rpc("excluir_agenda_evento", {
    email_caller: emailDaSessao(sessao),
    evento_id: id,
  });
  if (error) throw traduzErro(error);
}
