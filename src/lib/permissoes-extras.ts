/**
 * Permissões individuais por colaborador (checks no perfil de /funcionarios/$id).
 * Gravadas em `colaboradores.permissoes_extras` (jsonb: chave → boolean).
 */
import { exigirCloud } from "@/integrations/supabase/client";

export const GRUPOS_PERMISSOES_EXTRAS: { titulo: string; itens: { chave: string; rotulo: string }[] }[] = [
  {
    titulo: "Administração",
    itens: [
      { chave: "adm_setores", rotulo: "Gerenciar setores (criar, editar e excluir)" },
      { chave: "adm_perfis", rotulo: "Gerenciar perfis e permissões de acesso" },
      { chave: "adm_relatorios", rotulo: "Visualizar relatórios e indicadores" },
      { chave: "adm_logs", rotulo: "Visualizar logs de auditoria (quem fez o quê e quando)" },
    ],
  },
  {
    titulo: "Gestão de colaboradores",
    itens: [
      { chave: "col_cadastrar", rotulo: "Cadastrar novos colaboradores" },
      { chave: "col_editar", rotulo: "Editar colaboradores" },
      { chave: "col_excluir", rotulo: "Excluir colaboradores" },
      { chave: "col_banir_temp", rotulo: "Banir colaboradores temporariamente" },
      { chave: "col_banir_def", rotulo: "Banir colaboradores definitivamente" },
      { chave: "col_listar", rotulo: "Visualizar lista de colaboradores" },
      { chave: "col_senha", rotulo: "Redefinir senha de colaboradores" },
      { chave: "col_setor_cargo", rotulo: "Alterar o setor ou o cargo de colaboradores" },
      { chave: "col_reativar", rotulo: "Reativar colaboradores banidos temporariamente" },
    ],
  },
  {
    titulo: "Leitura de POPs",
    itens: [
      { chave: "pop_ver_setor", rotulo: "Visualizar POPs do próprio setor" },
      { chave: "pop_ver_todos", rotulo: "Visualizar POPs de todos os setores" },
    ],
  },
  {
    titulo: "Aprovação de POPs",
    itens: [
      { chave: "pop_aprovar_setor", rotulo: "Aprovar POPs do próprio setor" },
      { chave: "pop_aprovar_todos", rotulo: "Aprovar POPs de todos os setores" },
    ],
  },
  {
    titulo: "Gestão de POPs",
    itens: [
      { chave: "pop_publicar", rotulo: "Publicar novos POPs" },
      { chave: "pop_editar", rotulo: "Editar POPs" },
      { chave: "pop_excluir", rotulo: "Excluir POPs" },
    ],
  },
];

export type PermissoesExtras = Record<string, boolean>;

export async function carregarPermissoesExtras(colaboradorId: string): Promise<PermissoesExtras> {
  const { data, error } = await exigirCloud()
    .from("colaboradores")
    .select("permissoes_extras")
    .eq("id", colaboradorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const valor = (data as { permissoes_extras?: unknown } | null)?.permissoes_extras;
  return valor && typeof valor === "object" ? (valor as PermissoesExtras) : {};
}

export async function salvarPermissoesExtras(
  colaboradorId: string,
  permissoes: PermissoesExtras,
): Promise<void> {
  const { error } = await exigirCloud()
    .from("colaboradores")
    .update({ permissoes_extras: permissoes } as never)
    .eq("id", colaboradorId);
  if (error) throw new Error(error.message);
}
