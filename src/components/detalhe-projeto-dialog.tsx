import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSession } from "@/lib/auth";
import { STATUS_ACAO_LABELS } from "@/lib/planos";
import type { PlanoAcao } from "@/lib/planos";
import { listarOrigens } from "@/lib/planos-base";
import { atualizarProjeto } from "@/lib/projetos-crud";
import type { ProjetoEstrategico, StatusProjeto } from "@/lib/projetos";
import { STATUS_PROJETO_COR, STATUS_PROJETO_LABELS, SWOT_CHAVES, SWOT_LABELS, dataISOparaBR, progressoDoProjeto } from "@/lib/projetos";
import { carregarAcoesDoProjeto } from "@/lib/projetos-base";
import { imprimirProjeto } from "@/lib/projetos-pdf";
import { imprimirKanban } from "@/lib/projetos-pdf-2";
import { ProjetoKanban } from "@/components/projeto-kanban";
import { NovoPlanoDialog } from "@/components/novo-plano-dialog";
import { DetalhePlanoDialog } from "@/components/detalhe-plano-dialog";
import { SugestoesIaDialog } from "@/components/sugestoes-ia-dialog";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { podeGerenciarConteudo } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projeto: ProjetoEstrategico;
  onFechar: () => void;
  onAlterado: (p: ProjetoEstrategico) => void;
}

