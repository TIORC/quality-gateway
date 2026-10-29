// Emite um JWT assinado com a identidade do usuário (e-mail, nível de acesso e
// setor) para que as políticas RLS das ocorrências saibam quem está chamando.
// O login do portal é próprio (tabela `usuarios`), sem Supabase Auth; esta
// função revalida a senha no servidor e assina o token.
//
// Variáveis de ambiente:
// - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (preenchidas pelo Supabase)
// - SGQ_JWT_SECRET (ou SUPABASE_JWT_SECRET): segredo JWT do projeto, o mesmo que
//   o PostgREST usa para validar tokens.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALIDADE_SEGUNDOS = 12 * 60 * 60;

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(dados: Uint8Array | string): string {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : dados;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return hex(new Uint8Array(d));
}

async function assinar(payload: Record<string, unknown>, segredo: string): Promise<string> {
  const cabecalho = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = base64Url(JSON.stringify(payload));
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  return `${cabecalho}.${corpo}.${base64Url(new Uint8Array(assinatura))}`;
}

async function consultar(tabela: string, consulta: string): Promise<Record<string, unknown>[]> {
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${tabela}?${consulta}`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
  });
  if (!r.ok) throw new Error(`Consulta em ${tabela} falhou: ${r.status}`);
  return (await r.json()) as Record<string, unknown>[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const segredo = Deno.env.get("SGQ_JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET") ?? "";
  if (!segredo) return json({ erro: "Segredo JWT não configurado no servidor." }, 500);

  let email = "";
  let senha = "";
  try {
    const corpo = (await req.json()) as { email?: string; senha?: string };
    email = (corpo.email ?? "").trim().toLowerCase();
    senha = corpo.senha ?? "";
  } catch {
    return json({ erro: "Requisição inválida." }, 400);
  }
  if (!email || !senha) return json({ erro: "Informe e-mail e senha." }, 400);

  try {
    const alvo = encodeURIComponent(email);
    const [usuario] = await consultar(
      "usuarios",
      `select=id,email,senha_salt,senha_hash,role,setor,ativo&email=eq.${alvo}&limit=1`,
    );
    const invalido = () => json({ erro: "Credenciais inválidas." }, 401);
    if (!usuario || !usuario["ativo"]) return invalido();
    if ((await sha256Hex(`${usuario["senha_salt"]}:${senha}`)) !== usuario["senha_hash"]) {
      return invalido();
    }

    const [colab] = await consultar(
      "colaboradores",
      `select=id,nivel_acesso,setor&email=eq.${alvo}&limit=1`,
    );
    const nivel =
      (colab?.["nivel_acesso"] as string) ||
      (usuario["role"] === "gestor"
        ? "Gestor da Qualidade"
        : usuario["role"] === "admin"
          ? "Desenvolvedor do Sistema"
          : "Colaborador");
    const setor = ((colab?.["setor"] as string) || (usuario["setor"] as string) || "").trim();

    const agora = Math.floor(Date.now() / 1000);
    const token = await assinar(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: String(usuario["id"]),
        email,
        sgq_nivel: nivel,
        sgq_setor: setor,
        sgq_colaborador: String(colab?.["id"] ?? ""),
        iat: agora,
        exp: agora + VALIDADE_SEGUNDOS,
      },
      segredo,
    );
    return json({ token, expiraEm: agora + VALIDADE_SEGUNDOS });
  } catch {
    return json({ erro: "Não foi possível emitir o token." }, 500);
  }
});
