/**
 * Evidências levantadas na Apuração: o que é, o que ela comprova e o anexo
 * (arquivo ou vínculo com outra ocorrência). Quem move a ocorrência registra
 * e remove evidências; os demais só leem.
 */
import { useState } from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePanelSession } from "@/components/panel-shell";
import { traduzErro } from "@/lib/organizacao";
import {
  LIMITE_TEXTO_OCORRENCIA,
  evidenciasDe,
  idCurto,
  type AnexoOcorrencia,
  type EvidenciaApuracao,
  type Ocorrencia,
} from "@/lib/ocorrencias";
import { enviarAnexo, salvarEvidencias, urlAssinada } from "@/lib/ocorrencias-crud";

type ModoAnexo = "nenhum" | "arquivo" | "vinculo";

interface EvidenciasApuracaoProps {
  ocorrencia: Ocorrencia;
  /** Quando false, a lista é somente leitura. */
  editavel: boolean;
  /** Quando false, o tipo não aceita anexos nas evidências. */
  permiteAnexos: boolean;
  /** Chamado após salvar ou remover, para o pai recarregar a ocorrência. */
  onAlterada: () => Promise<void>;
}

export function EvidenciasApuracao({
  ocorrencia,
  editavel,
  permiteAnexos,
  onAlterada,
}: EvidenciasApuracaoProps) {
  const session = usePanelSession();
  const evidencias = evidenciasDe(ocorrencia);
  const [formAberto, setFormAberto] = useState(false);
  const [oQue, setOQue] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [modo, setModo] = useState<ModoAnexo>("nenhum");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const podeSalvar =
    !salvando &&
    oQue.trim().length > 0 &&
    evidencia.trim().length > 0 &&
    (modo !== "arquivo" || arquivo !== null);

  function limparForm() {
    setOQue("");
    setEvidencia("");
    setModo("nenhum");
    setArquivo(null);
    setFormAberto(false);
  }

  async function adicionar() {
    setSalvando(true);
    try {
      let anexo: AnexoOcorrencia | null = null;
      if (modo === "arquivo" && arquivo) anexo = await enviarAnexo(ocorrencia.id, arquivo);
      const nova: EvidenciaApuracao = {
        id: idCurto(),
        oQue: oQue.trim(),
        evidencia: evidencia.trim(),
        anexo,
        vinculo: modo === "vinculo",
        criadoEm: new Date().toISOString(),
      };
      await salvarEvidencias(
        ocorrencia,
        [...evidencias, nova],
        "Evidência adicionada",
        nova.oQue,
        session,
      );
      toast.success("Evidência registrada.");
      limparForm();
      await onAlterada();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(ev: EvidenciaApuracao) {
    try {
      await salvarEvidencias(
        ocorrencia,
        evidencias.filter((x) => x.id !== ev.id),
        "Evidência removida",
        ev.oQue,
        session,
      );
      toast.success("Evidência removida.");
      await onAlterada();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  async function abrirAnexo(anexo: AnexoOcorrencia) {
    if (!anexo.caminho) return;
    try {
      const url = await urlAssinada(anexo.caminho);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  return (
    <div>
      {evidencias.length === 0 ? (
        <p className="text-[13px] text-[#64748B]">Nenhuma evidência registrada.</p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1.4fr_auto_auto] gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8] sm:grid">
            <span>O que é</span>
            <span>O que ela evidencia</span>
            <span>Anexo</span>
            <span />
          </div>
          {evidencias.map((ev) => (
            <div
              key={ev.id}
              className="grid gap-2 rounded-lg bg-[#F8FAFC] p-3 text-[13px] text-[#334155] sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-center sm:gap-3"
            >
              <span className="font-semibold text-[#1F2937]">{ev.oQue}</span>
              <span className="whitespace-pre-wrap">{ev.evidencia}</span>
              <span>
                {ev.anexo ? (
                  <button
                    type="button"
                    onClick={() => void abrirAnexo(ev.anexo!)}
                    className="inline-flex items-center gap-1 font-semibold text-[#1E40AF] hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {ev.anexo.nome}
                  </button>
                ) : ev.vinculo ? (
                  <span className="text-[#64748B]">vínculo</span>
                ) : (
                  <span className="text-[#94A3B8]">—</span>
                )}
              </span>
              <span>
                {editavel && (
                  <button
                    type="button"
                    aria-label="Remover evidência"
                    onClick={() => void remover(ev)}
                    className="rounded p-1 text-[#64748B] hover:text-[#E11D48]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {editavel &&
        (formAberto ? (
          <div className="mt-3 space-y-3 rounded-lg border border-[#D9E0EA] p-3">
            <div>
              <Label className="text-[12px]">O que é</Label>
              <Input
                className="mt-1"
                maxLength={120}
                placeholder="Ex.: E-mail do cliente · 12/10"
                value={oQue}
                onChange={(e) => setOQue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px]">O que ela evidencia</Label>
              <Input
                className="mt-1"
                maxLength={LIMITE_TEXTO_OCORRENCIA}
                placeholder="Ex.: Mostra que o extrato foi enviado após o prazo"
                value={evidencia}
                onChange={(e) => setEvidencia(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px]">Anexo</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(
                  [
                    ["nenhum", "Sem anexo"],
                    ...(permiteAnexos ? [["arquivo", "Arquivo"] as const] : []),
                    ["vinculo", "Vínculo com outra ocorrência"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setModo(valor)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${
                      modo === valor
                        ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                        : "border-[#D9E0EA] bg-white text-[#475569] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {modo === "arquivo" && (
                <label className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9E0EA] bg-[#F8FAFC] px-2.5 py-2 text-[12px] text-[#64748B] hover:bg-[#F1F5F9]">
                  <Paperclip className="h-3.5 w-3.5" />
                  {arquivo ? arquivo.name : "Escolher arquivo (imagem, vídeo ou documento)"}
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    className="hidden"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={limparForm}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!podeSalvar}
                className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
                onClick={() => void adicionar()}
              >
                {salvando ? "Salvando…" : "Salvar evidência"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormAberto(true)}
            >
              <Plus className="h-4 w-4" />
              Evidência
            </Button>
          </div>
        ))}
    </div>
  );
}
