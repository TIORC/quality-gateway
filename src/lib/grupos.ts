import { clienteLivre } from "@/lib/supabase-livro";
import { exigirCloud } from "@/integrations/supabase/client";
import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { str } from "@/lib/planos-base";
import { getSession, type UserSession } from "@/lib/auth";
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

/**
 * Gravações de grupos passam por funções do banco, que conferem se quem pede é
 * Gestor da Qualidade ou Desenvolvedor do Sistema (ver a migração de grupos).
 */
async function chamarGrupoRpc(nome: string, args: Record<string, unknown>): Promise<Rec> {
  const session = getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const client = exigirCloud();
  const rpc = client.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc.call(client, nome, { p_email: session.email, ...args });
  if (error) throw error;
  return data as Rec;
}

export async function criarGrupoAcesso(nome: string, descricao: string, modulosPerm: Record<string, unknown>): Promise<GrupoAcesso> {
  const linha = await chamarGrupoRpc("grupo_acesso_salvar", {
    p_id: null, p_nome: nome.trim(), p_descricao: descricao, p_modulos: modulosPerm,
  });
  return grupoDoRow(linha);
}

export async function atualizarGrupoAcesso(id: string, patch: Partial<Omit<GrupoAcesso, "id">>): Promise<GrupoAcesso> {
  const linha = await chamarGrupoRpc("grupo_acesso_salvar", {
    p_id: id,
    p_nome: patch.nome?.trim() ?? null,
    p_descricao: patch.descricao ?? null,
    p_modulos: patch.modulosPerm ?? null,
  });
  return grupoDoRow(linha);
}

export async function excluirGrupoAcesso(id: string): Promise<void> {
  await chamarGrupoRpc("grupo_acesso_excluir", { p_id: id });
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