export function DetalheProjetoDialog({ projeto, onFechar, onAlterado }: Props) {
  return (
    <Dialog open onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">{projeto.codigo} - {projeto.tipo}</span>
            <span className="mt-1.5 block text-lg font-semibold">{projeto.nome}</span>
          </DialogTitle>
        </DialogHeader>
        <Corpo projetoInicial={projeto} onAlterado={onAlterado} />
      </DialogContent>
    </Dialog>
  );
}
function Corpo({ projetoInicial, onAlterado }: { projetoInicial: ProjetoEstrategico; onAlterado: (p: ProjetoEstrategico) => void }) {
  const catalogo = useCatalogoOrganizacional();
  const sessao = getSession();
  const podeEditar = podeGerenciarConteudo(sessao);
  const [projeto, setProjeto] = useState(projetoInicial);
  const [acoes, setAcoes] = useState<PlanoAcao[]>(projetoInicial.acoes ?? []);
  const [carregando, setCarregando] = useState(true);
  const [origens, setOrigens] = useState<string[]>([]);
  const [novaAcaoAberta, setNovaAcaoAberta] = useState(false);
  const [acaoAberta, setAcaoAberta] = useState<PlanoAcao | null>(null);
  const [iaAberta, setIaAberta] = useState(false);
  const [status, setStatus] = useState<StatusProjeto>(projeto.status);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([carregarAcoesDoProjeto(projeto.id), listarOrigens().catch(() => [])])
      .then(([lista, listaOrigens]) => {
        if (!ativo) return;
        setAcoes(lista);
        setOrigens(listaOrigens.map((o) => o.nome));
      })
      .catch(() => undefined)
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [projeto.id]);

  const progresso = useMemo(() => progressoDoProjeto({ ...projeto, acoes }), [projeto, acoes]);

  function propagar(atual: ProjetoEstrategico) {
    setProjeto(atual);
    onAlterado({ ...atual, acoes });
  }

  async function trocarStatus(novo: StatusProjeto) {
    setStatus(novo);
    try {
      const atual = await atualizarProjeto(projeto, { status: novo }, sessao);
      propagar(atual);
      toast.success("Status atualizado para " + STATUS_PROJETO_LABELS[novo] + ".");
    } catch (e) {
      setStatus(projeto.status);
      toast.error(e instanceof Error ? e.message : "Nao foi possivel atualizar.");
    }
  }

  function recarregarAcoes() {
    carregarAcoesDoProjeto(projeto.id).then(setAcoes).catch(() => undefined);
  }
  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn(STATUS_PROJETO_COR[projeto.status], "text-[11px]")}>{STATUS_PROJETO_LABELS[status]}</Badge>
        <span className="text-[12px] text-[#64748B]">{projeto.setor || "—"} · {projeto.responsavelNome || "Sem responsável"}</span>
        <span className="text-[12px] font-semibold text-[#1F2937]">{progresso}%</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => imprimirProjeto(projeto, acoes)}>
            <Download className="h-3.5 w-3.5" /> Relatório PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => imprimirKanban(projeto, acoes)}>
            <Download className="h-3.5 w-3.5" /> Kanban PDF
          </Button>
          {podeEditar ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setIaAberta(true)}>
                <Sparkles className="h-3.5 w-3.5" /> Gerar ações por IA
              </Button>
              <Button size="sm" onClick={() => setNovaAcaoAberta(true)}>
                <Plus className="h-4 w-4" /> Nova ação
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E9EEF5] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Status</p>
          <Select value={status} onValueChange={(v) => void trocarStatus(v as StatusProjeto)}>
            <SelectTrigger className="mt-1 h-8 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_PROJETO_LABELS) as StatusProjeto[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_PROJETO_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-[#E9EEF5] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Objetivo</p>
          <p className="mt-1 line-clamp-3 text-[13px] text-[#1F2937]">{projeto.objetivo || "—"}</p>
        </div>
        <div className="rounded-xl border border-[#E9EEF5] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Período</p>
          <p className="mt-1 text-[13px] text-[#1F2937]">{dataISOparaBR(projeto.inicio) || "—"} → {dataISOparaBR(projeto.fimPrevisto) || "—"}</p>
        </div>
        <div className="rounded-xl border border-[#E9EEF5] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Ações</p>
          <p className="mt-1 text-[13px] text-[#1F2937]">{acoes.length} vinculada(s)</p>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="mt-4">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="swot">Matriz SWOT</TabsTrigger>
          <TabsTrigger value="frentes">Frentes ({projeto.frentes.length})</TabsTrigger>
          <TabsTrigger value="acoes">Ações ({acoes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-3">
          {carregando ? (
            <p className="py-8 text-center text-sm text-[#64748B]">Carregando ações…</p>
          ) : (
            <ProjetoKanban projeto={projeto} acoes={acoes} sessao={sessao} podeEditar={podeEditar}
              onAbrir={setAcaoAberta}
              onMudou={(atual) => {
                setAcoes((lista) => lista.map((x) => (x.id === atual.id ? atual : x)));
                onAlterado({ ...projeto, acoes: acoes.map((x) => (x.id === atual.id ? atual : x)) });
              }} />
          )}
        </TabsContent>
        <TabsContent value="frentes" className="mt-3">
          {projeto.frentes.length ? (
            <ul className="divide-y divide-[#EEF2F7] rounded-xl border border-[#E9EEF5]">
              {projeto.frentes.map((f) => (
                <li key={f.id} className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[#1F2937]">{f.nome}</p>
                  {f.descricao ? <p className="text-[12px] text-[#64748B]">{f.descricao}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-[#94A3B8]">Nenhuma frente cadastrada.</p>}
        </TabsContent>
        <TabsContent value="acoes" className="mt-3">
          {carregando ? (
            <p className="py-8 text-center text-sm text-[#64748B]">Carregando ações…</p>
          ) : acoes.length ? (
            <ul className="divide-y divide-[#EEF2F7] rounded-xl border border-[#E9EEF5]">
              {acoes.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setAcaoAberta(a)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#F8FAFC]">
                    <span className="font-mono text-[11px] text-[#94A3B8]">{a.codigo}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#1F2937]">{a.titulo}</span>
                    <span className="text-[12px] text-[#64748B]">{STATUS_ACAO_LABELS[a.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-[#94A3B8]">Nenhuma ação vinculada.</p>}
        </TabsContent>
      </Tabs>

      {novaAcaoAberta ? (
        <NovoPlanoDialog aberto setores={catalogo.setores} colaboradores={catalogo.colaboradores}
          origens={origens.length ? origens : ["Planejamento Estratégico"]}
          onFechar={() => setNovaAcaoAberta(false)}
          onCriado={() => { setNovaAcaoAberta(false); recarregarAcoes(); }} />
      ) : null}
      {acaoAberta ? (
        <DetalhePlanoDialog plano={acaoAberta} podeGerenciar={podeEditar}
          onFechar={() => setAcaoAberta(null)}
          onAlterado={(p) => { setAcoes((lista) => lista.map((x) => (x.id === p.id ? p : x))); setAcaoAberta(p); }}
          onExcluido={() => { const id = acaoAberta.id; setAcoes((lista) => lista.filter((x) => x.id !== id)); setAcaoAberta(null); }} />
      ) : null}
      {iaAberta ? (
        <SugestoesIaDialog aberto projeto={projeto} setores={catalogo.setores} colaboradores={catalogo.colaboradores}
          onFechar={() => setIaAberta(false)}
          onCriadas={() => { setIaAberta(false); recarregarAcoes(); }} />
      ) : null}
    </div>
  );
}

