import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { podeGerenciarPesquisas } from "@/lib/permissoes";

export const Route = createFileRoute("/pesquisas-de-satisfacao")({
  head: () => ({
    meta: [{ title: "Pesquisas de Satisfação | Gestão da Qualidade" }],
  }),
  component: PesquisasDeSatisfacao,
});

// Valor do seletor de razão social e de pessoa que significa "todas".
const TODAS_EMPRESAS = "__todas__";
const TODAS_PESSOAS = "__todas_pessoas__";

function PesquisasDeSatisfacao() {
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
  // `usePanelSession` só funciona dentro do PanelShell, que é o pai desta página;
  // por isso lemos a sessão em cache diretamente.
  const sessao = getSession();
  const podeGerenciar = podeGerenciarPesquisas(sessao);

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
    void carregarModelos();
    void carregarRegistrosNps();
  }, [carregarModelos, carregarRegistrosNps]);

  useEffect(() => {
    void carregarRespostas(modelos);
  }, [modelos, carregarRespostas]);

  // Tudo abaixo respeita o filtro por razão social e por pessoa.
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
  }, [modelos, respostasPorModelo, registrosNps]);
  // Razões sociais de todas as fontes, sem repetição, para o seletor.
  const empresas = useMemo(() => {
    const nomes = new Set<string>();
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
  }, [modelos, respostasPorModelo, registrosNps]);

  // Total de respostas das pesquisas criadas, com os filtros aplicados.
  const totalRespostas = modelos.reduce(
    (total, modelo) => total + respostasDaPesquisa(modelo).length,
    0,
  );

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
        escreverRelatorio(janela, htmlRelatorioCompleto({ notasNps, ...filtros }, criadas));
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

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Gestão
          </p>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Pesquisas de Satisfação</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {totalRespostas} {totalRespostas === 1 ? "resposta" : "respostas"} recebidas
            {empresaFiltro ? ` de ${empresaFiltro}` : ""}. Notas
            de 1 (abaixo do esperado) a 10 (excelente).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void carregarModelos();
              void carregarRegistrosNps();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
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

      {/* Filtro por razão social e pessoa: vale para as pesquisas criadas e o NPS geral. */}
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

      <section className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-[#0F172A]">NPS geral</h2>
        <p className="mb-3 text-xs text-[#64748B]">
          Soma das respostas de todas as perguntas NPS das pesquisas criadas.
        </p>
        <GraficoNpsVelocimetro apuracao={apurarNps(notasNps)} />
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
