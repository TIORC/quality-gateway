import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const entrada = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  tipo: z.enum(["primeiro-acesso", "redefinir"]),
});

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gera o link (primeiro acesso ou redefinição) e envia por e-mail. */
export const enviarLinkSenha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = hex(bytes);
    const tokenHash = hex(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
    );

    const fn = data.tipo === "redefinir" ? "redefinir_senha_solicitar" : "primeiro_acesso_solicitar";
    const rpc = supabaseAdmin.rpc as unknown as (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: nome, error } = await rpc.call(supabaseAdmin, fn, {
      p_email: data.email,
      p_token_hash: tokenHash,
    });
    if (error) {
      console.error("enviarLinkSenha rpc:", error.message);
      return { ok: false, error: "Não foi possível iniciar o pedido agora." };
    }
    if (typeof nome !== "string" || !nome) {
      return {
        ok: false,
        error:
          data.tipo === "redefinir"
            ? "Não encontramos uma conta ativa com este e-mail."
            : "Não encontramos uma conta sem senha definida para este e-mail. Se você já tem senha, use “Esqueci minha senha”.",
      };
    }

    const req = getRequest();
    const origem = req ? new URL(req.url).origin : "https://gestaoqualidade.orcomacontabilidade.com.br";
    const link = `${origem}/primeiro-acesso#${token}`;
    try {
      await sendTemplateEmail("link-senha", data.email, {
        templateData: { nome, link, tipo: data.tipo },
        idempotencyKey: `link-senha-${tokenHash}`,
      });
    } catch (e) {
      console.error("enviarLinkSenha envio:", e);
      return { ok: false, error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." };
    }
    return { ok: true };
  });
