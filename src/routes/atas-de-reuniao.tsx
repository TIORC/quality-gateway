import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  Archive,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  Eye,
  FileText,
  Pencil,
  Plus,
  Power,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { AtaDialog } from "@/components/ata-dialog";
import { AtaLeituraDialog } from "@/components/ata-leitura-dialog";
import { TipoReuniaoDialog } from "@/components/tipo-reuniao-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { getSession } from "@/lib/auth";
import type { Ata, TipoReuniao } from "@/lib/atas";
import {
  ORIGEM_ATA_LABELS,
  ORIGENS_ATA,
  PERIODICIDADE_LABELS,
  STATUS_ATA,
  STATUS_ATA_LABELS,
} from "@/lib/atas";
import { listarAtas, listarTiposReuniao, usuarioIdPorEmail } from "@/lib/atas-base";
import {
  montarReunioesPrevistas,
  quantidadeProximasDias,
  type ReuniaoPrevista,
} from "@/lib/atas-calendario";
import { mudarAtivoTipoReuniao } from "@/lib/atas-crud";
import { ehAdministrador, podeEditarAta, podeGerenciarConteudo } from "@/lib/permissoes";
import { traduzErro } from "@/lib/organizacao";

export const Route = createFileRoute("/atas-de-reuniao")({
  head: () => ({
    meta: [{ title: "Atas de Reunião | Gestão da Qualidade" }],
  }),
  component: AtasDeReuniao,
});

