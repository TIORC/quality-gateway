import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buscarModeloPesquisa,
  registrarRespostaModelo,
  type ModeloPesquisa,
  type PerguntaModelo,
  type RespostaPesquisa,
} from "@/lib/pesquisas-modelos";

/**
 * Fundo azul com a logo repetida ao fundo, em baixa opacidade. A logo fica numa
 * camada atrás do conteúdo (before), então não atrapalha a leitura.
 */
const FUNDO_COM_LOGO =
  "relative isolate overflow-hidden bg-[#0B1F4B] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:content-[''] before:bg-[url('/logo-orcoma-branca.png')] before:bg-[length:160px_auto] before:bg-repeat before:opacity-[0.08]";

const NOTAS = Array.from({ length: 10 }, (_, indice) => indice + 1);
// NPS vai de 0 a 10. Os grupos (detratores, neutros, promotores) são só para o gráfico e não aparecem aqui.
const NOTAS_NPS = Array.from({ length: 11 }, (_, indice) => indice);
const OUTRO = "__outro__";
const SIM_NAO = ["Sim", "Não"];

/** Estado de uma pergunta na tela: a escolha e, quando for "Outro", o texto digitado. */
interface Escolha {
  valor?: number | string | string[];
  outro: string;
}

/** Converte a escolha em resposta gravável. Retorna undefined se a pergunta ficou em branco. */
function montarResposta(pergunta: PerguntaModelo, escolha: Escolha | undefined) {
  const valor = escolha?.valor;
  const outro = escolha?.outro.trim() ?? "";
  if (valor === undefined) return undefined;
  if (pergunta.tipo === "escala" || pergunta.tipo === "nps") {
    return typeof valor === "number" ? valor : undefined;
  }
  if (pergunta.tipo === "caixas_selecao") {
    const lista = Array.isArray(valor) ? valor : [];
    const respostas = lista.map((item) => (item === OUTRO ? outro : item)).filter(Boolean);
    return respostas.length ? respostas : undefined;
  }
  if (typeof valor !== "string") return undefined;
  const texto = valor === OUTRO ? outro : valor.trim();
  return texto || undefined;
}

