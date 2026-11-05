/**
 * Ações executadas para resolver a ocorrência (Eficácia). A Qualidade adiciona
 * ações e acompanha o status de cada uma: Pendente, Em andamento, Pausada ou Concluída.
 */
import { useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePanelSession } from "@/components/panel-shell";
import { traduzErro } from "@/lib/organizacao";
import {
  LIMITE_TEXTO_OCORRENCIA,
  STATUS_ACAO,
  STATUS_ACAO_LABELS,
  acoesExecutadasDe,
  formatarPrazo,
  idCurto,
  type AcaoExecutada,
  type Ocorrencia,
  type StatusAcao,
} from "@/lib/ocorrencias";
import { salvarAcoesExecutadas } from "@/lib/ocorrencias-crud";

/** Cores fixas (inline) para não depender do tema escuro do app. */
const ESTILO_STATUS: Record<StatusAcao, CSSProperties> = {
  pendente: { backgroundColor: "#FEF3C7", color: "#92400E" },
  em_andamento: { backgroundColor: "#DBEAFE", color: "#1E40AF" },
  pausada: { backgroundColor: "#FFEDD5", color: "#9A3412" },
  concluida: { backgroundColor: "#DCFCE7", color: "#166534" },
};

/** Cor da faixa lateral de cada linha, conforme o status. */
const COR_BORDA_STATUS: Record<StatusAcao, string> = {
  pendente: "#F59E0B",
  em_andamento: "#3B82F6",
  pausada: "#F97316",
  concluida: "#22C55E",
};

interface AcoesExecutadasProps {
  ocorrencia: Ocorrencia;
  /** Quando false, a lista é somente leitura. */
  editavel: boolean;
  /** Chamado após salvar, para o pai recarregar a ocorrência. */
  onAlterada: () => Promise<void>;
}

export function AcoesExecutadas({ ocorrencia, editavel, onAlterada }: AcoesExecutadasProps) {
  const session = usePanelSession();
  const acoes = acoesExecutadasDe(ocorrencia);
  const [formAberto, setFormAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState("");
  const [prazo, setPrazo] = useState("");
  const [status, setStatus] = useState<StatusAcao>("pendente");
  const [salvando, setSalvando] = useState(false);

  function limparForm() {
    setDescricao("");
    setArea("");
    setPrazo("");
    setStatus("pendente");
    setFormAberto(false);
  }

  async function adicionar() {
    setSalvando(true);
    try {
      const nova: AcaoExecutada = {
        id: idCurto(),
        descricao: descricao.trim(),
        area: area.trim(),
        prazo,
        status,
        criadoEm: new Date().toISOString(),
      };
      await salvarAcoesExecutadas(
        ocorrencia,
        [...acoes, nova],
        "Ação executada adicionada",
        `${nova.descricao} · ${STATUS_ACAO_LABELS[nova.status]}`,
        session,
      );
      toast.success("Ação adicionada.");
      limparForm();
      await onAlterada();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(acao: AcaoExecutada, novo: StatusAcao) {
    if (novo === acao.status) return;
    try {
      await salvarAcoesExecutadas(
        ocorrencia,
        acoes.map((a) => (a.id === acao.id ? { ...a, status: novo } : a)),
        "Status de ação executada alterado",
        `${acao.descricao}: ${STATUS_ACAO_LABELS[acao.status]} → ${STATUS_ACAO_LABELS[novo]}`,
        session,
      );
      await onAlterada();
    } catch (e) {
      toast.error(traduzErro(e).message);
    }
  }

  const podeSalvar = !salvando && descricao.trim().length > 0 && area.trim().length > 0;

  return (
    <div>
      {acoes.length === 0 ? (
        <p className="text-[13px] text-[#64748B]">Nenhuma ação registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {acoes.map((a) => (
            <div
              key={a.id}
              className="grid gap-2 rounded-lg p-3 text-[13px] sm:grid-cols-[1.6fr_1fr_auto_auto] sm:items-center sm:gap-3"
              style={{
                backgroundColor: "#1E293B",
                color: "#E2E8F0",
                borderLeft: `4px solid ${COR_BORDA_STATUS[a.status]}`,
              }}
            >
              <span className="font-semibold text-white">{a.descricao}</span>
              <span>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                  style={{ backgroundColor: "#312E81", color: "#C7D2FE" }}
                >
                  {a.area}
                </span>
              </span>
              <span className="font-semibold" style={{ color: "#A5B4FC" }}>
                {a.prazo ? formatarPrazo(a.prazo) : "Sem prazo"}
              </span>
              <span>
                {editavel ? (
                  <Select value={a.status} onValueChange={(v) => void mudarStatus(a, v as StatusAcao)}>
                    <SelectTrigger
                      className="h-8 w-[160px] font-semibold"
                      style={ESTILO_STATUS[a.status]}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ACAO.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_ACAO_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={ESTILO_STATUS[a.status]}
                  >
                    {STATUS_ACAO_LABELS[a.status]}
                  </span>
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
              <Label className="text-[12px]">Ação</Label>
              <Input
                className="mt-1"
                maxLength={LIMITE_TEXTO_OCORRENCIA}
                placeholder="Ex.: Revisar POP de envio de guias"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-[12px]">Área responsável</Label>
                <Input
                  className="mt-1"
                  maxLength={80}
                  placeholder="Ex.: Contábil"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[12px]">Prazo</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[12px]">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusAcao)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ACAO.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_ACAO_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {salvando ? "Salvando…" : "Adicionar ação"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setFormAberto(true)}>
              <Plus className="h-4 w-4" />
              Ação
            </Button>
          </div>
        ))}
    </div>
  );
}
