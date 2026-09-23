import { createFileRoute } from "@tanstack/react-router";
import { Building2, CalendarDays, ClipboardCheck, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { NovaAuditoriaDialog } from "@/components/nova-auditoria-dialog";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { listarAuditorias } from "@/lib/auditorias-base";
import { rotuloResultado, type Auditoria, type ResultadoAuditoria } from "@/lib/auditorias";
import { podeGerenciarConteudo } from "@/lib/permissoes";
import { dataISOparaBR } from "@/lib/projetos";
import { toast } from "sonner";

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

type SituacaoAuditoria = "planejadas" | "execucao" | "concluidas";

function situacaoDe(a: Auditoria): SituacaoAuditoria {
  if (a.resultado !== "nenhum") return "concluidas";
  const hoje = new Date().toISOString().slice(0, 10);
  if (a.dataPlanejada && a.dataPlanejada < hoje) return "execucao";
  return "planejadas";
}

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
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  async function recarregar() {
    setCarregando(true);
    try {
      setAuditorias(await listarAuditorias());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar as auditorias.");
      setAuditorias([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  const filtradas = auditorias.filter((a) => {
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    const pessoas = (itens: { nome: string }[]) => itens.map((x) => x.nome).join(" ");
    return `${a.codigo} ${a.titulo} ${a.unidade} ${pessoas(a.auditores)} ${pessoas(a.auditados)} ${a.setoresAuditados.join(" ")} ${rotuloResultado(a.resultado)}`
      .toLowerCase()
      .includes(b);
  });

  const porAba = (aba: string) =>
    aba === "todas" ? filtradas : filtradas.filter((a) => situacaoDe(a) === aba);

  const anoAtual = String(new Date().getFullYear());
  const noAno = auditorias.filter((a) =>
    (a.dataPlanejada ?? a.createdAt.slice(0, 10)).startsWith(anoAtual),
  ).length;
  const concluidas = auditorias.filter((a) => a.resultado !== "nenhum").length;
  const naoConformes = auditorias.filter((a) => a.resultado === "nao_conformidade").length;
  const ocorrencias = auditorias.filter((a) =>
    a.resultadoRef.trim().toUpperCase().startsWith("OCR"),
  ).length;
  const conformidade =
    concluidas > 0 ? Math.round(((concluidas - naoConformes) / concluidas) * 100) : 0;

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

        <Button
          className="shrink-0 rounded-full px-5 py-2 text-sm font-semibold shadow-sm"
          onClick={() => setNovaAuditoria(true)}
        >
          + Nova Auditoria
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Auditorias no ano"
          value={String(noAno)}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
          accent="#1F2937"
          footer={`${concluidas} concluída(s)`}
        />
        <SummaryCard
          label="Conformidade média"
          value={`${conformidade}%`}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#4F46E5]"
          accent="#4F46E5"
          footer="requisitos conformes"
        />
        <SummaryCard
          label="Não conformidades"
          value={String(naoConformes)}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#E11D48]"
          accent="#E11D48"
          footer="levantadas nas auditorias"
        />
        <SummaryCard
          label="Ocorrências abertas"
          value={String(ocorrencias)}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
          accent="#059669"
          footer="a partir de achados"
        />
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, título, unidade ou pessoas"
          className="max-w-md bg-white"
        />
        <span className="text-[12px] text-[#64748B]">{filtradas.length} auditoria(s)</span>
      </div>

      <Tabs defaultValue="todas">
        <TabsList className="mt-6 flex-wrap">
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {porAba(aba.valor).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((aba) => (
          <TabsContent key={aba.valor} value={aba.valor}>
            <ListaAuditorias
              auditorias={porAba(aba.valor)}
              carregando={carregando && aba.valor === "todas"}
              onNova={() => setNovaAuditoria(true)}
              podeGerenciar={podeGerenciar}
            />
          </TabsContent>
        ))}
      </Tabs>

      <NovaAuditoriaDialog
        aberto={novaAuditoria}
        unidades={catalogo.unidades}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setNovaAuditoria(false)}
        onCriado={(a) => {
          setAuditorias((lista) => [a, ...lista]);
          setNovaAuditoria(false);
        }}
      />
    </PanelShell>
  );
}

function ListaAuditorias({
  auditorias,
  carregando,
  onNova,
  podeGerenciar,
}: {
  auditorias: Auditoria[];
  carregando: boolean;
  onNova: () => void;
  podeGerenciar: boolean;
}) {
  if (carregando) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
        Carregando auditorias...
      </p>
    );
  }

  if (auditorias.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <ClipboardCheck className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma auditoria aqui</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Programe a auditoria, registre o relatório, as evidências e o resultado da verificação.
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

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {auditorias.map((a) => (
        <CartaoAuditoria key={a.id} auditoria={a} />
      ))}
    </div>
  );
}

