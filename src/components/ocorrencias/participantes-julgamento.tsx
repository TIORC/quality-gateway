/** Quem participou do julgamento, marcado com @ (visível a quem vê os detalhes internos). */
import { useState } from "react";
import { toast } from "sonner";

import { CampoMencao } from "@/components/campo-mencao";
import { Button } from "@/components/ui/button";
import type { UserSession } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import type { Ocorrencia } from "@/lib/ocorrencias";
import {
  participantesJulgamentoDe,
  salvarParticipantesJulgamento,
} from "@/lib/ocorrencias-crud";
import { traduzErro } from "@/lib/organizacao";

interface Props {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  colaboradores: Colaborador[];
  editavel: boolean;
  onSalvo: () => Promise<void>;
}

export function ParticipantesJulgamento({ ocorrencia: o, session, colaboradores, editavel, onSalvo }: Props) {
  const salvos = participantesJulgamentoDe(o);
  const [selecionados, setSelecionados] = useState<Colaborador[]>(() =>
    salvos.map(
      (p) => colaboradores.find((c) => c.id === p.id) ?? { id: p.id, nome: p.nome, cargo: "", email: p.email },
    ),
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarParticipantesJulgamento(
        o,
        selecionados.map((c) => ({ id: c.id, nome: c.nome, email: c.email })),
        session,
      );
      toast.success("Participantes do julgamento salvos.");
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
        Participantes do julgamento
      </h3>
      {editavel ? (
        <div className="mt-3 space-y-3">
          <CampoMencao
            colaboradores={colaboradores}
            selecionados={selecionados}
            onChange={setSelecionados}
            placeholder="Digite @ para marcar quem participou do julgamento…"
            exibirAvatar
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={salvando}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              onClick={() => void salvar()}
            >
              {salvando ? "Salvando…" : "Salvar participantes"}
            </Button>
          </div>
        </div>
      ) : salvos.length === 0 ? (
        <p className="mt-2 text-[13px] text-[#94A3B8]">Nenhum participante marcado.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {salvos.map((p) => (
            <span key={p.id} className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-xs font-medium text-[#1F2937]">
              @{p.nome}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
