/**
 * Acesso concedido por grupo de acesso.
 *
 * Cada grupo guarda em `grupos_acessos.modulos_perm` (jsonb):
 * - `rotas`: caminhos do menu que o grupo libera (ex.: "/indicadores");
 * - `permissoes`: permissões de documentos/planos que o grupo concede.
 *
 * A pessoa recebe a união do acesso de todos os grupos em que está (campo
 * `colaboradores.grupos`). Este módulo não depende de nada de autenticação para
 * poder ser usado tanto no login quanto no cadastro de grupos.
 */
import { NAV_GROUPS, type AppRoutePath } from "@/lib/navigation";

/** Permissões que um grupo pode conceder. Chaves iguais às colunas de `colaboradores`. */
export const PERMISSOES_DE_GRUPO = [
  {
    chave: "perm_adicionar_documentos",
    rotulo: "Adicionar documentos",
    descricao: "Criar POPs e políticas.",
  },
  {
    chave: "perm_modificar_documentos",
    rotulo: "Modificar documentos",
    descricao: "Editar POPs e políticas.",
  },
  {
    chave: "perm_excluir_documentos",
    rotulo: "Excluir documentos",
    descricao: "Excluir POPs e políticas.",
  },
  {
    chave: "perm_excluir_planos",
    rotulo: "Excluir planos de ação",
    descricao: "Remover planos de ação.",
  },
] as const;

export type ChavePermissaoGrupo = (typeof PERMISSOES_DE_GRUPO)[number]["chave"];

/** Caminhos do menu que podem ser liberados por grupo. Configurações fica de fora: é gestão. */
export const ROTAS_DE_GRUPO: { path: AppRoutePath; label: string }[] = NAV_GROUPS.flatMap(
  (grupo) => grupo.items,
)
  .filter((item) => item.path !== "/configuracoes")
  .map((item) => ({ path: item.path, label: item.label }));

export interface ModulosPermGrupo {
  rotas?: string[];
  permissoes?: Partial<Record<ChavePermissaoGrupo, boolean>>;
}

export interface AcessoDosGrupos {
  rotas: AppRoutePath[];
  permissoes: Record<ChavePermissaoGrupo, boolean>;
}

const SEM_PERMISSOES = Object.fromEntries(
  PERMISSOES_DE_GRUPO.map((permissao) => [permissao.chave, false]),
) as Record<ChavePermissaoGrupo, boolean>;

/** Converte o valor salvo (objeto ou texto JSON) em `ModulosPermGrupo`. */
export function lerModulosPerm(valor: unknown): ModulosPermGrupo {
  let bruto = valor;
  if (typeof bruto === "string") {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return {};
    }
  }
  if (!bruto || typeof bruto !== "object") return {};
  return bruto as ModulosPermGrupo;
}

/** Nomes dos grupos de um colaborador, a partir do texto ("CIPA; Comitê de riscos"). */
export function nomesDosGrupos(texto: string | null | undefined): string[] {
  return String(texto ?? "")
    .split(/[;,]/)
    .map((nome) => nome.trim())
    .filter(Boolean);
}

/** Une o acesso de todos os grupos informados (lista de `modulos_perm`). */
export function acessoDosGrupos(modulosLista: unknown[]): AcessoDosGrupos {
  const permissoes = { ...SEM_PERMISSOES };
  const rotas = new Set<AppRoutePath>();
  for (const bruto of modulosLista) {
    const modulos = lerModulosPerm(bruto);
    for (const permissao of PERMISSOES_DE_GRUPO) {
      if (modulos.permissoes?.[permissao.chave] === true) permissoes[permissao.chave] = true;
    }
    for (const rota of modulos.rotas ?? []) {
      if (ROTAS_DE_GRUPO.some((item) => item.path === rota)) rotas.add(rota as AppRoutePath);
    }
  }
  return { rotas: [...rotas], permissoes };
}
