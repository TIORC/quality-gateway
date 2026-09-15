/**
 * Autenticação do painel administrativo.
 *
 * IMPORTANTE: trata-se de um protótipo front-end — os usuários ficam em memória
 * no cliente (não há backend). Para produção, mova a validação para o servidor
 * (ex.: createServerFn do TanStack Start + banco de dados e sessão via cookies).
 */

export type UserRole = "admin" | "gestor" | "usuario";

export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  cargo: string;
  setor: string;
  ativo: boolean;
}

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  cargo: string;
  setor: string;
  loginAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gestor: "Gestor da Qualidade",
  usuario: "Usuário",
};

/**
 * Registro de usuários (mock de banco de dados).
 *
 * Usuário com permissão de administrador criado para acesso ao painel:
 *   e-mail: gabriel.anacleto@orcoma.com.br
 *   senha : Orcoma@2026
 */
const USERS: User[] = [
  {
    id: "usr_admin_gabriel",
    nome: "Gabriel Anacleto",
    email: "gabriel.anacleto@orcoma.com.br",
    senha: "Orcoma@2026",
    role: "admin",
    cargo: "Administrador do Sistema",
    setor: "TI",
    ativo: true,
  },
];

const SESSION_KEY = "quality-gateway:session";

function buildSession(user: User): UserSession {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    cargo: user.cargo,
    setor: user.setor,
    loginAt: new Date().toISOString(),
  };
}

function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && Object.prototype.hasOwnProperty.call(ROLE_LABELS, role);
}

function readSession(): UserSession | null {
  // localStorage não existe no servidor (SSR) — sempre null por lá.
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSession> | null;
    if (!parsed?.email || !isValidRole(parsed.role)) return null;
    return { ...parsed, cargo: parsed.cargo ?? "", setor: parsed.setor ?? "" } as UserSession;
  } catch {
    return null;
  }
}

export function getSession(): UserSession | null {
  return readSession();
}

export function isAuthenticated(): boolean {
  return readSession() !== null;
}

export function isAdminSession(session: UserSession | null): boolean {
  return session?.role === "admin";
}

export function login(
  email: string,
  senha: string,
): { ok: true; session: UserSession } | { ok: false; error: string } {
  const emailNormalizado = email.trim().toLowerCase();

  const user = USERS.find((u) => u.email.toLowerCase() === emailNormalizado && u.ativo);

  if (!user || user.senha !== senha) {
    return {
      ok: false,
      error: "Credenciais inválidas. Verifique o e-mail e a senha e tente novamente.",
    };
  }

  const session = buildSession(user);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { ok: true, session };
}

export function logout(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}
