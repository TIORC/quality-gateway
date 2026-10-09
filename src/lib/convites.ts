/**
 * Primeiro acesso por convite.
 *
 * O administrador gera um link por colaborador. O token fica só no link (na parte
 * `#fragmento`, que nunca vai ao servidor) e o banco guarda apenas o hash SHA-256.
 * A pessoa abre o link e cria a própria senha.
 */

import { exigirCloud, lovableCloudConfigurado } from "@/integrations/supabase/client";
import { gerarSalt, hashSenha } from "@/lib/auth";

/** Validade do convite: 24 horas (1 dia). */
const DIAS_VALIDADE = 1;

interface ErroRpc {
  message?: string;
}

/** Chamada de função do banco sem depender dos tipos gerados (funções novas). */
async function chamarFuncao<T>(
  nome: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: ErroRpc | null }> {
  const client = exigirCloud();
  const rpc = client.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: ErroRpc | null }>;
  const resposta = await rpc.call(client, nome, args);
  return { data: resposta.data as T | null, error: resposta.error };
}

function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Token aleatório de 32 bytes (64 caracteres hexadecimais). */
function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesParaHex(bytes);
}

async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return bytesParaHex(new Uint8Array(digest));
}

function linkDoConvite(token: string): string {
  return `${window.location.origin}/primeiro-acesso#${token}`;
}

/**
 * Gera um novo convite para o colaborador (invalida os anteriores não usados) e
 * devolve o link para ser enviado à pessoa.
 */
export async function criarConviteAcesso(
  colaboradorId: string,
): Promise<{ ok: true; link: string; expiraEm: string } | { ok: false; error: string }> {
  if (!lovableCloudConfigurado) {
    return { ok: false, error: "Lovable Cloud não configurado." };
  }
  try {
    const token = gerarToken();
    const tokenHash = await sha256Hex(token);
    const { data, error } = await chamarFuncao<string>("convite_criar", {
      p_colaborador_id: colaboradorId,
      p_token_hash: tokenHash,
      p_dias: DIAS_VALIDADE,
    });
    if (error) return { ok: false, error: error.message ?? "Não foi possível gerar o convite." };
    return { ok: true, link: linkDoConvite(token), expiraEm: String(data) };
  } catch {
    return { ok: false, error: "Não foi possível gerar o convite. Verifique a conexão." };
  }
}

/** Confere se o token ainda é válido e devolve o nome e o e-mail do colaborador. */
export async function buscarConviteAcesso(
  token: string,
): Promise<{ ok: true; nome: string; email: string } | { ok: false; error: string }> {
  if (!lovableCloudConfigurado) {
    return { ok: false, error: "Lovable Cloud não configurado." };
  }
  try {
    const tokenHash = await sha256Hex(token.trim());
    const { data, error } = await chamarFuncao<{ nome: string; email: string }[]>(
      "convite_validar",
      { p_token_hash: tokenHash },
    );
    if (error) throw error;
    const linha = data?.[0];
    if (!linha) {
      return {
        ok: false,
        error: "Este link é inválido, já foi usado ou expirou. Peça um novo ao administrador.",
      };
    }
    return { ok: true, nome: linha.nome, email: linha.email };
  } catch {
    return { ok: false, error: "Não foi possível validar o link. Verifique a conexão." };
  }
}

/** Grava a senha escolhida pela pessoa e consome o convite. */
export async function resgatarConviteAcesso(
  token: string,
  senha: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!lovableCloudConfigurado) {
    return { ok: false, error: "Lovable Cloud não configurado." };
  }
  if (senha.trim().length < 4) {
    return { ok: false, error: "A senha deve ter pelo menos 4 caracteres." };
  }
  try {
    const tokenHash = await sha256Hex(token.trim());
    const salt = gerarSalt();
    const hash = await hashSenha(senha, salt);
    const { data, error } = await chamarFuncao<boolean>("convite_resgatar", {
      p_token_hash: tokenHash,
      p_salt: salt,
      p_hash: hash,
    });
    if (error) throw error;
    if (!data) {
      return {
        ok: false,
        error: "Este link é inválido, já foi usado ou expirou. Peça um novo ao administrador.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar a senha. Verifique a conexão." };
  }
}
