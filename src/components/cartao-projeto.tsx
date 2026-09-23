import { useState } from "react";
import { usePanelSession } from "@/components/panel-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { DetalheProjetoDialog } from "@/components/detalhe-projeto-dialog";
import { PrioridadeDot } from "@/components/plano-badges";
import { excluirProjeto } from "@/lib/projetos-crud";
import type { ProjetoEstrategico } from "@/lib/projetos";
import { STATUS_PROJETO_COR, STATUS_PROJETO_LABELS, dataISOparaBR, progressoDoProjeto } from "@/lib/projetos";
import { podeGerenciarConteudo } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projeto: ProjetoEstrategico;
  onAlterado: (p: ProjetoEstrategico) => void;
  onExcluido: (id: string) => void;
}

/** Cartão do portfólio: status, andamento, prioridade + abrir detalhe/excluir. */
export function CartaoProjeto({ projeto, onAlterado, onExcluido }: Props) {
  const sessao = usePanelSession();
  const podeGerenciar = podeGerenciarConteudo(sessao);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const progresso = progressoDoProjeto(projeto);

  function excluir() {
    excluirProjeto(projeto.id)
      .then(() => {
        toast.success(`Projeto ${projeto.codigo} excluído.`);
        onExcluido(projeto.id);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."))
      .finally(() => setConfirmando(false));
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-[#94A3B8]">{projeto.codigo}</span>
        <Badge className={cn("text-[11px] font-semibold", STATUS_PROJETO_COR[projeto.status])}>
          {STATUS_PROJETO_LABELS[projeto.status]}
        </Badge>
        <span className="ml-auto"><PrioridadeDot prioridade={projeto.prioridade} /></span>
      </div>
      <button type="button" onClick={() => setDetalheAberto(true)} className="mt-2 text-left">
        <span className="block truncate text-[15px] font-bold text-[#1F2937] hover:underline">{projeto.nome}</span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] text-[#64748B]">{projeto.objetivo || "Sem objetivo descrito."}</span>
      </button>
      <div className="mt-3 flex items-center gap-2">
        <Progress value={progresso} className="h-1.5 flex-1" />
        <span className="font-mono text-[11px] text-slate-500">{progresso}%</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#64748B]">
        <span className="truncate">{projeto.responsavelNome || "Sem responsável"} · {projeto.setor || "—"}</span>
        <span className="shrink-0 font-mono">{projeto.frentes.length} frente(s)</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B]">
        <span>Fim previsto: {dataISOparaBR(projeto.fimPrevisto) || "—"}</span>
        <span>{projeto.tipo}</span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-[#F1F5F9] pt-3">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetalheAberto(true)}>
          Abrir quadro
        </Button>
        {podeGerenciar ? (
          <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setConfirmando(true)}>
            Excluir
          </Button>
        ) : null}
      </div>
      {detalheAberto ? (
        <DetalheProjetoDialog projeto={projeto}
          onFechar={() => setDetalheAberto(false)}
          onAlterado={onAlterado} />
      ) : null}
      <ConfirmarDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        tom="danger"
        titulo={`Excluir ${projeto.codigo}?`}
        descricao="As ações vinculadas permanecem nos Planos de Ação, mas perdem o vínculo visual do Kanban."
        textoConfirmar="Excluir projeto"
        onConfirmar={excluir} />
    </div>
  );
}

