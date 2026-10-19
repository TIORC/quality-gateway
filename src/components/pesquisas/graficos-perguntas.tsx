import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  listarRespostasModelo,
  type ModeloPesquisa,
  type PerguntaModelo,
  type RespostaPesquisa,
} from "@/lib/pesquisas-modelos";

const COR_BARRA = "#2563EB";
const ROTULO_OUTRO = "Outro";

interface GraficosPerguntasProps {
  modelos: ModeloPesquisa[];
}

/**
 * Um gráfico por pergunta do modelo escolhido. O título é o texto atual da
 * pergunta, então qualquer edição no formulário aparece aqui. Sem respostas, os
 * gráficos aparecem zerados.
 */
export function GraficosPerguntas({ modelos }: GraficosPerguntasProps) {
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<RespostaPesquisa[]>([]);
  const [carregando, setCarregando] = useState(false);

  const modelo = modelos.find((m) => m.id === (modeloId ?? modelos[0]?.id)) ?? null;
  const modeloAtualId = modelo?.id;

  // Nome de quem respondeu: a pergunta "Respondido por", ou a empresa se ela não existir.
  const nomeDe = useMemo(() => {
    const chavePessoa = modelo?.perguntas.find((p) => /respondido/i.test(p.texto))?.id;
    const chaveEmpresa = modelo?.perguntas.find((p) => /nome da empresa/i.test(p.texto))?.id;
    return (resposta: RespostaPesquisa) => {
      const pessoa = chavePessoa ? resposta[chavePessoa] : undefined;
      const empresa = chaveEmpresa ? resposta[chaveEmpresa] : undefined;
      return String(pessoa || empresa || "Sem identificação");
    };
  }, [modelo]);

  useEffect(() => {
    if (!modeloAtualId) return;
    let ativo = true;
    setCarregando(true);
    listarRespostasModelo(modeloAtualId)
      .then((lista) => {
        if (ativo) setRespostas(lista);
      })
      .catch((erro: unknown) => {
        toast.error(
          erro instanceof Error ? erro.message : "Não foi possível carregar as respostas.",
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [modeloAtualId]);

  if (!modelo) return null;

  return (
    <section className="mb-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#0F172A]">Gráficos por pergunta</h2>
        {modelos.length > 1 && (
          <select
            className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]"
            value={modelo.id}
            onChange={(e) => setModeloId(e.target.value)}
          >
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo}
              </option>
            ))}
          </select>
        )}
      </div>

      {carregando && <p className="text-sm text-[#64748B]">Carregando respostas…</p>}

      <div className="grid gap-4">
        {modelo.perguntas.map((pergunta, indice) => (
          <CartaoPergunta
            key={pergunta.id}
            numero={indice + 1}
            pergunta={pergunta}
            respostas={respostas}
            nomeDe={nomeDe}
          />
        ))}
      </div>
    </section>
  );
}

function CartaoPergunta({
  numero,
  pergunta,
  respostas,
  nomeDe,
}: {
  numero: number;
  pergunta: PerguntaModelo;
  respostas: RespostaPesquisa[];
  nomeDe: (resposta: RespostaPesquisa) => string;
}) {
  const pares = useMemo(
    () =>
      respostas
        .map((r) => ({ nome: nomeDe(r), valor: r[pergunta.id] }))
        .filter(
          (p): p is { nome: string; valor: number | string | string[] } =>
            p.valor !== undefined && p.valor !== "",
        ),
    [respostas, pergunta.id, nomeDe],
  );
  const valores = pares.map((p) => p.valor);

  return (
    <div className="rounded-lg border border-[#E2E8F0] p-4">
      <h3 className="text-sm font-semibold text-[#0F172A]">
        {numero}. {pergunta.texto}
      </h3>
      {pergunta.subtitulo && <p className="mt-1 text-xs text-[#64748B]">{pergunta.subtitulo}</p>}
      <p className="mb-3 text-xs text-[#64748B]">
        {valores.length} {valores.length === 1 ? "resposta" : "respostas"}
      </p>
      {pergunta.tipo === "escala" && <GraficoEscala pares={pares} />}
      {(pergunta.tipo === "multipla_escolha" ||
        pergunta.tipo === "caixas_selecao" ||
        pergunta.tipo === "sim_nao") && <GraficoOpcoes pergunta={pergunta} valores={valores} />}
      {(pergunta.tipo === "texto_curto" || pergunta.tipo === "texto_longo") && (
        <RespostasTexto pares={pares} />
      )}
    </div>
  );
}

