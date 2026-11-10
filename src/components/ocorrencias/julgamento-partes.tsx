/**
 * Julgamento por partes: o responsável separa a reclamação em partes e marca
 * cada uma como procedente ou não-procedente. O resultado geral é derivado
 * delas. Depois de registrado, só o gestor (quem gerencia a ocorrência) edita.
 */
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import {
  PROCEDENCIA_LABELS,
  idCurto,
  itensJulgamentoDe,
  procedenciaDosItens,
  type ItemJulgamento,
  type Ocorrencia,
} from "@/lib/ocorrencias";
import { salvarItensJulgamento } from "@/lib/ocorrencias-crud";

interface JulgamentoPartesProps {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  /** Pode registrar o julgamento (responsável, na etapa atual). */
  editavel: boolean;
  /** Pode editar um julgamento já registrado (gestor). */
  gerencia: boolean;
  onSalvo: () => Promise<void>;
}

function parteNova(): ItemJulgamento {
  return { id: idCurto(), descricao: "", procedencia: "procedente" };
}

export function JulgamentoPartes({ ocorrencia: o, session, editavel, gerencia, onSalvo }: JulgamentoPartesProps) {
  const salvos = itensJulgamentoDe(o);
  const jaRegistrado = salvos.length > 0;
  const podeEditar = editavel && (!jaRegistrado || gerencia);
  const [itens, setItens] = useState<ItemJulgamento[]>(salvos.length > 0 ? salvos : [parteNova()]);
  const [salvando, setSalvando] = useState(false);

  function atualizar(id: string, mudanca: Partial<ItemJulgamento>) {
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, ...mudanca } : i)));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarItensJulgamento(o, itens, session);
      toast.success("Julgamento salvo.");
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  const resultadoGeral = procedenciaDosItens(itens);

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Julgamento — procedência por parte
      </h3>
      <p className="mt-1 text-[13px] text-[#64748B]">
        Separe a reclamação em partes e marque cada uma como procedente ou não-procedente. O solicitante
        verá o resultado em tempo real.
      </p>

      {podeEditar ? (
        <div className="mt-3 space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[200px] flex-1"
                placeholder="Descreva a parte da reclamação…"
                maxLength={1000}
                value={item.descricao}
                onChange={(e) => atualizar(item.id, { descricao: e.target.value })}
              />
              <Button
                type="button"
                size="sm"
                variant={item.procedencia === "procedente" ? "default" : "outline"}
                className={
                  item.procedencia === "procedente"
                    ? "bg-[#059669] text-white hover:bg-[#047857]"
                    : "text-[#64748B]"
                }
                onClick={() => atualizar(item.id, { procedencia: "procedente" })}
              >
                <CheckCircle2 className="h-4 w-4" />
                Procedente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={item.procedencia === "nao_procedente" ? "default" : "outline"}
                className={
                  item.procedencia === "nao_procedente"
                    ? "bg-[#E11D48] text-white hover:bg-[#BE123C]"
                    : "text-[#64748B]"
                }
                onClick={() => atualizar(item.id, { procedencia: "nao_procedente" })}
              >
                <AlertTriangle className="h-4 w-4" />
                Não-procedente
              </Button>
              {itens.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Remover parte"
                  onClick={() => setItens((atual) => atual.filter((i) => i.id !== item.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItens((atual) => [...atual, parteNova()])}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D9E0EA] px-4 py-2 text-[13px] font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]"
          >
            <Plus className="h-4 w-4" />
            Adicionar parte
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[12px] text-[#475569]">
              Resultado geral:{" "}
              <span className="font-semibold">
                {PROCEDENCIA_LABELS[resultadoGeral]}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              disabled={salvando}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              onClick={() => void salvar()}
            >
              {salvando ? "Salvando…" : jaRegistrado ? "Salvar alterações do julgamento" : "Registrar julgamento"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {salvos.length === 0 ? (
            <p className="text-[13px] text-[#94A3B8]">Julgamento ainda não registrado.</p>
          ) : (
            <ul className="space-y-2">
              {salvos.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#334155]"
                >
                  <span>{i.descricao}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      i.procedencia === "procedente"
                        ? "bg-[#ECFDF5] text-[#065F46]"
                        : "bg-[#FDECEE] text-[#991A1A]"
                    }`}
                  >
                    {PROCEDENCIA_LABELS[i.procedencia]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {jaRegistrado && !gerencia && editavel && (
            <p className="text-[11px] text-[#94A3B8]">Apenas o gestor pode editar um julgamento já registrado.</p>
          )}
        </div>
      )}
    </section>
  );
}
