/**
 * Atas de Reunião — acesso aos dados (tipos de reunião e atas).
 *
 * Espelha a migration `20260926000000_atas_de_reuniao.sql`. As leituras usam o
 * cliente "livre" (sem tipagem das tabelas) e o mapeamento via
 * `Record<string, unknown>`, no mesmo estilo de `auditorias-base.ts` e
 * `planos-base.ts`. As escritas ficam em `atas-crud.ts` e passam pelas funções
 * do banco que validam permissão.
 */
import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import type {
  Ata,
  AtaAcao,
  AtaSetorCitado,
  DocumentoAta,
  OrigemAta,
  ParticipanteDocumento,
  PautaDocumento,
  PeriodicidadeReuniao,
  PlanoDocumento,
  StatusAta,
  StatusSugestaoAcao,
  TipoReuniao,
  UsuarioRef,
} from "@/lib/atas";

export interface UsuarioAtaRow {
  id: string;
  nome: string;
  email: string;
}

export type Rec = Record<string, unknown>;
export const str = (r: unknown, p = ""): string => (typeof r === "string" ? r : p);
export const int = (r: unknown): number | null =>
  typeof r === "number" ? r : typeof r === "string" && r !== "" ? Number(r) : null;

const PERIODICIDADES_OK = new Set<string>([
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "avulsa",
]);
const ORIGENS_OK = new Set<string>(["simples", "sistema", "arquivo"]);
const STATUS_OK = new Set<string>(["rascunho", "aguardando_assinatura", "assinada"]);
const SUGESTAO_OK = new Set<string>(["sugerida", "confirmada", "descartada"]);

function usuariosDoJson(v: unknown): UsuarioRef[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const nome = str(o["nome"]).trim();
    if (!nome || !str(o["id"])) return [];
    return [{ id: str(o["id"]), nome }];
  });
}

