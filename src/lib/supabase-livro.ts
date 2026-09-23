/**
 * Cliente Supabase "livre" (não tipado pelas tabelas geradas).
 *
 * O cliente padrão (`exigirCloud`) vem tipado por `Database` (types.ts,
 * auto-gerado) e por isso recusa tabelas ainda não mapeadas — como
 * `projetos_estrategicos`, `grupos_acessos`, etc. Este helper devolve o mesmo
 * cliente, mas com a tipagem loosen, permitindo `.from("tabela_nova")` e
 * acesso via `Record<string, unknown>` direto (mesmo estilo de `planos-base.ts`).
 */
import { exigirCloud } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function clienteLivre(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return exigirCloud() as any;
}
