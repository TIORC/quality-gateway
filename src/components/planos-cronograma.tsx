/**
 * Cronograma dos planos de ação: uma barra por ação, do início (criação) até o
 * prazo, agrupada por responsável, setor ou origem. Ações vencidas aparecem em vermelho.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { grupoDaOrigem, type GrupoOrigem } from "@/components/planos-kanban";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planoAtrasado, STATUS_ACAO_LABELS, type PlanoAcao, type StatusAcao } from "@/lib/planos";

const DIA = 86_400_000;
type Escala = "dia" | "semana" | "mes";
type Agrupar = "responsavel" | "setor" | "origem";

/** Janela de tempo visível para cada escala: começa alguns dias antes de hoje. */
const JANELA: Record<Escala, { antes: number; dias: number; passo: number }> = {
  dia: { antes: 3, dias: 14, passo: 1 },
  semana: { antes: 14, dias: 56, passo: 7 },
  mes: { antes: 60, dias: 180, passo: 30 },
};

const COR_STATUS: Record<string, string> = {
  nao_iniciado: "#94A3B8",
  aberta: "#94A3B8",
  em_andamento: "#22D3EE",
  impedida: "#FB7185",
  concluida: "#4ADE80",
  atrasada: "#22D3EE",
  cancelado: "#64748B",
};

const LEGENDA: { rotulo: string; cor: string }[] = [
  { rotulo: "Não iniciada", cor: COR_STATUS.nao_iniciado! },
  { rotulo: "Em andamento", cor: COR_STATUS.em_andamento! },
  { rotulo: "Impedida", cor: COR_STATUS.impedida! },
  { rotulo: "Concluída", cor: COR_STATUS.concluida! },
  { rotulo: "Vencida", cor: "#F43F5E" },
];

const ROTULO_GRUPO: Record<GrupoOrigem, string> = {
  Ocorrências: "Ocorrências",
  POP: "POP",
  Auditoria: "Auditoria",
  Reunião: "Reunião",
  Outras: "Outras",
};

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function chaveGrupo(p: PlanoAcao, agrupar: Agrupar): string {
  if (agrupar === "responsavel") return p.responsavelNome || "Sem responsável";
  if (agrupar === "setor") return p.setor || "Sem setor";
  return ROTULO_GRUPO[grupoDaOrigem(p.origem || "")];
}

