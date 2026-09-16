import { createFileRoute } from "@tanstack/react-router";
import { Building2, Clock, Mail, ShieldCheck, Tag } from "lucide-react";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { getSession, ROLE_PERFIL_LABELS, type UserRole } from "@/lib/auth";
import { EMPRESA_ORCOMA } from "@/lib/dados";

export const Route = createFileRoute("/meu-perfil")({
  head: () => ({
    meta: [{ title: "Meu Perfil | Gestão da Qualidade" }],
  }),
  component: MeuPerfil,
});

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function formatarLogin(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface LinhaPerfilProps {
  icon: typeof Tag;
  rotulo: string;
  valor: string;
}

function LinhaPerfil({ icon: Icone, rotulo, valor }: LinhaPerfilProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] px-3.5 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#1E3A8A] shadow-sm">
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          {rotulo}
        </p>
        <p className="mt-0.5 text-[14px] font-medium leading-snug text-[#1F2937]">{valor}</p>
      </div>
    </div>
  );
}

function MeuPerfil() {
  const sessionDaTela = usePanelSession();
  const perfil = getSession();
  const session = perfil ?? sessionDaTela;

  const nome = session?.nome ?? "Usuário";
  const role = (session?.role ?? "usuario") as UserRole;
  const rotuloRole = ROLE_PERFIL_LABELS[role] ?? "Colaborador";
  const cargo = session?.cargo ?? "";
  const setor = session?.setor ?? "";
  const email = session?.email ?? "";
  const ultimoLogin = session?.loginAt ?? "";

  return (
    <PanelShell wide>
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
          Conta
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
          Meu Perfil
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Dados do colaborador e da empresa representada no portal.
        </p>
      </header>

      <main className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-[#D9E0EA] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#312E81] text-xl font-bold text-white">
              {iniciais(nome)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight text-[#1F2937]">{nome}</h2>
              <p className="text-sm text-[#64748B]">{cargo}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#1E3A8A]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {rotuloRole}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LinhaPerfil icon={Tag} rotulo="Role" valor={rotuloRole} />
            <LinhaPerfil icon={Building2} rotulo="Empresa" valor={EMPRESA_ORCOMA} />
            <LinhaPerfil icon={Building2} rotulo="Setor" valor={setor || "—"} />
            <LinhaPerfil icon={Mail} rotulo="E-mail" valor={email || "—"} />
            <LinhaPerfil icon={Clock} rotulo="Último login" valor={formatarLogin(ultimoLogin)} />
          </div>
        </section>

        <aside className="flex flex-col rounded-2xl border border-[#D9E0EA] bg-white p-6 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2F7] text-[#1E3A8A]">
            <Building2 className="h-5 w-5" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
            Empresa representada
          </p>
          <p className="mt-1.5 text-[15px] font-bold leading-snug text-[#1F2937]">
            {EMPRESA_ORCOMA}
          </p>
          <p className="mt-2 text-[13px] text-[#64748B]">
            Todos os colaboradores deste portal representam esta organização.
          </p>
        </aside>
      </main>
    </PanelShell>
  );
}
