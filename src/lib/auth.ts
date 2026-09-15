/**
 * Autenticação do painel administrativo.
 *
 * As credenciais ficam no banco do Lovable Cloud (tabela `public.usuarios`,
 * criada em `supabase/migrations/20260915030000_org.sql`). A senha é guardada
 * como hash (SHA-256) com salt por usuário; a validação só compara o hash
 * calculado no navegador.
 */

import { exigirCloud, lovableCloudConfigurado } from "@/integrations/supabase/client";
import type { UsuarioRow } from "@/integrations/supabase/types";

export type UserRole = "admin" | "gestor" | "usuario";

export interface User {
  id: string;
  nome: string;
  email: string;
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

/** Rótulos exibidos na página Meu Perfil. */
export const ROLE_PERFIL_LABELS: Record<UserRole, string> = {
  admin: "Administrador do Sistema",
  gestor: "Líder",
  usuario: "Colaborador",
};

const SESSION_KEY = "quality-gateway:session";

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
    return {
      id: parsed.id ?? "",
      nome: parsed.nome ?? "",
      email: parsed.email,
      role: parsed.role,
      cargo: parsed.cargo ?? "",
      setor: parsed.setor ?? "",
      loginAt: parsed.loginAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Devolve a sessão ativa (persistida no navegador) ou `null`. */
export function getSession(): UserSession | null {
  return readSession();
}

export function isAuthenticated(): boolean {
  return readSession() !== null;
}

export function isAdminSession(session: UserSession | null): boolean {
  return session?.role === "admin";
}

async function hashSenha(senha: string, salt: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto?.subtle) {
    throw new Error("A autenticação exige um navegador com suporte a Web Crypto (HTTPS).");
  }
  const dados = new TextEncoder().encode(`${salt}:${senha}`);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildSession(user: Pick<User, "id" | "nome" | "email" | "role" | "cargo" | "setor">): UserSession {
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

function usuarioDoRow(row: UsuarioRow): User {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role: isValidRole(row.role) ? row.role : "usuario",
    cargo: row.cargo,
    setor: row.setor,
    ativo: row.ativo,
  };
}

function persistirSession(session: UserSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Valida as credenciais contra o banco do Lovable Cloud. Precisa de HTTPS/web
 * crypto no navegador para calcular o hash da senha.
 */
export async function login(
  email: string,
  senha: string,
): Promise<{ ok: true; session: UserSession } | { ok: false; error: string }> {
  if (!lovableCloudConfigurado) {
    return {
      ok: false,
      error:
        "Lovable Cloud não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.",
    };
  }

  const emailNormalizado = email.trim().toLowerCase();

  try {
    const client = exigirCloud();
    const { data, error } = await client
      .from("usuarios")
      .select("id,nome,email,senha_salt,senha_hash,role,cargo,setor,ativo")
      .eq("email", emailNormalizado)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.ativo) {
      return {
        ok: false,
        error: "Credenciais inválidas. Verifique o e-mail e a senha e tente novamente.",
      };
    }

    const hash = await hashSenha(senha, data.senha_salt);
    if (hash !== data.senha_hash) {
      return {
        ok: false,
        error: "Credenciais inválidas. Verifique o e-mail e a senha e tente novamente.",
      };
    }

    const session = buildSession(usuarioDoRow(data));
    persistirSession(session);
    return { ok: true, session };
  } catch {
    return {
      ok: false,
      error: "Não foi possível validar o acesso. Verifique a conexão e tente novamente.",
    };
  }
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}