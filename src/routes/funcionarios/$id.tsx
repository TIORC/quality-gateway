import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  Building2,
  Clock,
  Eye,
  FileCheck2,
  Mail,
  MapPin,
  ShieldCheck,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { EMPRESA_ORCOMA } from "@/lib/dados";
import * as org from "@/lib/organizacao";
import type { PerfilColaborador } from "@/lib/organizacao";
import { formatarDataHoraBrasilia } from "@/lib/utils";

export const Route = createFileRoute("/funcionarios/$id")({
  head: () => ({
    meta: [{ title: "Perfil do Funcionário | Gestão da Qualidade" }],
  }),
  component: PerfilFuncionario,
});

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function StatusBadge({ status }: { status: string }) {
  const ativo = status === "Ativo";
  return (
    <span
      className={
        ativo
          ? "inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#047857]"
          : "inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]"
      }
    >
      <span
        className={
          ativo ? "h-1.5 w-1.5 rounded-full bg-[#059669]" : "h-1.5 w-1.5 rounded-full bg-[#94A3B8]"
        }
      />
      {status}
    </span>
  );
}

interface DadoPerfilProps {
  icon: typeof Tag;
  rotulo: string;
  valor: string;
}

function DadoPerfil({ icon: Icone, rotulo, valor }: DadoPerfilProps) {
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

function PerfilFuncionario() {
  const { id } = Route.useParams();
  const session = usePanelSession();
  const [perfil, setPerfil] = useState<PerfilColaborador | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    if (!org.organizacaoDisponivel()) {
      setCarregando(false);
      return;
    }
    org
      .carregarPerfilColaborador(id)
      .then((dados) => {
        if (ativo) setPerfil(dados);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar o perfil do colaborador.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  const ehProprioPerfil = !!session && session.colaboradorId === id;

  const percentual =
    perfil && perfil.processosVisualizados > 0
      ? Math.min(100, Math.round((perfil.processosLidos / perfil.processosVisualizados) * 100))
      : 0;

  return (
    <PanelShell wide>
      <div className="mb-6">
        <Link
          to="/funcionarios"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1E3A8A] transition hover:text-[#312E81]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para funcionários
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
          Organização
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
          Perfil do colaborador
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">Informações organizacionais e de acesso.</p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#D9E0EA] bg-white px-6 py-16 text-sm text-[#64748B] shadow-sm">
          Carregando perfil…
        </div>
      ) : !perfil ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#D9E0EA] bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <UserRound className="h-6 w-6 text-[#94A3B8]" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-[#1F2937]">
            Colaborador não encontrado
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            O registro pode ter sido removido ou o link está incorreto.
          </p>
          <Link
            to="/funcionarios"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#D9E0EA] bg-white px-3 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#EEF2F7]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para funcionários
          </Link>
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-[#D9E0EA] bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#312E81] text-xl font-bold text-white">
                {iniciais(perfil.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold tracking-tight text-[#1F2937]">
                    {perfil.nome}
                  </h2>
                  <StatusBadge status={perfil.status} />
                  {ehProprioPerfil ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[11px] font-semibold text-[#1E3A8A]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Este é você
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-[#64748B]">{perfil.cargo}</p>
                <p className="text-[12px] text-[#94A3B8]">
                  {[perfil.setor, [perfil.unidade, perfil.cidade].filter(Boolean).join(" · ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {ehProprioPerfil ? (
                <Link
                  to="/meu-perfil"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#D9E0EA] bg-white px-3 py-2 text-[12px] font-semibold text-[#1E3A8A] transition hover:bg-[#EEF2F7]"
                >
                  <UserRound className="h-4 w-4" />
                  Editar em Meu Perfil
                </Link>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DadoPerfil icon={Building2} rotulo="Empresa" valor={EMPRESA_ORCOMA} />
              <DadoPerfil icon={Tag} rotulo="Cargo" valor={perfil.cargo || "—"} />
              <DadoPerfil icon={Mail} rotulo="E-mail" valor={perfil.email || "—"} />
              <DadoPerfil icon={Building2} rotulo="Setor" valor={perfil.setor || "—"} />
              <DadoPerfil
                icon={MapPin}
                rotulo="Unidade / Cidade"
                valor={[perfil.unidade, perfil.cidade].filter(Boolean).join(" · ") || "—"}
              />
              <DadoPerfil
                icon={ShieldCheck}
                rotulo="Nível de acesso"
                valor={perfil.nivelAcesso || "—"}
              />
              <DadoPerfil
                icon={Clock}
                rotulo="Último acesso"
                valor={
                  perfil.ultimoAcesso
                    ? formatarDataHoraBrasilia(perfil.ultimoAcesso)
                    : "Nunca acessou"
                }
              />
              <DadoPerfil icon={Tag} rotulo="Grupos" valor={perfil.grupos || "—"} />
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#D9E0EA] bg-white p-6 shadow-sm">
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
            </div>

            <div className="rounded-2xl border border-[#D9E0EA] bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Leitura de processos
              </p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF2F7] text-[#1E3A8A]">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">
                      Visualizados
                    </p>
                    <p className="text-[16px] font-semibold text-[#1F2937]">
                      {perfil.processosVisualizados}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF2F7] text-[#1E3A8A]">
                    <FileCheck2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#94A3B8]">Lidos</p>
                    <p className="text-[16px] font-semibold text-[#1F2937]">
                      {perfil.processosLidos}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-[#64748B]">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpenCheck className="h-3.5 w-3.5" />
                      Conclusão
                    </span>
                    <span>{percentual}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E9EEF5]">
                    <span
                      className="block h-full rounded-full bg-[#1E3A8A]"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-[#E9EEF5] bg-[#F8FAFC] px-4 py-3 text-[12px] text-[#64748B]">
              <Users className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              Perfil público da organização, exibido ao visitar o colaborador.
            </div>
          </aside>
        </main>
      )}
    </PanelShell>
  );
}
