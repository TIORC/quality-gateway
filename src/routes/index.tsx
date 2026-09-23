import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { isAuthenticated, login, redefinirSenha } from "@/lib/auth";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão da Qualidade | Acesso" },
      {
        name: "description",
        content: "Acesse o sistema de Gestão da Qualidade com seu e-mail corporativo e senha.",
      },
      { property: "og:title", content: "Gestão da Qualidade | Acesso" },
      {
        property: "og:description",
        content: "Acesse o sistema de Gestão da Qualidade com seu e-mail corporativo e senha.",
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
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [recuperarAberto, setRecuperarAberto] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [recuperarErro, setRecuperarErro] = useState("");
  const [recuperarSucesso, setRecuperarSucesso] = useState(false);
  const [recuperarCarregando, setRecuperarCarregando] = useState(false);

  // Se já houver sessão ativa, passa pela tela de loading e vai ao painel.
  useEffect(() => {
    if (isAuthenticated()) {
      router.navigate({ to: "/loading", replace: true });
    }
  }, [router]);

  async function onSubmit(e: FormEvent) {
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

    const result = await login(email, senha);
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
              src="/favicon.png"
              alt="Logomarca da empresa"
              className="h-16 w-16 object-contain"
            />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-brand-foreground sm:text-3xl">
              Gestão da Qualidade
            </h1>
            <p className="mt-2 text-sm text-brand-muted">Entre com suas credenciais corporativas</p>
          </div>

          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-brand-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso com e-mail corporativo
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
              <div className="relative">
                <input
                  id="senha"
                  type={verSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="input-brand pr-11"
                />
                <button
                  type="button"
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVerSenha((atual) => !atual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted transition hover:text-brand-foreground"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              <button
                type="button"
                onClick={() => {
                  setRecuperarErro("");
                  setRecuperarSucesso(false);
                  setEmailRecuperar("");
                  setSenhaNova("");
                  setConfirmarSenha("");
                  setRecuperarAberto(true);
                }}
                className="text-sm text-brand-muted transition hover:text-brand-foreground"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </section>
      </div>

      <AppFooter variant="brand" />

      <Dialog open={recuperarAberto} onOpenChange={(abre) => !abre && setRecuperarAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir minha senha</DialogTitle>
            <DialogDescription>
              Informe seu e-mail corporativo e a nova senha de acesso.
            </DialogDescription>
          </DialogHeader>

          {recuperarSucesso ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-[#D9E0EA] bg-[#F8FAFC] px-4 py-3 text-sm text-[#059669]">
                Senha redefinida. Faça login com a nova senha.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                  onClick={() => setRecuperarAberto(false)}
                >
                  Voltar ao login
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-recuperar">E-mail corporativo</Label>
                  <Input
                    id="email-recuperar"
                    type="email"
                    value={emailRecuperar}
                    onChange={(evento) => setEmailRecuperar(evento.target.value)}
                    placeholder="nome@empresa.com.br"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    value={senhaNova}
                    onChange={(evento) => setSenhaNova(evento.target.value)}
                    placeholder="Nova senha"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                  <Input
                    id="confirmar-senha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(evento) => setConfirmarSenha(evento.target.value)}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {recuperarErro ? (
                <p className="text-sm text-destructive" role="alert">
                  {recuperarErro}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRecuperarAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={recuperarCarregando}
                  className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                  onClick={async () => {
                    if (!emailRecuperar.includes("@")) {
                      setRecuperarErro("Informe um e-mail corporativo válido.");
                      return;
                    }
                    if (senhaNova.trim().length < 4) {
                      setRecuperarErro("A nova senha deve ter pelo menos 4 caracteres.");
                      return;
                    }
                    if (senhaNova !== confirmarSenha) {
                      setRecuperarErro("As senhas não conferem.");
                      return;
                    }
                    setRecuperarErro("");
                    setRecuperarCarregando(true);
                    const resultado = await redefinirSenha(emailRecuperar, senhaNova);
                    setRecuperarCarregando(false);
                    if (resultado.ok) {
                      setEmail(emailRecuperar);
                      setRecuperarSucesso(true);
                    } else {
                      setRecuperarErro(resultado.error);
                    }
                  }}
                >
                  {recuperarCarregando ? "Redefinindo…" : "Redefinir senha"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