const ESTILOS_RESULTADO: Record<ResultadoAuditoria, { pill: string }> = {
  nenhum: { pill: "bg-[#F1F5F9] text-[#64748B]" },
  nao_conformidade: { pill: "bg-[#FDECEE] text-[#B91C1C]" },
  ponto_atencao: { pill: "bg-[#FFFBEB] text-[#92400E]" },
  oportunidade: { pill: "bg-[#ECFDF5] text-[#065F46]" },
};

const LIMITE_NOMES_CARD = 3;

function CartaoAuditoria({ auditoria }: { auditoria: Auditoria }) {
  const resultadoPill =
    auditoria.resultado === "nenhum"
      ? "bg-[#F1F5F9] text-[#64748B]"
      : (ESTILOS_RESULTADO[auditoria.resultado]?.pill ?? "bg-[#F1F5F9] text-[#64748B]");

  const nomes = (pessoas: { nome: string }[]) => {
    const lista = pessoas.map((p) => p.nome).filter(Boolean);
    if (lista.length === 0) return "—";
    const visiveis = lista.slice(0, LIMITE_NOMES_CARD);
    const resto = lista.length - visiveis.length;
    return resto > 0 ? `${visiveis.join(", ")} +${resto}` : visiveis.join(", ");
  };

  return (
    <div className="flex flex-col rounded-xl border border-[#E9EEF5] bg-white p-4 shadow-sm transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-[#94A3B8]">{auditoria.codigo || "—"}</span>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resultadoPill}`}
          title={`Resultado: ${rotuloResultado(auditoria.resultado)}`}
        >
          {rotuloResultado(auditoria.resultado)}
          {auditoria.resultadoRef ? ` · ${auditoria.resultadoRef}` : ""}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug text-[#1F2937]">
        {auditoria.titulo || "Sem título"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
          {auditoria.tipo}
        </span>
        {auditoria.norma ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
            <ClipboardCheck className="h-3 w-3" />
            {auditoria.norma}
          </span>
        ) : null}
        {auditoria.unidade ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
            <Building2 className="h-3 w-3" />
            {auditoria.unidade}
          </span>
        ) : null}
        {auditoria.dataPlanejada ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
            <CalendarDays className="h-3 w-3" />
            {dataISOparaBR(auditoria.dataPlanejada)}
          </span>
        ) : null}
      </div>

      {auditoria.setoresAuditados.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Setores auditados
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {auditoria.setoresAuditados.slice(0, LIMITE_NOMES_CARD).map((setor) => (
              <span
                key={setor}
                className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#1E3A8A]"
              >
                {setor}
              </span>
            ))}
            {auditoria.setoresAuditados.length > LIMITE_NOMES_CARD ? (
              <span className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#1E3A8A]">
                +{auditoria.setoresAuditados.length - LIMITE_NOMES_CARD}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid flex-1 gap-3 border-t border-[#EEF2F7] pt-3 text-[12px] sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            <Users className="h-3 w-3" />
            Auditores
          </p>
          <p className="mt-1 leading-snug text-[#334155]">{nomes(auditoria.auditores)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            <Users className="h-3 w-3" />
            Auditados
          </p>
          <p className="mt-1 leading-snug text-[#334155]">{nomes(auditoria.auditados)}</p>
        </div>
      </div>
    </div>
  );
}