function GraficoEscala({
  pares,
}: {
  pares: { nome: string; valor: number | string | string[] }[];
}) {
  const dados = Array.from({ length: 10 }, (_, i) => {
    const nota = i + 1;
    const nomes = pares.filter((p) => Number(p.valor) === nota).map((p) => p.nome);
    return { rotulo: String(nota), total: nomes.length, nomes };
  });

  const notas = pares.map((p) => Number(p.valor)).filter((n) => !Number.isNaN(n));
  const media = notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : null;

  return (
    <div className="grid gap-3">
      <GraficoBarras dados={dados} />
      <p className="text-sm text-[#0F172A]">
        <span className="font-semibold">Média: </span>
        {media === null ? "—" : media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        <span className="text-[#64748B]">
          {" "}
          ({notas.length} {notas.length === 1 ? "voto" : "votos"})
        </span>
      </p>
      <ul className="grid gap-1 text-sm text-[#334155]">
        {dados
          .filter((d) => d.total > 0)
          .map((d) => (
            <li key={d.rotulo}>
              <span className="font-semibold">Nota {d.rotulo}:</span> {d.nomes.join(", ")}
            </li>
          ))}
      </ul>
    </div>
  );
}

function GraficoOpcoes({
  pergunta,
  valores,
}: {
  pergunta: PerguntaModelo;
  valores: (number | string | string[])[];
}) {
  const opcoes = pergunta.tipo === "sim_nao" ? ["Sim", "Não"] : pergunta.opcoes;
  const contagem = new Map<string, number>(opcoes.map((o) => [o, 0]));
  if (pergunta.permiteOutro) contagem.set(ROTULO_OUTRO, 0);

  for (const valor of valores) {
    const itens = Array.isArray(valor) ? valor : [String(valor)];
    for (const item of itens) {
      const chave = opcoes.includes(item) ? item : ROTULO_OUTRO;
      if (contagem.has(chave)) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
  }

  const dados = [...contagem.entries()].map(([rotulo, total]) => ({ rotulo, total }));
  return <GraficoBarras dados={dados} />;
}

const PALAVRAS_POSITIVAS = [
  "otimo",
  "ótimo",
  "excelente",
  "bom",
  "boa",
  "bons",
  "obrigad",
  "parabens",
  "parabéns",
  "satisfeit",
  "claro",
  "rapid",
  "rápid",
  "eficiente",
  "gosto",
  "adorei",
  "interessante",
  "atencioso",
  "atenciosa",
  "agradec",
  "melhor",
  "competente",
];
const PALAVRAS_NEGATIVAS = [
  "pessim",
  "péssim",
  "ruim",
  "demora",
  "demorad",
  "falta",
  "problema",
  "reclam",
  "insatisfeit",
  "erro",
  "atras",
  "atraso",
  "nao gostei",
  "não gostei",
  "lento",
  "pior",
  "descaso",
  "dificil",
  "difícil",
  "esquec",
  "confus",
  "nunca",
  "sem retorno",
];

/**
 * Classificação simples por palavras-chave, só para colorir as respostas de texto.
 * Não entende o contexto: pode errar, e o ideal é conferir cada resposta.
 */
function classificarTexto(texto: string): "positiva" | "negativa" | "neutra" {
  const minusculo = texto.toLowerCase();
  const positivas = PALAVRAS_POSITIVAS.filter((p) => minusculo.includes(p)).length;
  const negativas = PALAVRAS_NEGATIVAS.filter((p) => minusculo.includes(p)).length;
  if (negativas > positivas) return "negativa";
  if (positivas > negativas) return "positiva";
  return "neutra";
}

const ESTILO_SENTIMENTO = {
  positiva:
    "border-l-4 border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  negativa: "border-l-4 border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100",
  neutra: "bg-[#F8FAFC] text-[#334155]",
} as const;

function RespostasTexto({
  pares,
}: {
  pares: { nome: string; valor: number | string | string[] }[];
}) {
  if (pares.length === 0) {
    return <p className="text-sm text-[#64748B]">Nenhuma resposta ainda.</p>;
  }
  return (
    <ul className="grid gap-2 text-sm">
      {pares
        .slice(-5)
        .reverse()
        .map((par, indice) => {
          const texto = String(par.valor);
          return (
            <li
              key={indice}
              className={`rounded-md px-3 py-2 ${ESTILO_SENTIMENTO[classificarTexto(texto)]}`}
            >
              <span className="font-semibold">{par.nome}:</span> {texto}
            </li>
          );
        })}
    </ul>
  );
}

function GraficoBarras({ dados }: { dados: { rotulo: string; total: number }[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} interval={0} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
          <Bar dataKey="total" fill={COR_BARRA} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="total" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
