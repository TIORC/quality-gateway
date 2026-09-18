/**
 * Rotas permitidas por nível de acesso.
 *
 * O mapa abaixo é CONFIGURÁVEL: para mudar o que cada nível vê no menu,
 * basta editar a lista de caminhos. Os rótulos dos níveis vêm de
 * `src/lib/niveis-acesso.ts` para não duplicar os nomes usados em
 * `configuracoes.tsx`.
 */

import type { AppRoutePath } from "@/lib/navigation";
import type { UserSession } from "@/lib/auth";
import {
  NIVEIS_ACESSO_TOTAL_POPS,
  NIVEL_SOMENTE_LIBERADOS,
  normalizarSetor,
} from "@/lib/niveis-acesso";

const TODAS_AS_ROTAS: AppRoutePath[] = [
  "/painel",
  "/planos-de-acao",
  "/ocorrencias",
  "/auditorias",
  "/atas-de-reuniao",
  "/projetos-e-estrategias",
  "/indicadores",
  "/politicas",
  "/pops",
  "/funcionarios",
  "/configuracoes",
  "/disparo-de-cobrancas",
  "/meu-perfil",
];

/**
 * Páginas liberadas para todos os colaboradores: todas do portal exceto a
 * configuração e o disparo de cobranças (restritas à Administração/Gestão).
 */
const ROTAS_ABERTAS: AppRoutePath[] = TODAS_AS_ROTAS.filter(
  (rota) => rota !== "/configuracoes" && rota !== "/disparo-de-cobrancas",
);

export const ROTAS_POR_NIVEL: Record<string, AppRoutePath[]> = {
  Administrador: TODAS_AS_ROTAS,
  "Gestor da Qualidade": TODAS_AS_ROTAS,
  "Auxiliar da Qualidade": ROTAS_ABERTAS,
  Diretoria: ROTAS_ABERTAS,
  "Líder de setor": ROTAS_ABERTAS,
  Desenvolvedor: ROTAS_ABERTAS,
  Colaborador: ROTAS_ABERTAS,
  "Colaborador de outra unidade": ROTAS_ABERTAS,
};

/** Rotas que a sessão atual pode acessar (vazio = sem restrição definida). */
export function rotasPermitidas(session: UserSession | null): Set<AppRoutePath> {
  if (!session) return new Set();
  // Admin/gestor sempre têm tudo, independente do nível do colaborador.
  if (session.role === "admin" || session.role === "gestor") return new Set(TODAS_AS_ROTAS);
  const nivel = session.nivelAcesso;
  if (!nivel || !ROTAS_POR_NIVEL[nivel]) return new Set();
  return new Set(ROTAS_POR_NIVEL[nivel]);
}

/** Indica se a sessão pode abrir a rota informada. */
export function rotaPermitida(session: UserSession | null, path: string): boolean {
  const permitidas = rotasPermitidas(session);
  // Sem mapa para o nível (ex.: colaborador sem vínculo): não restringe.
  if (permitidas.size === 0) return true;
  return permitidas.has(path as AppRoutePath);
}

/** Nível com acesso irrestrito aos POPs (sem liberação nem filtro de setor). */
export function temAcessoTotalPops(session: UserSession | null): boolean {
  if (!session) return false;
  if (session.role === "admin" || session.role === "gestor") return true;
  return NIVEIS_ACESSO_TOTAL_POPS.has(session.nivelAcesso);
}

/** Nível que vê apenas os documentos liberados individualmente. */
export function veSomenteLiberados(session: UserSession | null): boolean {
  return session?.nivelAcesso === NIVEL_SOMENTE_LIBERADOS;
}

/* -------------------------------------------------------------------------- */
/* Permissões de documentos (POPs e políticas)                                */
/* -------------------------------------------------------------------------- */

/**
 * Liderança da Qualidade: perfil "gestor", nível "Gestor da Qualidade" ou o
 * cargo "Coordenador da Qualidade". Sempre gerencia documentos, sem depender
 * das permissões individuais de colaborador.
 */
export function ehLiderancaDaQualidade(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (session.role === "admin" || session.role === "gestor") return true;
  return (
    session.nivelAcesso === "Gestor da Qualidade" || session.cargo === "Coordenador da Qualidade"
  );
}

/** Colaborador que recebeu a permissão individual concedida pelo gestor. */
function permConcedida(session: UserSession, permissao: boolean | undefined): boolean {
  return permissao === true;
}

/** Indica se a sessão pode adicionar/criar documentos (POPs e políticas). */
export function podeAdicionarDocumentos(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehLiderancaDaQualidade(session)) return true;
  return permConcedida(session, session.permAdicionarDocumentos);
}

/** Indica se a sessão pode modificar/editar documentos (POPs e políticas). */
export function podeModificarDocumentos(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehLiderancaDaQualidade(session)) return true;
  return permConcedida(session, session.permModificarDocumentos);
}

/** Indica se a sessão pode excluir documentos (POPs e políticas). */
export function podeExcluirDocumentos(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehLiderancaDaQualidade(session)) return true;
  return permConcedida(session, session.permExcluirDocumentos);
}

/**
 * Usuário do setor da Qualidade ou liderança da Qualidade (role admin/gestor,
 * nível "Gestor da Qualidade" ou cargo de coordenador da Qualidade).
 */
export function ehUsuarioDaQualidade(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehLiderancaDaQualidade(session)) return true;
  return normalizarSetor(session.setor) === "qualidade";
}

/**
 * Regra geral do portal: quem não é do setor da Qualidade não pode criar,
 * editar ou excluir conteúdo (com as exceções de abrir ocorrência e sugerir
 * melhorias). Fica apenas em leitura, salvo o que o gestor da Qualidade
 * conceder individualmente nas permissões de documentos.
 */
export function podeGerenciarConteudo(session: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(session);
}
