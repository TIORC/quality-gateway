import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { LayoutGrid, Plus, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovoPlanoDialog } from "@/components/novo-plano-dialog";
import { DetalhePlanoDialog } from "@/components/detalhe-plano-dialog";
import { CartaoLista, TabelaPlanos } from "@/components/planos-visoes";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { getSession } from "@/lib/auth";
import { podeGerenciarConteudo } from "@/lib/permissoes";
import { PRIORIDADES_ACAO, STATUS_ACAO_LABELS } from "@/lib/planos";
import type { PlanoAcao, StatusAcao } from "@/lib/planos";
import { diasParaPrazo, planoAtrasado } from "@/lib/planos";
import { listarOrigens, listarPlanos } from "@/lib/planos-base";
import { ehResponsavel, ehSeguidor } from "@/lib/planos-inter";

const rotaPlanos = getRouteApi("/planos-de-acao");

export const Route = createFileRoute("/planos-de-acao")({
  validateSearch: (s: Record<string, unknown>) => ({
    abrir: typeof s["abrir"] === "string" ? (s["abrir"] as string) : undefined,
  }),
  head: () => ({ meta: [{ title: "Planos de Acao | Gestao da Qualidade" }] }),
  component: PlanosDeAcao,
});

interface Filtros {
  busca: string; origem: string; status: string;
  setor: string; prioridade: string; prazo: string;
}
const FILTROS_INICIAIS: Filtros = {
  busca: "", origem: "todas", status: "todos",
  setor: "todos", prioridade: "todas", prazo: "todos",
};
const ABAS = [
  { valor: "minhas", rotulo: "Minhas ações" },
  { valor: "acompanho", rotulo: "Acompanho" },
  { valor: "organizacao", rotulo: "Toda a organizacao" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];


function PlanosDeAcao() {
  const catalogo = useCatalogoOrganizacional();
  const sessaoCtx = usePanelSession();
  const sessao = getSession() ?? sessaoCtx;
  const podeGerenciar = podeGerenciarConteudo(sessao);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [aba, setAba] = useState<Aba>("minhas");
  const [vista, setVista] = useState<"lista" | "tabela">("lista");
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [origens, setOrigens] = useState<string[]>([]);
  const [novoPlanoAberto, setNovoPlanoAberto] = useState(false);
  const [planoAberto, setPlanoAberto] = useState<PlanoAcao | null>(null);
  const { abrir } = rotaPlanos.useSearch();

  function atualizarFiltro(campo: keyof Filtros, valor: string) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  async function recarregar() {
    setCarregando(true);
    setErro("");
    try {
      const [lista, listaOrigens] = await Promise.all([listarPlanos(), listarOrigens()]);
      setPlanos(lista);
      const nomes = listaOrigens.length > 0 ? listaOrigens.map((o) => o.nome) : [];
      const extras = lista.map((p) => p.origem).filter((o) => o && !nomes.includes(o));
      setOrigens([...nomes, ...extras]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      setPlanos([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void recarregar(); }, []);

  useEffect(() => {
    if (!abrir || planos.length === 0) return;
    const alvo = planos.find((p) => p.id === abrir);
    if (alvo) setPlanoAberto(alvo);
  }, [abrir, planos]);

  const contadores = useMemo(() => ({
    minhas: planos.filter((p) => ehResponsavel(p, sessao)).length,
    acompanho: planos.filter((p) => !ehResponsavel(p, sessao) && ehSeguidor(p, sessao)).length,
    organizacao: planos.length,
  }), [planos, sessao]);

  const filtrados = useMemo(
    () => filtrarPlanos(planos, filtros, aba, sessao),
    [planos, filtros, aba, sessao],
  );


  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Todas as ações
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Planos de ação
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Você edita o que é seu. O que acompanha como seguidor fica em leitura.
          </p>
        </div>

      <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-lg border border-[#D9E0EA] bg-white p-0.5">
            <button type="button" onClick={() => setVista("lista")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${vista === "lista" ? "bg-[#EEF2FF] text-[#4F46E5]" : "text-[#64748B]"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Lista
            </button>
            <button type="button" onClick={() => setVista("tabela")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${vista === "tabela" ? "bg-[#EEF2FF] text-[#4F46E5]" : "text-[#64748B]"}`}>
              <Table2 className="h-3.5 w-3.5" /> Tabela
            </button>
          </div>
          {podeGerenciar ? (
            <Button className="shrink-0" onClick={() => setNovoPlanoAberto(true)}>
              <Plus className="h-4 w-4" />
              Novo plano de ação
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList>
          {ABAS.map((item) => (
            <TabsTrigger key={item.valor} value={item.valor} className="gap-1.5">
              {item.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {item.valor === "minhas" ? contadores.minhas : item.valor === "acompanho" ? contadores.acompanho : contadores.organizacao}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((item) => (
          <TabsContent key={item.valor} value={item.valor}>
            <ListaAcoes
              filtros={filtros}
              setores={catalogo.setores}
              origens={origens}
              carregando={carregando}
              erro={erro}
              planos={filtrados}
              vista={vista}
              podeGerenciar={podeGerenciar}
              onFiltroChange={atualizarFiltro}
              onNovoPlano={() => setNovoPlanoAberto(true)}
              onAbrir={setPlanoAberto}
              onRecarregar={() => void recarregar()}
            />
          </TabsContent>
        ))}
      </Tabs>

      <NovoPlanoDialog
        aberto={novoPlanoAberto}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        origens={origens}
        onFechar={() => setNovoPlanoAberto(false)}
        onCriado={() => { setNovoPlanoAberto(false); void recarregar(); }}
      />
      {planoAberto ? (
        <DetalhePlanoDialog
          plano={planoAberto}
          podeGerenciar={podeGerenciar}
          onFechar={() => setPlanoAberto(null)}
          onAlterado={(p) => {
            setPlanos((atual) => atual.map((x) => (x.id === p.id ? p : x)));
            setPlanoAberto(p);
          }}
          onExcluido={() => {
            setPlanos((atual) => atual.filter((x) => x.id !== planoAberto.id));
            setPlanoAberto(null);
          }}
        />
      ) : null}
    </PanelShell>
  );
}

function filtrarPlanos(planos: PlanoAcao[], filtros: Filtros, aba: Aba, sessao: ReturnType<typeof getSession>): PlanoAcao[] {
  let lista = [...planos];
  if (aba === "minhas") lista = lista.filter((p) => ehResponsavel(p, sessao));
  if (aba === "acompanho") lista = lista.filter((p) => !ehResponsavel(p, sessao) && ehSeguidor(p, sessao));
  if (filtros.origem !== "todas") lista = lista.filter((p) => p.origem === filtros.origem);
  if (filtros.status !== "todos") {
    if (filtros.status === "atrasado") lista = lista.filter((p) => planoAtrasado(p));
    else lista = lista.filter((p) => p.status === filtros.status);
  }
  if (filtros.setor !== "todos") lista = lista.filter((p) => p.setor === filtros.setor);
  if (filtros.prioridade !== "todas") lista = lista.filter((p) => p.prioridade === filtros.prioridade);
  if (filtros.prazo !== "todos") {
    lista = lista.filter((p) => {
      const dias = diasParaPrazo(p.prazo);
      if (filtros.prazo === "sem-prazo") return dias === null;
      if (dias === null) return false;
      if (filtros.prazo === "atrasado") return dias < 0;
      if (filtros.prazo === "hoje") return dias === 0;
      if (filtros.prazo === "7dias") return dias >= 0 && dias <= 7;
      return true;
    });
  }
  const busca = filtros.busca.trim().toLowerCase();
  if (busca) {
    lista = lista.filter((p) =>
      `${p.titulo} ${p.codigo} ${p.descricao} ${p.responsavelNome} ${p.setor}`.toLowerCase().includes(busca),
    );
  }
  return lista.sort((a, b) => {
    const aa = planoAtrasado(a) ? 0 : 1;
    const bb = planoAtrasado(b) ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return (a.prazo ?? "9999") < (b.prazo ?? "9999") ? -1 : 1;
  });
}

interface ListaAcoesProps {
  filtros: Filtros;
  setores: string[];
  origens: string[];
  carregando: boolean;
  erro: string;
  planos: PlanoAcao[];
  vista: "lista" | "tabela";
  podeGerenciar: boolean;
  onFiltroChange: (campo: keyof Filtros, valor: string) => void;
  onNovoPlano: () => void;
  onAbrir: (plano: PlanoAcao) => void;
  onRecarregar: () => void;
}

function ListaAcoes(props: ListaAcoesProps) {
  const { filtros, setores, origens, carregando, erro, planos, vista } = props;
  const { onFiltroChange, onNovoPlano, onAbrir, onRecarregar, podeGerenciar } = props;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="grid gap-3 border-b border-[#E9EEF5] p-3 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input value={filtros.busca} onChange={(e) => onFiltroChange("busca", e.target.value)}
            placeholder="Buscar por título, código ou responsável" className="pl-9" />
        </div>
        <Select value={filtros.origem} onValueChange={(v) => onFiltroChange("origem", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.status} onValueChange={(v) => onFiltroChange("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_ACAO_LABELS) as StatusAcao[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_ACAO_LABELS[s]}</SelectItem>
            ))}
            <SelectItem value="atrasado">Em atraso (prazo vencido)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtros.setor} onValueChange={(v) => onFiltroChange("setor", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.prioridade} onValueChange={(v) => onFiltroChange("prioridade", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prioridades</SelectItem>
            {PRIORIDADES_ACAO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.prazo} onValueChange={(v) => onFiltroChange("prazo", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer prazo</SelectItem>
            <SelectItem value="atrasado">Em atraso</SelectItem>
            <SelectItem value="hoje">Vence hoje</SelectItem>
            <SelectItem value="7dias">Próximos 7 dias</SelectItem>
            <SelectItem value="sem-prazo">Sem prazo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {carregando ? (
        <p className="px-6 py-16 text-center text-sm text-[#94A3B8]">Carregando ações…</p>
      ) : erro ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-rose-600">{erro}</p>
          <Button variant="outline" className="mt-4" onClick={onRecarregar}>Tentar de novo</Button>
        </div>
      ) : planos.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <h3 className="text-base font-semibold text-[#1F2937]">Nenhuma ação encontrada</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Ajuste os filtros ou registre um novo plano de ação para começar.
          </p>
          {podeGerenciar ? (
            <Button variant="outline" className="mt-5" onClick={onNovoPlano}>
              <Plus className="h-4 w-4" /> Novo plano de ação
            </Button>
          ) : null}
        </div>
      ) : vista === "lista" ? (
        <CartaoLista planos={planos} onAbrir={onAbrir} />
      ) : (
        <TabelaPlanos planos={planos} onAbrir={onAbrir} />
      )}
    </div>
  );
}

