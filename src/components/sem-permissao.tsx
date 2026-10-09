import { Lock } from "lucide-react";

/** Aviso de acesso restrito: cadeado + texto em vermelho. */
export function SemPermissao({ compacto = false }: { compacto?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold text-[#E11D48] ${compacto ? "text-[13px]" : "text-[15px]"}`}
    >
      <Lock className={compacto ? "h-3.5 w-3.5" : "h-4 w-4"} />
      Sem Permissão!
    </span>
  );
}
