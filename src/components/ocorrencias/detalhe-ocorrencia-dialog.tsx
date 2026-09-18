import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePanelSession } from "@/components/panel-shell";
import { APROVACOES, type Ocorrencia, type HistoricoItem } from "@/lib/ocorrencias";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import { MetroLinha } from "@/components/ocorrencias/metro-linha";
import { listarHistorico, moverEtapa, aprovarSubetapa } from "@/lib/ocorrencias-crud";
import { FormatadorSla } from "@/components/ocorrencias/formatador-sla";

interface DetalheOcorrenciaDialogProps {
  aberto: boolean;
  onClose: () => void;
  ocorrencia: Ocorrencia | null;
}

export function DetalheOcorrenciaDialog({ aberto, onClose, ocorrencia }: DetalheOcorrenciaDialogProps) {
  const session = usePanelSession();
  const usuarioQualidade = ehUsuarioDaQualidade(session);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (aberto && ocorrencia) {
      listarHistorico(ocorrencia.id).then(setHistorico).catch(() => setHistorico([]));
    }
  }, [aberto, ocorrencia]);

  const papel: "qualidade" | "solicitante" | "encarregado" = usuarioQualidade
    ? "qualidade"
    : ocorrencia?.responsavelAtual?.email === session?.email ? "encarregado" : "solicitante";

  if (!ocorrencia) return null;

  async function comentar() {
    if (!comentario.trim()) return;
    const res = await moverEtapa(ocorrencia.id, ocorrencia.macroAtual, {
      acao: "comentario", usuario: session!, texto: comentario,
    });
    if (res.ok) {
      setComentario("");
      listarHistorico(ocorrencia.id).then(setHistorico).catch(() => {});
    } else {
      toast.error(res.erro ?? "Não foi possível comentar");
    }
  }

  const acoes = APROVACOES[ocorrencia.macroAtual] ?? [];
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-[#1E3A8A]">{ocorrencia.numero}</span>{" "}
            — {ocorrencia.tituloCurto}
          </DialogTitle>
          <DialogDescription>
            Tipo: {ocorrencia.tipo.nome} · Status: {ocorrencia.status}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          <MetroLinha ocorrencia={ocorrencia} visao={papel === "solicitante" ? "simplificada" : "completa"} />
          {renderRespostas(papel === "solicitante", ocorrencia)}
          {renderAcoes(papel, acoes, ocorrencia, session)}
          {renderHistorico(historico, comentario, setComentario, comentar)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderRespostas(solicitante: boolean, o: Ocorrencia) {
  if (solicitante) return null;
  return (
    <div className="rounded-lg border border-[#D9E0EA] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Dados da abertura
      </p>
      <pre className="text-[12px] whitespace-pre-wrap text-[#334155]">
        {JSON.stringify(o.respostas, null, 2)}
      </pre>
    </div>
  );
}

function renderAcoes(
  papel: "qualidade" | "solicitante" | "encarregado",
  acoes: string[], o: Ocorrencia, session: any,
) {
  if (papel !== "qualidade" && papel !== "encarregado") return null;
  if (acoes.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#D9E0EA] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Ações da etapa
      </p>
      <div className="flex flex-wrap gap-2">
        {acoes.map((a) => (
          <Button
            key={a} variant="outline" size="sm"
            onClick={() =>
              void aprovarSubetapa(o, a, session).then((res) => {
                if (res.ok) toast.success(`Etapa ${a}`);
                else toast.error(res.erro ?? "Falha na ação");
              })
            }
          >
            {a}
          </Button>
        ))}
      </div>
    </div>
  );
}

function renderHistorico(
  historico: HistoricoItem[],
  comentario: string, setComentario: (v: string) => void,
  comentar: () => void,
) {
  return (
    <div className="rounded-lg border border-[#D9E0EA] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Comentários &amp; histórico
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {historico.map((h) => (
          <div key={h.id} className="text-[12px]">
            <span className="font-medium text-[#1E3A8A]">{h.autorNome}</span>
            <span className="mx-1 text-[#94A3B8]">•</span>
            <span className="text-[#64748B]">{new Date(h.criadoEm).toLocaleString("pt-BR")}</span>
            <p className="mt-0.5 text-[#334155]">{h.comentario || h.acao}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Textarea
          placeholder="Adicionar comentário…"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="min-h-[60px]"
        />
        <Button type="button" size="sm" onClick={() => void comentar()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
