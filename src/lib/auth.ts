/**
 * Autenticação do painel administrativo.
 *
 * As credenciais ficam no banco do Lovable Cloud (tabela `public.usuarios`,
 * criada em `supabase/migrations/20260915030000_org.sql`). A senha é guardada
 * como hash (SHA-256) com salt por usuário; a validação só compara o hash
 * calculado no navegador.
 */

import { exigirCloud, lovableCloudConfigurado } from "@/integrations/supabase/client";
import type { ColaboradorRow, UsuarioRow } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UserRole = "admin" | "gestor" | "usuario";

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  cargo: string;
  setor: string;
  ativo: boolean;
  /** Registro organizacional vinculado (`colaboradores.id`). */
  colaboradorId: string;
  /** Nível de acesso herdado do colaborador (`colaboradores.nivel_acesso`). */
  nivelAcesso: string;
  /** Unidade do colaborador. */
  unidade: string;
}

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  cargo: string;
  setor: string;
  /** Registro organizacional vinculado (vazio quando não há colaborador). */
  colaboradorId: string;
  /** Nível de acesso efetivo (vazio para compatibilidade). */
  nivelAcesso: string;
  /** Unidade do colaborador (vazio quando não há vínculo). */
  unidade: string;
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
      colaboradorId: parsed.colaboradorId ?? "",
      nivelAcesso: parsed.nivelAcesso ?? "",
      unidade: parsed.unidade ?? "",
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

function buildSession(
  user: Pick<
    User,
    | "id"
    | "nome"
    | "email"
    | "role"
    | "cargo"
    | "setor"
    | "colaboradorId"
    | "nivelAcesso"
    | "unidade"
  >,
): UserSession {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    cargo: user.cargo,
    setor: user.setor,
    colaboradorId: user.colaboradorId,
    nivelAcesso: user.nivelAcesso,
    unidade: user.unidade,
    loginAt: new Date().toISOString(),
  };
}

function usuarioDoRow(
  row: Pick<
    UsuarioRow,
    "id" | "nome" | "email" | "senha_salt" | "senha_hash" | "role" | "cargo" | "setor" | "ativo"
  > & {
    colaborador_id?: string | null;
  },
): User {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role: isValidRole(row.role) ? row.role : "usuario",
    cargo: row.cargo,
    setor: row.setor,
    ativo: row.ativo,
    colaboradorId: row.colaborador_id ?? "",
    nivelAcesso: "",
    unidade: "",
  };
}

/** Nível mínimo dado ao role quando o colaborador não informa nível. */
function nivelPorRole(role: UserRole): string {
  if (role === "admin") return "Administrador";
  if (role === "gestor") return "Gestor da Qualidade";
  return "Colaborador";
}

/**
 * Busca o colaborador vinculado ao usuário: primeiro pelo `colaborador_id`,
 * com fallback pelo e-mail normalizado. Devolve `null` quando não há vínculo.
 */
async function buscarColaboradorVinculado(
  client: SupabaseClient<Database>,
  usuario: { id: string; email: string; colaboradorId: string },
): Promise<Pick<
  ColaboradorRow,
  | "id"
  | "nome"
  | "email"
  | "cargo"
  | "unidade"
  | "cidade"
  | "setor"
  | "nivel_acesso"
  | "grupos"
  | "exclusao"
