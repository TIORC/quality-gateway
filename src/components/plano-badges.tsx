import { STATUS_ACAO_LABELS, diasParaPrazo, planoAtrasado, type PlanoAcao } from "@/lib/planos";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const STATUS_CLS: Record<string, string> = {
  nao_iniciado: "bg-slate-100 text-slate-600",
  aberta: "bg-indigo-100 text-indigo-700",
  em_andamento: "bg-amber-100 text-amber-800",
  concluida: "bg-emerald-100 text-emerald-700",
  atrasada: "bg-rose-100 text-rose-700",
  cancelado: "bg-slate-200 text-slate-500 line-through",
};

const PRIO_CLS: Record<string, string> = {
  "Crítica": "bg-rose-600", Alta: "bg-amber-500", "Média": "bg-sky-500", Baixa: "bg-slate-400",
};

export function StatusBadge({ status }: { status: PlanoAcao["status"] }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_CLS[status])}>
      {STATUS_ACAO_LABELS[status]}
    </span>
  );
}

export function PrioridadeDot({ prioridade, titulo }: { prioridade: string; titulo?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569]" title={titulo ?? prioridade}>
      <span className={cn("h-2.5 w-2.5 rounded-full", PRIO_CLS[prioridade] ?? "bg-slate-400")} />
      {prioridade}
    </span>
  );
}

export function PrazoBadge({ plano }: { plano: PlanoAcao }) {
  const dias = diasParaPrazo(plano.prazo);
  if (dias === null) return <span className="text-[12px] text-[#94A3B8]">Sem prazo</span>;
  const atrasado = planoAtrasado(plano);
  const txt = dias < 0 ? `${Math.abs(dias)}d em atraso`
    : dias === 0 ? "Vence hoje" : `em ${dias}d`;
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
      atrasado ? "bg-rose-50 text-rose-700" : dias <= 5 ? "bg-amber-50 text-amber-700" : "text-slate-500",
    )}>
      {txt}
    </span>
  );
}

export function ProgressoBar({ valor }: { valor: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={valor} className="h-1.5 flex-1" />
      <span className="font-mono text-[11px] text-slate-500">{valor}%</span>
    </div>
  );
}