export function ResponderPesquisaModelo({ id }: { id: string }) {
  const [modelo, setModelo] = useState<ModeloPesquisa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    buscarModeloPesquisa(id)
      .then((encontrado) => {
        if (ativo) setModelo(encontrado);
      })
      .catch((erro: unknown) => {
        if (ativo) {
          toast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a pesquisa.");
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  function atualizar(pergunta: PerguntaModelo, mudanca: Partial<Escolha>) {
    setEscolhas((atuais) => ({
      ...atuais,
      [pergunta.id]: { outro: "", ...atuais[pergunta.id], ...mudanca },
    }));
  }

  async function onSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (!modelo) return;
    const respostas: RespostaPesquisa = {};
    for (const pergunta of modelo.perguntas) {
      const resposta = montarResposta(pergunta, escolhas[pergunta.id]);
      if (resposta === undefined) {
        if (pergunta.obrigatoria) {
          toast.error(`Responda a pergunta: ${pergunta.texto}`);
          return;
        }
        continue;
      }
      respostas[pergunta.id] = resposta;
    }
    setEnviando(true);
    try {
      await registrarRespostaModelo(modelo.id, respostas);
      setEnviado(true);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar sua resposta.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <Tela>Carregando pesquisa…</Tela>;
  }

  if (!modelo) {
    return <Tela>Pesquisa não encontrada. Confira o link recebido.</Tela>;
  }

  if (enviado) {
    return (
      <main className={FUNDO_COM_LOGO + " flex min-h-screen items-center justify-center px-4"}>
        <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-[#0F172A]">Obrigado!</h1>
          <p className="mt-2 text-sm text-[#64748B]">Sua resposta foi registrada.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={FUNDO_COM_LOGO + " min-h-screen px-4 py-10"}>
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-xl border border-t-4 border-[#E2E8F0] border-t-[#2563EB] bg-white p-6 sm:p-8 dark:border-t-[#93C5FD]"
        // Fundo sólido: o estilo global deixa os cards brancos semitransparentes.
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <header>
          <h1 className="text-2xl font-semibold text-[#0F172A]">{modelo.titulo}</h1>
          {modelo.descricao && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#64748B]">{modelo.descricao}</p>
          )}
        </header>

        {modelo.perguntas.map((pergunta, indice) => (
          <fieldset key={pergunta.id} className="grid gap-3">
            <legend className="mb-2 text-sm font-medium text-[#0F172A]">
              {`${indice + 1} - ${pergunta.texto}`}
              {pergunta.obrigatoria && <span className="text-[#DC2626]"> *</span>}
            </legend>
            {pergunta.subtitulo && <p className="text-xs text-[#64748B]">{pergunta.subtitulo}</p>}
            <CampoResposta
              pergunta={pergunta}
              escolha={escolhas[pergunta.id]}
              onChange={(mudanca) => atualizar(pergunta, mudanca)}
            />
          </fieldset>
        ))}

        <Button type="submit" disabled={enviando} className="self-end">
          {enviando ? "Enviando..." : "Enviar resposta"}
        </Button>
      </form>
    </main>
  );
}

function CampoResposta({
  pergunta,
  escolha,
  onChange,
}: {
  pergunta: PerguntaModelo;
  escolha: Escolha | undefined;
  onChange: (mudanca: Partial<Escolha>) => void;
}) {
  const valor = escolha?.valor;

  if (pergunta.tipo === "texto_curto") {
    return (
      <Input
        aria-label={pergunta.texto}
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange({ valor: e.target.value })}
      />
    );
  }

  if (pergunta.tipo === "texto_longo") {
    return (
      <Textarea
        aria-label={pergunta.texto}
        rows={4}
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange({ valor: e.target.value })}
      />
    );
  }

  if (pergunta.tipo === "escala" || pergunta.tipo === "nps") {
    const nps = pergunta.tipo === "nps";
    const colunas = nps ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-5 sm:grid-cols-10";
    return (
      <div className={`grid gap-2 ${colunas}`}>
        {(nps ? NOTAS_NPS : NOTAS).map((nota) => (
          <button
            key={nota}
            type="button"
            onClick={() => onChange({ valor: nota })}
            aria-pressed={valor === nota}
            className={
              "h-10 rounded-md border text-sm font-medium transition-colors " +
              (valor === nota
                ? "border-[#553F8C] bg-[#553F8C] text-white"
                : "border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F1F5F9]")
            }
          >
            {nota}
          </button>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === "sim_nao") {
    return (
      <OpcoesEscolha
        nome={pergunta.id}
        tipo="radio"
        opcoes={SIM_NAO}
        selecionadas={typeof valor === "string" ? [valor] : []}
        onEscolher={(opcao) => onChange({ valor: opcao })}
      />
    );
  }

  // Múltipla escolha e caixas de seleção: a lista é `opcoes`, mais "Outro" quando existir.
  const tipo = pergunta.tipo === "caixas_selecao" ? "checkbox" : "radio";
  const selecionadas = Array.isArray(valor) ? valor : typeof valor === "string" ? [valor] : [];
  const opcoes = pergunta.permiteOutro ? [...pergunta.opcoes, OUTRO] : pergunta.opcoes;

  function escolher(opcao: string) {
    if (tipo === "radio") {
      onChange({ valor: opcao });
      return;
    }
    const proximas = selecionadas.includes(opcao)
      ? selecionadas.filter((item) => item !== opcao)
      : [...selecionadas, opcao];
    onChange({ valor: proximas });
  }

  return (
    <OpcoesEscolha
      nome={pergunta.id}
      tipo={tipo}
      opcoes={opcoes}
      selecionadas={selecionadas}
      onEscolher={escolher}
      campoOutro={
        pergunta.permiteOutro && selecionadas.includes(OUTRO) ? (
          <Input
            aria-label="Outra resposta"
            value={escolha?.outro ?? ""}
            onChange={(e) => onChange({ outro: e.target.value })}
            className="h-8 max-w-xs"
          />
        ) : null
      }
    />
  );
}

function OpcoesEscolha({
  nome,
  tipo,
  opcoes,
  selecionadas,
  onEscolher,
  campoOutro,
}: {
  nome: string;
  tipo: "radio" | "checkbox";
  opcoes: string[];
  selecionadas: string[];
  onEscolher: (opcao: string) => void;
  campoOutro?: ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {opcoes.map((opcao) => (
        <label key={opcao} className="flex items-center gap-3 text-sm text-[#0F172A]">
          <input
            type={tipo}
            name={nome}
            value={opcao}
            checked={selecionadas.includes(opcao)}
            onChange={() => onEscolher(opcao)}
            className="h-4 w-4 accent-[#2563EB]"
          />
          {opcao === OUTRO ? "Outro:" : opcao}
          {opcao === OUTRO && campoOutro}
        </label>
      ))}
    </div>
  );
}

function Tela({ children }: { children: ReactNode }) {
  return (
    <main className={FUNDO_COM_LOGO + " flex min-h-screen items-center justify-center px-4"}>
      <div className="max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
        {children}
      </div>
    </main>
  );
}
