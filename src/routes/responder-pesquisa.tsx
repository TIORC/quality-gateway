import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ResponderPesquisaModelo } from "@/components/pesquisas/responder-pesquisa-modelo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERGUNTAS_NOTA, registrarRespostaPesquisa } from "@/lib/pesquisas-satisfacao";

export const Route = createFileRoute("/responder-pesquisa")({
  head: () => ({
    meta: [
      { title: "Pesquisa de Satisfação | Orcoma" },
      { name: "description", content: "Pesquisa de satisfação do atendimento Orcoma." },
    ],
  }),
  // Cada pesquisa criada tem o seu link: /responder-pesquisa?pesquisa=<id>.
  validateSearch: (busca: Record<string, unknown>): { pesquisa?: string } => ({
    pesquisa: typeof busca.pesquisa === "string" && busca.pesquisa ? busca.pesquisa : undefined,
  }),
  component: ResponderPesquisaPublica,
});

function ResponderPesquisaPublica() {
  const { pesquisa } = Route.useSearch();
  if (pesquisa) return <ResponderPesquisaModelo id={pesquisa} />;
  return <ResponderPesquisa />;
}

const NOTAS = Array.from({ length: 10 }, (_, indice) => indice + 1);

const UNIDADES = ["Maracás", "Salvador", "Jequié 2", "Jaguaquara"];
const OUTRO = "__outro__";

type Notas = Record<(typeof PERGUNTAS_NOTA)[number]["chave"], number | null>;

const NOTAS_VAZIAS = Object.fromEntries(
  PERGUNTAS_NOTA.map((pergunta) => [pergunta.chave, null]),
) as Notas;

function ResponderPesquisa() {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [nomePessoa, setNomePessoa] = useState("");
  const [unidadeEscolhida, setUnidadeEscolhida] = useState("");
  const [unidadeOutro, setUnidadeOutro] = useState("");
  const [notas, setNotas] = useState<Notas>(NOTAS_VAZIAS);
  const [sugestao, setSugestao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function escolherNota(chave: keyof Notas, valor: number) {
    setNotas((atual) => ({ ...atual, [chave]: valor }));
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    const unidade = (unidadeEscolhida === OUTRO ? unidadeOutro : unidadeEscolhida).trim();
    if (!unidade) {
      toast.error("Escolha a unidade que atende você.");
      return;
    }
    const respondidas = PERGUNTAS_NOTA.every((pergunta) => notas[pergunta.chave] !== null);
    if (!respondidas) {
      toast.error("Escolha uma nota de 1 a 10 em cada pergunta.");
      return;
    }
    setEnviando(true);
    try {
      await registrarRespostaPesquisa({
        empresa: empresa.trim(),
        email: email.trim(),
        nomePessoa: nomePessoa.trim(),
        unidade,
        notaAtendimento: notas.notaAtendimento as number,
        notaQualidade: notas.notaQualidade as number,
        notaOrientacoes: notas.notaOrientacoes as number,
        notaPrazos: notas.notaPrazos as number,
        notaRecomendacao: notas.notaRecomendacao as number,
        sugestao: sugestao.trim(),
      });
      setEnviado(true);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar sua resposta.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="relative isolate overflow-hidden flex min-h-screen items-center justify-center bg-[#0B1F4B] px-4 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:content-[''] before:bg-[url('/logo-orcoma-branca.png')] before:bg-[length:160px_auto] before:bg-repeat before:opacity-[0.08]">
        <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-[#0F172A]">Obrigado!</h1>
          <p className="mt-2 text-sm text-[#64748B]">Sua resposta foi registrada.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate overflow-hidden min-h-screen bg-[#0B1F4B] px-4 py-10 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:content-[''] before:bg-[url('/logo-orcoma-branca.png')] before:bg-[length:160px_auto] before:bg-repeat before:opacity-[0.08]">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-xl border border-t-4 border-[#E2E8F0] border-t-[#2563EB] bg-white p-6 sm:p-8 dark:border-t-[#93C5FD]"
      >
        <header>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Pesquisa de Satisfação</h1>
        </header>

        <div className="grid gap-2">
          <Label htmlFor="empresa">Nome da Empresa</Label>
          <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="nome">Respondido por</Label>
          <Input id="nome" value={nomePessoa} onChange={(e) => setNomePessoa(e.target.value)} required />
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium text-[#0F172A]">
            Sou atendido pela unidade
          </legend>
          {UNIDADES.map((opcao) => (
            <label key={opcao} className="flex items-center gap-3 text-sm text-[#0F172A]">
              <input
                type="radio"
                name="unidade"
                value={opcao}
                checked={unidadeEscolhida === opcao}
                onChange={() => setUnidadeEscolhida(opcao)}
                className="h-4 w-4 accent-[#2563EB]"
              />
              {opcao}
            </label>
          ))}
          <label className="flex items-center gap-3 text-sm text-[#0F172A]">
            <input
              type="radio"
              name="unidade"
              value={OUTRO}
              checked={unidadeEscolhida === OUTRO}
              onChange={() => setUnidadeEscolhida(OUTRO)}
              className="h-4 w-4 accent-[#2563EB]"
            />
            Outro:
            <Input
              aria-label="Outra unidade"
              value={unidadeOutro}
              disabled={unidadeEscolhida !== OUTRO}
              onFocus={() => setUnidadeEscolhida(OUTRO)}
              onChange={(e) => setUnidadeOutro(e.target.value)}
              className="h-8 max-w-xs"
            />
          </label>
        </fieldset>

        {PERGUNTAS_NOTA.map((pergunta, indice) => (
          <fieldset key={pergunta.chave} className="grid gap-3">
            <legend className="mb-2 text-sm font-medium text-[#0F172A]">
              {`${indice + 1} - ${pergunta.pergunta}`}
            </legend>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {NOTAS.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => escolherNota(pergunta.chave, valor)}
                  aria-pressed={notas[pergunta.chave] === valor}
                  className={
                    "h-10 rounded-md border text-sm font-medium transition-colors " +
                    (notas[pergunta.chave] === valor
                      ? "border-[#553F8C] bg-[#553F8C] text-white"
                      : "border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9]")
                  }
                >
                  {valor}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[#DC2626]">Abaixo do esperado</span>
              <span className="text-[#16A34A]">Excelente!</span>
            </div>
          </fieldset>
        ))}

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium text-[#0F172A]">
            6 - Que sugestão você nos recomenda para melhorar ainda mais?
          </legend>
          <p className="text-xs text-[#64748B]">
            Se quiser nos contar mais sobre alguma nota, ou compartilhar qualquer sugestão, ficaremos
            muito gratos. Isso nos ajuda a melhorar de verdade.
          </p>
          <Textarea
            aria-label="Sugestão"
            value={sugestao}
            onChange={(e) => setSugestao(e.target.value)}
            placeholder="Sua resposta"
            rows={4}
          />
        </fieldset>

        <Button type="submit" disabled={enviando} className="self-end">
          {enviando ? "Enviando..." : "Enviar resposta"}
        </Button>
      </form>
    </main>
  );
}
