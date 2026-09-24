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
import type { Ata, TipoReuniao } from "@/lib/atas";
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
  "/meu-perfil",
];

/**
 * Páginas liberadas para todos os colaboradores: todas do portal exceto a
 * configuração (restrita à Administração/Gestão).
 */
const ROTAS_ABERTAS: AppRoutePath[] = TODAS_AS_ROTAS.filter((rota) => rota !== "/configuracoes");

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
  // Caminhos dinâmicos herdam a permissão da rota raiz (ex.: /funcionarios/$id).
  if ([...permitidas].some((rota) => path.startsWith(`${rota}/`))) return true;
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
 * Administrador do sistema (role `admin` ou nível "Administrador"). Enxerga o
 * andamento de tudo em leitura, sem as permissões de gestão da Qualidade.
 */
export function ehAdministrador(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  return session.role === "admin" || session.nivelAcesso === "Administrador";
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

/**
 * Pode planejar auditorias: Qualidade (admin/gestor, Qualidade), nível
 * Administrador e nível Desenvolvedor. Demais perfis ficam em leitura.
 */
export function podePlanejarAuditoria(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session)) return true;
  return session.nivelAcesso === "Administrador" || session.nivelAcesso === "Desenvolvedor";
}

/* -------------------------------------------------------------------------- */
/* Permissões de Planos de Ação                                               */
/* -------------------------------------------------------------------------- */

/**
 * Gestor/Administrador da Qualidade: cria, edita e exclui qualquer ação,
 * de qualquer setor. (Regra espelhada no servidor pelo nível de acesso.)
 */
export function podeGerenciarTodosPlanos(session: UserSession | null | undefined): boolean {
  return ehLiderancaDaQualidade(session);
}

/** Contexto mínimo da ação para avaliar participação (responsável/seguidor). */
export interface PlanoParticipacao {
  responsavelEmail: string;
  responsavelId: string;
  seguidores: string[];
  seguidoresIds: string[];
}

function emailNormalizado(session: UserSession | null | undefined): string {
  return (session?.email ?? "").trim().toLowerCase();
}

/** Responsável pela ação (por e-mail ou pelo vínculo de colaborador). */
export function ehResponsavelDoPlano(
  session: UserSession | null | undefined,
  plano: PlanoParticipacao,
): boolean {
  if (!session) return false;
  const email = emailNormalizado(session);
  if (email && plano.responsavelEmail.trim().toLowerCase() === email) return true;
  const colaborador = (session.colaboradorId ?? "").trim();
  return !!colaborador && plano.responsavelId === colaborador;
}

/** Seguidor da ação: recebe notificações, não responde por ela. */
export function ehSeguidorDoPlano(
  session: UserSession | null | undefined,
  plano: PlanoParticipacao,
): boolean {
  if (!session) return false;
  const email = emailNormalizado(session);
  if (email && plano.seguidores.some((e) => e.trim().toLowerCase() === email)) return true;
  const colaborador = (session.colaboradorId ?? "").trim();
  return !!colaborador && plano.seguidoresIds.includes(colaborador);
}

/** Criação: Qualidade (ou liderança) e quem recebeu a permissão individual. */
export function podeCriarPlano(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session)) return true;
  return permConcedida(session, session.permAdicionarDocumentos);
}

/**
 * Edição: liderança/Qualidade editam qualquer ação; responsável e seguidores
 * editam as ações em que participam (progresso, status, comentários); quem tem
 * a permissão individual de modificar documentos também edita.
 */
export function podeEditarPlano(
  session: UserSession | null | undefined,
  plano: PlanoParticipacao,
): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session)) return true;
  if (permConcedida(session, session.permModificarDocumentos)) return true;
  return ehResponsavelDoPlano(session, plano) || ehSeguidorDoPlano(session, plano);
}

/**
 * Excluir planos de ação: liderança da Qualidade (admin/gestor) sempre pode;
 * demais usuários apenas com a permissão individual `perm_excluir_planos`,
 * concedida pelo Gestor da Qualidade em /configurações.
 */
export function podeExcluirPlano(session: UserSession | null | undefined): boolean {
  if (!session) return false;
  if (ehLiderancaDaQualidade(session)) return true;
  return permConcedida(session, session.permExcluirPlanos);
}

/**
 * Comentar: qualquer participante (responsável/seguidor) ou perfil com acesso
 * de edição. Colaborador sem vínculo com a ação apenas visualiza.
 */
export function podeComentarPlano(
  session: UserSession | null | undefined,
  plano: PlanoParticipacao,
): boolean {
  return podeEditarPlano(session, plano);
}

/**
 * Visão restrita: fora da Qualidade/liderança, o colaborador vê apenas as ações
 * em que é responsável, seguidor ou do seu próprio setor.
 */
export function vePlanoNaLista(
  session: UserSession | null | undefined,
  plano: PlanoParticipacao & { setor: string },
): boolean {
  if (!session) return false;
  if (ehUsuarioDaQualidade(session)) return true;
  if (ehResponsavelDoPlano(session, plano) || ehSeguidorDoPlano(session, plano)) return true;
  const setor = normalizarSetor(session.setor);
  return !!setor && normalizarSetor(plano.setor) === setor;
}

/** Filtra a lista conforme a visão permitida (aplicada após carregar as ações). */
export function filtrarPlanosVisiveis<T extends PlanoParticipacao & { setor: string }>(
  session: UserSession | null | undefined,
  planos: T[],
): T[] {
  if (!session) return [];
  return planos.filter((plano) => vePlanoNaLista(session, plano));
}

/* -------------------------------------------------------------------------- */
/* Permissões de Atas de Reunião                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ata simples (sem tipo vinculado): somente Qualidade/Admin cria. Ata do
 * sistema pode ser criada por quem participa do tipo — o banco valida
 * (`pode_criar_ata`), o front apenas libera o formulário.
 */
export function podeCriarAtaSimples(session: UserSession | null | undefined): boolean {
  return podeGerenciarConteudo(session) || ehAdministrador(session);
}

/**
 * Indica se a origem pode ser oferecida na tela de nova ata. Para `simples`,
 * exige Qualidade/Admin; para `sistema`, qualquer sessão ativa tenta (a
 * validação de participação ocorre no banco).
 */
export function podeCriarAta(
  session: UserSession | null | undefined,
  origem: Ata["origem"],
): boolean {
  if (!session) return false;
  if (origem === "simples") return podeCriarAtaSimples(session);
  return origem === "sistema";
}

/**
 * Edição de ata rascunho: Qualidade/Admin sempre; demais somente o criador
 * (`criado_por`) ou participante/signatário do tipo vinculado. O `usuarioId` é
 * o id de `public.usuarios` da sessão, resolvido por `usuarioIdPorEmail`. A
 * regra definitiva é validada no banco (`pode_editar_ata`).
 */
export function podeEditarAta(
  session: UserSession | null | undefined,
  ata: Ata | null | undefined,
  tipo: TipoReuniao | null | undefined,
  usuarioId: string | null,
): boolean {
  if (!session || !ata) return false;
  if (ata.status !== "rascunho") return false;
  if (podeGerenciarConteudo(session) || ehAdministrador(session)) return true;
  if (!usuarioId) return false;
  if (ata.criadoPor === usuarioId) return true;
  if (!tipo) return false;
  return [...tipo.participantes, ...tipo.signatarios].some((p) => p.id === usuarioId);
}
