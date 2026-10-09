import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";
import { buscarConviteAcesso, resgatarConviteAcesso } from "@/lib/convites";

export const Route = createFileRoute("/primeiro-acesso")({
  head: () => ({
    meta: [
      { title: "Primeiro acesso — Gestão da Qualidade" },
      { name: "description", content: "Crie a sua senha de acesso ao sistema de Gestão da Qualidade." },
    ],
  }),
  component: PrimeiroAcesso,
});

type Estado =
  | { fase: "carregando" }
  | { fase: "invalido"; erro: string }
  | { fase: "pronto"; nome: string; email: string }
  | { fase: "concluido"; email: string };

function PrimeiroAcesso() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const fragmento = window.location.hash.replace(/^#/, "").trim();
    if (!fragmento) {
      setEstado({ fase: "invalido", erro: "Link incompleto. Use o link enviado pelo administrador." });
      return;
    }
    setToken(fragmento);
    buscarConviteAcesso(fragmento).then((resultado) => {
      setEstado(
        resultado.ok
          ? { fase: "pronto", nome: resultado.nome, email: resultado.email }
          : { fase: "invalido", erro: resultado.error },
      );
    });
  }, []);

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (senha.trim().length < 4) {
      setErro("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }
    setErro("");
    setSalvando(true);
    const resultado = await resgatarConviteAcesso(token, senha);
    if (!resultado.ok) {
      setSalvando(false);
      setErro(resultado.error);
      return;
    }

    // Entra direto no sistema com a senha recém-criada. Se o login falhar por
    // algum motivo, mostra a confirmação e a pessoa entra pela tela de login.
    if (estado.fase === "pronto") {
      const entrada = await login(estado.email, senha);
      if (entrada.ok) {
        router.navigate({ to: "/loading", replace: true });
        return;
      }
      setEstado({ fase: "concluido", email: estado.email });
    }
    setSalvando(false);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4">
        <section className="w-full max-w-md rounded-2xl border border-[#E9EEF5] bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#312E81] text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[#1F2937]">Primeiro acesso</h1>
              <p className="text-sm text-[#64748B]">Gestão da Qualidade</p>
            </div>
          </div>

          {estado.fase === "carregando" ? (
            <p className="text-sm text-[#64748B]">Validando o link…</p>
          ) : null}

          {estado.fase === "invalido" ? (
            <div className="space-y-4">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {estado.erro}
              </p>
              <Link to="/" className="text-sm text-[#312E81] underline">
                Voltar para o login
              </Link>
            </div>
          ) : null}

          {estado.fase === "pronto" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-[#475569]">
                Olá, <strong>{estado.nome}</strong>. Crie a sua senha para entrar com o e-mail{" "}
                <strong>{estado.email}</strong>.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={verSenha ? "text" : "password"}
                    value={senha}
                    onChange={(evento) => setSenha(evento.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setVerSenha((atual) => !atual)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[#64748B]"
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                <Input
                  id="confirmar-senha"
                  type={verSenha ? "text" : "password"}
                  value={confirmacao}
                  onChange={(evento) => setConfirmacao(evento.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {erro ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erro}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={salvando}
                className="btn-brand disabled:cursor-not-allowed disabled:opacity-70"
              >
                {salvando ? "Salvando…" : "Criar senha e concluir"}
              </button>
            </form>
          ) : null}

          {estado.fase === "concluido" ? (
            <div className="space-y-4">
              <p className="text-sm text-[#475569]">
                Senha criada com sucesso. Entre com o e-mail <strong>{estado.email}</strong> e a senha que
                você acabou de definir.
              </p>
              <Link to="/" className="btn-brand inline-flex justify-center">
                Ir para o login
              </Link>
            </div>
          ) : null}
        </section>
      </div>
      <AppFooter variant="brand" />
    </main>
  );
}