function AtasDeReuniao() {
  const sessao = usePanelSession();
  const catalogo = useCatalogoOrganizacional();
  const podeGerenciar = podeGerenciarConteudo(sessao) || ehAdministrador(sessao);

  const [tipos, setTipos] = useState<TipoReuniao[]>([]);
  const [atas, setAtas] = useState<Ata[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [tipoEmEdicao, setTipoEmEdicao] = useState<TipoReuniao | null>(null);
  const [tipoParaDesativar, setTipoParaDesativar] = useState<TipoReuniao | null>(null);
  const [desativando, setDesativando] = useState(false);
  const [dialogAtaAberto, setDialogAtaAberto] = useState(false);
  const [ataEmEdicao, setAtaEmEdicao] = useState<Ata | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    if (sessao?.email) void usuarioIdPorEmail(sessao.email).then(setUsuarioId);
  }, [sessao]);

  async function recarregar() {
    setCarregando(true);
    try {
      const [tiposCarregados, atasCarregadas] = await Promise.all([
        listarTiposReuniao(),
        listarAtas(),
      ]);
      setTipos(tiposCarregados);
      setAtas(atasCarregadas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar as atas de reunião.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  const previstas = useMemo(() => montarReunioesPrevistas(tipos, atas), [tipos, atas]);
  const proximas30Dias = useMemo(() => quantidadeProximasDias(previstas), [previstas]);

  const resumos = [
    {
      rotulo: "Ata simples",
      icone: FileText,
      valor: atas.filter((ata) => ata.origem === "simples").length,
    },
    {
      rotulo: "Atas do sistema",
      icone: Building2,
      valor: atas.filter((ata) => ata.origem === "sistema").length,
    },
    {
      rotulo: "Arquivo anterior",
      icone: Archive,
      valor: atas.filter((ata) => ata.origem === "arquivo").length,
    },
    {
      rotulo: "Próximas reuniões",
      icone: CalendarClock,
      valor: proximas30Dias,
    },
  ] as const;

  function abrirNovo() {
    setTipoEmEdicao(null);
    setDialogAberto(true);
  }

  function abrirEdicao(tipo: TipoReuniao) {
    setTipoEmEdicao(tipo);
    setDialogAberto(true);
  }

  function aplicarSalvo(tipoSalvo: TipoReuniao) {
    setTipos((lista) => {
      const existe = lista.some((item) => item.id === tipoSalvo.id);
      return existe
        ? lista.map((item) => (item.id === tipoSalvo.id ? tipoSalvo : item))
        : [tipoSalvo, ...lista];
    });
    setDialogAberto(false);
  }

  function abrirNovaAta() {
    setAtaEmEdicao(null);
    setDialogAtaAberto(true);
  }

  function abrirEdicaoAta(ata: Ata) {
    setAtaEmEdicao(ata);
    setDialogAtaAberto(true);
  }

  function aplicarAtaSalva() {
    setDialogAtaAberto(false);
    setAtaEmEdicao(null);
    void recarregar();
  }

  async function confirmarDesativar() {
    if (!tipoParaDesativar || desativando) return;
    setDesativando(true);
    try {
      const atualizado = await mudarAtivoTipoReuniao(tipoParaDesativar.id, false, getSession());
      setTipos((lista) => lista.map((item) => (item.id === atualizado.id ? atualizado : item)));
      toast.success("Tipo de reunião desativado");
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setDesativando(false);
      setTipoParaDesativar(null);
    }
  }

  async function reativar(tipo: TipoReuniao) {
    try {
      const atualizado = await mudarAtivoTipoReuniao(tipo.id, true, getSession());
      setTipos((lista) => lista.map((item) => (item.id === atualizado.id ? atualizado : item)));
      toast.success("Tipo de reunião reativado");
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  const vazio = !carregando && tipos.length === 0 && atas.length === 0;

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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {podeGerenciar ? (
            <Button type="button" variant="outline" onClick={abrirNovo}>
              <Plus className="h-4 w-4" />
              Cadastrar tipo de reunião
            </Button>
          ) : null}
          <Button type="button" className="h-10 shrink-0 rounded-full px-5" onClick={abrirNovaAta}>
            <Plus className="h-4 w-4" />
            Nova Ata de Reunião
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resumos.map((resumo) => {
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
                <p className="mt-1 text-[26px] font-semibold leading-none text-[#1F2937]">
                  {String(resumo.valor)}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {vazio ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#E9EEF5] px-5 py-4">
            <BarChart3 className="h-4 w-4 text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#1F2937]">Reuniões</h3>
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
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                variant="link"
                className="h-auto p-0 text-[13px] font-medium text-[#1E3A8A] hover:text-[#1E40AF]"
              >
                Ir para as atas do sistema
              </Button>
              {podeGerenciar ? (
                <Button type="button" onClick={abrirNovo}>
                  <Plus className="h-4 w-4" />
                  Cadastrar tipo de reunião
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <Tabs defaultValue="reunioes" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="reunioes" className="gap-1.5">
              Reuniões
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {atas.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="tipos" className="gap-1.5">
              Tipos de reunião
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {tipos.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-1.5">
              Calendário
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {previstas.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reunioes">
            <PainelReunioes
              atas={atas}
              tipos={tipos}
              sessao={sessao}
              usuarioId={usuarioId}
              carregando={carregando}
              onNova={abrirNovaAta}
              onEditar={abrirEdicaoAta}
            />
          </TabsContent>

          <TabsContent value="tipos">
            <ListaTipos
              tipos={tipos}
              carregando={carregando}
              podeGerenciar={podeGerenciar}
              {...(podeGerenciar
                ? {
                    onNovo: abrirNovo,
                    onEditar: abrirEdicao,
                    onDesativar: setTipoParaDesativar,
                    onReativar: reativar,
                  }
                : {})}
            />
          </TabsContent>

          <TabsContent value="calendario">
            <ListaCalendario previstas={previstas} carregando={carregando} />
          </TabsContent>
        </Tabs>
      )}

      <TipoReuniaoDialog
        aberto={dialogAberto}
        tipo={tipoEmEdicao}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setDialogAberto(false)}
        onSalvo={aplicarSalvo}
      />

      <ConfirmarDialog
        open={tipoParaDesativar !== null}
        onOpenChange={(abre) => (!abre ? setTipoParaDesativar(null) : undefined)}
        tom="warning"
        titulo="Desativar tipo de reunião?"
        {...(tipoParaDesativar
          ? {
              descricao: (
                <>
                  O tipo <strong>{tipoParaDesativar.nome}</strong> deixará de aparecer no calendário
                  e nas novas atas. As atas já registradas não são alteradas.
                </>
              ),
            }
          : {})}
        textoConfirmar={desativando ? "Desativando…" : "Desativar"}
        carregando={desativando}
        onConfirmar={() => void confirmarDesativar()}
      />

      <AtaDialog
        aberto={dialogAtaAberto}
        ata={ataEmEdicao}
        tipos={tipos}
        podeCriarSimples={podeGerenciar}
        onFechar={() => setDialogAtaAberto(false)}
        onSalvo={aplicarAtaSalva}
      />
    </PanelShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Lista de tipos de reunião                                                   */
/* -------------------------------------------------------------------------- */

function ListaTipos({
  tipos,
  carregando,
  podeGerenciar,
  onNovo,
  onEditar,
  onDesativar,
  onReativar,
}: {
  tipos: TipoReuniao[];
  carregando: boolean;
  podeGerenciar: boolean;
  onNovo?: () => void;
  onEditar?: (tipo: TipoReuniao) => void;
  onDesativar?: (tipo: TipoReuniao) => void;
  onReativar?: (tipo: TipoReuniao) => void;
}) {
  if (carregando) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
        Carregando tipos de reunião…
      </p>
    );
  }

  if (tipos.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <CalendarClock className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
            Nenhum tipo de reunião cadastrado
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Cadastre os tipos para programar as reuniões no calendário.
          </p>
          {onNovo ? (
            <Button type="button" className="mt-5" onClick={onNovo}>
              <Plus className="h-4 w-4" />
              Cadastrar tipo de reunião
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tipos.map((tipo) => (
        <CartaoTipo
          key={tipo.id}
          tipo={tipo}
          podeGerenciar={podeGerenciar}
          {...(podeGerenciar ? { onEditar, onDesativar, onReativar } : {})}
        />
      ))}
    </div>
  );
}

function CartaoTipo({
  tipo,
  podeGerenciar,
  onEditar,
  onDesativar,
  onReativar,
}: {
  tipo: TipoReuniao;
  podeGerenciar: boolean;
  onEditar?: (tipo: TipoReuniao) => void;
  onDesativar?: (tipo: TipoReuniao) => void;
  onReativar?: (tipo: TipoReuniao) => void;
}) {
  const nomes = (lista: { nome: string }[]) => {
    const nomesFiltrados = lista.map((p) => p.nome).filter(Boolean);
    return nomesFiltrados.length === 0 ? "—" : nomesFiltrados.join(", ");
  };

  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm ${
        tipo.ativo ? "border-[#E9EEF5]" : "border-[#EEF2F7] opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-snug text-[#1F2937]">{tipo.nome}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            tipo.ativo ? "bg-[#ECFDF3] text-[#047857]" : "bg-[#F1F5F9] text-[#64748B]"
          }`}
        >
          {tipo.ativo ? "Ativo" : "Desativado"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
          {PERIODICIDADE_LABELS[tipo.periodicidade]}
        </span>
        {tipo.diaPrevisto !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
            <CalendarDays className="h-3 w-3" />
            Dia {tipo.diaPrevisto}
            {tipo.periodicidade === "semanal" || tipo.periodicidade === "quinzenal"
              ? " (dia da semana)"
              : " do mês"}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid flex-1 gap-3 border-t border-[#EEF2F7] pt-3 text-[12px] sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            <Users className="h-3 w-3" />
            Participantes
          </p>
          <p className="mt-1 leading-snug text-[#334155]">{nomes(tipo.participantes)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            <Users className="h-3 w-3" />
            Signatários
          </p>
          <p className="mt-1 leading-snug text-[#334155]">{nomes(tipo.signatarios)}</p>
        </div>
      </div>

      {podeGerenciar ? (
        <div className="mt-3 flex items-center gap-2 border-t border-[#EEF2F7] pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => onEditar?.(tipo)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {tipo.ativo ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-[12px] text-[#B91C1C]"
              onClick={() => onDesativar?.(tipo)}
            >
              <Power className="h-3.5 w-3.5" />
              Desativar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-[12px] text-[#047857]"
              onClick={() => onReativar?.(tipo)}
            >
              <Power className="h-3.5 w-3.5" />
              Reativar
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Calendário — próximas reuniões, atrasadas destacadas                        */
/* -------------------------------------------------------------------------- */

function rotuloPrazo(reuniao: ReuniaoPrevista, hoje: Date): string {
  const diff = differenceInCalendarDays(reuniao.dataPrevista, hoje);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff > 1) return `Em ${diff} dias`;
  return `Há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? "" : "s"}`;
}

function ListaCalendario({
  previstas,
  carregando,
}: {
  previstas: ReuniaoPrevista[];
  carregando: boolean;
}) {
  const hoje = new Date();

  if (carregando) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
        Carregando calendário…
      </p>
    );
  }

  if (previstas.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <CalendarDays className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma reunião prevista</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Os tipos ativos com periodicidade definida aparecem aqui com a próxima data prevista.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <ul className="divide-y divide-[#E9EEF5]">
        {previstas.map((reuniao) => {
          const atrasada = reuniao.atrasada;
          return (
            <li
              key={reuniao.tipo.id}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                atrasada ? "bg-[#FEF2F2]" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-[14px] font-semibold text-[#1F2937]">{reuniao.tipo.nome}</h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      atrasada ? "bg-[#FDECEE] text-[#B91C1C]" : "bg-[#EFF6FF] text-[#1E3A8A]"
                    }`}
                  >
                    {atrasada ? "Atrasada" : "Prevista"}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                  Próxima data prevista: {format(reuniao.dataPrevista, "dd/MM/yyyy")}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p
                  className={`text-[13px] font-semibold ${
                    atrasada ? "text-[#B91C1C]" : "text-[#334155]"
                  }`}
                >
                  {rotuloPrazo(reuniao, hoje)}
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  Periodicidade: {PERIODICIDADE_LABELS[reuniao.tipo.periodicidade]}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reuniões — lista de atas com busca e filtros                               */
/* -------------------------------------------------------------------------- */

const CORES_STATUS: Record<Ata["status"], string> = {
  rascunho: "bg-[#F1F5F9] text-[#475569]",
  aguardando_assinatura: "bg-[#FEF3C7] text-[#B45309]",
  assinada: "bg-[#ECFDF3] text-[#047857]",
};

function PainelReunioes({
  atas,
  tipos,
  sessao,
  usuarioId,
  carregando,
  onNova,
  onEditar,
}: {
  atas: Ata[];
  tipos: TipoReuniao[];
  sessao: ReturnType<typeof getSession>;
  usuarioId: string | null;
  carregando: boolean;
  onNova: () => void;
  onEditar: (ata: Ata) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [ataVisualizada, setAtaVisualizada] = useState<Ata | null>(null);

  const tipoPorId = useMemo(() => new Map(tipos.map((tipo) => [tipo.id, tipo])), [tipos]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return atas.filter((ata) => {
      if (termo && !ata.titulo.toLowerCase().includes(termo)) return false;
      if (filtroTipo !== "todos" && ata.tipoReuniaoId !== filtroTipo) return false;
      if (filtroOrigem !== "todas" && ata.origem !== filtroOrigem) return false;
      if (filtroStatus !== "todos" && ata.status !== filtroStatus) return false;
      if (filtroInicio && ata.dataReuniao < filtroInicio) return false;
      if (filtroFim && ata.dataReuniao > filtroFim) return false;
      return true;
    });
  }, [atas, busca, filtroTipo, filtroOrigem, filtroStatus, filtroInicio, filtroFim]);

  if (carregando) {
    return (
      <p className="mt-4 rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
        Carregando atas…
      </p>
    );
  }

  if (atas.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <FileText className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma ata registrada</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Clique em "Nova Ata de Reunião" para registrar uma ata simples ou gerada pelo sistema.
          </p>
          <Button type="button" className="mt-5" onClick={onNova}>
            <Plus className="h-4 w-4" />
            Nova Ata de Reunião
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-[#D9E0EA] bg-white p-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar pelo título…"
            className="h-9 lg:w-64"
          />
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-9 w-full lg:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="h-9 w-full lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {ORIGENS_ATA.map((origem) => (
                <SelectItem key={origem} value={origem}>
                  {ORIGEM_ATA_LABELS[origem]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 w-full lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_ATA.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_ATA_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filtroInicio}
              onChange={(evento) => setFiltroInicio(evento.target.value)}
              className="h-9"
              aria-label="Período de início"
            />
            <span className="text-[12px] text-[#94A3B8]">até</span>
            <Input
              type="date"
              value={filtroFim}
              onChange={(evento) => setFiltroFim(evento.target.value)}
              className="h-9"
              aria-label="Período de fim"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center shadow-sm">
            <h3 className="text-base font-semibold text-[#1F2937]">
              Nenhuma ata para os filtros atuais
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
              Ajuste a busca ou os filtros de tipo, origem, status e período.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
            <ul className="divide-y divide-[#E9EEF5]">
              {lista.map((ata) => {
                const tipo = ata.tipoReuniaoId ? tipoPorId.get(ata.tipoReuniaoId) : undefined;
                const editavel = podeEditarAta(sessao, ata, tipo, usuarioId);
                return (
                  <li
                    key={ata.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[14px] font-semibold text-[#1F2937]">{ata.titulo}</h4>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CORES_STATUS[ata.status]}`}
                        >
                          {STATUS_ATA_LABELS[ata.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#64748B]">
                        {format(parseISO(ata.dataReuniao), "dd/MM/yyyy")} ·{" "}
                        {ata.tipoReuniaoId ? (tipo?.nome ?? "Tipo removido") : "Ata simples"} ·{" "}
                        {ORIGEM_ATA_LABELS[ata.origem]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px]"
                        onClick={() => setAtaVisualizada(ata)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Button>
                      {editavel ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[12px]"
                          onClick={() => onEditar(ata)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <AtaLeituraDialog
        aberto={ataVisualizada !== null}
        ata={ataVisualizada}
        tipo={
          ataVisualizada?.tipoReuniaoId
            ? (tipoPorId.get(ataVisualizada.tipoReuniaoId) ?? null)
            : null
        }
        usuarioId={usuarioId}
        sessao={sessao}
        onFechar={() => setAtaVisualizada(null)}
      />
    </>
  );
}
