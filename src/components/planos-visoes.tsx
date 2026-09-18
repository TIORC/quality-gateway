import { useMemo, useState } from "react";
import { Columns3, Download } from "lucide-react";
import { PrazoBadge, PrioridadeDot, StatusBadge } from "@/components/plano-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_ACAO_LABELS, formatarPrazo } from "@/lib/planos";
import type { PlanoAcao } from "@/lib/planos";

export function CartaoLista({ planos, onAbrir }: { planos: PlanoAcao[]; onAbrir: (p: PlanoAcao) => void }) {
  return (
    <ul className="divide-y divide-[#EEF2F7]">
      {planos.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onAbrir(p)}
            className="flex w-full items-center gap-3 border-l-[3px] border-l-transparent px-4 py-3 text-left transition hover:bg-[#F8FAFC]">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-[#94A3B8]">{p.codigo || "—"} · {p.setor || "—"}</span>
                <StatusBadge status={p.status} />
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-medium text-[#1F2937]">{p.titulo}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                <span>{p.responsavelNome || "Sem responsável"}</span>
                <PrioridadeDot prioridade={p.prioridade} />
                <span className="hidden sm:inline">{p.origem}</span>
              </span>
            </span>
            <PrazoBadge plano={p} />
          </button>
        </li>
      ))}
    </ul>
  );
}
type Coluna =
  | "codigo" | "titulo" | "responsavel" | "seguidores" | "setor" | "origem" | "vinculo"
  | "prazo" | "status" | "prioridade" | "progresso" | "atualizado";

const COLUNAS: { id: Coluna; rotulo: string; fixa?: boolean }[] = [
  { id: "codigo", rotulo: "Código" }, { id: "titulo", rotulo: "Título", fixa: true },
  { id: "responsavel", rotulo: "Responsável" }, { id: "seguidores", rotulo: "Seguidores" },
  { id: "setor", rotulo: "Setor" },
  { id: "origem", rotulo: "Origem" }, { id: "vinculo", rotulo: "Vinculado a" },
  { id: "prazo", rotulo: "Prazo" },
  { id: "status", rotulo: "Status" }, { id: "prioridade", rotulo: "Prioridade" },
  { id: "progresso", rotulo: "Progresso" }, { id: "atualizado", rotulo: "Atualizado em" },
];

const PESO_PRIORIDADE: Record<string, number> = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 };

/** Preferência de colunas do usuário (mantém o contexto ao alternar de visão). */
const CHAVE_COLUNAS = "sgq.planos.tabela.colunas";

function valorDaColuna(p: PlanoAcao, col: Coluna): string | number {
  switch (col) {
    case "codigo": return p.codigo;
    case "titulo": return p.titulo.toLowerCase();
    case "responsavel": return p.responsavelNome.toLowerCase();
    case "seguidores": return p.seguidores.length;
    case "setor": return p.setor;
    case "origem": return p.origem;
    case "vinculo": return p.vinculoTipo;
    case "prazo": return p.prazo ?? "9999-12-31";
    case "status": return STATUS_ACAO_LABELS[p.status];
    case "prioridade": return PESO_PRIORIDADE[p.prioridade] ?? 9;
    case "progresso": return p.progresso;
    case "atualizado": return p.updatedAt;
  }
}

/** Texto plano da célula — usado em CSV/Excel/impressão. */
function textoDaColuna(p: PlanoAcao, col: Coluna): string {
  switch (col) {
    case "titulo": return p.titulo;
    case "responsavel": return p.responsavelNome;
    case "seguidores": return p.seguidores.join(", ");
    case "vinculo": return p.vinculoTipo ? `${p.vinculoTipo}: ${p.vinculoId}` : "";
    case "prazo": return formatarPrazo(p.prazo);
    case "status": return STATUS_ACAO_LABELS[p.status];
    case "progresso": return `${p.progresso}%`;
    case "atualizado": return p.updatedAt ? new Date(p.updatedAt).toLocaleString("pt-BR") : "—";
    default: return String(valorDaColuna(p, col) ?? "");
  }
}

