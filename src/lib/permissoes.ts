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

export const ROTAS_POR_NIVEL: Record<string, AppRoutePath[]> = {
  Administrador: TODAS_AS_ROTAS,
  "Gestor da Qualidade": TODAS_AS_ROTAS,
  "Auxiliar da Qualidade": ["/painel", "/planos-de-acao", "/pops", "/politicas", "/meu-perfil"],
  Diretoria: ["/painel", "/pops", "/politicas", "/meu-perfil"],
  "Líder de setor": [
    "/painel",
    "/planos-de-acao",
    "/ocorrencias",
    "/pops",
    "/politicas",
    "/meu-perfil",
  ],
  Desenvolvedor: ["/pops", "/politicas", "/meu-perfil"],
  Colaborador: ["/pops", "/politicas", "/meu-perfil"],
  "Colaborador de outra unidade": ["/pops", "/politicas", "/meu-perfil"],
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

/** Colaborador do setor Qualidade que recebeu a permissão individual. */
function permConcedida(session: UserSession, permissao: boolean | undefined): boolean {
  if (normalizarSetor(session.setor) !== "qualidade") return false;
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