export function CronogramaPlanos({
  planos,
  onAbrir,
}: {
  planos: PlanoAcao[];
  onAbrir: (p: PlanoAcao) => void;
}) {
  const [escala, setEscala] = useState<Escala>("semana");
  const [agrupar, setAgrupar] = useState<Agrupar>("responsavel");
  const [origem, setOrigem] = useState<string>("todas");
  const [mostrarConcluidas, setMostrarConcluidas] = useState(true);

  const janela = JANELA[escala];
  const inicio = useMemo(() => {
    const hoje = inicioDoDia(new Date());
    return new Date(hoje.getTime() - janela.antes * DIA);
  }, [janela.antes]);
  const fim = useMemo(() => new Date(inicio.getTime() + janela.dias * DIA), [inicio, janela.dias]);
  const posicao = (d: Date) => ((d.getTime() - inicio.getTime()) / (fim.getTime() - inicio.getTime())) * 100;

  // Ações com um intervalo para desenhar (precisam de prazo ou de conclusão).
  const comIntervalo = useMemo(() => {
    return planos
      .filter((p) => (origem === "todas" ? true : ROTULO_GRUPO[grupoDaOrigem(p.origem || "")] === origem))
      .filter((p) => mostrarConcluidas || p.status !== "concluida")
      .map((p) => {
        const inicioP = new Date(p.createdAt);
        const fimBruto =
          p.status === "concluida" && p.concluidaEm
            ? new Date(p.concluidaEm)
            : p.prazo
              ? new Date(`${p.prazo}T12:00:00`)
              : null;
        return { p, inicioP, fimP: fimBruto };
      })
      .filter((x): x is { p: PlanoAcao; inicioP: Date; fimP: Date } => x.fimP !== null)
      .filter((x) => x.fimP.getTime() >= inicio.getTime() && x.inicioP.getTime() <= fim.getTime());
  }, [planos, origem, mostrarConcluidas, inicio, fim]);

  const semPrazo = planos.filter((p) => !p.prazo && p.status !== "concluida").length;

  const grupos = useMemo(() => {
    const mapa = new Map<string, { p: PlanoAcao; inicioP: Date; fimP: Date }[]>();
    for (const item of comIntervalo) {
      const chave = chaveGrupo(item.p, agrupar);
      mapa.set(chave, [...(mapa.get(chave) ?? []), item]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [comIntervalo, agrupar]);

  // Marcas do eixo do tempo.
  const marcas = useMemo(() => {
    const lista: { d: Date; rotulo: string }[] = [];
    for (let t = 0; t <= janela.dias; t += janela.passo) {
      const d = new Date(inicio.getTime() + t * DIA);
      lista.push({
        d,
        rotulo:
          escala === "mes"
            ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
            : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      });
    }
    return lista;
  }, [inicio, janela.dias, janela.passo, escala]);

  const hoje = inicioDoDia(new Date());
  const hojeVisivel = hoje.getTime() >= inicio.getTime() && hoje.getTime() <= fim.getTime();

  const botao = (ativo: boolean) =>
    `rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
      ativo ? "bg-[#4F46E5] text-white" : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {(["dia", "semana", "mes"] as Escala[]).map((e) => (
            <button key={e} type="button" className={botao(escala === e)} onClick={() => setEscala(e)}>
              {e === "dia" ? "Dia" : e === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <div className="w-[190px]">
          <Select value={agrupar} onValueChange={(v) => setAgrupar(v as Agrupar)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="responsavel">Agrupar: responsável</SelectItem>
              <SelectItem value="setor">Agrupar: setor</SelectItem>
              <SelectItem value="origem">Agrupar: origem</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[190px]">
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Origem: todas</SelectItem>
              {Object.values(ROTULO_GRUPO).map((g) => (
                <SelectItem key={g} value={g}>
                  Origem: {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setMostrarConcluidas((v) => !v)}
          className="rounded-md border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground"
        >
          Mostrar concluídas: {mostrarConcluidas ? "sim" : "não"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        {LEGENDA.map((l) => (
          <span key={l.rotulo} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.cor }} />
            {l.rotulo}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[260px_1fr] border-b border-border">
            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ação · origem
            </div>
            <div className="relative h-8">
              {marcas.map((m, i) => (
                <span
                  key={i}
                  className="absolute top-2 -translate-x-1/2 text-[11px] text-muted-foreground"
                  style={{ left: `${posicao(m.d)}%` }}
                >
                  {m.rotulo}
                </span>
              ))}
            </div>
          </div>

          {grupos.length === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              Nenhuma ação com prazo para mostrar neste intervalo.
            </p>
          )}

          {grupos.map(([nomeGrupo, itens]) => (
            <div key={nomeGrupo} className="border-b border-border last:border-b-0">
              <div className="bg-muted/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                {nomeGrupo}
              </div>
              {itens.map(({ p, inicioP, fimP }) => {
                const vencida = planoAtrasado(p);
                const cor = vencida ? "#F43F5E" : (COR_STATUS[p.status] ?? "#94A3B8");
                const inicioVisivel = Math.max(inicioP.getTime(), inicio.getTime());
                const fimVisivel = Math.min(fimP.getTime(), fim.getTime());
                const esq = posicao(new Date(inicioVisivel));
                const larg = Math.max(1.5, posicao(new Date(fimVisivel)) - esq);
                const estiloBarra: CSSProperties = {
                  left: `${esq}%`,
                  width: `${larg}%`,
                  backgroundColor: cor,
                  backgroundImage:
                    p.status === "impedida"
                      ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0 6px, transparent 6px 12px)"
                      : undefined,
                };
                const rotuloStatus = vencida ? "Vencida" : STATUS_ACAO_LABELS[p.status as StatusAcao] ?? p.status;
                return (
                  <div key={p.id} className="grid grid-cols-[260px_1fr] items-center border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => onAbrir(p)}
                      className="px-4 py-2.5 text-left transition hover:bg-muted/50"
                    >
                      <span className="line-clamp-1 block text-[13px] font-semibold text-foreground">{p.titulo}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {p.origem}
                        {p.vinculoId ? ` · ${p.vinculoId}` : ""}
                      </span>
                    </button>
                    <div className="relative h-11">
                      {hojeVisivel && (
                        <span
                          className="absolute inset-y-0 w-px bg-[#60A5FA]/70"
                          style={{ left: `${posicao(hoje)}%` }}
                        />
                      )}
                      <div
                        className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-white shadow-sm"
                        style={estiloBarra}
                        title={`${p.titulo} · ${rotuloStatus}`}
                      >
                        <span className="truncate">
                          {rotuloStatus} · {new Date(fimP).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {semPrazo > 0 && (
        <p className="text-[12px] text-muted-foreground">
          {semPrazo} ação(ões) sem prazo definido não aparecem no cronograma.
        </p>
      )}
    </div>
  );
}
