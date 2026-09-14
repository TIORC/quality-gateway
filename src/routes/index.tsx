import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import logoWhite from "@/assets/logo-white.png.asset.json";

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
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setErro("Informe um e-mail corporativo válido.");
      return;
    }
    if (senha.length < 4) {
      setErro("Informe sua senha.");
      return;
    }
    setErro("");
  }

  return (
    <main className="bg-brand-gradient relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-brand-glow pointer-events-none absolute inset-0" />
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

          <button type="submit" className="btn-brand">
            Entrar
          </button>

          <div className="text-center">
            <a href="#" className="text-sm text-brand-muted hover:text-brand-foreground">
              Esqueci minha senha
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
