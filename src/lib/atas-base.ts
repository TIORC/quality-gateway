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
  OrigemAta,
  PeriodicidadeReuniao,
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
        "id,tipo_reuniao,origem,titulo,data_reuniao,texto,status,criado_por,created_at,updated_at",
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

let cacheUsuarioPorEmail: Map<string, string> | null = null;

/**
 * Devolve o id de `public.usuarios` pelo e-mail do colaborador logado, para o
 * front decidir participação na ata (espelha `usuario_id_por_email` no banco).
 * Carrega a lista uma única vez e guarda em memória.
 */
export async function usuarioIdPorEmail(email: unknown): Promise<string | null> {
  const limpo = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!limpo) return null;
  if (!cacheUsuarioPorEmail) {
    const mapa = new Map<string, string>();
    try {
      const client = clienteLivre();
      const { data, error } = await client.from("usuarios").select("id,email");
      if (!error) {
        for (const row of data ?? []) {
          const linha = row as Record<string, unknown>;
          const valor = String(linha["email"] ?? "")
            .trim()
            .toLowerCase();
          if (valor && linha["id"]) mapa.set(valor, String(linha["id"]));
        }
      }
    } catch {
      // Sem cache diante de falha; a permissão real é validada no banco.
    }
    cacheUsuarioPorEmail = mapa;
  }
  return cacheUsuarioPorEmail.get(limpo) ?? null;
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
