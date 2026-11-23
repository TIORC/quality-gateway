/**
 * Agenda de atas de reunião — visão de calendário (mês / semana / dia), estilo
 * Google Agenda. Mostra as reuniões dos tipos em que o usuário participa ou
 * assina, e os eventos avulsos em que ele é criador ou convidado.
 *
 * Na visão de mês, clicar em um dia o seleciona e o painel ao lado lista os
 * compromissos desse dia.
 */
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Paperclip,
  Pencil,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { NovoEventoAgendaDialog } from "@/components/novo-evento-agenda-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserSession } from "@/lib/auth";
import type { Ata, TipoReuniao } from "@/lib/atas";
import { PERIODICIDADE_LABELS } from "@/lib/atas";
import {
  enviarAnexoAgenda,
  excluirAgendaEvento,
  marcarAgendaEventoRealizada,
  removerAnexoAgenda,
  urlAnexoAgenda,
  type AgendaEvento,
  type AnexoAgenda,
} from "@/lib/agenda-eventos";
import type { UsuarioAtaRow } from "@/lib/atas-base";
import {
  envolvidoNoTipo,
  montarAgenda,
  type EventoAgenda,
  type SituacaoEvento,
} from "@/lib/atas-calendario";
import { traduzErro } from "@/lib/organizacao";

type ModoAgenda = "mes" | "semana" | "dia";

const MODOS: { valor: ModoAgenda; rotulo: string }[] = [
  { valor: "mes", rotulo: "Mês" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "dia", rotulo: "Hoje" },
];

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Domingo como primeiro dia da semana (padrão do Google Agenda em pt-BR). */
const OPCAO_SEMANA = { weekStartsOn: 0 } as const;

const ROTULO_SITUACAO: Record<SituacaoEvento, string> = {
  prevista: "Prevista",
  atrasada: "Atrasada",
  realizada: "Realizada",
  agendada: "Agendada",
};

/** Cores por situação: previstas azul, atrasadas vermelho, realizadas verde, agendadas rosa. */
const ESTILO_SITUACAO: Record<SituacaoEvento, { fundo: string; texto: string; ponto: string }> = {
  prevista: { fundo: "bg-[#2563EB]", texto: "text-white", ponto: "bg-[#2563EB]" },
  atrasada: { fundo: "bg-[#DC2626]", texto: "text-white", ponto: "bg-[#DC2626]" },
  realizada: { fundo: "bg-[#059669]", texto: "text-white", ponto: "bg-[#059669]" },
  agendada: { fundo: "bg-[#DB2777]", texto: "text-white", ponto: "bg-[#DB2777]" },
};

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function chaveDia(data: Date): string {
  return format(data, "yyyy-MM-dd");
}

function intervaloDo(modo: ModoAgenda, cursor: Date): { inicio: Date; fim: Date } {
  if (modo === "dia") return { inicio: cursor, fim: cursor };
  if (modo === "semana") {
    return {
      inicio: startOfWeek(cursor, OPCAO_SEMANA),
      fim: endOfWeek(cursor, OPCAO_SEMANA),
    };
  }
  return {
    inicio: startOfWeek(startOfMonth(cursor), OPCAO_SEMANA),
    fim: endOfWeek(endOfMonth(cursor), OPCAO_SEMANA),
  };
}

function tituloDo(modo: ModoAgenda, cursor: Date, inicio: Date, fim: Date): string {
  if (modo === "dia")
    return capitalizar(format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }));
  if (modo === "semana") {
    return `${format(inicio, "d MMM", { locale: ptBR })} – ${format(fim, "d MMM yyyy", { locale: ptBR })}`;
  }
  return capitalizar(format(cursor, "MMMM 'de' yyyy", { locale: ptBR }));
}

/** Tamanho legível de um anexo: "512 KB" ou "2,4 MB". */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Rótulo de horário do evento: "09:00 – 10:30", "09:00" ou "Dia inteiro". */
function rotuloHorario(inicio: string | null, fim: string | null): string {
  if (!inicio) return "Dia inteiro";
  return fim ? `${inicio} – ${fim}` : inicio;
}

/** Hora exibida ao lado do compromisso: horário do evento, ou "Reunião" para tipos sem hora. */
function rotuloHoraCompromisso(evento: EventoAgenda): string {
  if (evento.horario) return evento.horario;
  return evento.tipo ? "Reunião" : "Dia inteiro";
}

