import { createFileRoute } from "@tanstack/react-router";
import { Download, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { CriarPesquisaDialog } from "@/components/pesquisas/criar-pesquisa-dialog";
import { GraficosPerguntas } from "@/components/pesquisas/graficos-perguntas";
import { PanelShell } from "@/components/panel-shell";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarModelosPesquisa, type ModeloPesquisa } from "@/lib/pesquisas-modelos";
import {
  listarPesquisas,
  mediaGeral,
  mediaPorPergunta,
  type PesquisaSatisfacao,
} from "@/lib/pesquisas-satisfacao";
import { podeGerenciarPesquisas } from "@/lib/permissoes";

export const Route = createFileRoute("/pesquisas-de-satisfacao")({
  head: () => ({
    meta: [{ title: "Pesquisas de Satisfação | Gestão da Qualidade" }],
  }),
  component: PesquisasDeSatisfacao,
});

const COR_BARRA = "#2563EB";
const COR_MEDIA_GERAL = "#0F172A";

function PesquisasDeSatisfacao() {
  const [pesquisas, setPesquisas] = useState<PesquisaSatisfacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criandoPesquisa, setCriandoPesquisa] = useState(false);
  const [modelos, setModelos] = useState<ModeloPesquisa[]>([]);
  const [modeloEditando, setModeloEditando] = useState<ModeloPesquisa | null>(null);
  // `usePanelSession` só funciona dentro do PanelShell, que é o pai desta página;
  // por isso lemos a sessão em cache diretamente.
  const sessao = getSession();
  const podeGerenciar = podeGerenciarPesquisas(sessao);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setPesquisas(await listarPesquisas());
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar as pesquisas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarModelos = useCallback(async () => {
    try {
      setModelos(await listarModelosPesquisa());
    } catch (erro) {
      toast.error(
        erro instanceof Error ? erro.message : "Não foi possível carregar as pesquisas criadas.",
      );
    }
  }, []);

  useEffect(() => {
    void carregar();
    void carregarModelos();
  }, [carregar, carregarModelos]);

  const medias = useMemo(() => mediaPorPergunta(pesquisas), [pesquisas]);
  const geral = useMemo(() => mediaGeral(pesquisas), [pesquisas]);
  const atendimento = medias[0] ?? { rotulo: "", media: 0 };
  const demais = medias.slice(1);
  const dadosGeral = [
    ...medias.map((m) => ({ rotulo: m.rotulo, media: m.media })),
    { rotulo: "Média Geral", media: geral },
  ];

  function exportarExcel() {
    const linhas = pesquisas.map((p) => ({
      Empresa: p.empresa,
      "Nome completo": p.nomePessoa,
      Unidade: p.unidade,
      Atendimento: p.notaAtendimento,
      Qualidade: p.notaQualidade,
      Orientações: p.notaOrientacoes,
      Prazos: p.notaPrazos,
      Recomendação: p.notaRecomendacao,
      "Data da resposta": new Date(p.criadoEm).toLocaleDateString("pt-BR"),
    }));
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, planilha, "Empresas");
    XLSX.writeFile(pasta, "pesquisas-de-satisfacao.xlsx");
  }

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Gestão
          </p>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Pesquisas de Satisfação</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {pesquisas.length} {pesquisas.length === 1 ? "resposta" : "respostas"} recebidas. Notas
            de 1 (abaixo do esperado) a 10 (excelente).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={exportarExcel} disabled={pesquisas.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          {podeGerenciar && (
            <Button
              onClick={() => {
                setModeloEditando(null);
                setCriandoPesquisa(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Pesquisa
            </Button>
          )}
        </div>
        {podeGerenciar && (
          <CriarPesquisaDialog
            aberto={criandoPesquisa}
            onAbertoChange={setCriandoPesquisa}
            modelo={modeloEditando}
            onSalvo={() => void carregarModelos()}
          />
        )}
      </div>

      {modelos.length > 0 && (
        <section className="mb-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-[#0F172A]">Pesquisas criadas</h2>
          <ul className="divide-y divide-[#E2E8F0]">
            {modelos.map((modelo) => (
              <li key={modelo.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0F172A]">{modelo.titulo}</p>
                  <p className="text-xs text-[#64748B]">
                    {modelo.perguntas.length}{" "}
                    {modelo.perguntas.length === 1 ? "pergunta" : "perguntas"}
                    {" · criada em "}
                    {new Date(modelo.criadoEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {podeGerenciar && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModeloEditando(modelo);
                      setCriandoPesquisa(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <GraficosPerguntas modelos={modelos} />

      {!carregando && pesquisas.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          Nenhuma resposta de pesquisa recebida ainda.
        </div>
      ) : (
        <div className="grid gap-6">
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-[#0F172A]">
              Empresas que responderam
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Nome completo</TableHead>
                    <TableHead>Unidade atendida</TableHead>
                    <TableHead className="text-center">Atendimento</TableHead>
                    <TableHead className="text-center">Qualidade</TableHead>
                    <TableHead className="text-center">Orientações</TableHead>
                    <TableHead className="text-center">Prazos</TableHead>
                    <TableHead className="text-center">Recomendação</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesquisas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.empresa || "—"}</TableCell>
                      <TableCell>{p.nomePessoa || "—"}</TableCell>
                      <TableCell>{p.unidade || "—"}</TableCell>
                      <TableCell className="text-center">{p.notaAtendimento}</TableCell>
                      <TableCell className="text-center">{p.notaQualidade}</TableCell>
                      <TableCell className="text-center">{p.notaOrientacoes}</TableCell>
                      <TableCell className="text-center">{p.notaPrazos}</TableCell>
                      <TableCell className="text-center">{p.notaRecomendacao}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-[#475569]">
                        {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-1 text-base font-semibold text-[#0F172A]">{atendimento.rotulo}</h2>
            <p className="mb-3 text-xs text-[#64748B]">
              Como você avalia o nosso atendimento? (1 a 10)
            </p>
            <GraficoMedia dados={[{ rotulo: "Atendimento", media: atendimento.media }]} />
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-[#0F172A]">
              Médias das demais perguntas
            </h2>
            <GraficoMedia dados={demais.map((m) => ({ rotulo: m.rotulo, media: m.media }))} />
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-[#0F172A]">Média Geral</h2>
              <span className="text-2xl font-semibold text-[#0F172A]">
                {geral.toLocaleString("pt-BR")}
              </span>
            </div>
            <GraficoMedia dados={dadosGeral} destacarUltima />
          </section>
        </div>
      )}
    </PanelShell>
  );
}

function GraficoMedia({
  dados,
  destacarUltima = false,
}: {
  dados: { rotulo: string; media: number }[];
  destacarUltima?: boolean;
}) {
  const altura = Math.max(120, dados.length * 56);
  return (
    <div style={{ width: "100%", height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#E2E8F0" />
          <XAxis
            type="number"
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fontSize: 12 }}
          />
          <YAxis type="category" dataKey="rotulo" width={220} tick={{ fontSize: 12 }} />
          <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={22}>
            {dados.map((item, indice) => (
              <Cell
                key={item.rotulo}
                fill={destacarUltima && indice === dados.length - 1 ? COR_MEDIA_GERAL : COR_BARRA}
              />
            ))}
            <LabelList
              dataKey="media"
              position="right"
              formatter={(v: number) => v.toLocaleString("pt-BR")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
