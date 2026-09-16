import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, FileCheck2, Search, UserX, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PanelShell } from "@/components/panel-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_FUNCIONARIO, type Funcionario, type StatusFuncionario } from "@/lib/dados";
import * as org from "@/lib/organizacao";
import { formatarDataHoraBrasilia } from "@/lib/utils";

export const Route = createFileRoute("/funcionarios")({
  head: () => ({
    meta: [{ title: "Funcionários | Gestão da Qualidade" }],
  }),
  component: Funcionarios,
});

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ResumoCardProps {
  label: string;
  value: string;
  valueClass: string;
  accent: string;
  footer: string;
  icone: typeof Users;
}

function ResumoCard({ label, value, valueClass, accent, footer, icone: Icone }: ResumoCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
          {label}
        </p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2F7]">
          <Icone className="h-4 w-4 text-[#64748B]" />
        </span>
      </div>
      <p className={`mt-3 text-[28px] font-semibold leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-[13px] text-[#64748B]">{footer}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
      {children}
    </th>
  );
}

function StatusBadge({ status }: { status: StatusFuncionario }) {
  return (
    <span
      className={
        status === "Ativo"
          ? "inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#047857]"
          : "inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]"
      }
    >
      <span
        className={
          status === "Ativo"
            ? "h-1.5 w-1.5 rounded-full bg-[#059669]"
            : "h-1.5 w-1.5 rounded-full bg-[#94A3B8]"
        }
      />
      {status}
    </span>
  );
}

function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [setor, setSetor] = useState("todos");

  useEffect(() => {
    let ativo = true;
    if (!org.organizacaoDisponivel()) {
      setCarregando(false);
      return;
    }
    org
      .carregarFuncionarios()
      .then((lista) => {
        if (ativo) setFuncionarios(lista);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar os funcionários.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const setores = [...new Set(funcionarios.map((funcionario) => funcionario.setor).filter(Boolean))]
    .map((nome) => nome as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtrados = funcionarios.filter((funcionario) => {
    const termo = busca.trim().toLowerCase();
    const bateBusca =
      termo === "" ||
      funcionario.nome.toLowerCase().includes(termo) ||
      funcionario.email.toLowerCase().includes(termo) ||
      funcionario.cargo.toLowerCase().includes(termo);
    const bateStatus = status === "todos" || funcionario.status === status;
    const bateSetor = setor === "todos" || funcionario.setor === setor;
    return bateBusca && bateStatus && bateSetor;
  });

  const ativos = funcionarios.filter((funcionario) => funcionario.status === "Ativo").length;
  const inativos = funcionarios.length - ativos;
  const totalLidos = funcionarios.reduce(
    (soma, funcionario) => soma + funcionario.processosLidos,
    0,
  );

  return (
    <PanelShell wide>
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
          Organização
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
          Funcionários
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Todos os funcionários cadastrados na plataforma, com situação de acesso e leitura dos
          processos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard
          label="Funcionários"
          value={String(funcionarios.length)}
          valueClass="text-[#1F2937]"
          accent="#312E81"
          footer="Cadastrados na plataforma"
          icone={Users}
        />
        <ResumoCard
          label="Ativos"
          value={String(ativos)}
          valueClass="text-[#059669]"
          accent="#059669"
          footer="Com acesso liberado ao portal"
          icone={CheckCircle2}
        />
        <ResumoCard
          label="Inativos"
          value={String(inativos)}
          valueClass="text-[#E11D48]"
          accent="#E11D48"
          footer="Sem acesso no momento"
          icone={UserX}
        />
        <ResumoCard
          label="Processos lidos"
          value={String(totalLidos)}
          valueClass="text-[#1E3A8A]"
          accent="#1E3A8A"
          footer="Leituras confirmadas no total"
          icone={FileCheck2}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome, e-mail ou cargo"
              className="pl-9"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full xl:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_FUNCIONARIO.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className="w-full xl:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {setores.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center px-6 py-12 text-sm text-[#64748B]">
            Carregando funcionários…
          </div>
        ) : filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-[#E9EEF5]">
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Cargo</Th>
                  <Th>Status</Th>
                  <Th>Último acesso</Th>
                  <Th>Processos visualizados</Th>
                  <Th>Processos lidos</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((funcionario) => {
                  const percentual =
                    funcionario.processosVisualizados > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (funcionario.processosLidos / funcionario.processosVisualizados) * 100,
                          ),
                        )
                      : 0;

                  return (
                    <tr
                      key={funcionario.id}
                      className="border-b border-[#E9EEF5] last:border-0 hover:bg-[#F8FAFC]"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#312E81] text-[12px] font-semibold text-white">
                            {iniciais(funcionario.nome)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#1F2937]">
                              {funcionario.nome}
                            </p>
                            <p className="truncate text-[11px] text-[#64748B]">
                              {funcionario.setor || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#64748B]">
                        {funcionario.email || "—"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-medium text-[#1F2937]">
                          {funcionario.cargo}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={funcionario.status} />
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#64748B]">
                        {funcionario.ultimoAcesso ? (
                          <span title={funcionario.ultimoAcesso}>
                            {formatarDataHoraBrasilia(funcionario.ultimoAcesso)}
                          </span>
                        ) : (
                          <span className="italic text-[#94A3B8]">Nunca acessou</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]">
                          <Eye className="h-3.5 w-3.5 text-[#94A3B8]" />
                          {funcionario.processosVisualizados}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]">
                            <FileCheck2 className="h-3.5 w-3.5 text-[#94A3B8]" />
                            {funcionario.processosLidos}
                          </span>
                          <div className="hidden items-center gap-2 sm:flex">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E9EEF5]">
                              <span
                                className="block h-full rounded-full bg-[#1E3A8A]"
                                style={{ width: `${percentual}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-[#64748B]">
                              {percentual}%
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <Users className="h-6 w-6 text-[#94A3B8]" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#1F2937]">
              Nenhum funcionário encontrado
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">Ajuste a busca ou os filtros.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-[#94A3B8]">
        Exibindo {filtrados.length} de {funcionarios.length} funcionário(s) cadastrado(s).
      </p>
    </PanelShell>
  );
}
