import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import type { Ata, OrigemAta } from "@/lib/atas";
import { atualizarAta, criarAta } from "@/lib/atas-crud";
import { traduzErro } from "@/lib/organizacao";
import type { TipoReuniao } from "@/lib/atas";

interface CampoProps {
  rotulo: string;
  children: React.ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface AtaDialogProps {
  aberto: boolean;
  /** Ata em edição; `null`/ausente = novo cadastro. */
  ata: Ata | null;
  /** Tipos de reunião (o diálogo filtra os ativos para novas atas). */
  tipos: TipoReuniao[];
  /** `true` quando a sessão pode criar ata simples (Qualidade/Admin). */
  podeCriarSimples: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

function origemInicial(ata: Ata | null): OrigemAta {
  if (ata && (ata.origem === "simples" || ata.origem === "sistema")) return ata.origem;
  return "sistema";
}

export function AtaDialog({
  aberto,
  ata,
  tipos,
  podeCriarSimples,
  onFechar,
  onSalvo,
}: AtaDialogProps) {
  const [origem, setOrigem] = useState<OrigemAta>(() => origemInicial(ata));
  const [tipoReuniaoId, setTipoReuniaoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (ata) {
      setOrigem(origemInicial(ata));
      setTipoReuniaoId(ata.tipoReuniaoId ?? "");
      setTitulo(ata.titulo);
      setDataReuniao(ata.dataReuniao);
      setTexto(ata.texto);
      setSalvando(false);
    } else {
      setOrigem(podeCriarSimples ? "simples" : "sistema");
      setTipoReuniaoId("");
      setTitulo("");
      setDataReuniao("");
      setTexto("");
      setSalvando(false);
    }
  }, [aberto, ata, podeCriarSimples]);

  const editando = ata !== null;
  const precisaTipo = origem === "sistema";

  // Novas atas: somente tipos ativos. Edição: mantém o tipo atual mesmo que
  // ele tenha sido desativado depois.
  const opcoesTipos = editando
    ? ata.tipoReuniaoId && !tipos.some((t) => t.id === ata.tipoReuniaoId && t.ativo)
      ? tipos
      : tipos.filter((t) => t.ativo)
    : tipos.filter((t) => t.ativo);

  async function salvar() {
    if (salvando) return;
    if (!titulo.trim()) {
      toast.error("Informe o título da ata.");
      return;
    }
    if (!dataReuniao.trim()) {
      toast.error("Informe a data da reunião.");
      return;
    }
    if (precisaTipo && !tipoReuniaoId) {
      toast.error("Selecione o tipo de reunião.");
      return;
    }
    setSalvando(true);
    const entrada = {
      origem,
      tipoReuniaoId: precisaTipo ? tipoReuniaoId : null,
      titulo: titulo.trim(),
      dataReuniao: dataReuniao.trim(),
      texto,
    };
    try {
      if (editando) {
        await atualizarAta(ata.id, entrada, getSession());
        toast.success("Ata atualizada");
      } else {
        await criarAta(entrada, getSession());
        toast.success("Ata registrada");
      }
      onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  const capaOrigem = (valor: string) =>
    `flex flex-1 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      origem === valor
        ? "border-[#1E3A8A] bg-[#EEF2F7] text-[#1E3A8A]"
        : "border-[#E9EEF5] bg-white text-[#334155] hover:border-[#CBD5E1]"
    }`;

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar ata" : "Nova Ata de Reunião"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Altere o título, a data ou o texto. A origem e o tipo ficam fixos."
              : "Escolha o tipo de registro e preencha os dados da reunião."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={capaOrigem("simples")}
              disabled={editando ? ata.origem !== "simples" : !podeCriarSimples}
              onClick={() => setOrigem("simples")}
            >
              <span className="text-[13px] font-semibold">Ata simples</span>
              <span className="text-[11px] text-[#64748B]">
                Registro avulso, sem tipo de reunião.
              </span>
            </button>
            <button
              type="button"
              className={capaOrigem("sistema")}
              disabled={editando ? ata.origem !== "sistema" : false}
              onClick={() => setOrigem("sistema")}
            >
              <span className="text-[13px] font-semibold">Ata do sistema</span>
              <span className="text-[11px] text-[#64748B]">
                Vinculada a um tipo de reunião.
              </span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo rotulo="Título">
                <Input
                  value={titulo}
                  onChange={(evento) => setTitulo(evento.target.value)}
                  placeholder="Ex.: Reunião de análise crítica"
                />
              </Campo>
            </div>

            <Campo rotulo="Data da reunião">
              <Input
                type="date"
                value={dataReuniao}
                onChange={(evento) => setDataReuniao(evento.target.value)}
              />
            </Campo>

            {precisaTipo ? (
              <Campo rotulo="Tipo de reunião">
                <Select
                  value={tipoReuniaoId}
                  onValueChange={setTipoReuniaoId}
                  disabled={editando}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesTipos.map((tipo) => (
                      <SelectItem key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            ) : null}
          </div>

          <Campo rotulo="Texto da ata">
            <Textarea
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Transcreva o conteúdo da reunião…"
              className="min-h-[160px] text-[13px] leading-relaxed"
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar ata"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}