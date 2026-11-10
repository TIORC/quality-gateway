/**
 * Dashboard das ocorrências: indicadores, ocorrências por setor, por tipo e mês,
 * julgamento das reclamações, causas que mais se repetem e prioridade das abertas.
 * Usa só os dados reais da lista recebida (filtros de período, tipo e setor).
 */
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PRIORIDADE_LABELS,
  acoesExecutadasDe,
  apuracaoFerramentasDe,
  causaRaizDaApuracao,
  type Ocorrencia,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";

const DIA_MS = 86_400_000;
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Grupo = "nc" | "reclamacao" | "multa" | "outro";
const GRUPO_LABEL: Record<Grupo, string> = {
  nc: "NC + erros",
  reclamacao: "Reclamações",
  multa: "Multas",
  outro: "Outros",
};
const GRUPO_COR: Record<Grupo, string> = {
  nc: "#3B82F6",
  reclamacao: "#F59E0B",
  multa: "#A78BFA",
  outro: "#94A3B8",
};

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function grupoDe(o: Pick<Ocorrencia, "tipoNome">): Grupo {
  const n = normalizar(o.tipoNome ?? "");
  if (n.includes("nao conformidade") || n.includes("erro")) return "nc";
  if (n.includes("reclamacao")) return "reclamacao";
  if (n.includes("multa")) return "multa";
  return "outro";
}

/** Início do mês, `meses` meses atrás (inclui o mês atual como último). */
function inicioDoPeriodo(meses: number, base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() - (meses - 1), 1);
}

function diasEntre(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DIA_MS;
}

