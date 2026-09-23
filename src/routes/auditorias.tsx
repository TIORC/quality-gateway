import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Plus } from "lucide-react";
import { useState } from "react";
import { NovaAuditoriaDialog } from "@/components/nova-auditoria-dialog";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { podeGerenciarConteudo } from "@/lib/permissoes";

export const Route = createFileRoute("/auditorias")({
  head: () => ({
    meta: [{ title: "Auditorias | Gestão da Qualidade" }],
  }),
  component: Auditorias,
});

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "planejadas", rotulo: "Planejadas" },
  { valor: "execucao", rotulo: "Em execução" },
  { valor: "concluidas", rotulo: "Concluídas" },
] as const;

interface SummaryCardProps {
  label: string;
  value: string;
  footer: string;
  accent: string;
  valueClass: string;
}

function SummaryCard({ label, value, footer, accent, valueClass }: SummaryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <p className={valueClass}>{value}</p>
      <p className="mt-2 text-[13px] text-[#64748B]">{footer}</p>
    </div>
  );
}

function Auditorias() {
  const catalogo = useCatalogoOrganizacional();
  const sessao = usePanelSession();
  const podeGerenciar = podeGerenciarConteudo(sessao);
  const [novaAuditoria, setNovaAuditoria] = useState(false);

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Auditorias da qualidade
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Cada não conformidade encontrada vira uma ocorrência com fluxo próprio, sem sair da
            auditoria.
          </p>
        </div>

        {podeGerenciar ? (
          <Button className="shrink-0" onClick={() => setNovaAuditoria(true)}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </Button>
        ) : null}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Auditorias no ano"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
          accent="#1F2937"
          footer="0 concluídas"
        />
        <SummaryCard
          label="Conformidade média"
          value="0%"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#4F46E5]"
          accent="#4F46E5"
          footer="requisitos conformes"
        />
        <SummaryCard
          label="Não conformidades"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#E11D48]"
          accent="#E11D48"
          footer="levantadas nas auditorias"
        />
        <SummaryCard
          label="Ocorrências abertas"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
          accent="#059669"
          footer="a partir de achados"
        />
      </section>

      <Tabs defaultValue="todas">
        <TabsList className="mt-6 flex-wrap">
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                0
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((aba) => (
          <TabsContent key={aba.valor} value={aba.valor}>
            <ListaAuditorias onNova={() => setNovaAuditoria(true)} podeGerenciar={podeGerenciar} />
          </TabsContent>
        ))}
      </Tabs>

      <NovaAuditoriaDialog
        aberto={novaAuditoria}
        unidades={catalogo.unidades}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setNovaAuditoria(false)}
      />
    </PanelShell>
  );
}

function ListaAuditorias({
  onNova,
  podeGerenciar,
}: {
  onNova: () => void;
  podeGerenciar: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <ClipboardCheck className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma auditoria aqui</h3>
        <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
          Programe a auditoria, monte o roteiro de verificação e registre os achados.
        </p>
        {podeGerenciar ? (
          <Button variant="outline" className="mt-5" onClick={onNova}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </Button>
        ) : null}
      </div>
    </div>
  );
}
