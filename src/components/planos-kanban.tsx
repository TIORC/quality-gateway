/**
 * Visão Kanban de todas as ações: uma coluna por situação, com a origem de
 * cada ação (Ocorrências, POP, Auditoria, Reunião) em destaque no cartão.
 * Ações com prazo vencido aparecem em vermelho.
 */
import type { CSSProperties } from "react";
import { formatarPrazo, planoAtrasado, type PlanoAcao, type StatusAcao } from "@/lib/planos";

export type GrupoOrigem = "Ocorrências" | "POP" | "Auditoria" | "Reunião" | "Outras";

interface ColunaKanban {
  titulo: string;
  status: StatusAcao[];
  cor: string;
}

/** Colunas do quadro. "Atrasada" (status legado) segue na coluna Em andamento e aparece vermelha. */
const COLUNAS: ColunaKanban[] = [
  { titulo: "Não iniciadas", status: ["nao_iniciado", "aberta"], cor: "#94A3B8" },
  { titulo: "Em andamento", status: ["em_andamento", "atrasada"], cor: "#3B82F6" },
  { titulo: "Impedidas", status: ["impedida"], cor: "#F97316" },
  { titulo: "Concluídas", status: ["concluida"], cor: "#22C55E" },
];

/** Agrupa a origem do plano nos quatro tipos do quadro (o resto fica em "Outras"). */
export function grupoDaOrigem(origem: string): GrupoOrigem {
  const o = origem
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (o.includes("auditoria")) return "Auditoria";
  if (o.includes("ata") || o.includes("reuniao")) return "Reunião";
  if (o.includes("pop")) return "POP";
  if (
    o.includes("nao conformidade") ||
    o.includes("reclamacao") ||
    o.includes("solicitacao de cliente") ||
    o.includes("ocorrencia")
  )
    return "Ocorrências";
  return "Outras";
}

const ESTILO_GRUPO: Record<GrupoOrigem, CSSProperties> = {
  Ocorrências: { backgroundColor: "#FDE2E2", color: "#9F1239" },
  POP: { backgroundColor: "#DBEAFE", color: "#1E40AF" },
  Auditoria: { backgroundColor: "#CCFBF1", color: "#115E59" },
  Reunião: { backgroundColor: "#EDE9FE", color: "#5B21B6" },
  Outras: { backgroundColor: "#E2E8F0", color: "#334155" },
};

const VERMELHO = "#E11D48";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

export function KanbanPlanos({
  planos,
  onAbrir,
}: {
  planos: PlanoAcao[];
  onAbrir: (p: PlanoAcao) => void;
}) {
  return (
    <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
      {COLUNAS.map((coluna) => {
        const itens = planos.filter((p) => coluna.status.includes(p.status));
        return (
          <section
            key={coluna.titulo}
            className="flex min-h-[360px] flex-col rounded-xl border border-border bg-muted/40 p-3"
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <span
                className="text-[12px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: coluna.cor }}
              >
                {coluna.titulo}
              </span>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                {itens.length}
              </span>
            </header>

            <div className="flex flex-col gap-2.5">
              {itens.length === 0 && (
                <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">Nenhuma ação aqui.</p>
              )}
              {itens.map((p) => {
                const vencida = planoAtrasado(p);
                const grupo = grupoDaOrigem(p.origem || "");
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAbrir(p)}
                    className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition hover:shadow-md"
                    style={{
                      borderColor: vencida ? VERMELHO : undefined,
                      borderWidth: vencida ? 2 : undefined,
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold"
                        style={ESTILO_GRUPO[grupo]}
                      >
                        {grupo}
                      </span>
                      {p.origem && (
                        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                          {p.origem}
                          {p.vinculoId ? ` · ${p.vinculoId}` : ""}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">
                      {p.titulo}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${p.progresso}%`,
                          backgroundColor: vencida ? VERMELHO : coluna.cor,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="truncate">{p.responsavelNome || "Sem responsável"}</span>
                        <span>·</span>
                        <span
                          className="shrink-0 font-semibold"
                          style={vencida ? { color: VERMELHO } : undefined}
                        >
                          {vencida ? "Vencida · " : ""}
                          {formatarPrazo(p.prazo)}
                        </span>
                      </span>
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: "#4F46E5" }}
                        title={p.responsavelNome}
                      >
                        {iniciais(p.responsavelNome || "?")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
