import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarraDestacada } from "@/components/barra-destacada";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CriarPesquisaDialog } from "@/components/pesquisas/criar-pesquisa-dialog";
import { GraficoNpsVelocimetro } from "@/components/pesquisas/grafico-nps-velocimetro";
import { GraficosPerguntas } from "@/components/pesquisas/graficos-perguntas";
import { RespostasPesquisa } from "@/components/pesquisas/respostas-pesquisa";
import { PanelShell } from "@/components/panel-shell";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apurarNps } from "@/lib/nps";
import {
  escreverRelatorio,
  htmlRelatorioCompleto,
  htmlRelatorioPesquisa,
  prepararJanelaRelatorio,
  type PesquisaComRespostas,
} from "@/lib/pesquisas-pdf";
import {
  chaveEmpresaDo,
  chaveNomeDo,
  empresaDaResposta,
  textoDaResposta,
  excluirModeloPesquisa,
  linkDaPesquisa,
  listarModelosPesquisa,
  listarRegistrosNps,
  listarRespostasDetalhadas,
  type ModeloPesquisa,
  type RegistroNps,
  type RespostaModelo,
} from "@/lib/pesquisas-modelos";
import {
  PERGUNTAS_NOTA,
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
// Valor do seletor de razão social e de pessoa que significa "todas".
const TODAS_EMPRESAS = "__todas__";
const TODAS_PESSOAS = "__todas_pessoas__";

// Simulação temporária do velocímetro com notas fixas. Remover depois de testar.
const SIMULACOES: Record<string, number[]> = {
  vazio: [],
  // Score −40: 6 detratores, 2 neutros e 2 promotores.
  critica: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // Score 25: 1 detrator, 13 neutros e 6 promotores.
  aperfeicoamento: [3, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8, 7, 8, 7, 9, 10, 9, 10, 9, 10],
  // Score 62,5: 1 detrator, 4 neutros e 11 promotores.
  qualidade: [0, 7, 8, 7, 8, ...Array.from({ length: 11 }, (_, indice) => (indice % 2 ? 10 : 9))],
  // Score 88: 1 detrator, 1 neutro e 23 promotores.
  excelencia: [5, 8, ...Array.from({ length: 23 }, (_, indice) => (indice % 2 ? 10 : 9))],
};

const OPCOES_SIMULACAO: { chave: string | null; rotulo: string }[] = [
  { chave: null, rotulo: "Dados reais" },
  { chave: "vazio", rotulo: "Sem dados" },
  { chave: "critica", rotulo: "Crítica" },
  { chave: "aperfeicoamento", rotulo: "Aperfeiçoamento" },
  { chave: "qualidade", rotulo: "Qualidade" },
  { chave: "excelencia", rotulo: "Excelência" },
];

function PesquisasDeSatisfacao() {
  const [pesquisas, setPesquisas] = useState<PesquisaSatisfacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criandoPesquisa, setCriandoPesquisa] = useState(false);
  const [modelos, setModelos] = useState<ModeloPesquisa[]>([]);
  const [modeloEditando, setModeloEditando] = useState<ModeloPesquisa | null>(null);
  // Pesquisa cujo link acabou de ser copiado (volta a null após um instante).
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);
  // Pesquisa cujas respostas estão abertas no próprio card.
  const [modeloAberto, setModeloAberto] = useState<string | null>(null);
  // Pesquisa aguardando confirmação de exclusão, e se a exclusão está em andamento.
  const [modeloParaExcluir, setModeloParaExcluir] = useState<ModeloPesquisa | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Notas NPS de todas as pesquisas, com a razão social de quem respondeu.
  const [registrosNps, setRegistrosNps] = useState<RegistroNps[]>([]);
  // Respostas de cada pesquisa criada, indexadas pelo id da pesquisa.
  const [respostasPorModelo, setRespostasPorModelo] = useState<Record<string, RespostaModelo[]>>({});
  // Razão social escolhida no filtro ("" = todas).
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  // Pessoa escolhida no filtro ("" = todas).
  const [pessoaFiltro, setPessoaFiltro] = useState("");
  // Simulação escolhida no seletor temporário (null = dados reais).
  const [simulacao, setSimulacao] = useState<string | null>(null);
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

  const carregarRegistrosNps = useCallback(async () => {
    try {
      setRegistrosNps(await listarRegistrosNps());
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível calcular o NPS geral.");
    }
  }, []);

  // Respostas de cada pesquisa criada, para os gráficos, as tabelas e o filtro por razão social.
  const carregarRespostas = useCallback(async (lista: ModeloPesquisa[]) => {
    try {
      const partes = await Promise.all(
        lista.map(async (modelo) => [modelo.id, await listarRespostasDetalhadas(modelo.id)] as const),
      );
      setRespostasPorModelo(Object.fromEntries(partes));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar as respostas.");
    }
  }, []);

  useEffect(() => {
    void carregar();
    void carregarModelos();
    void carregarRegistrosNps();
  }, [carregar, carregarModelos, carregarRegistrosNps]);

  useEffect(() => {
    void carregarRespostas(modelos);
  }, [modelos, carregarRespostas]);

  // Tudo abaixo respeita o filtro por razão social e por pessoa.
  const pesquisasFiltradas = useMemo(
    () =>
      pesquisas.filter(
        (p) =>
          (!empresaFiltro || p.empresa.trim() === empresaFiltro) &&
          (!pessoaFiltro || p.nomePessoa.trim() === pessoaFiltro),
      ),
    [pesquisas, empresaFiltro, pessoaFiltro],
  );
  const notasNps = useMemo(
    () =>
      registrosNps
        .filter(
          (r) =>
            (!empresaFiltro || r.empresa === empresaFiltro) &&
            (!pessoaFiltro || r.pessoa === pessoaFiltro),
        )
        .map((r) => r.nota),
    [registrosNps, empresaFiltro, pessoaFiltro],
  );
  // Nomes de quem respondeu, de todas as fontes, sem repetição, para o seletor de pessoa.
  const pessoas = useMemo(() => {
    const nomes = new Set<string>();
    for (const p of pesquisas) {
      if (p.nomePessoa.trim()) nomes.add(p.nomePessoa.trim());
    }
    for (const modelo of modelos) {
      const chave = chaveNomeDo(modelo.perguntas);
      for (const resposta of respostasPorModelo[modelo.id] ?? []) {
        const nome = textoDaResposta(resposta, chave);
        if (nome) nomes.add(nome);
      }
    }
    for (const registro of registrosNps) {
      if (registro.pessoa) nomes.add(registro.pessoa);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pesquisas, modelos, respostasPorModelo, registrosNps]);
  // Razões sociais de todas as fontes, sem repetição, para o seletor.
  const empresas = useMemo(() => {
    const nomes = new Set<string>();
    for (const p of pesquisas) {
      if (p.empresa.trim()) nomes.add(p.empresa.trim());
    }
    for (const modelo of modelos) {
      const chave = chaveEmpresaDo(modelo.perguntas);
      for (const resposta of respostasPorModelo[modelo.id] ?? []) {
        const nome = empresaDaResposta(resposta, chave);
        if (nome) nomes.add(nome);
      }
    }
    for (const registro of registrosNps) {
      if (registro.empresa) nomes.add(registro.empresa);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pesquisas, modelos, respostasPorModelo, registrosNps]);

  /** Respostas de uma pesquisa criada, filtradas pela razão social e pela pessoa. */
  function respostasDaPesquisa(modelo: ModeloPesquisa): RespostaModelo[] {
    const todas = respostasPorModelo[modelo.id] ?? [];
    if (!empresaFiltro && !pessoaFiltro) return todas;
    const chaveEmpresa = chaveEmpresaDo(modelo.perguntas);
    const chaveNome = chaveNomeDo(modelo.perguntas);
    return todas.filter(
      (resposta) =>
        (!empresaFiltro || empresaDaResposta(resposta, chaveEmpresa) === empresaFiltro) &&
        (!pessoaFiltro || textoDaResposta(resposta, chaveNome) === pessoaFiltro),
    );
  }

  // Com filtro de razão social ou pessoa, só aparecem as pesquisas com respostas dela.
  const modelosVisiveis =
    empresaFiltro || pessoaFiltro
      ? modelos.filter((modelo) => respostasDaPesquisa(modelo).length > 0)
      : modelos;

  const medias = useMemo(() => mediaPorPergunta(pesquisasFiltradas), [pesquisasFiltradas]);
  const geral = useMemo(() => mediaGeral(pesquisasFiltradas), [pesquisasFiltradas]);
  const atendimento = medias[0] ?? { rotulo: "", media: 0 };
  const demais = medias.slice(1);
  // As perguntas além do atendimento ainda não estão no formulário público.
  const temDemais = demais.some((m) => m.media > 0);
  const dadosGeral = [
    ...medias.map((m) => ({ rotulo: m.rotulo, media: m.media })),
    { rotulo: "Média Geral", media: geral },
  ];

  async function excluirModelo() {
    if (!modeloParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirModeloPesquisa(modeloParaExcluir.id);
      toast.success("Pesquisa excluída.");
      if (modeloAberto === modeloParaExcluir.id) setModeloAberto(null);
      setModeloParaExcluir(null);
      void carregarModelos();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir a pesquisa.");
    } finally {
      setExcluindo(false);
    }
  }

  function exportarPdf(alvo: ModeloPesquisa | null) {
    // A janela abre já no clique, para o navegador não bloquear o pop-up.
    const janela = prepararJanelaRelatorio();
    if (!janela) {
      toast.error("Libere pop-ups para exportar o PDF.");
      return;
    }
    try {
      const criadas: PesquisaComRespostas[] = (alvo ? [alvo] : modelos).map((modelo) => ({
        modelo,
        respostas: respostasDaPesquisa(modelo),
      }));
      const filtros = {
        empresa: empresaFiltro || undefined,
        busca: pessoaFiltro || undefined,
      };
      if (alvo) {
        const unica = criadas[0];
        if (!unica) throw new Error("Pesquisa não encontrada.");
        escreverRelatorio(janela, htmlRelatorioPesquisa(unica, filtros));
      } else {
        escreverRelatorio(
          janela,
          htmlRelatorioCompleto({ pesquisas: pesquisasFiltradas, notasNps, ...filtros }, criadas),
        );
      }
    } catch (erro) {
      janela.close();
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gerar o PDF.");
    }
  }

  async function copiarLink(id: string) {
    try {
      await navigator.clipboard.writeText(linkDaPesquisa(id));
      setLinkCopiadoId(id);
      setTimeout(() => setLinkCopiadoId((atual) => (atual === id ? null : atual)), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  function exportarExcel() {
    const linhas = pesquisasFiltradas.map((p) => {
      const linha: Record<string, string | number | null> = {
        "Carimbo de data/hora": new Date(p.criadoEm).toLocaleString("pt-BR"),
        "Nome da Empresa": p.empresa,
        "Respondido por": p.nomePessoa,
        "Sou atendido pela unidade": p.unidade,
      };
      PERGUNTAS_NOTA.forEach((pergunta, indice) => {
        linha[`${indice + 1} - ${pergunta.pergunta}`] = p[pergunta.chave];
      });
      linha["6 - Que sugestão você nos recomenda para melhorar ainda mais?"] = p.sugestao;
      return linha;
    });
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, planilha, "Form_Responses");
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
            {pesquisasFiltradas.length}{" "}
            {pesquisasFiltradas.length === 1 ? "resposta" : "respostas"} recebidas
            {empresaFiltro ? ` de ${empresaFiltro}` : ""}. Notas
            de 1 (abaixo do esperado) a 10 (excelente).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void carregar();
              void carregarModelos();
              void carregarRegistrosNps();
            }}
            disabled={carregando}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={exportarExcel} disabled={pesquisasFiltradas.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => void exportarPdf(null)}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
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

      {/* Filtro por razão social: vale para o formulário, as pesquisas criadas e o NPS geral. */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <span className="text-sm font-semibold text-[#0F172A]">Razão social</span>
        <Select
          value={empresaFiltro || TODAS_EMPRESAS}
          onValueChange={(valor) => setEmpresaFiltro(valor === TODAS_EMPRESAS ? "" : valor)}
        >
          <SelectTrigger className="w-[320px] max-w-full">
            <SelectValue placeholder="Todas as razões sociais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_EMPRESAS}>Todas as razões sociais</SelectItem>
            {empresas.map((nome) => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-semibold text-[#0F172A]">Pessoa</span>
        <Select
          value={pessoaFiltro || TODAS_PESSOAS}
          onValueChange={(valor) => setPessoaFiltro(valor === TODAS_PESSOAS ? "" : valor)}
        >
          <SelectTrigger className="w-[260px] max-w-full">
            <SelectValue placeholder="Todas as pessoas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_PESSOAS}>Todas as pessoas</SelectItem>
            {pessoas.map((nome) => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(empresaFiltro || pessoaFiltro) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEmpresaFiltro("");
              setPessoaFiltro("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {modelosVisiveis.length > 0 && (
        <section className="mb-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-[#0F172A]">Pesquisas criadas</h2>
          <ul className="divide-y divide-[#E2E8F0]">
            {modelosVisiveis.map((modelo) => {
              const aberto = modeloAberto === modelo.id;
              return (
                <li key={modelo.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-expanded={aberto}
                      onClick={() => setModeloAberto(aberto ? null : modelo.id)}
                      className="flex min-w-0 items-center gap-2 text-left"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${aberto ? "rotate-180" : ""}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#0F172A]">
                          {modelo.titulo}
                        </span>
                        <span className="block text-xs text-[#64748B]">
                          {modelo.perguntas.length}{" "}
                          {modelo.perguntas.length === 1 ? "pergunta" : "perguntas"}
                          {" · criada em "}
                          {new Date(modelo.criadoEm).toLocaleDateString("pt-BR")}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copiarLink(modelo.id)}
                        className={
                          linkCopiadoId === modelo.id
                            ? "border-[#16A34A] text-[#16A34A] hover:text-[#16A34A]"
                            : undefined
                        }
                      >
                        {linkCopiadoId === modelo.id ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {linkCopiadoId === modelo.id ? "Link Copiado" : "Copiar link"}
                      </Button>
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
                      {podeGerenciar && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModeloParaExcluir(modelo)}
                          className="text-[#DC2626] hover:text-[#DC2626]"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => void exportarPdf(modelo)}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  {aberto && (
                    <div className="mt-4 grid gap-6">
                      <GraficosPerguntas modelo={modelo} respostas={respostasDaPesquisa(modelo)} />
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Respostas</h3>
                        <RespostasPesquisa modelo={modelo} respostas={respostasDaPesquisa(modelo)} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pesquisasFiltradas.length > 0 && (
        <div className="mt-6 grid gap-6">
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-1 text-base font-semibold text-[#0F172A]">{atendimento.rotulo}</h2>
            <p className="mb-3 text-xs text-[#64748B]">
              Como você avalia o nosso atendimento? (1 a 10)
            </p>
            <GraficoMedia dados={[{ rotulo: "Atendimento", media: atendimento.media }]} />
          </section>

          {temDemais && (
            <>
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
            </>
          )}
        </div>
      )}

      <section className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-[#0F172A]">NPS geral</h2>
        <p className="mb-3 text-xs text-[#64748B]">
          Soma das respostas de todas as perguntas NPS das pesquisas criadas.
        </p>
        {/* Seletor temporário para testar as condições do velocímetro. Remover depois. */}
        <div className="mb-3 rounded-lg border border-dashed border-[#F59E0B] bg-[#FFFBEB] p-3">
          <p className="mb-2 text-xs font-semibold text-[#92400E]">
            Simulações para teste: os valores são fictícios, não são dados reais.
          </p>
          <div className="flex flex-wrap gap-2">
          {OPCOES_SIMULACAO.map((opcao) => (
            <Button
              key={opcao.rotulo}
              size="sm"
              variant={simulacao === opcao.chave ? "default" : "outline"}
              onClick={() => setSimulacao(opcao.chave)}
            >
              {opcao.rotulo}
            </Button>
          ))}
          </div>
        </div>
        <GraficoNpsVelocimetro
          apuracao={apurarNps(simulacao ? (SIMULACOES[simulacao] ?? []) : notasNps)}
        />
      </section>
      <AlertDialog
        open={modeloParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setModeloParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pesquisa?</AlertDialogTitle>
            <AlertDialogDescription>
              “{modeloParaExcluir?.titulo}” e todas as respostas dela serão apagadas. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(evento) => {
                // Mantém o diálogo aberto até a exclusão terminar.
                evento.preventDefault();
                void excluirModelo();
              }}
              className="bg-[#DC2626] hover:bg-[#B91C1C]"
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <Tooltip
            cursor={{ fill: "#2563EB", fillOpacity: 0.06 }}
            formatter={(valor) => [Number(valor).toLocaleString("pt-BR"), "Média"]}
          />
          <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={22} activeBar={<BarraDestacada />}>
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
