import { format, addDays, isAfter } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export type SlaStatus = "no_prazo" | "critico" | "atrasado" | "concluido";

export interface SlaInfo {
  status: SlaStatus;
  atrasado: boolean;
  critical: boolean;
  label: string;
  dataLimite?: string;
}

/** Converte uma data-limite em informações de SLA. */
export function calcularSla(dataLimite?: string | null): SlaInfo {
  const hoje = new Date();
  if (!dataLimite) {
    return { status: "no_prazo", atrasado: false, critical: false, label: "Sem prazo" };
  }
  const limite = new Date(dataLimite);
  const diff = limite.getTime() - hoje.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return { status: "atrasado", atrasado: true, critical: true, label: `Atrasado há ${Math.abs(dias)} dia(s)`, dataLimite };
  }
  if (dias <= 1) {
    return { status: "critico", atrasado: false, critical: true, label: `Vence hoje${dias === 0 ? "" : ` / faltam ${dias} dia(s)`}`, dataLimite };
  }
  return { status: "no_prazo", atrasado: false, critical: false, label: `Faltam ${dias} dia(s)`, dataLimite };
}

export const FormatadorSla = {
  calcular(macro: string, dataLimite?: string | null): SlaInfo {
    return calcularSla(dataLimite);
  },
  formatarData(data?: string): string {
    if (!data) return "—";
    return format(new Date(data), "dd/MM/yyyy");
  },
  Icone({ sla }: { sla: SlaInfo }) {
    if (sla.atrasado) return <AlertTriangle className="h-4 w-4 text-[#E11D48]" />;
    if (sla.critical) return <Clock className="h-4 w-4 text-[#D97706]" />;
    return <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />;
  },
};
