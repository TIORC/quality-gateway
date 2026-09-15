/**
 * Cliente do Lovable Cloud (Supabase).
 *
 * O Lovable Cloud injeta `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
 * no ambiente do front-end automaticamente. Para rodar localmente, crie um
 * `.env.local` na raiz do projeto com:
 *
 *   VITE_SUPABASE_URL=https://<projeto>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública do projeto>
 *
 * Sem essas variáveis o portal continua funcionando: a tela de POPs cai no
 * conjunto de demonstração em memória (ver `src/lib/pops.ts`).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const URL_CLOUD = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;

// O Lovable Cloud usa o nome novo (publishable key); mantemos o antigo como
// alternativa para projetos que ainda expõem a chave anônima.
const CHAVE_CLOUD = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined;

/** `true` quando as variáveis do Lovable Cloud estão disponíveis. */
export const lovableCloudConfigurado = Boolean(URL_CLOUD && CHAVE_CLOUD);

export const supabase: SupabaseClient<Database> | null = lovableCloudConfigurado
  ? createClient<Database>(URL_CLOUD as string, CHAVE_CLOUD as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "quality-gateway:cloud-auth",
      },
    })
  : null;

/** Devolve o cliente garantindo que o Cloud está configurado. */
export function exigirCloud(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      "Lovable Cloud não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.",
    );
  }
  return supabase;
}