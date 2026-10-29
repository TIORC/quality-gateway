/**
 * Token de identidade das ocorrências.
 *
 * O login do portal é próprio (sem Supabase Auth). Para a RLS das ocorrências
 * saber quem chama, o login troca e-mail+senha por um JWT assinado no servidor
 * (função `emitir-token-ocorrencias`). O token vale só para as tabelas do
 * módulo; o restante do app continua usando a chave pública.
 */
import { createClient } from "@supabase/supabase-js";

const CHAVE = "quality-gateway:ocorrencias-token";

interface TokenGuardado {
  token: string;
  expiraEm: number;
}

function ler(): TokenGuardado | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHAVE);
    if (!raw) return null;
    const t = JSON.parse(raw) as TokenGuardado;
    return t.token && t.expiraEm > Math.floor(Date.now() / 1000) + 30 ? t : null;
  } catch {
    return null;
  }
}

export function tokenOcorrencias(): string | null {
  return ler()?.token ?? null;
}

export function limparTokenOcorrencias(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAVE);
}

/** Troca as credenciais pelo token. Falha silenciosa: o login não depende dele. */
export async function obterTokenOcorrencias(email: string, senha: string): Promise<boolean> {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const chave = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !chave || typeof window === "undefined") return false;
  try {
    const resposta = await fetch(`${url}/functions/v1/emitir-token-ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: chave },
      body: JSON.stringify({ email, senha }),
    });
    if (!resposta.ok) {
      console.warn(
        `[ocorrências] A função emitir-token-ocorrencias respondeu ${resposta.status}: ${await resposta.text().catch(() => "")}`,
      );
      return false;
    }
    const dados = (await resposta.json()) as TokenGuardado;
    if (!dados.token) return false;
    window.localStorage.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch (erro) {
    console.warn("[ocorrências] Falha ao chamar emitir-token-ocorrencias:", erro);
    return false;
  }
}

/** Cliente das tabelas de ocorrências: envia o token do usuário, não a chave pública. */
export function criarClienteOcorrencias() {
  const url = (import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"]) as string;
  const chave = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"]) as string;
  return createClient(url, chave, {
    accessToken: async () => {
      const token = tokenOcorrencias();
      if (!token) {
        console.warn(
          "[ocorrências] Sem token de identidade (ausente ou expirado). Saia e entre novamente; se persistir, verifique a função emitir-token-ocorrencias.",
        );
      }
      return token;
    },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", chave);
        // Sem token válido, não envia a chave pública como bearer: a RLS recusa.
        if (headers.get("Authorization") === `Bearer ${chave}`) headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
  });
}
