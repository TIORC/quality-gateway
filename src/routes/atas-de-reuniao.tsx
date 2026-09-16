import { createFileRoute } from "@tanstack/react-router";
import { Archive, BarChart3, Building2, CalendarClock, FileText, Plus } from "lucide-react";
import { PanelShell } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/atas-de-reuniao")({
  head: () => ({
    meta: [{ title: "Atas de Reunião | Gestão da Qualidade" }],
  }),
  component: AtasDeReuniao,
});

const RESUMOS = [
  { rotulo: "Ata simples", icone: FileText },
  { rotulo: "Atas do sistema", icone: Building2 },
  { rotulo: "Arquivo anterior", icone: Archive },
  { rotulo: "Próximas reuniões", icone: CalendarClock },
] as const;

function AtasDeReuniao() {
  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Reuniões e desdobramentos
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Atas de reunião
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            A ata entra uma vez. As ações saem dela já endereçadas, com o item de origem preservado.
          </p>
        </div>

        <Button className="shrink-0">
          <Plus className="h-4 w-4" />
          Nova ata
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RESUMOS.map((resumo) => {
          const Icone = resumo.icone;
          return (
            <div
              key={resumo.rotulo}
              className="flex items-center gap-4 rounded-xl border border-[#D9E0EA] bg-white p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF2F7]">
                <Icone className="h-5 w-5 text-[#64748B]" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  {resumo.rotulo}
                </p>
                <p className="mt-1 text-[26px] font-semibold leading-none text-[#1F2937]">0</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E9EEF5] px-5 py-4">
          <BarChart3 className="h-4 w-4 text-[#64748B]" />
          <h3 className="text-[14px] font-semibold text-[#1F2937]">Indicadores</h3>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <BarChart3 className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
            Nenhum tipo de reunião cadastrado
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Para abrir uma nova ata é preciso antes cadastrar os tipos de reunião (nome,
            periodicidade, participantes e quem assina) nas configurações / agenda.
          </p>
          <Button
            variant="link"
            className="mt-5 h-auto p-0 text-[13px] font-medium text-[#1E3A8A] hover:text-[#1E40AF]"
          >
            Ir para as atas do sistema
          </Button>
        </div>
      </section>
    </PanelShell>
  );
}
