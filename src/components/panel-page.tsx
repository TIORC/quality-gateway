import { Construction } from "lucide-react";
import { PanelShell } from "@/components/panel-shell";

export interface PanelPageProps {
  title: string;
  description?: string;
}

export function PanelPage({ title, description }: PanelPageProps) {
  return (
    <PanelShell>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Construction className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Módulo em construção</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A área de <strong>{title}</strong> será liberada em breve para todos os usuários do
          sistema.
        </p>
      </div>
    </PanelShell>
  );
}
