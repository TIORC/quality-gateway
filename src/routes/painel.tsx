import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from "recharts";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PlanoDeAcaoRow = Tables<"planos_de_acao">;

import { logout, getSession } from "@/lib/auth";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contarPorCampo(planos: PlanoDeAcaoRow[], campo: keyof PlanoDeAcaoRow) {
  const mapa: Record<string, number> = {};
  for (const p of planos) {
    const valor = String(p[campo]);
    mapa[valor] = (mapa[valor] || 0) + 1;
  }
  return Object.entries(mapa)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

const STATUS_COLORS: Record<string, string> = {
  aberta: "#4F46E5",
  em_andamento: "#F59E0B",
  concluida: "#059669",
  atrasada: "#E11D48",
};

const ORIGEM_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#059669",
  "#F59E0B",
  "#E11D48",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

const SETOR_COLORS = [
  "#4F46E5",
  "#059669",
  "#E11D48",
  "#F59E0B",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
  "#14B8A6",
  "#64748B",
  "#D946EF",
];

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

function GraficoStatus({ planos }: { planos: PlanoDeAcaoRow[] }) {
  const dados = contarPorCampo(planos, "status")
    .filter((d) => d.nome in STATUS_LABELS)
    .map((d) => ({
      ...d,
      nome: STATUS_LABELS[d.nome] ?? d.nome,
      cor: STATUS_COLORS[d.nome] ?? "#64748B",
    }));

  if (dados.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#64748B]">Nenhum plano de ação.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={dados}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="total"
          nameKey="nome"
          stroke="none"
        >
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx, cy } = (viewBox ?? {}) as { cx?: number; cy?: number };
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                  <tspan x={cx} dy={-6} className="fill-[#1F2937] text-[18px] font-bold">
                    {planos.length}
                  </tspan>
                  <tspan x={cx} dy={18} className="fill-[#94A3B8] text-[10px]">
                    Total
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E9EEF5",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`${value} ação(ões)`]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", color: "#64748B" }}
          formatter={(value: string) => <span className="text-[11px] text-[#64748B]">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function GraficoOrigem({ planos }: { planos: PlanoDeAcaoRow[] }) {
  const dados = contarPorCampo(planos, "origem");

  if (dados.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#64748B]">Nenhum plano de ação.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF5" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nome"
          width={160}
          tick={{ fontSize: 11, fill: "#64748B" }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E9EEF5",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`${value} ação(ões)`]}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {dados.map((_, i) => (
            <Cell key={i} fill={ORIGEM_COLORS[i % ORIGEM_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function GraficoSetor({ planos }: { planos: PlanoDeAcaoRow[] }) {
  const dados = contarPorCampo(planos, "setor");

  if (dados.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#64748B]">Nenhum plano de ação.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF5" vertical={false} />
        <XAxis
          dataKey="nome"
          tick={{ fontSize: 10, fill: "#64748B" }}
          angle={-30}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E9EEF5",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`${value} ação(ões)`]}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {dados.map((_, i) => (
            <Cell key={i} fill={SETOR_COLORS[i % SETOR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

function Painel() {
  const router = useRouter();
  const sessionFromCtx = usePanelSession();
  const [menuAberto, setMenuAberto] = useState(false);
  const [planos, setPlanos] = useState<PlanoDeAcaoRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Resolve o perfil completo guardado na sessão do navegador (dados do Lovable Cloud).
  const perfil = getSession();
  const session = perfil ?? sessionFromCtx;
  const nomeUsuario = perfil?.nome ?? session?.nome ?? "Usuário";
  const cargoUsuario = perfil?.cargo ?? session?.cargo ?? "";
  const setorUsuario = perfil?.setor ?? session?.setor ?? "";
  const iniciais = nomeUsuario
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    async function carregar() {
      try {

        const { data, error } = await supabase
          .from("planos_de_acao")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setPlanos(data ?? []);
      } catch {
        setPlanos([]);
      }
      setCarregando(false);
    }
    carregar();
  }, []);

  const totalAcoes = planos.length;
  const abertas = planos.filter((p) => p.status === "aberta" || p.status === "em_andamento").length;
  const atrasadas = planos.filter((p) => p.status === "atrasada").length;
  const concluidas = planos.filter((p) => p.status === "concluida").length;
  const taxaConclusao = totalAcoes > 0 ? Math.round((concluidas / totalAcoes) * 100) : 0;

  const setoresUnicos = new Set(planos.map((p) => p.setor)).size;

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
          <span className="hidden text-[13px] text-[#64748B] lg:block">{dataHoje}</span>

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
                {iniciais}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-semibold leading-tight text-[#1F2937]">
                  {nomeUsuario}
                </span>
                <span className="block text-[11px] leading-tight text-[#64748B]">
                  {cargoUsuario}
                </span>
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
                    <p className="text-[13px] font-semibold text-[#1F2937]">{nomeUsuario}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">{cargoUsuario}</p>
                    <p className="text-xs text-[#94A3B8]">{setorUsuario}</p>
                    <p className="mt-1 truncate text-[11px] text-[#94A3B8]">{session?.email}</p>
                  </div>
                  <div className="mx-2 my-1 h-px bg-[#E9EEF5]" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAberto(false);
                      void router.navigate({ to: "/meu-perfil" });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1F2937]"
                  >
                    <User className="h-4 w-4" />
                    Meu Perfil
                  </button>
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
            {setorUsuario} · {cargoUsuario}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Bom dia, {nomeUsuario.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Você acompanha {abertas} planos de ação de {setoresUnicos} setores.
          </p>
        </div>

        {/* Cards de resumo */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Ações na organização"
            value={String(totalAcoes)}
            valueClass="text-[#1F2937]"
            accent="#1F2937"
            footer={
              <span>
                <span className="font-semibold text-[#1F2937]">{abertas}</span> em aberto
              </span>
            }
          />
          <SummaryCard
            label="Em atraso"
            value={String(atrasadas)}
            valueClass="text-[#E11D48]"
            accent="#E11D48"
            footer="prazo vencido"
          />
          <SummaryCard
            label="Concluídas"
            value={String(concluidas)}
            valueClass="text-[#059669]"
            accent="#059669"
            footer="no período"
          />
          <SummaryCard
            label="Taxa de conclusão"
            value={`${taxaConclusao}%`}
            valueClass="text-[#4F46E5]"
            accent="#4F46E5"
            footer="do total atribuído"
          />
        </section>

        {/* Seção de gráficos */}
        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Distribuição por status" className="lg:col-span-1">
            {carregando ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[#94A3B8]">Carregando…</p>
              </div>
            ) : (
              <GraficoStatus planos={planos} />
            )}
          </ChartCard>

          <ChartCard title="Origem das ações" className="lg:col-span-2">
            {carregando ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[#94A3B8]">Carregando…</p>
              </div>
            ) : (
              <GraficoOrigem planos={planos} />
            )}
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
            {carregando ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[#94A3B8]">Carregando…</p>
              </div>
            ) : (
              <GraficoSetor planos={planos} />
            )}
          </ChartCard>
        </section>
      </main>
    </PanelShell>
  );
}
