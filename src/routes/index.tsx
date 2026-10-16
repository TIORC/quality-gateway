import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { isAuthenticated, login } from "@/lib/auth";
import { solicitarPrimeiroAcesso } from "@/lib/convites";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [primeiroAcessoAberto, setPrimeiroAcessoAberto] = useState(false);
  const [modoLink, setModoLink] = useState<"primeiro-acesso" | "redefinir">("primeiro-acesso");
  const [emailPrimeiroAcesso, setEmailPrimeiroAcesso] = useState("");
  const [erroPrimeiroAcesso, setErroPrimeiroAcesso] = useState("");
  const [enviandoPrimeiroAcesso, setEnviandoPrimeiroAcesso] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState("");

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

  function abrirPrimeiroAcesso(modo: "primeiro-acesso" | "redefinir" = "primeiro-acesso") {
    setModoLink(modo);
    setEmailPrimeiroAcesso(email);
    setErroPrimeiroAcesso("");
    setEmailEnviado("");
    setPrimeiroAcessoAberto(true);
  }

  async function onSubmitPrimeiroAcesso(e: FormEvent) {
    e.preventDefault();
    if (!emailPrimeiroAcesso.includes("@")) {
      setErroPrimeiroAcesso("Informe um e-mail corporativo válido.");
      return;
    }
    setErroPrimeiroAcesso("");
    setEnviandoPrimeiroAcesso(true);
    const resultado = await solicitarPrimeiroAcesso(emailPrimeiroAcesso, modoLink);
    setEnviandoPrimeiroAcesso(false);
    if (resultado.ok) {
      setEmailEnviado(emailPrimeiroAcesso.trim());
      return;
    }
    setErroPrimeiroAcesso(resultado.error);
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
                onClick={() => abrirPrimeiroAcesso("redefinir")}
                className="text-sm text-brand-muted transition hover:text-brand-foreground"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="button"
              onClick={() => abrirPrimeiroAcesso()}
              className="w-full rounded-xl border border-brand-line bg-white/5 py-3 text-sm font-semibold text-brand-foreground transition hover:bg-white/10"
            >
              Primeiro acesso
            </button>
          </form>
        </section>
      </div>

      <AppFooter variant="brand" />

      <Dialog open={recuperarAberto} onOpenChange={(abre) => !abre && setRecuperarAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Esqueci minha senha</DialogTitle>
            <DialogDescription>
              Peça ao administrador do sistema um novo link de primeiro acesso. Ele chega pelo
              administrador e permite criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              onClick={() => setRecuperarAberto(false)}
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={primeiroAcessoAberto}
        onOpenChange={(abre) => !abre && setPrimeiroAcessoAberto(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modoLink === "redefinir" ? "Esqueci minha senha" : "Primeiro acesso"}</DialogTitle>
            <DialogDescription>
              {modoLink === "redefinir"
                ? "Informe o seu e-mail corporativo. Enviaremos um link para você criar uma nova senha."
                : "Informe o seu e-mail corporativo. Se a conta existir e a senha ainda não tiver sido criada, enviaremos um link para você definir a sua senha."}
            </DialogDescription>
          </DialogHeader>

          {emailEnviado ? (
            <div className="space-y-4">
              <p className="text-sm text-brand-foreground">
                Enviamos o link para <strong>{emailEnviado}</strong>. Abra o e-mail e clique no
                botão para criar a sua senha. O link vale por 24 horas.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                  onClick={() => setPrimeiroAcessoAberto(false)}
                >
                  Entendi
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onSubmitPrimeiroAcesso} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="email-primeiro-acesso"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  E-mail corporativo
                </label>
                <Input
                  id="email-primeiro-acesso"
                  type="email"
                  autoComplete="email"
                  value={emailPrimeiroAcesso}
                  onChange={(e) => setEmailPrimeiroAcesso(e.target.value)}
                  placeholder="nome@empresa.com.br"
                />
              </div>

              {erroPrimeiroAcesso ? (
                <p className="text-sm text-destructive" role="alert">
                  {erroPrimeiroAcesso}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={enviandoPrimeiroAcesso}
                  className="w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF] disabled:opacity-70"
                >
                  {enviandoPrimeiroAcesso ? "Enviando…" : "Enviar link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
