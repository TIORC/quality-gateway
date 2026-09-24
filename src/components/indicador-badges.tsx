import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import {
  STATUS_APURACAO_LABELS,
  type StatusApuracao,
  type Variacao,
} from "@/lib/indicadores";
import { cn } from "@/lib/utils";

/**
 * Tons dos selos do módulo de indicadores.
 *
 * As cores ficam no CSS (`.indicadores-page [data-pill=...]`) para valerem nos
 * temas claro e escuro sem duplicar classes utilitárias.
 */
export type TomPill = "sucesso" | "perigo" | "atencao" | "neutro" | "info";

export function Pill({
  tom,
  children,
  className,
  title,
}: {
  tom: TomPill;
  children: ReactNode;
  className?: string | undefined;
  title?: string | undefined;
}) {
  return (
    <span
      data-pill={tom}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

const TOM_STATUS: Record<StatusApuracao, TomPill> = {
  pendente: "neutro",
  dentro_da_meta: "sucesso",
  abaixo_da_meta: "perigo",
};

/** Selo do status da apuração (Pendente / Dentro da meta / Abaixo da meta). */
export function StatusApuracaoBadge({
  status,
  fechado,
}: {
  status: StatusApuracao;
  fechado?: boolean | undefined;
}) {
  return (
    <Pill tom={TOM_STATUS[status]} title={fechado ? "Mês fechado" : undefined}>
      {STATUS_APURACAO_LABELS[status]}
      {fechado ? " · fechado" : ""}
    </Pill>
  );
}

/** Selo de apuração atrasada (mês anterior sem lançamento após o dia limite). */
export function SeloAtraso({ mes }: { mes: string }) {
  return (
    <Pill tom="atencao" title={`Sem lançamento desde ${mes}`}>
      <AlertTriangle className="h-3 w-3" />
      Apuração atrasada
    </Pill>
  );
}

/** Selo de indicador calculado a partir de outro módulo do portal. */
export function SeloAutomatico() {
  return (
    <Pill tom="info" title="Valor sugerido automaticamente a partir de outro módulo">
      <Sparkles className="h-3 w-3" />
      Automático
    </Pill>
  );
}

/**
 * Variação contra o mês anterior: seta + percentual, colorida pela direção
 * favorável ao sentido do indicador (para `menor_melhor`, queda é melhora).
 */
export function VariacaoIndicador({
  variacao,
  absoluta,
}: {
  variacao: Variacao | null;
  /** Texto da diferença absoluta já formatado (unidade do indicador). */
  absoluta: string;
}) {
  if (!variacao) {
    return <span className="text-[12px] text-[#94A3B8]">Sem base de comparação</span>;
  }
  if (!variacao.mudou) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#64748B]">
        <Minus className="h-3.5 w-3.5" />
        Estável vs. mês anterior
      </span>
    );
  }
  const Seta = variacao.absoluta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] font-semibold",
        variacao.melhorou ? "text-[#059669]" : "text-[#E11D48]",
      )}
      title={`${variacao.melhorou ? "Melhora" : "Piora"} de ${absoluta} vs. mês anterior`}
    >
      <Seta className="h-3.5 w-3.5" />
      {variacao.percentual === null ? "—" : `${variacao.percentual > 0 ? "+" : ""}${variacao.percentual}%`}
      <span className="font-normal text-[#64748B]">({absoluta})</span>
    </span>
  );
}
