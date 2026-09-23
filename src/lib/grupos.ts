import { clienteLivre } from "@/lib/supabase-livro";
import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { str } from "@/lib/planos-base";
import type { UserSession } from "@/lib/auth";
import { ehUsuarioDaQualidade, ehLiderancaDaQualidade } from "@/lib/permissoes";
import type { GrupoAcesso } from "@/lib/projetos-crud";

export type Rec = Record<string, unknown>;

export function grupoDoRow(row: Rec): GrupoAcesso {
    const raw = row["modulos_perm"];
  let modulosPerm: Record<string, unknown>;
  try { modulosPerm = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>) ?? {}; }
  catch { modulosPerm = {}; }
  return {
    id: str(row["id"]), nome: str(row["nome"]), descricao: str(row["descricao"]),
    modulosPerm, createdAt: str(row["created_at"]), updatedAt: str(row["updated_at"]),
  };
}

/** Grupos visíveis: admin/gestor veem todos; demais veem só os do seu `grupos`. */
export async function listarGruposAcesso(session: UserSession | null | undefined): Promise<GrupoAcesso[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client.from("grupos_acessos").select("*").order("nome");
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    const todos = (data ?? []).map((r: unknown) => grupoDoRow(r as unknown as Rec));
    if (!session) return todos;
    if (ehUsuarioDaQualidade(session) || ehLiderancaDaQualidade(session)) return todos;
    const grupos = String(session.grupos ?? "").split(/[;,]/).map((g) => g.trim().toLowerCase()).filter(Boolean);
    if (grupos.length === 0) return [];
    return todos.filter((g: GrupoAcesso) => grupos.includes(g.nome.toLowerCase()));
  } catch (e) {
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message)) return [];
    throw e;
  }
}

export async function criarGrupoAcesso(nome: string, descricao: string, modulosPerm: Record<string, unknown>): Promise<GrupoAcesso> {
  const client = clienteLivre();
  const { data, error } = await client.from("grupos_acessos").insert({
    nome: nome.trim(), descricao, modulos_perm: JSON.stringify(modulosPerm),
  }).select("*").single();
  if (error) throw traduzErro(error);
  return grupoDoRow(data as unknown as Rec);
}

export async function atualizarGrupoAcesso(id: string, patch: Partial<Omit<GrupoAcesso, "id">>): Promise<GrupoAcesso> {
  const client = clienteLivre();
  const u: Record<string, unknown> = {};
    if (patch.nome !== undefined) u["nome"] = patch.nome;
  if (patch.descricao !== undefined) u["descricao"] = patch.descricao;
  if (patch.modulosPerm !== undefined) u["modulos_perm"] = JSON.stringify(patch.modulosPerm);
  const { data, error } = await client.from("grupos_acessos").update(u).eq("id", id).select("*").single();
  if (error) throw traduzErro(error);
  return grupoDoRow(data as unknown as Rec);
}

export async function excluirGrupoAcesso(id: string): Promise<void> {
  const client = clienteLivre();
  const { error } = await client.from("grupos_acessos").delete().eq("id", id);
  if (error) throw traduzErro(error);
}

interface ProjetoGrupoPermissao { podeVer: boolean; podeEditar: boolean; }

/** Grupos autorizados a ver/editar um projeto (join com projeto_grupos). */
export async function listarGruposDoProjeto(projetoId: string): Promise<ProjetoGrupoPermissao & { grupos: GrupoAcesso[] }> {
  const client = clienteLivre();
  const { data, error } = await client
    .from("projeto_grupos")
    .select("pode_ver,pode_editar, grupos_acessos!inner(*)")
    .eq("projeto_id", projetoId);
  if (error) {
    if (tabelaAusente(error)) return { podeVer: true, podeEditar: false, grupos: [] };
    throw traduzErro(error);
  }
  const grupos: GrupoAcesso[] = [];
  let podeVer = false, podeEditar = false;
  for (const r of data ?? []) {
        const o = r as unknown as Rec;
    const g = o["grupos_acessos"] as Rec | null;
    if (g) grupos.push(grupoDoRow(g));
    if (o["pode_ver"]) podeVer = true;
    if (o["pode_editar"]) podeEditar = true;
  }
  return { podeVer, podeEditar, grupos };
}

export async function vincularGrupoAoProjeto(projetoId: string, grupoId: string, perm: ProjetoGrupoPermissao): Promise<void> {
  const client = clienteLivre();
  const { error } = await client.from("projeto_grupos").upsert({
    projeto_id: projetoId, grupo_id: grupoId, pode_ver: perm.podeVer, pode_editar: perm.podeEditar,
  });
  if (error) throw traduzErro(error);
}

export async function desvincularGrupoDoProjeto(projetoId: string, grupoId: string): Promise<void> {
  const client = clienteLivre();
  const { error } = await client.from("projeto_grupos").delete().match({ projeto_id: projetoId, grupo_id: grupoId });
  if (error) throw traduzErro(error);
}
