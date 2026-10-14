// Primeiro acesso: gera um convite para quem ainda não definiu a própria senha e
// envia o link de criação de senha por e-mail.
//
// Variáveis de ambiente esperadas:
// - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (preenchidas pelo Supabase)
// - RESEND_API_KEY: chave do provedor de e-mail
// - EMAIL_FROM: remetente, ex.: "Gestão da Qualidade <acesso@empresa.com.br>"
// - APP_URL (opcional): endereço público do sistema, usado no link do e-mail

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MENSAGEM_NAO_ELEGIVEL =
  "Não encontramos uma conta sem senha definida para este e-mail. Se você já tem senha, use “Esqueci minha senha”.";

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return bytesParaHex(new Uint8Array(digest));
}

async function chamarRpc(nome: string, args: Record<string, unknown>): Promise<unknown> {
  const url = `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/${nome}`;
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!resposta.ok) throw new Error(`RPC ${nome} falhou: ${resposta.status}`);
  return resposta.json();
}

function htmlDoEmail(nome: string, link: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;margin:0 0 16px;">Primeiro acesso — Gestão da Qualidade</h1>
      <p style="font-size:14px;line-height:1.6;">Olá, <strong>${nome}</strong>.</p>
      <p style="font-size:14px;line-height:1.6;">Recebemos o pedido de primeiro acesso à sua conta. Clique no botão abaixo para criar a sua senha.</p>
      <p style="margin:28px 0;text-align:center;">
        <a href="${link}" style="background:#1E3A8A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block;">Criar minha senha</a>
      </p>
      <p style="font-size:12px;line-height:1.6;color:#64748b;">O link vale por 24 horas e só pode ser usado uma vez. Se você não pediu este acesso, ignore este e-mail.</p>
    </div>
  </body>
</html>`;
}

async function enviarEmail(para: string, nome: string, link: string): Promise<void> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM"),
      to: [para],
      subject: "Primeiro acesso — Gestão da Qualidade",
      html: htmlDoEmail(nome, link),
    }),
  });
  if (!resposta.ok) throw new Error(`Envio de e-mail falhou: ${resposta.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  try {
    const corpo = (await req.json()) as { email?: unknown };
    const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
    if (!email.includes("@")) {
      return json({ ok: false, error: "Informe um e-mail corporativo válido." }, 400);
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = bytesParaHex(bytes);
    const tokenHash = await sha256Hex(token);

    const nome = await chamarRpc("primeiro_acesso_solicitar", {
      p_email: email,
      p_token_hash: tokenHash,
    });
    if (typeof nome !== "string" || !nome) {
      return json({ ok: false, error: MENSAGEM_NAO_ELEGIVEL });
    }

    const base = Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "";
    const link = `${base.replace(/\/$/, "")}/primeiro-acesso#${token}`;
    await enviarEmail(email, nome, link);

    return json({ ok: true });
  } catch (erro) {
    console.error("enviar-primeiro-acesso:", erro);
    return json(
      { ok: false, error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." },
      500,
    );
  }
});