export interface AgendaAtasProps {
  tipos: TipoReuniao[];
  atas: Ata[];
  agendados: AgendaEvento[];
  pessoas: UsuarioAtaRow[];
  sessao: UserSession | null;
  usuarioId: string | null;
  podeGerenciar: boolean;
  carregando: boolean;
  onVerAta: (ata: Ata) => void;
  /** Chamado após criar ou excluir um evento, para recarregar a agenda. */
  onAlterado: () => void;
}

export function AgendaAtas({
  tipos,
  atas,
  agendados,
  pessoas,
  sessao,
  usuarioId,
  podeGerenciar,
  carregando,
  onVerAta,
  onAlterado,
}: AgendaAtasProps) {
  const [modo, setModo] = useState<ModoAgenda>("mes");
  /** Dia em foco: é o dia selecionado no mês, o da semana ou o do modo dia. */
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [eventoAberto, setEventoAberto] = useState<EventoAgenda | null>(null);
  const [novoEventoAberto, setNovoEventoAberto] = useState(false);
  /** Evento que o formulário está editando; `null` quando é um evento novo. */
  const [eventoEmEdicao, setEventoEmEdicao] = useState<AgendaEvento | null>(null);
  const [eventoParaExcluir, setEventoParaExcluir] = useState<AgendaEvento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const hoje = useMemo(() => startOfDay(new Date()), []);
  const { inicio, fim } = useMemo(() => intervaloDo(modo, cursor), [modo, cursor]);

  const eventos = useMemo(
    () => montarAgenda(tipos, atas, agendados, inicio, fim, usuarioId, hoje),
    [tipos, atas, agendados, inicio, fim, usuarioId, hoje],
  );

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const evento of eventos) {
      const chave = chaveDia(evento.data);
      mapa.set(chave, [...(mapa.get(chave) ?? []), evento]);
    }
    return mapa;
  }, [eventos]);

  const dias = useMemo(() => eachDayOfInterval({ start: inicio, end: fim }), [inicio, fim]);
  const semanas = useMemo(() => {
    const grupos: Date[][] = [];
    for (let i = 0; i < dias.length; i += 7) grupos.push(dias.slice(i, i + 7));
    return grupos;
  }, [dias]);

  const nomesPorId = useMemo(
    () => new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome.trim()])),
    [pessoas],
  );

  /**
   * Há reuniões para o usuário? Sim se ele tem evento avulso (criador ou convidado),
   * ata de um tipo em que participa, ou tipo recorrente ativo em que participa.
   */
  const temReunioes = useMemo(() => {
    if (!usuarioId) return false;
    const tiposDoUsuario = tipos.filter((tipo) => envolvidoNoTipo(tipo, usuarioId));
    const idsDoUsuario = new Set(tiposDoUsuario.map((tipo) => tipo.id));
    return (
      agendados.some(
        (evento) =>
          evento.criadoPor === usuarioId ||
          evento.convidados.some((pessoa) => pessoa.id === usuarioId),
      ) ||
      atas.some((ata) => ata.tipoReuniaoId !== null && idsDoUsuario.has(ata.tipoReuniaoId)) ||
      tiposDoUsuario.some((tipo) => tipo.ativo && tipo.periodicidade !== "avulsa")
    );
  }, [tipos, atas, agendados, usuarioId]);

  function eventosDo(dia: Date): EventoAgenda[] {
    return eventosPorDia.get(chaveDia(dia)) ?? [];
  }

  function navegar(direcao: -1 | 1) {
    setCursor((atual) => {
      if (modo === "dia") return addDays(atual, direcao);
      if (modo === "semana") return addDays(atual, 7 * direcao);
      return addMonths(atual, direcao);
    });
  }

  function irParaDia(dia: Date) {
    setCursor(startOfDay(dia));
    setModo("dia");
  }

  function abrirNovoEvento() {
    setEventoEmEdicao(null);
    setNovoEventoAberto(true);
  }

  function fecharFormularioEvento() {
    setNovoEventoAberto(false);
    setEventoEmEdicao(null);
  }

  async function enviarAnexo(agendado: AgendaEvento, arquivo: File): Promise<AgendaEvento> {
    const atualizado = await enviarAnexoAgenda(agendado.id, arquivo, sessao);
    onAlterado();
    return atualizado;
  }

  async function removerAnexo(agendado: AgendaEvento, anexo: AnexoAgenda): Promise<AgendaEvento> {
    const atualizado = await removerAnexoAgenda(agendado.id, anexo.caminho, sessao);
    onAlterado();
    return atualizado;
  }

  async function alterarRealizada(agendado: AgendaEvento, marcar: boolean) {
    try {
      await marcarAgendaEventoRealizada(agendado.id, marcar, sessao);
      toast.success(marcar ? "Evento marcado como realizado" : "Evento reaberto como agendado");
      setEventoAberto(null);
      onAlterado();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function confirmarExclusao() {
    if (!eventoParaExcluir || excluindo) return;
    setExcluindo(true);
    try {
      await excluirAgendaEvento(eventoParaExcluir.id, sessao);
      toast.success("Evento excluído da agenda");
      setEventoAberto(null);
      onAlterado();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setExcluindo(false);
      setEventoParaExcluir(null);
    }
  }

  const tituloPeriodo = tituloDo(modo, cursor, inicio, fim);

  return (
    <div className="space-y-4">
      {/* Cabeçalho: navegação, período, criação e modo de visualização */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#D9E0EA] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2.5"
            onClick={() => navegar(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2.5"
            onClick={() => navegar(1)}
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="ml-2 text-[15px] font-semibold text-[#1F2937]">{tituloPeriodo}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="h-9 rounded-full px-4"
            disabled={!usuarioId}
            title={
              usuarioId
                ? undefined
                : "Seu e-mail não está cadastrado como colaborador. Procure a Qualidade."
            }
            onClick={abrirNovoEvento}
          >
            <Plus className="h-4 w-4" />
            Alimentar Agenda
          </Button>
          <div className="inline-flex rounded-lg bg-[#F1F5F9] p-1">
            {MODOS.map((item) => (
              <button
                key={item.valor}
                type="button"
                onClick={() => {
                  // "Hoje" sempre abre o dia de hoje; Mês e Semana mantêm o dia em foco.
                  if (item.valor === "dia") setCursor(startOfDay(new Date()));
                  setModo(item.valor);
                }}
                className={`rounded-md px-3 py-1 text-[12px] font-semibold transition-colors ${
                  modo === item.valor
                    ? "bg-white text-[#1F2937] shadow-sm"
                    : "text-[#64748B] hover:text-[#1F2937]"
                }`}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aviso discreto: a agenda continua visível, mesmo sem reuniões */}
      {!carregando && !temReunioes ? (
        <p className="rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-[13px] text-[#64748B]">
          Nenhuma reunião marcada ainda. Use Alimentar Agenda para marcar a primeira.
          {!usuarioId ? (
            <span className="mt-1 block text-[12px] text-[#92400E]">
              Não encontramos o e-mail "{sessao?.email?.trim() || "(sem e-mail na sessão)"}" na
              lista de usuários, por isso o botão está indisponível. Se o seu e-mail é outro, saia e
              entre de novo; se não está cadastrado, peça à Qualidade.
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#64748B]">
        {(Object.keys(ROTULO_SITUACAO) as SituacaoEvento[]).map((situacao) => (
          <span key={situacao} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${ESTILO_SITUACAO[situacao].ponto}`} />
            {ROTULO_SITUACAO[situacao]}
          </span>
        ))}
      </div>

      <div className={modo === "mes" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" : undefined}>
        <div className="min-w-0">
          {carregando ? (
            <p className="rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
              Carregando agenda…
            </p>
          ) : modo === "mes" ? (
            <VisaoMes
              semanas={semanas}
              mesAtual={cursor}
              selecionado={cursor}
              hoje={hoje}
              eventosDo={eventosDo}
              onSelecionar={setCursor}
              onEvento={setEventoAberto}
            />
          ) : modo === "semana" ? (
            <VisaoSemana
              dias={dias}
              hoje={hoje}
              eventosDo={eventosDo}
              onDia={irParaDia}
              onEvento={setEventoAberto}
            />
          ) : (
            <VisaoDia
              dia={cursor}
              eventos={eventosDo(cursor)}
              nomesPorId={nomesPorId}
              onEvento={setEventoAberto}
            />
          )}
        </div>

        {modo === "mes" && !carregando ? (
          <PainelDia
            dia={cursor}
            hoje={hoje}
            eventos={eventosDo(cursor)}
            nomesPorId={nomesPorId}
            podeCriar={Boolean(usuarioId)}
            onEvento={setEventoAberto}
            onNovo={abrirNovoEvento}
          />
        ) : null}
      </div>

      <DetalheEvento
        evento={eventoAberto}
        usuarioId={usuarioId}
        podeGerenciar={podeGerenciar}
        nomesPorId={nomesPorId}
        onFechar={() => setEventoAberto(null)}
        onVerAta={(ata) => {
          setEventoAberto(null);
          onVerAta(ata);
        }}
        onExcluir={(agendado) => setEventoParaExcluir(agendado)}
        onMarcarRealizada={(agendado, marcar) => void alterarRealizada(agendado, marcar)}
        onEnviarAnexo={enviarAnexo}
        onRemoverAnexo={removerAnexo}
        onEditar={(agendado) => {
          setEventoAberto(null);
          setEventoEmEdicao(agendado);
          setNovoEventoAberto(true);
        }}
      />

      <NovoEventoAgendaDialog
        aberto={novoEventoAberto}
        dataPadrao={chaveDia(cursor)}
        pessoas={pessoas}
        sessao={sessao}
        evento={eventoEmEdicao}
        onFechar={fecharFormularioEvento}
        onSalvo={() => {
          fecharFormularioEvento();
          onAlterado();
        }}
      />

      <ConfirmarDialog
        open={eventoParaExcluir !== null}
        onOpenChange={(abre) => (!abre ? setEventoParaExcluir(null) : undefined)}
        tom="warning"
        titulo="Excluir evento?"
        {...(eventoParaExcluir
          ? {
              descricao: (
                <>
                  O evento <strong>{eventoParaExcluir.titulo}</strong> será removido da agenda de
                  todos os convidados. Essa ação não pode ser desfeita.
                </>
              ),
            }
          : {})}
        textoConfirmar={excluindo ? "Excluindo…" : "Excluir"}
        carregando={excluindo}
        onConfirmar={() => void confirmarExclusao()}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                       */
/* -------------------------------------------------------------------------- */

function ChipEvento({ evento, onClick }: { evento: EventoAgenda; onClick: () => void }) {
  const estilo = ESTILO_SITUACAO[evento.situacao];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${evento.horario ? `${evento.horario} · ` : ""}${evento.titulo} · ${ROTULO_SITUACAO[evento.situacao]}`}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${estilo.fundo} ${estilo.texto}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
      {evento.horario ? <span className="shrink-0 font-semibold">{evento.horario}</span> : null}
      <span className="truncate">{evento.titulo}</span>
    </button>
  );
}

function VisaoMes({
  semanas,
  mesAtual,
  selecionado,
  hoje,
  eventosDo,
  onSelecionar,
  onEvento,
}: {
  semanas: Date[][];
  mesAtual: Date;
  selecionado: Date;
  hoje: Date;
  eventosDo: (dia: Date) => EventoAgenda[];
  onSelecionar: (dia: Date) => void;
  onEvento: (evento: EventoAgenda) => void;
}) {
  const LIMITE_VISIVEIS = 3;

  return (
    <div className="overflow-hidden rounded-xl border border-[#D9E0EA] bg-white">
      <div className="grid grid-cols-7 border-b border-[#E9EEF5] bg-[#F8FAFC]">
        {DIAS_DA_SEMANA.map((rotulo) => (
          <div
            key={rotulo}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]"
          >
            {rotulo}
          </div>
        ))}
      </div>

      {semanas.map((semana) => (
        <div key={semana[0]?.toISOString()} className="grid grid-cols-7">
          {semana.map((dia) => {
            const doMes = isSameMonth(dia, mesAtual);
            const ehHoje = isSameDay(dia, hoje);
            const ehSelecionado = isSameDay(dia, selecionado);
            const eventosDia = eventosDo(dia);
            const visiveis = eventosDia.slice(0, LIMITE_VISIVEIS);
            const restantes = eventosDia.length - visiveis.length;

            return (
              <div
                key={dia.toISOString()}
                onClick={() => onSelecionar(dia)}
                className={`flex min-h-[64px] cursor-pointer flex-col gap-1 border-b border-r border-[#E9EEF5] p-1 transition-colors last:border-r-0 hover:bg-[#F8FAFC] sm:min-h-[104px] sm:p-1.5 ${
                  ehSelecionado
                    ? "bg-[#EFF6FF] ring-2 ring-inset ring-[#1E3A8A]"
                    : doMes
                      ? "bg-white"
                      : "bg-[#FAFBFD]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center self-end rounded-full text-[12px] font-semibold ${
                    ehHoje ? "bg-[#1E3A8A] text-white" : doMes ? "text-[#1F2937]" : "text-[#94A3B8]"
                  }`}
                >
                  {format(dia, "d")}
                </span>

                {/* Celular: bolinhas coloridas. Telas maiores: título dos compromissos. */}
                {eventosDia.length > 0 ? (
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {eventosDia.slice(0, 4).map((evento) => (
                      <span
                        key={evento.chave}
                        className={`h-1.5 w-1.5 rounded-full ${ESTILO_SITUACAO[evento.situacao].ponto}`}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="hidden flex-col gap-1 sm:flex">
                  {visiveis.map((evento) => (
                    <ChipEvento
                      key={evento.chave}
                      evento={evento}
                      onClick={() => onEvento(evento)}
                    />
                  ))}
                  {restantes > 0 ? (
                    <span className="px-1.5 text-[11px] font-semibold text-[#1E3A8A]">
                      +{restantes} mais
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PainelDia({
  dia,
  hoje,
  eventos,
  nomesPorId,
  podeCriar,
  onEvento,
  onNovo,
}: {
  dia: Date;
  hoje: Date;
  eventos: EventoAgenda[];
  nomesPorId: Map<string, string>;
  podeCriar: boolean;
  onEvento: (evento: EventoAgenda) => void;
  onNovo: () => void;
}) {
  const ehHoje = isSameDay(dia, hoje);
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-[#D9E0EA] bg-white p-4 lg:sticky lg:top-4 lg:self-start">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          {ehHoje ? "Hoje · " : ""}
          {capitalizar(format(dia, "EEEE", { locale: ptBR }))}
        </p>
        <h4 className="mt-1 text-[20px] font-semibold text-[#1F2937]">
          {format(dia, "d 'de' MMMM", { locale: ptBR })}
        </h4>
      </div>

      <Button type="button" className="w-full rounded-full" disabled={!podeCriar} onClick={onNovo}>
        <Plus className="h-4 w-4" />
        Alimentar Agenda neste dia
      </Button>

      <div className="border-t border-[#EEF2F7] pt-3">
        {eventos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CalendarDays className="h-6 w-6 text-[#94A3B8]" />
            <p className="text-[13px] text-[#64748B]">Nada marcado para este dia.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {eventos.map((evento) => {
              const estilo = ESTILO_SITUACAO[evento.situacao];
              const criador = evento.agendado
                ? (nomesPorId.get(evento.agendado.criadoPor) ?? "colaborador")
                : null;
              return (
                <li key={evento.chave}>
                  <button
                    type="button"
                    onClick={() => onEvento(evento)}
                    className={`flex w-full items-stretch gap-3 rounded-lg px-2 py-2 text-left transition-opacity hover:opacity-90 ${estilo.fundo}`}
                  >
                    <span className="w-1 shrink-0 rounded-full bg-white/70" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white/80">
                        {rotuloHoraCompromisso(evento)}
                      </p>
                      <p className="truncate text-[14px] font-medium text-white">{evento.titulo}</p>
                      <p className={`mt-0.5 text-[11px] font-semibold ${estilo.texto}`}>
                        {ROTULO_SITUACAO[evento.situacao]}
                        {criador ? ` · criado por ${criador}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function VisaoSemana({
  dias,
  hoje,
  eventosDo,
  onDia,
  onEvento,
}: {
  dias: Date[];
  hoje: Date;
  eventosDo: (dia: Date) => EventoAgenda[];
  onDia: (dia: Date) => void;
  onEvento: (evento: EventoAgenda) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#D9E0EA] bg-white">
      <div className="grid min-w-[760px] grid-cols-7">
        {dias.map((dia) => {
          const ehHoje = isSameDay(dia, hoje);
          const eventosDia = eventosDo(dia);
          return (
            <div
              key={dia.toISOString()}
              className="flex min-h-[260px] flex-col gap-1.5 border-r border-[#E9EEF5] p-2 last:border-r-0"
            >
              <button
                type="button"
                onClick={() => onDia(dia)}
                className="flex items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-[#F8FAFC]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {DIAS_DA_SEMANA[dia.getDay()]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                    ehHoje ? "bg-[#1E3A8A] text-white" : "text-[#1F2937]"
                  }`}
                >
                  {format(dia, "d")}
                </span>
              </button>

              {eventosDia.length === 0 ? (
                <p className="px-1 text-[11px] text-[#CBD5E1]">—</p>
              ) : (
                eventosDia.map((evento) => (
                  <ChipEvento key={evento.chave} evento={evento} onClick={() => onEvento(evento)} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisaoDia({
  dia,
  eventos,
  nomesPorId,
  onEvento,
}: {
  dia: Date;
  eventos: EventoAgenda[];
  nomesPorId: Map<string, string>;
  onEvento: (evento: EventoAgenda) => void;
}) {
  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#D9E0EA] bg-white px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <CalendarDays className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhum evento neste dia</h3>
        <p className="mt-1.5 text-sm text-[#64748B]">
          {format(dia, "dd/MM/yyyy")} não tem reuniões nem eventos para você. Use “Alimentar Agenda”
          para marcar um.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {eventos.map((evento) => {
        const estilo = ESTILO_SITUACAO[evento.situacao];
        const subtitulo = evento.tipo
          ? `${PERIODICIDADE_LABELS[evento.tipo.periodicidade]} · ${evento.tipo.participantes.length} participante${evento.tipo.participantes.length === 1 ? "" : "s"}`
          : `${rotuloHorario(evento.agendado?.horaInicio ?? null, evento.agendado?.horaFim ?? null)}${
              evento.agendado?.convidados.length
                ? ` · ${evento.agendado.convidados.length} convidado${evento.agendado.convidados.length === 1 ? "" : "s"}`
                : ""
            }`;
        return (
          <li key={evento.chave}>
            <button
              type="button"
              onClick={() => onEvento(evento)}
              className="flex w-full items-stretch overflow-hidden rounded-xl border border-[#D9E0EA] bg-white text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <span className={`w-1.5 shrink-0 ${estilo.ponto}`} />
              <div className="flex flex-1 flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#1F2937]">{evento.titulo}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{subtitulo}</p>
                  {evento.agendado ? (
                    <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                      Criado por{" "}
                      {evento.agendado.criadoPor && nomesPorId.get(evento.agendado.criadoPor)
                        ? nomesPorId.get(evento.agendado.criadoPor)
                        : "colaborador"}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${estilo.fundo} ${estilo.texto}`}
                >
                  {ROTULO_SITUACAO[evento.situacao]}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DetalheEvento({
  evento,
  usuarioId,
  podeGerenciar,
  nomesPorId,
  onFechar,
  onVerAta,
  onExcluir,
  onMarcarRealizada,
  onEditar,
  onEnviarAnexo,
  onRemoverAnexo,
}: {
  evento: EventoAgenda | null;
  usuarioId: string | null;
  podeGerenciar: boolean;
  nomesPorId: Map<string, string>;
  onFechar: () => void;
  onVerAta: (ata: Ata) => void;
  onExcluir: (agendado: AgendaEvento) => void;
  onMarcarRealizada: (agendado: AgendaEvento, marcar: boolean) => void;
  onEditar: (agendado: AgendaEvento) => void;
  onEnviarAnexo: (agendado: AgendaEvento, arquivo: File) => Promise<AgendaEvento>;
  onRemoverAnexo: (agendado: AgendaEvento, anexo: AnexoAgenda) => Promise<AgendaEvento>;
}) {
  const estilo = evento ? ESTILO_SITUACAO[evento.situacao] : null;
  const agendado = evento?.agendado ?? null;
  const podeExcluir = Boolean(
    agendado && (podeGerenciar || (usuarioId !== null && agendado.criadoPor === usuarioId)),
  );
  const podeAnexar = Boolean(
    agendado &&
    usuarioId &&
    (podeGerenciar ||
      agendado.criadoPor === usuarioId ||
      agendado.convidados.some((pessoa) => pessoa.id === usuarioId)),
  );

  // Anexos ficam em estado local para aparecerem logo após enviar ou remover.
  const [anexos, setAnexos] = useState<AnexoAgenda[]>([]);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  useEffect(() => {
    setAnexos(evento?.agendado?.anexos ?? []);
  }, [evento]);

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !agendado) return;
    setEnviandoAnexo(true);
    try {
      const atualizado = await onEnviarAnexo(agendado, arquivo);
      setAnexos(atualizado.anexos);
      toast.success("Anexo enviado");
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function abrirAnexo(anexo: AnexoAgenda) {
    try {
      const url = await urlAnexoAgenda(anexo.caminho);
      window.open(url, "_blank", "noopener");
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    }
  }

  async function removerAnexo(anexo: AnexoAgenda) {
    if (!agendado) return;
    if (!window.confirm(`Remover o anexo "${anexo.nome}"? O arquivo será apagado.`)) return;
    try {
      const atualizado = await onRemoverAnexo(agendado, anexo);
      setAnexos(atualizado.anexos);
      toast.success("Anexo removido");
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    }
  }

  return (
    <Dialog open={evento !== null} onOpenChange={(aberto) => (!aberto ? onFechar() : undefined)}>
      <DialogContent className="sm:max-w-3xl">
        {evento && estilo ? (
          <>
            <DialogHeader>
              <DialogTitle>{evento.titulo}</DialogTitle>
              <DialogDescription>
                {capitalizar(format(evento.data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }))}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-[13px]">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${estilo.fundo} ${estilo.texto}`}
              >
                {ROTULO_SITUACAO[evento.situacao]}
              </span>

              {agendado ? (
                <>
                  <div className="grid gap-3 border-t border-[#EEF2F7] pt-3 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Clock className="h-3 w-3" />
                        Horário
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {rotuloHorario(agendado.horaInicio, agendado.horaFim)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        Criado por
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {agendado.criadoPor === usuarioId
                          ? "Você"
                          : (nomesPorId.get(agendado.criadoPor) ?? "colaborador")}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Users className="h-3 w-3" />
                        Convidados
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {agendado.convidados.map((pessoa) => `@${pessoa.nome}`).join("  ") || "—"}
                      </p>
                    </div>
                    {agendado.descricao ? (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                          Descrição
                        </p>
                        <p className="mt-1 whitespace-pre-line text-[#334155]">
                          {agendado.descricao}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-[#EEF2F7] pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Paperclip className="h-3 w-3" />
                        Anexos
                      </p>
                      {podeAnexar ? (
                        <label
                          className={`inline-flex cursor-pointer items-center text-[12px] font-semibold text-[#1E3A8A] hover:underline ${
                            enviandoAnexo ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          {enviandoAnexo ? "Enviando…" : "+ Adicionar arquivo"}
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(e) => void aoEscolherArquivo(e)}
                            disabled={enviandoAnexo}
                          />
                        </label>
                      ) : null}
                    </div>
                    {anexos.length === 0 ? (
                      <p className="mt-2 text-[12px] text-[#94A3B8]">Nenhum anexo.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {anexos.map((anexo) => (
                          <li
                            key={anexo.caminho}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#EEF2F7] px-3 py-2"
                          >
                            <button
                              type="button"
                              onClick={() => void abrirAnexo(anexo)}
                              className="min-w-0 truncate text-left text-[13px] font-medium text-[#1E3A8A] hover:underline"
                            >
                              {anexo.nome}
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[11px] text-[#94A3B8]">
                                {formatarTamanho(anexo.tamanho)}
                              </span>
                              {podeExcluir ? (
                                <button
                                  type="button"
                                  aria-label={`Remover ${anexo.nome}`}
                                  onClick={() => void removerAnexo(anexo)}
                                  className="text-[#B91C1C] hover:opacity-80"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {podeExcluir ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F7] pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[12px]"
                        onClick={() => onMarcarRealizada(agendado, !agendado.realizada)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {agendado.realizada ? "Reabrir como agendada" : "Marcar como realizada"}
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[12px] text-[#334155]"
                          onClick={() => onEditar(agendado)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[12px] text-[#B91C1C]"
                          onClick={() => onExcluir(agendado)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir evento
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="grid gap-3 border-t border-[#EEF2F7] pt-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        Periodicidade
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {evento.tipo ? PERIODICIDADE_LABELS[evento.tipo.periodicidade] : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Users className="h-3 w-3" />
                        Participantes
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {evento.tipo?.participantes.map((p) => p.nome).join(", ") || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Users className="h-3 w-3" />
                        Signatários
                      </p>
                      <p className="mt-1 text-[#334155]">
                        {evento.tipo?.signatarios.map((p) => p.nome).join(", ") || "—"}
                      </p>
                    </div>
                  </div>

                  {evento.ata ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-4 py-3">
                      <p className="min-w-0 truncate text-[#334155]">{evento.ata.titulo}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 text-[12px]"
                        onClick={() => onVerAta(evento.ata as Ata)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ver ata
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[#64748B]">Ainda não há ata registrada para esta reunião.</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