/** Mapeia uma linha de `tipos_reuniao` para o modelo `TipoReuniao`. */
export function tipoReuniaoDoRow(row: Rec): TipoReuniao {
  const periodicidade = str(row["periodicidade"], "avulsa");
  return {
    id: str(row["id"]),
    nome: str(row["nome"]),
    periodicidade: (PERIODICIDADES_OK.has(periodicidade)
      ? periodicidade
      : "avulsa") as PeriodicidadeReuniao,
    diaPrevisto: int(row["dia_previsto"]),
    participantes: usuariosDoJson(row["participantes"]),
    signatarios: usuariosDoJson(row["signatarios"]),
    ativo: row["ativo"] !== false,
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

/** Documento de uma ata nova, ou de uma ata antiga que não tem documento salvo. */
export function documentoVazio(): DocumentoAta {
  return {
    areas: "",
    horario: "",
    pauta: [],
    plano: [],
    participantes: [],
    elaboradoPor: "",
    aprovadoPor: "",
    revisao: "1",
    dataRevisao: "",
  };
}

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function listaDe(valor: unknown): Rec[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is Rec => !!item && typeof item === "object");
}

/** Lê o jsonb `documento`, tolerando campos ausentes (atas antigas e migrations recentes). */
export function documentoDoJson(valor: unknown): DocumentoAta {
  const base = documentoVazio();
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return base;
  const o = valor as Rec;
  const pauta: PautaDocumento[] = listaDe(o["pauta"]).map((item) => ({
    area: textoDe(item["area"]),
    pauta: textoDe(item["pauta"]),
    descricao: textoDe(item["descricao"]),
  }));
  const plano: PlanoDocumento[] = listaDe(o["plano"]).map((item) => ({
    numero: textoDe(item["numero"]),
    oQue: textoDe(item["oQue"]),
    como: textoDe(item["como"]),
    quem: textoDe(item["quem"]),
    quando: textoDe(item["quando"]),
    status: textoDe(item["status"]),
  }));
  const participantes: ParticipanteDocumento[] = listaDe(o["participantes"]).map((item) => ({
    nome: textoDe(item["nome"]),
    cargo: textoDe(item["cargo"]),
  }));
  return {
    areas: textoDe(o["areas"]),
    horario: textoDe(o["horario"]),
    pauta,
    plano,
    participantes,
    elaboradoPor: textoDe(o["elaboradoPor"]),
    aprovadoPor: textoDe(o["aprovadoPor"]),
    revisao: textoDe(o["revisao"]) || base.revisao,
    dataRevisao: textoDe(o["dataRevisao"]),
  };
}

/** Mapeia uma linha de `atas` para o modelo `Ata`. */
export function ataDoRow(row: Rec): Ata {
  const origem = str(row["origem"], "simples");
  const status = str(row["status"], "rascunho");
  const tipoReuniaoId = str(row["tipo_reuniao"]);
  return {
    id: str(row["id"]),
    tipoReuniaoId: tipoReuniaoId ? tipoReuniaoId : null,
    origem: (ORIGENS_OK.has(origem) ? origem : "simples") as OrigemAta,
    titulo: str(row["titulo"]),
    dataReuniao: str(row["data_reuniao"]),
    texto: str(row["texto"]),
    documento: documentoDoJson(row["documento"]),
    status: (STATUS_OK.has(status) ? status : "rascunho") as StatusAta,
    criadoPor: str(row["criado_por"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

/** Lista os tipos de reunião cadastrados (ativos e desativados). */
export async function listarTiposReuniao(): Promise<TipoReuniao[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("tipos_reuniao")
      .select("*")
      .order("nome", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => tipoReuniaoDoRow(row as Record<string, unknown>));
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}

/** Lista as atas existentes (dados usados pelo calendário e resumos). */
export async function listarAtas(): Promise<Ata[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("atas")
      .select(
        "id,tipo_reuniao,origem,titulo,data_reuniao,texto,documento,status,criado_por,created_at,updated_at",
      )
      .order("data_reuniao", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => ataDoRow(row as Record<string, unknown>));
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}

/**
 * Devolve o id de `public.usuarios` pelo e-mail do colaborador logado, para o
 * front decidir participação na ata (espelha `usuario_id_por_email` no banco).
 *
 * Consulta direta por e-mail a cada chamada, sem cache: uma falha antiga não
 * fica presa em memória até recarregar a página. Erros são propagados, para
 * quem chama poder avisar o usuário. `null` significa "e-mail sem cadastro".
 */
export async function usuarioIdPorEmail(email: unknown): Promise<string | null> {
  const limpo = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!limpo) return null;
  const client = clienteLivre();
  const { data, error } = await client
    .from("usuarios")
    .select("id,email")
    .ilike("email", limpo)
    .limit(1);
  if (error) throw traduzErro(error);
  const linha = (data ?? [])[0] as Record<string, unknown> | undefined;
  return linha?.["id"] ? String(linha["id"]) : null;
}

/* -------------------------------------------------------------------------- */
/* Leitura assistida — setores citados e ações geradas                        */
/* -------------------------------------------------------------------------- */

/** Mapeia uma linha de `ata_setores_citados` para o modelo `AtaSetorCitado`. */
export function ataSetorCitadoDoRow(row: Rec): AtaSetorCitado {
  return {
    id: str(row["id"]),
    ataId: str(row["ata"]),
    setor: str(row["setor"]),
    trecho: str(row["trecho"]),
  };
}

/** Mapeia uma linha de `ata_acoes` para o modelo `AtaAcao`. */
export function ataAcaoDoRow(row: Rec): AtaAcao {
  const status = str(row["status_sugestao"], "sugerida");
  return {
    id: str(row["id"]),
    ataId: str(row["ata"]),
    trechoOrigem: str(row["trecho_origem"]),
    descricao: str(row["descricao"]),
    setorDestino: str(row["setor_destino"]),
    responsavel: str(row["responsavel"]) || null,
    prazo: str(row["prazo"]) || null,
    planoAcaoId: str(row["plano_acao"]) || null,
    statusSugestao: (SUGESTAO_OK.has(status) ? status : "sugerida") as StatusSugestaoAcao,
  };
}

/** Setores citados de uma ata (extrato por setor), com o trecho preservado. */
export async function listarSetoresCitadosDaAta(ataId: string): Promise<AtaSetorCitado[]> {
  if (!ataId) return [];
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("ata_setores_citados")
      .select("id,ata,setor,trecho")
      .eq("ata", ataId);
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => ataSetorCitadoDoRow(row as Record<string, unknown>));
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}

/** Ações geradas de uma ata, de mais recente para mais antiga. */
export async function listarAcoesDaAta(ataId: string): Promise<AtaAcao[]> {
  if (!ataId) return [];
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("ata_acoes")
      .select(
        "id,ata,trecho_origem,descricao,setor_destino,responsavel,prazo,plano_acao,status_sugestao",
      )
      .eq("ata", ataId);
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => ataAcaoDoRow(row as Record<string, unknown>));
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}

/**
 * Usuários do portal (`public.usuarios`) com id, nome e e-mail, para exibir o
 * responsável de uma ação (que é gravado como `usuarios.id`).
 */
export async function listarUsuariosDasAtas(): Promise<UsuarioAtaRow[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client.from("usuarios").select("id,nome,email");
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((row: unknown) => {
      const linha = row as Record<string, unknown>;
      return { id: str(linha["id"]), nome: str(linha["nome"]), email: str(linha["email"]) };
    });
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}
