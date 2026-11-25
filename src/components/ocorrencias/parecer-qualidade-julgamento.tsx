/**
 * Parecer de Julgamento. Cada parecer publicado aparece como uma mensagem de
 * conversa (autor, data e texto), até 20.000 caracteres. Quem pode escrever: a
 * Qualidade, o líder de um setor envolvido e os participantes do julgamento. A
 * Qualidade vê os pareceres de todos; os demais veem só o próprio.
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import {
  LIMITE_PARECER_QUALIDADE_JULGAMENTO,
  pareceresQualidadeJulgamentoDe,
  type Ocorrencia,
  type ParecerQualidadeJulgamento,
} from "@/lib/ocorrencias";
import {
  excluirParecerQualidadeJulgamento,
  participantesJulgamentoDe,
  salvarParecerQualidadeJulgamento,
} from "@/lib/ocorrencias-crud";
import {
  podeConfigurarOcorrencias,
  podeEscreverParecerJulgamento,
  pareceresVisiveis,
  veTodosPareceresJulgamento,
} from "@/lib/ocorrencias-permissoes";
import { formatarDataHoraBrasilia } from "@/lib/utils";

interface ParecerJulgamentoProps {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  /** Quando false (fora do julgamento ou ocorrência encerrada), não há escrita. */
  editavel: boolean;
  onSalvo: () => Promise<void>;
}

export function ParecerQualidadeJulgamento({
  ocorrencia: o,
  session,
  editavel,
  onSalvo,
}: ParecerJulgamentoProps) {
  const todos = pareceresQualidadeJulgamentoDe(o);
  const visiveis = pareceresVisiveis(session, todos);
  const podeEscrever =
    editavel && podeEscreverParecerJulgamento(session, o, participantesJulgamentoDe(o));
  const veTodos = veTodosPareceresJulgamento(session);
  const [texto, setTexto] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<ParecerQualidadeJulgamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Excluir é restrito ao Gestor da Qualidade e ao Desenvolvedor do Sistema.
  const podeExcluir = podeConfigurarOcorrencias(session);

  async function publicar() {
    setPublicando(true);
    try {
      await salvarParecerQualidadeJulgamento(o, texto, session);
      setTexto("");
      toast.success("Parecer de julgamento publicado.");
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setPublicando(false);
    }
  }

  async function excluir() {
    if (!paraExcluir) return;
    setExcluindo(true);
    try {
      await excluirParecerQualidadeJulgamento(o, paraExcluir.id, session);
      setParaExcluir(null);
      toast.success("Parecer de julgamento excluído.");
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setExcluindo(false);
    }
  }

  // Sem escrita e sem parecer visível para esta pessoa, a seção não aparece.
  if (!podeEscrever && visiveis.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Parecer de Julgamento
      </h3>
      <p className="mt-1 text-[13px] text-[#64748B]">
        {veTodos
          ? "Pareceres de todos os envolvidos no julgamento. Ficam anexados ao documento da ocorrência."
          : "Você vê somente o seu parecer. Ele fica anexado ao documento da ocorrência."}
      </p>

      {visiveis.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {visiveis.map((p) => (
            <li key={p.id} className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-[12px] font-semibold text-white">
                {(p.salvoPorNome || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-[12px] font-semibold text-[#1F2937]">{p.salvoPorNome || "—"}</p>
                  <span className="text-[11px] text-[#64748B]">
                    {p.salvoEm ? formatarDataHoraBrasilia(p.salvoEm) : ""}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[#334155]">{p.texto}</p>
                {podeExcluir && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setParaExcluir(p)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        podeEscrever && <p className="mt-3 text-[13px] text-[#64748B]">Nenhum parecer publicado.</p>
      )}

      {podeEscrever && (
        <div className="mt-4 space-y-2 border-t border-[#E9EEF5] pt-4">
          <Textarea
            className="min-h-[120px]"
            maxLength={LIMITE_PARECER_QUALIDADE_JULGAMENTO}
            placeholder="Escreva o seu parecer de julgamento…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end text-[11px] text-[#94A3B8]">
            {texto.length}/{LIMITE_PARECER_QUALIDADE_JULGAMENTO}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={publicando || !texto.trim()}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              onClick={() => void publicar()}
            >
              {publicando ? "Publicando…" : "Publicar parecer"}
            </Button>
          </div>
        </div>
      )}

      {podeExcluir && (
        <ConfirmarDialog
          open={paraExcluir !== null}
          onOpenChange={(aberto) => {
            if (!aberto) setParaExcluir(null);
          }}
          tom="danger"
          titulo="Excluir este parecer de julgamento?"
          descricao="A mensagem será apagada desta ocorrência e do documento impresso. Essa ação não pode ser desfeita."
          textoConfirmar="Excluir parecer"
          carregando={excluindo}
          onConfirmar={() => void excluir()}
        />
      )}
    </section>
  );
}