function Celula({ plano, coluna }: { plano: PlanoAcao; coluna: Coluna }) {
  switch (coluna) {
    case "codigo": return <span className="font-mono text-[12px]">{plano.codigo || "—"}</span>;
    case "titulo": return <span className="font-medium">{plano.titulo}</span>;
    case "prazo": return <PrazoBadge plano={plano} />;
    case "status": return <StatusBadge status={plano.status} />;
    case "prioridade": return <PrioridadeDot prioridade={plano.prioridade} />;
    case "progresso": return <span className="font-mono text-[12px]">{plano.progresso}%</span>;
    case "seguidores": return <span className="text-[#64748B]">{plano.seguidores.length || "—"}</span>;
    case "origem": return <span className="text-[#64748B]">{plano.origem}</span>;
    case "vinculo": return <span className="text-[#64748B]">{plano.vinculoTipo || "—"}</span>;
    default: return <>{String(valorDaColuna(plano, coluna) || "—")}</>;
  }
}


export function TabelaPlanos({ planos, onAbrir }: { planos: PlanoAcao[]; onAbrir: (p: PlanoAcao) => void }) {
  const [ordem, setOrdem] = useState<{ col: Coluna; dir: 1 | -1 }>({ col: "prazo", dir: 1 });
  const [ocultas, setOcultas] = useState<Coluna[]>(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_COLUNAS);
      return bruto ? (JSON.parse(bruto) as Coluna[]) : [];
    } catch {
      return [];
    }
  });
  const visiveis = COLUNAS.filter((c) => c.fixa || !ocultas.includes(c.id));

  function alternarColuna(id: Coluna, marcada: boolean) {
    setOcultas((atual) => {
      const proximo = marcada ? atual.filter((c) => c !== id) : [...atual, id];
      try {
        localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(proximo));
      } catch {
        /* sem localStorage: a escolha vale só para a sessão atual */
      }
      return proximo;
    });
  }

  const ordenados = useMemo(
    () =>
      [...planos].sort((a, b) => {
        const va = valorDaColuna(a, ordem.col);
        const vb = valorDaColuna(b, ordem.col);
        if (va < vb) return -1 * ordem.dir;
        if (va > vb) return 1 * ordem.dir;
        return 0;
      }),
    [planos, ordem],
  );

  function baixar(conteudo: string, nome: string, tipo: string) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** CSV (BOM + ";") com as colunas visíveis — abre direto no Excel pt-BR. */
  function exportarCsv() {
    const cabecalho = visiveis.map((c) => c.rotulo).join(";");
    const linhas = ordenados
      .map((p) => visiveis.map((c) => `"${textoDaColuna(p, c.id).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    baixar(`\ufeff${cabecalho}\r\n${linhas}`, "planos-de-acao.csv", "text/csv;charset=utf-8");
  }

  /** Planilha HTML salva como .xls — abre no Excel/LibreOffice. */
  function exportarXls() {
    const th = visiveis.map((c) => `<th>${c.rotulo}</th>`).join("");
    const tr = ordenados
      .map((p) => `<tr>${visiveis.map((c) => `<td>${textoDaColuna(p, c.id)}</td>`).join("")}</tr>`)
      .join("");
    baixar(
      `<html><head><meta charset="utf-8" /></head><body><table border="1">` +
        `<thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></body></html>`,
      "planos-de-acao.xls",
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E9EEF5] px-3 py-2">
        <span className="flex-1 text-[12px] text-[#64748B]">{ordenados.length} ação(ões)</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="h-3.5 w-3.5" /> Colunas
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-2">
            <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Colunas visíveis
            </p>
            {COLUNAS.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-[#1F2937] transition hover:bg-[#F1F5F9]"
              >
                <Checkbox
                  checked={c.fixa || !ocultas.includes(c.id)}
                  disabled={c.fixa}
                  onCheckedChange={(v) => alternarColuna(c.id, v === true)}
                />
                {c.rotulo}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={exportarCsv}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportarXls}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>PDF / Imprimir</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E9EEF5] bg-[#F8FAFC]">
              {visiveis.map((c) => (
                <th key={c.id}>
                  <button type="button"
                    onClick={() => setOrdem((o) => ({ col: c.id, dir: o.col === c.id && o.dir === 1 ? -1 : 1 }))}
                    className="flex w-full items-center gap-1 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    {c.rotulo} {ordem.col === c.id ? (ordem.dir === 1 ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((p) => (
              <tr key={p.id} onClick={() => onAbrir(p)} className="cursor-pointer border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                {visiveis.map((c) => (
                  <td key={c.id} className="px-3 py-2.5">
                    <Celula plano={p} coluna={c.id} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
