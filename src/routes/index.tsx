import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import logoWhite from "@/assets/logo-white.png.asset.json";
import { isAuthenticated, login } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão da Qualidade | Acesso" },
      {
        name: "description",
        content:
          "Acesse o sistema de Gestão da Qualidade com seu e-mail corporativo e senha.",
      },
      { property: "og:title", content: "Gestão da Qualidade | Acesso" },
      {
        property: "og:description",
        content:
          "Acesse o sistema de Gestão da Qualidade com seu e-mail corporativo e senha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Se já houver sessão ativa, passa pela tela de loading e vai ao painel.
  useEffect(() => {
    if (isAuthenticated()) {
      router.navigate({ to: "/loading", replace: true });
    }
  }, [router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!email.includes("@")) {
      setErro("Informe um e-mail corporativo válido.");
      return;
    }
    if (senha.length === 0) {
      setErro("Informe sua senha.");
      return;
    }

    setErro("");
    setCarregando(true);

    const result = login(email, senha);
    if (result.ok) {
      router.navigate({ to: "/loading", replace: true });
      return;
    }

    setErro(result.error);
    setCarregando(false);
  }

  return (
    <main className="bg-brand-gradient relative flex min-h-screen flex-col">
      <div className="bg-brand-glow pointer-events-none absolute inset-0" />
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <section className="bg-surface-glass relative w-full max-w-md rounded-2xl border border-brand-line p-8 shadow-brand backdrop-blur-sm sm:p-10">
        <div className="flex flex-col items-center text-center">
          <img
            src={logoWhite.url}
            alt="Logomarca da empresa"
            className="h-16 w-16 object-contain"
          />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-brand-foreground sm:text-3xl">
            Gestão da Qualidade
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            Entre com suas credenciais corporativas
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-brand-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso Administrador
          </span>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wider text-brand-muted"
            >
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com.br"
              className="input-brand"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="senha"
              className="text-xs font-medium uppercase tracking-wider text-brand-muted"
            >
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="input-brand"
            />
          </div>

          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={carregando}
            className="btn-brand disabled:cursor-not-allowed disabled:opacity-70"
          >
            {carregando ? "Entrando…" : "Entrar"}
          </button>

          <div className="text-center">
            <a href="#" className="text-sm text-brand-muted hover:text-brand-foreground">
              Esqueci minha senha
            </a>
          </div>
        </form>
        </section>
      </div>

      <footer className="relative pb-5 text-center">
        <p className="text-xs text-brand-muted">
          Criado pelos Desenvolvedores da Orcoma - G.
        </p>
      </footer>
    </main>
  );
}
