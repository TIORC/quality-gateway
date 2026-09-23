import { useState } from "react";
import { PrazoBadge, PrioridadeDot, StatusBadge } from "@/components/plano-badges";
import { Button } from "@/components/ui/button";
import { atualizarPlano } from "@/lib/planos-crud";
import type { PlanoAcao, StatusAcao } from "@/lib/planos";
import { STATUS_ACAO_LABELS } from "@/lib/planos";
import type { ProjetoEstrategico } from "@/lib/projetos";
import type { UserSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  projeto: ProjetoEstrategico;
  acoes: PlanoAcao[];
  sessao: UserSession | null;
  podeEditar: boolean;
  onAbrir: (p: PlanoAcao) => void;
  onMudou: (p: PlanoAcao) => void;
}

const STATUS_POR_COLUNA_FALLBACK: Record<string, StatusAcao[]> = {
  afazer: ["nao_iniciado", "aberta"],
  andamento: ["em_andamento", "atrasada"],
  concluido: ["concluida", "cancelado"],
};

/** Kanban das ações do projeto (drag-and-drop nativo HTML5). */
export function ProjetoKanban({ projeto, acoes, sessao, podeEditar, onAbrir, onMudou }: Props) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  function acoesDaColuna(colunaId: string): PlanoAcao[] {
    const col = projeto.kanbanColunas.find((c) => c.id === colunaId);
    const lista = col?.status?.length ? col.status : (STATUS_POR_COLUNA_FALLBACK[colunaId] ?? []);
    return acoes.filter((a) => lista.includes(a.status));
  }

  async function mover(acao: PlanoAcao, colunaId: string) {
    const col = projeto.kanbanColunas.find((c) => c.id === colunaId);
    const destino = (col?.status?.[0] ?? STATUS_POR_COLUNA_FALLBACK[colunaId]?.[0]) as StatusAcao | undefined;
    if (!destino || destino === acao.status) return;
    const anterior = acao.status;
    onMudou({ ...acao, status: destino });
    try {
      const atualizado = await atualizarPlano(acao, { status: destino }, sessao);
      onMudou(atualizado);
      toast.success(`Ação movida para ${STATUS_ACAO_LABELS[destino]}.`);
    } catch (e) {
      onMudou({ ...acao, status: anterior });
      toast.error(e instanceof Error ? e.message : "Não foi possível mover.");
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {projeto.kanbanColunas.map((col) => {
        const cartoes = acoesDaColuna(col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => { if (podeEditar) { e.preventDefault(); setSobre(col.id); } }}
            onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const id = e.dataTransfer.getData("text/plano-id");
              const acao = acoes.find((a) => a.id === id);
              if (acao && podeEditar) void mover(acao, col.id);
            }}
            className={cn(
              "flex min-h-[220px] flex-col rounded-xl border bg-[#F8FAFC] p-2.5 transition",
              sobre === col.id ? "border-[#1E3A8A] ring-2 ring-[#1E3A8A]/20" : "border-[#E9EEF5]",
            )}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#475569]">{col.nome}</span>
              <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#64748B] shadow-sm">{cartoes.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {cartoes.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onAbrir(a)}
                  onKeyDown={(e) => { if (e.key === "Enter") onAbrir(a); }}
                  draggable={podeEditar}
                  onDragStart={(e) => { setArrastando(a.id); e.dataTransfer.setData("text/plano-id", a.id); }}
                  onDragEnd={() => { setArrastando(null); setSobre(null); }}
                  className={cn(
                    "cursor-pointer rounded-lg border border-[#E9EEF5] bg-white p-3 shadow-sm transition hover:shadow",
                    arrastando === a.id && "opacity-50",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={a.status} />
                    <PrazoBadge plano={a} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-[#1F2937]">{a.titulo}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#64748B]">
                    <span className="truncate">{a.responsavelNome || "Sem responsável"}</span>
                    <PrioridadeDot prioridade={a.prioridade} />
                  </div>
                </div>
              ))}
              {cartoes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#D9E0EA] px-3 py-6 text-center text-[12px] text-[#94A3B8]">
                  Arraste ações para cá
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
