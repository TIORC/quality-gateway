import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { ehUsuarioDaQualidade, ehLiderancaDaQualidade } from "@/lib/permissoes";
import { normalizarSetor } from "@/lib/niveis-acesso";
import type { PlanoAcao } from "@/lib/planos";
import { listarPlanos } from "@/lib/planos-base";
import type { UserSession } from "@/lib/auth";
import { KANBAN_COLUNAS_DEFAULT } from "@/lib/projetos";
import { clienteLivre } from "@/lib/supabase-livro";
import type { ProjetoEstrategico, Swot, FrenteTrabalho, KanbanColuna, TipoProjeto, StatusProjeto, PrioridadeProjeto } from "@/lib/projetos";

export type Rec = Record<string, unknown>;
export const str = (r: unknown, p = ""): string => (typeof r === "string" ? r : p);

function textoParaArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((i) => (typeof i === "string" ? [i] : [JSON.stringify(i)]));
}

function swotDoRow(v: unknown): Swot {
  const o: Record<string, unknown> =
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    forcas: textoParaArray(o["forcas"]),
    fraquezas: textoParaArray(o["fraquezas"]),
    oportunidades: textoParaArray(o["oportunidades"]),
    ameacas: textoParaArray(o["ameacas"]),
  };
}

function frentesDoRow(v: unknown): FrenteTrabalho[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    const o = item as Record<string, unknown>;
    const nome = str(o["nome"]);
    if (!nome) return [];
    return [{
      id: str(o["id"]) || `fr-${Math.random().toString(36).slice(2, 8)}`,
      nome, descricao: str(o["descricao"]), setores: textoParaArray(o["setores"]),
    }];
  });
}

function kanbanDoRow(v: unknown): KanbanColuna[] {
  if (!Array.isArray(v)) return [...KANBAN_COLUNAS_DEFAULT];
  const cols = v.flatMap((item) => {
    const o = item as Record<string, unknown>;
    const id = str(o["id"]);
    const nome = str(o["nome"], id);
    if (!id || !nome) return [];
    const status = textoParaArray(o["status"]);
    return [{ id, nome, status: status.length ? status : ["nao_iniciado"] }];
  });
  return cols.length ? cols : [...KANBAN_COLUNAS_DEFAULT];
}

const TIPOS_PROJETO_OK: TipoProjeto[] = ["Planejamento Estratégico", "Projeto"];
const STATUS_PROJETO_OK: StatusProjeto[] = ["planejamento", "em_andamento", "concluido", "cancelado", "pausado"];
const PRIORIDADES_OK: PrioridadeProjeto[] = ["Baixa", "Média", "Alta", "Crítica"];

export function projetoDoRow(row: Rec): ProjetoEstrategico {
  const tipo = str(row["tipo"], "Planejamento Estratégico") as TipoProjeto;
  const status = str(row["status"], "planejamento") as StatusProjeto;
  const prioridade = str(row["prioridade"], "Média") as PrioridadeProjeto;
  return {
    id: str(row["id"]), codigo: str(row["codigo"]), nome: str(row["nome"]),
    tipo: TIPOS_PROJETO_OK.includes(tipo) ? tipo : "Planejamento Estratégico",
    objetivo: str(row["objetivo"]), setor: str(row["setor"]),
    responsavelId: str(row["responsavel_id"]),
    responsavelNome: str(row["responsavel_nome"]),
    responsavelEmail: str(row["responsavel_email"]),
    grupoAlvo: str(row["grupo_alvo"]),
    inicio: typeof row["inicio"] === "string" ? row["inicio"] : null,
    fimPrevisto: typeof row["fim_previsto"] === "string" ? row["fim_previsto"] : null,
    fimReal: typeof row["fim_real"] === "string" ? row["fim_real"] : null,
    prioridade: PRIORIDADES_OK.includes(prioridade) ? prioridade : "Média",
    status: STATUS_PROJETO_OK.includes(status) ? status : "planejamento",
    swot: swotDoRow(row["swot"]), frentes: frentesDoRow(row["frentes"]),
    kanbanColunas: kanbanDoRow(row["kanban_colunas"]),
    createdAt: str(row["created_at"]), updatedAt: str(row["updated_at"]),
  };
}

export const usuarioEmailProjeto = (session: UserSession | null | undefined): string =>
  (session?.email ?? "").trim().toLowerCase();

/**
 * Visibilidade: admin/gestor/qualidade veem tudo; senão só se é responsável,
 * do seu setor ou pertence ao grupo-alvo do projeto.
 */
export function podeVerProjeto(session: UserSession | null | undefined, projeto: ProjetoEstrategico): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session) || ehLiderancaDaQualidade(session)) return true;
  const email = usuarioEmailProjeto(session);
  if (email && email === projeto.responsavelEmail) return true;
  const setor = normalizarSetor(session.setor);
  if (setor && normalizarSetor(projeto.setor) === setor) return true;
  const grupos = String(session.grupos ?? "").split(/[;,]/).map((g) => g.trim().toLowerCase());
  if (grupos.includes(projeto.grupoAlvo.trim().toLowerCase())) return true;
  return false;
}

export function projetosVisiveis(
  session: UserSession | null | undefined,
  projetos: ProjetoEstrategico[],
): ProjetoEstrategico[] {
  if (!session) return [];
  if (ehUsuarioDaQualidade(session) || ehLiderancaDaQualidade(session)) return projetos;
  return projetos.filter((p) => podeVerProjeto(session, p));
}

/** Lista projetos já filtrados pela visão do colaborador. */
export async function listarProjetos(session: UserSession | null | undefined): Promise<ProjetoEstrategico[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("projetos_estrategicos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return projetosVisiveis(session, (data ?? []).map((r: unknown) => projetoDoRow(r as unknown as Rec)));
  } catch (e) {
    // Cloud não configurado ou tabela ainda não criada -> lista vazia.
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message)) return [];
    throw e;
  }
}

/** Carrega ações (planos) vinculadas a um projeto via vinculo_tipo='Projeto'. */
export async function carregarAcoesDoProjeto(projetoId: string): Promise<PlanoAcao[]> {
  const planos = await listarPlanos().catch(() => [] as PlanoAcao[]);
  return planos.filter((p) => p.vinculoTipo === "Projeto" && p.vinculoId === projetoId);
}

/** Carrega ações de todos os projetos em um único request. */
export async function carregarAcoesPorProjeto(): Promise<Map<string, PlanoAcao[]>> {
  const planos = await listarPlanos().catch(() => [] as PlanoAcao[]);
  const mapa = new Map<string, PlanoAcao[]>();
  for (const p of planos) {
    if (p.vinculoTipo === "Projeto" && p.vinculoId) {
      const arr = mapa.get(p.vinculoId) ?? [];
      arr.push(p);
      mapa.set(p.vinculoId, arr);
    }
  }
  return mapa;
}
