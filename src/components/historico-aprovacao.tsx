import { History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSession } from "@/lib/auth";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import { cn } from "@/lib/utils";

/** Uma etapa do ciclo de vida do documento (publicação, aprovações, vigência). */
export interface EtapaHistorico {
  rotulo: string;
  /** Quem executou a etapa. */
  nome?: string;
  /** Quando: ISO (aaaa-mm-dd…) ou texto já formatado (ex.: dd/mm/aaaa). */
  data?: string | null;
  /** Se a etapa já aconteceu. Quando não, aparece como "Aguardando". */
  concluida: boolean;
}

function formatarData(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR");
}

/**
 * Tag "Histórico" que abre a linha do tempo de quem publicou, quem aprovou em
 * cada etapa e quando o documento entrou em vigor.
 */
export function HistoricoAprovacao({
  etapas,
  className,
}: {
  etapas: EtapaHistorico[];
  className?: string;
}) {
  // Colaborador (fora da Qualidade) não vê o histórico de aprovação.
  const sessao = getSession();
  if (sessao?.nivelAcesso === "Colaborador" && !ehUsuarioDaQualidade(sessao)) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(evento) => evento.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-[#D9E0EA] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A8A] transition hover:bg-[#EEF2F7]",
            className,
          )}
        >
          <History className="h-3 w-3" />
          Histórico
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4" onClick={(evento) => evento.stopPropagation()}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#1E293B]">
          Histórico do documento
        </p>
        <ol className="space-y-3">
          {etapas.map((etapa) => (
            <li key={etapa.rotulo} className="flex gap-3">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  etapa.concluida ? "bg-emerald-500" : "bg-slate-300",
                )}
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#1F2937]">{etapa.rotulo}</p>
                {etapa.concluida ? (
                  <p className="text-[12px] text-[#475569]">
                    {etapa.nome || "—"}
                    {etapa.data ? ` · ${formatarData(etapa.data)}` : ""}
                  </p>
                ) : (
                  <p className="text-[12px] italic text-[#94A3B8]">Aguardando</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
