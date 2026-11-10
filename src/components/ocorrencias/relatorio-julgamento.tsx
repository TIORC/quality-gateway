/**
 * Relatório do julgamento: texto livre (até 50.000 caracteres) e documentos
 * anexados, escritos pelo responsável antes da decisão de procedência.
 */
import { useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import {
  LIMITE_RELATORIO_JULGAMENTO,
  relatorioJulgamentoDe,
  type AnexoOcorrencia,
  type Ocorrencia,
} from "@/lib/ocorrencias";
import { enviarAnexo, salvarRelatorioJulgamento } from "@/lib/ocorrencias-crud";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import { AnexosVisualizador } from "@/components/ocorrencias/anexos-visualizador";

interface RelatorioJulgamentoProps {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  /** Quando false (ocorrência encerrada ou sem permissão), mostra só o conteúdo salvo. */
  editavel: boolean;
  onSalvo: () => Promise<void>;
}

export function RelatorioJulgamento({ ocorrencia: o, session, editavel, onSalvo }: RelatorioJulgamentoProps) {
  const salvo = relatorioJulgamentoDe(o);
  const [texto, setTexto] = useState(salvo?.texto ?? "");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const novos: AnexoOcorrencia[] = [];
      for (const arquivo of arquivos) {
        novos.push(await enviarAnexo(o.id, arquivo));
      }
      await salvarRelatorioJulgamento(o, texto, novos, session);
      setArquivos([]);
      toast.success("Relatório do julgamento salvo.");
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Relatório
      </h3>
      <p className="mt-1 text-[13px] text-[#64748B]">
        Descreva a apuração do julgamento e anexe os documentos que sustentam a decisão.
      </p>

      {editavel ? (
        <div className="mt-3 space-y-2">
          <Textarea
            className="min-h-[160px]"
            maxLength={LIMITE_RELATORIO_JULGAMENTO}
            placeholder="Escreva o relatório do julgamento…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end text-[11px] text-[#94A3B8]">
            {texto.length}/{LIMITE_RELATORIO_JULGAMENTO}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]">
              <Paperclip className="h-3.5 w-3.5" />
              {arquivos.length > 0 ? `${arquivos.length} documento(s)` : "Anexar documentos"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <p className="text-[11px] text-[#64748B]">
                {salvo
                  ? `Último registro: ${salvo.salvoPorNome || "—"} · ${formatarDataHoraBrasilia(salvo.salvoEm)}`
                  : "Ainda não registrado."}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={salvando}
                className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                onClick={() => void salvar()}
              >
                {salvando ? "Salvando…" : "Salvar relatório"}
              </Button>
            </div>
          </div>
          {salvo && salvo.anexos.length > 0 && (
            <div className="mt-2">
              <AnexosVisualizador anexos={salvo.anexos} />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-wrap rounded-lg bg-[#F8FAFC] p-3 text-[13px] text-[#334155]">
            {salvo?.texto || "Não registrado."}
          </p>
          {salvo && salvo.anexos.length > 0 && <AnexosVisualizador anexos={salvo.anexos} />}
        </div>
      )}
    </section>
  );
}