function percentual(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export function DashboardOcorrencias({
  ocorrencias,
  tipos,
}: {
  ocorrencias: Ocorrencia[];
  tipos: TipoOcorrencia[];
}) {
  const [meses, setMeses] = useState(3);
  const [tipoId, setTipoId] = useState("todos");
  const [setor, setSetor] = useState("todos");

  const agora = useMemo(() => new Date(), []);
  const inicio = useMemo(() => inicioDoPeriodo(meses, agora), [meses, agora]);
  const inicioAnterior = useMemo(
    () => new Date(inicio.getFullYear(), inicio.getMonth() - meses, 1),
    [inicio, meses],
  );

  const setores = useMemo(
    () => Array.from(new Set(ocorrencias.map((o) => o.abertaPorSetor).filter(Boolean))).sort(),
    [ocorrencias],
  );

  // Base filtrada por tipo e setor (sem o período).
  const base = useMemo(
    () =>
      ocorrencias.filter(
        (o) =>
          (tipoId === "todos" || o.tipoId === tipoId) &&
          (setor === "todos" || o.abertaPorSetor === setor),
      ),
    [ocorrencias, tipoId, setor],
  );

  const noPeriodo = useMemo(
    () => base.filter((o) => new Date(o.createdAt) >= inicio),
    [base, inicio],
  );
  const noPeriodoAnterior = useMemo(
    () => base.filter((o) => new Date(o.createdAt) >= inicioAnterior && new Date(o.createdAt) < inicio),
    [base, inicio, inicioAnterior],
  );

  // Indicadores.
  const registradas = noPeriodo.length;
  const variacao = percentual(registradas - noPeriodoAnterior.length, noPeriodoAnterior.length);
  const emAndamento = base.filter((o) => o.status !== "encerrada").length;
  const hoje = agora.toISOString().slice(0, 10);
  const acoesVencidas = base.flatMap((o) =>
    acoesExecutadasDe(o)
      .filter((a) => a.status !== "concluida" && a.prazo && a.prazo < hoje)
      .map(() => o.id),
  );
  const ocorrenciasComAcaoVencida = new Set(acoesVencidas).size;
  const totalAcoes = base.reduce((s, o) => s + acoesExecutadasDe(o).length, 0);
  const encerradasNoPeriodo = noPeriodo.filter((o) => o.status === "encerrada" && o.encerradaEm);
  const tempoMedio =
    encerradasNoPeriodo.length === 0
      ? null
      : Math.round(
          encerradasNoPeriodo.reduce((s, o) => s + diasEntre(o.createdAt, o.encerradaEm!), 0) /
            encerradasNoPeriodo.length,
        );
  const reincidencia = percentual(
    noPeriodo.filter((o) => o.reaberturas > 0).length,
    noPeriodo.length,
  );

  // Ocorrências por setor.
  const porSetor = useMemo(() => {
    const cont = new Map<string, number>();
    for (const o of noPeriodo) {
      const s = o.abertaPorSetor || "Sem setor";
      cont.set(s, (cont.get(s) ?? 0) + 1);
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]);
  }, [noPeriodo]);
  const maxSetor = Math.max(1, ...porSetor.map(([, n]) => n));

  // Por tipo e mês (empilhado por grupo).
  const mesesLista = useMemo(
    () =>
      Array.from({ length: meses }, (_, i) => {
        const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
        return {
          chave: `${d.getFullYear()}-${d.getMonth()}`,
          rotulo: `${MESES_CURTOS[d.getMonth()]}`,
        };
      }),
    [meses, inicio],
  );
  const dadosMes = useMemo(
    () =>
      mesesLista.map((m) => {
        const linha: Record<string, string | number> = { mes: m.rotulo };
        for (const g of Object.keys(GRUPO_LABEL) as Grupo[]) linha[g] = 0;
        for (const o of noPeriodo) {
          const d = new Date(o.createdAt);
          if (`${d.getFullYear()}-${d.getMonth()}` !== m.chave) continue;
          const g = grupoDe(o);
          linha[g] = (linha[g] as number) + 1;
        }
        return linha;
      }),
    [mesesLista, noPeriodo],
  );

  // Julgamento das reclamações (e multas), sem contar pendentes.
  const julgados = noPeriodo.filter(
    (o) =>
      grupoDe(o) === "reclamacao" &&
      (o.procedencia === "procedente" ||
        o.procedencia === "parcialmente_procedente" ||
        o.procedencia === "nao_procedente"),
  );
  const procedentes = julgados.filter((o) => o.procedencia === "procedente").length;
  const parciais = julgados.filter((o) => o.procedencia === "parcialmente_procedente").length;
  const improcedentes = julgados.length - procedentes - parciais;

  // Causas que mais se repetem (causa raiz registrada na apuração).
  const causas = useMemo(() => {
    const mapa = new Map<string, { texto: string; total: number; reincidentes: number }>();
    for (const o of noPeriodo) {
      const texto = causaRaizDaApuracao(apuracaoFerramentasDe(o)).trim();
      if (!texto) continue;
      const chave = normalizar(texto);
      const atual = mapa.get(chave) ?? { texto, total: 0, reincidentes: 0 };
      atual.total += 1;
      if (o.reaberturas > 0) atual.reincidentes += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [noPeriodo]);

  // Prioridade das abertas.
  const prioridades = ["alta", "media", "baixa", "a_definir"] as const;
  const abertasPorPrioridade = prioridades.map((p) => ({
    chave: p,
    rotulo: PRIORIDADE_LABELS[p],
    total: base.filter((o) => o.status !== "encerrada" && o.prioridade === p).length,
  }));
  const maxPrioridade = Math.max(1, ...abertasPorPrioridade.map((p) => p.total));
  const corPrioridade: Record<string, string> = {
    alta: "#F43F5E",
    media: "#F59E0B",
    baixa: "#3B82F6",
    a_definir: "#94A3B8",
  };

  const cartao = "rounded-xl border border-border bg-card p-5";
  const titulo = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[170px]">
          <Label className="text-[12px]">Período</Label>
          <Select value={String(meses)} onValueChange={(v) => setMeses(Number(v))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <Label className="text-[12px]">Tipo</Label>
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <Label className="text-[12px]">Setor</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {setores.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador
          rotulo="Registradas no período"
          valor={String(registradas)}
          detalhe={`${variacao >= 0 ? "+" : ""}${variacao}% vs período anterior`}
        />
        <Indicador rotulo="Em andamento" valor={String(emAndamento)} detalhe="abertas hoje" />
        <Indicador
          rotulo="Ações vencidas"
          valor={String(acoesVencidas.length)}
          cor="#F87171"
          detalhe={`em ${ocorrenciasComAcaoVencida} ocorrência(s) de ${totalAcoes} ação(ões)`}
        />
        <Indicador
          rotulo="Tempo médio até concluir"
          valor={tempoMedio === null ? "—" : `${tempoMedio}`}
          unidade={tempoMedio === null ? undefined : "dias"}
          detalhe={`${encerradasNoPeriodo.length} encerrada(s) no período`}
        />
        <Indicador
          rotulo="Reincidência"
          valor={`${reincidencia}%`}
          cor="#FBBF24"
          detalhe="ocorrências em novo ciclo"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cartao}>
          <p className={titulo}>Ocorrências por setor</p>
          <div className="mt-4 space-y-3">
            {porSetor.length === 0 && <p className="text-[13px] text-muted-foreground">Sem ocorrências no período.</p>}
            {porSetor.map(([nome, n]) => (
              <div key={nome} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-[13px] text-foreground/80">
                <span className="truncate">{nome}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${(n / maxSetor) * 100}%` }} />
                </div>
                <span className="text-right font-semibold">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cartao} lg:col-span-2`}>
          <p className={titulo}>Por tipo, mês a mês</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {(Object.keys(GRUPO_LABEL) as Grupo[]).map((g) => (
                  <Bar key={g} dataKey={g} name={GRUPO_LABEL[g]} stackId="tipos" fill={GRUPO_COR[g]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cartao}>
          <p className={titulo}>Reclamações · julgamento</p>
          {julgados.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">Nenhuma reclamação julgada no período.</p>
          ) : (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full">
                <div className="bg-[#F87171]" style={{ width: `${percentual(procedentes, julgados.length)}%` }} />
                <div className="bg-[#F59E0B]" style={{ width: `${percentual(parciais, julgados.length)}%` }} />
                <div className="bg-[#3B82F6]" style={{ width: `${percentual(improcedentes, julgados.length)}%` }} />
              </div>
              <p className="mt-3 text-[13px] text-foreground/80">
                <strong className="text-[#F87171]">{percentual(procedentes, julgados.length)}%</strong> procedentes (
                {procedentes}) · <strong className="text-[#F59E0B]">{percentual(parciais, julgados.length)}%</strong>{" "}
                parcialmente procedentes ({parciais}) ·{" "}
                <strong className="text-[#3B82F6]">{percentual(improcedentes, julgados.length)}%</strong>{" "}
                improcedentes ({improcedentes})
              </p>
            </>
          )}
        </div>

        <div className={`${cartao} lg:col-span-2`}>
          <p className={titulo}>Causas que mais se repetem</p>
          <div className="mt-3 divide-y divide-border">
            {causas.length === 0 && (
              <p className="py-3 text-[13px] text-muted-foreground">Nenhuma causa raiz registrada ainda.</p>
            )}
            {causas.map((c) => (
              <div key={c.texto} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-foreground/80">
                <span className="min-w-0 flex-1 truncate">{c.texto}</span>
                <span className="w-10 shrink-0 font-semibold">{c.total}×</span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={
                    c.reincidentes > 0
                      ? { backgroundColor: "#FEE2E2", color: "#991B1B" }
                      : { backgroundColor: "#FEF3C7", color: "#92400E" }
                  }
                >
                  {c.reincidentes > 0 ? "Reincidência" : "Atenção"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cartao}>
        <p className={titulo}>Prioridade das ocorrências abertas</p>
        <div className="mt-4 space-y-3">
          {abertasPorPrioridade.map((p) => (
            <div key={p.chave} className="grid grid-cols-[90px_1fr_32px] items-center gap-3 text-[13px] text-foreground/80">
              <span className="font-semibold">{p.rotulo}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(p.total / maxPrioridade) * 100}%`, backgroundColor: corPrioridade[p.chave] }}
                />
              </div>
              <span className="text-right font-semibold">{p.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  unidade,
  detalhe,
  cor,
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  detalhe: string;
  cor?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] text-black dark:text-white">{rotulo}</p>
      <p style={cor ? { color: cor } : undefined} className="mt-1 text-[28px] font-bold text-black dark:text-white">
        {valor}
        {unidade && <span className="ml-1 text-[14px] font-semibold text-muted-foreground">{unidade}</span>}
      </p>
      <p className="mt-1 text-[11px] text-black dark:text-white">{detalhe}</p>
    </div>
  );
}
