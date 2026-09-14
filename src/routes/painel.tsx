import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [{ title: "Painel | Gestão da Qualidade" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Painel,
});

const DATA = {
  nome: "Gabriel Anacleto",
  cargo: "Desenvolvedor de Software JR",
  iniciais: "GA",
  data: "segunda-feira, 14 de setembro de 2026",
};

interface SummaryCardProps {
  label: string;
  value: string;
  valueClass: string;
  accent: string;
  footer: ReactNode;
}

function SummaryCard({ label, value, valueClass, accent, footer }: SummaryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <p className={cn("mt-3 text-[30px] font-semibold leading-none", valueClass)}>{value}</p>
      <p className="mt-2 text-[13px] text-[#64748B]">{footer}</p>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  className?: string;
  children: ReactNode;
}

function ChartCard({ title, className, children }: ChartCardProps) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-[#D9E0EA] bg-white", className)}>
      <p className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {title}
      </p>
      <div className="relative min-h-[220px] flex-1 px-5 pb-5 pt-4">{children}</div>
    </div>
  );
}

function AxesFrame({ right }: { right?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 border-b border-l border-[#D9E0EA]",
        right && "border-r border-[#E7EBF2]",
      )}
    />
  );
}

function Painel() {
  const router = useRouter();
  const session = usePanelSession();
  const [menuAberto, setMenuAberto] = useState(false);

  function handleLogout() {
    logout();
    router.navigate({ to: "/", replace: true });
  }

  return (
    <PanelShell wide>
      <header className="flex h-14 items-center justify-between border-b border-[#D9E0EA]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
          Painel
        </span>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-[13px] text-[#64748B] lg:block">{DATA.data}</span>

          <button
            type="button"
            aria-label="Notificações"
            className="rounded-md p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1F2937]"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>

          <span className="hidden h-5 w-px bg-[#D9E0EA] sm:block" />

          <div className="relative">
            <button
              type="button"
              aria-label="Menu do usuário"
              onClick={() => setMenuAberto((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-[#F1F5F9]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#312E81] text-[12px] font-semibold text-white">
                {DATA.iniciais}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-semibold leading-tight text-[#1F2937]">
                  {DATA.nome}
                </span>
                <span className="block text-[11px] leading-tight text-[#64748B]">{DATA.cargo}</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[#64748B] transition-transform",
                  menuAberto && "rotate-180",
                )}
              />
            </button>

            {menuAberto ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[#D9E0EA] bg-white p-1.5 shadow-lg">
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-[#1F2937]">{DATA.nome}</p>
                    <p className="text-xs text-[#64748B]">{DATA.cargo}</p>
                    <p className="mt-1 truncate text-[11px] text-[#94A3B8]">{session?.email}</p>
                  </div>
                  <div className="mx-2 my-1 h-px bg-[#E9EEF5]" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#E11D48]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="w-full pt-5">
        {/* Cabeçalho do dashboard */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Qualidade · Desenvolvedor de Software JR
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Bom dia, Gabriel.
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Você acompanha 0 planos de ação de 0 setores.
          </p>
        </div>

        {/* Cards de resumo */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Ações na organização"
            value="0"
            valueClass="text-[#1F2937]"
            accent="#1F2937"
            footer={
              <span>
                <span className="font-semibold text-[#1F2937]">0</span> em aberto
              </span>
            }
          />
          <SummaryCard
            label="Em atraso"
            value="0"
            valueClass="text-[#E11D48]"
            accent="#E11D48"
            footer="prazo vencido"
          />
          <SummaryCard
            label="Concluídas"
            value="0"
            valueClass="text-[#059669]"
            accent="#059669"
            footer="no período"
          />
          <SummaryCard
            label="Taxa de conclusão"
            value="0%"
            valueClass="text-[#4F46E5]"
            accent="#4F46E5"
            footer="do total atribuído"
          />
        </section>

        {/* Seção de gráficos */}
        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Distribuição por status" className="lg:col-span-1">
            <div className="absolute inset-0" />
          </ChartCard>

          <ChartCard title="Origem das ações" className="lg:col-span-2">
            <AxesFrame right />
          </ChartCard>
        </section>

        {/* Seção inferior */}
        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-[#D9E0EA] bg-white lg:col-span-2">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-[14px] font-semibold text-[#1F2937]">Próximos vencimentos</h3>
              <button
                type="button"
                className="text-[13px] font-medium text-[#64748B] transition hover:text-[#1F2937]"
              >
                ver todos →
              </button>
            </div>
            <div className="mt-4 h-px w-full bg-[#E9EEF5]" />
            <div className="flex flex-1 items-center justify-center px-5 py-16">
              <p className="text-sm text-[#64748B]">Nenhuma ação em aberto.</p>
            </div>
          </div>

          <ChartCard title="Ações por setor" className="lg:col-span-1">
            <AxesFrame />
          </ChartCard>
        </section>
      </main>
    </PanelShell>
  );
}
