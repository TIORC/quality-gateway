import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export interface ConfirmarDialogProps {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** "danger" (exclusão) | "warning" (alteração sensível) | "info" | "success" */
  tom?: "danger" | "warning" | "info" | "success";
  titulo: string;
  descricao?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  carregando?: boolean;
  onConfirmar: () => void;
}

const TONS = {
  danger: {
    icone: Trash2,
    corIcone: "bg-rose-50 text-rose-600 ring-rose-100",
    botao: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300",
    faixa: "bg-gradient-to-r from-rose-600 to-red-500",
  },
  warning: {
    icone: AlertTriangle,
    corIcone: "bg-amber-50 text-amber-600 ring-amber-100",
    botao: "bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-300",
    faixa: "bg-gradient-to-r from-amber-500 to-orange-400",
  },
  info: {
    icone: Info,
    corIcone: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    botao: "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-300",
    faixa: "bg-gradient-to-r from-indigo-600 to-violet-500",
  },
  success: {
    icone: CheckCircle2,
    corIcone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    botao: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300",
    faixa: "bg-gradient-to-r from-emerald-600 to-teal-500",
  },
} as const;

/**
 * Cartão de confirmação (alert) reutilizável: exclusão, alterações sensíveis,
 * conclusão de ação etc. Baseado no AlertDialog do Radix (foco preso, ESC,
 * clique fora fecha). Uso:
 *   <ConfirmarDialog open tom="danger" titulo="Excluir ação?" … />
 */
export function ConfirmarDialog({
  open, onOpenChange, tom = "info", titulo, descricao,
  textoConfirmar = "Confirmar", textoCancelar = "Cancelar", carregando, onConfirmar,
}: ConfirmarDialogProps) {
  const t = TONS[tom];
  const Icone = t.icone;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden rounded-2xl border-[#E9EEF5] p-0 shadow-2xl sm:rounded-2xl">
        <span className={cn("block h-1.5 w-full", t.faixa)} />
        <div className="p-6 pt-5">
          <AlertDialogHeader className="items-center space-y-3 text-center sm:items-start sm:text-left">
            <span className={cn("flex h-12 w-12 items-center justify-center rounded-full ring-8", t.corIcone)}>
              <Icone className="h-6 w-6" />
            </span>
            <AlertDialogTitle className="text-[17px] font-semibold text-[#1F2937]">
              {titulo}
            </AlertDialogTitle>
            {descricao ? (
              <AlertDialogDescription asChild>
                <div className="text-[13.5px] leading-relaxed text-[#64748B]">{descricao}</div>
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              disabled={carregando}
              className="rounded-xl border-[#D9E0EA] px-4 py-2 text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9]"
            >
              {textoCancelar}
            </AlertDialogCancel>
            <button
              type="button"
              disabled={carregando}
              onClick={onConfirmar}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                t.botao,
              )}
            >
              {carregando ? "Processando…" : textoConfirmar}
            </button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