> | null> {
  if (usuario.colaboradorId) {
    const { data } = await client
      .from("colaboradores")
      .select("id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao")
      .eq("id", usuario.colaboradorId)
      .maybeSingle();
    if (data) return data;
  }
  const email = usuario.email.trim().toLowerCase();
  if (!email) return null;
  const { data } = await client
    .from("colaboradores")
    .select("id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao")
    .eq("email", email)
    .maybeSingle();
  return data ?? null;
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

    const usuario = usuarioDoRow(data);
    const sessionBase = buildSession({
      ...usuario,
      nivelAcesso: nivelPorRole(usuario.role),
    });

    // Mescla o registro organizacional (colaboradores) na sessão, quando houver.
    try {
      const colaborador = await buscarColaboradorVinculado(client, {
        id: usuario.id,
        email: usuario.email,
        colaboradorId: usuario.colaboradorId,
      });
      if (colaborador) {
        sessionBase.colaboradorId = colaborador.id;
        sessionBase.unidade = colaborador.unidade;
        if (colaborador.nivel_acesso) sessionBase.nivelAcesso = colaborador.nivel_acesso;
        if (!usuario.cargo && colaborador.cargo) sessionBase.cargo = colaborador.cargo;
        if (!usuario.setor && colaborador.setor) sessionBase.setor = colaborador.setor;
        if (usuario.email !== colaborador.email && colaborador.email) {
          sessionBase.email = usuario.email;
        }
      }
    } catch {
      // Sem vínculo: mantém a sessão com os dados do usuário (compatibilidade).
    }

    persistirSession(sessionBase);
    return { ok: true, session: sessionBase };
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

/**
 * Indica se a sessão pode entrar no painel: admins, gestores e qualquer
 * colaborador com nível de acesso definido.
 */
export function rolePodeAcessarPainel(session: UserSession | null): boolean {
  if (!session) return false;
  if (session.role === "admin" || session.role === "gestor") return true;
  return session.nivelAcesso.trim() !== "";
}

/** Gera um salt aleatório em hexadecimal (um por usuário). */
export function gerarSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cria (ou substitui) o acesso de login de um colaborador: grava em `usuarios`
 * com hash de senha, salt próprio e o vínculo `colaborador_id`.
 */
export async function criarAcessoColaborador(
  colaboradorId: string,
  email: string,
  senha: string,
  role: UserRole,
): Promise<void> {
  if (!lovableCloudConfigurado) {
    throw new Error("Lovable Cloud não configurado.");
  }
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado || !emailNormalizado.includes("@")) {
    throw new Error("Informe o e-mail corporativo do colaborador.");
  }
  if (senha.trim().length < 4) {
    throw new Error("A senha de acesso deve ter pelo menos 4 caracteres.");
  }

  const client = exigirCloud();

  // Dados do colaborador para preencher nome/cargo/setor do acesso.
  const { data: colaborador, error: erroColaborador } = await client
    .from("colaboradores")
    .select("id,nome,email,cargo,setor")
    .eq("id", colaboradorId)
    .maybeSingle();
  if (erroColaborador) throw new Error(String(erroColaborador.message ?? erroColaborador));
  if (!colaborador) throw new Error("Colaborador não encontrado.");

  const salt = gerarSalt();
  const hash = await hashSenha(senha, salt);

  // Se já existe acesso para o e-mail, substitui senha/vínculo; senão cria.
  const { data: existente } = await client
    .from("usuarios")
    .select("id")
    .eq("email", emailNormalizado)
    .maybeSingle();

  const registro = {
    nome: colaborador.nome,
    email: emailNormalizado,
    senha_salt: salt,
    senha_hash: hash,
    role,
    cargo: colaborador.cargo,
    setor: colaborador.setor,
    ativo: true,
    colaborador_id: colaboradorId,
  };

  const { error } = existente
    ? await client.from("usuarios").update(registro).eq("id", existente.id)
    : await client.from("usuarios").insert({ id: `usr_${colaboradorId}`, ...registro });
  if (error) throw new Error(String(error.message ?? error));
}

/** E-mails que já possuem acesso de login (para o badge "Tem login"). */
export async function listarEmailsComLogin(): Promise<string[]> {
  if (!lovableCloudConfigurado) return [];
  try {
    const client = exigirCloud();
    const { data, error } = await client.from("usuarios").select("email");
    if (error) return [];
    return (data ?? []).map((linha) => linha.email.trim().toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Redefine a senha de acesso de um usuário existente (autosserviço).
 * Gera um novo salt e regrava o hash SHA-256 da nova senha.
 */
export async function redefinirSenha(
  email: string,
  novaSenha: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!lovableCloudConfigurado) {
    return {
      ok: false,
      error:
        "Lovable Cloud não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.",
    };
  }

  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado || !emailNormalizado.includes("@")) {
    return { ok: false, error: "Informe o e-mail corporativo cadastrado." };
  }
  if (!novaSenha || novaSenha.trim().length < 4) {
    return { ok: false, error: "A nova senha deve ter pelo menos 4 caracteres." };
  }

  try {
    const client = exigirCloud();
    const { data, error } = await client
      .from("usuarios")
      .select("id,email")
      .eq("email", emailNormalizado)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return { ok: false, error: "E-mail não cadastrado no portal." };
    }

    const salt = gerarSalt();
    const hash = await hashSenha(novaSenha, salt);

    const { error: erroUpdate } = await client
      .from("usuarios")
      .update({ senha_salt: salt, senha_hash: hash })
      .eq("id", data.id);
    if (erroUpdate) throw erroUpdate;

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível redefinir a senha. Verifique a conexão e tente novamente.",
    };
  }
}
