import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CampoMencao } from "@/components/campo-mencao";
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
import { getSession } from "@/lib/auth";
import {
  PERIODICIDADE_LABELS,
  PERIODICIDADES_REUNIAO,
  type PeriodicidadeReuniao,
  type TipoReuniao,
} from "@/lib/atas";
import { atualizarTipoReuniao, criarTipoReuniao } from "@/lib/atas-crud";
import type { Colaborador } from "@/lib/dados";
import { traduzErro } from "@/lib/organizacao";

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

function tipoParaMencao(tipo: TipoReuniao | null): Colaborador[] {
  if (!tipo) return [];
  const vistos = new Set<string>();
  const lista: Colaborador[] = [];
  for (const p of [...tipo.participantes, ...tipo.signatarios]) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    lista.push({ id: p.id, nome: p.nome, cargo: "" });
  }
  return lista;
}

interface TipoReuniaoDialogProps {
  aberto: boolean;
  /** Tipo em edição; `null`/ausente = novo cadastro. */
  tipo: TipoReuniao | null;
  colaboradores: Colaborador[];
  onFechar: () => void;
  onSalvo: (tipo: TipoReuniao) => void;
}

export function TipoReuniaoDialog({
  aberto,
  tipo,
  colaboradores,
  onFechar,
  onSalvo,
}: TipoReuniaoDialogProps) {
  const [nome, setNome] = useState("");
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeReuniao>("avulsa");
  const [diaPrevisto, setDiaPrevisto] = useState("");
  const [participantes, setParticipantes] = useState<Colaborador[]>([]);
  const [signatarios, setSignatarios] = useState<Colaborador[]>([]);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setNome("");
    setPeriodicidade("avulsa");
    setDiaPrevisto("");
    setParticipantes([]);
    setSignatarios([]);
    setSalvando(false);
  }

  useEffect(() => {
    if (!aberto) {
      limpar();
      return;
    }
    if (tipo) {
      setNome(tipo.nome);
      setPeriodicidade(tipo.periodicidade);
      setDiaPrevisto(tipo.diaPrevisto !== null ? String(tipo.diaPrevisto) : "");
      const mencionaveis = tipoParaMencao(tipo);
      const participantesIds = new Set(tipo.participantes.map((p) => p.id));
      const signatariosIds = new Set(tipo.signatarios.map((p) => p.id));
      setParticipantes(mencionaveis.filter((c) => participantesIds.has(c.id)));
      setSignatarios(mencionaveis.filter((c) => signatariosIds.has(c.id)));
    } else {
      limpar();
    }
  }, [aberto, tipo]);

  const semanalOuQuinzenal = periodicidade === "semanal" || periodicidade === "quinzenal";
  const dicaDia =
    periodicidade === "avulsa"
      ? "Sem periodicidade — não há dia previsto."
      : semanalOuQuinzenal
        ? "Dia da semana da reunião: 1 = segunda ... 7 = domingo."
        : "Dia do mês previsto para a reunião (1 a 31).";

  const diaValido = semanalOuQuinzenal
    ? !diaPrevisto ||
      (/^\d{1,2}$/.test(diaPrevisto) && Number(diaPrevisto) >= 1 && Number(diaPrevisto) <= 7)
    : !diaPrevisto ||
      (/^\d{1,2}$/.test(diaPrevisto) && Number(diaPrevisto) >= 1 && Number(diaPrevisto) <= 31);

  async function salvar() {
    if (salvando) return;
    if (!nome.trim()) {
      toast.error("Informe o nome do tipo de reunião.");
      return;
    }
    if (!diaValido) {
      toast.error(
        semanalOuQuinzenal
          ? "O dia previsto deve ser um número entre 1 e 7 (2ª a domingo)."
          : "O dia previsto deve ser um número entre 1 e 31.",
      );
      return;
    }
    setSalvando(true);
    const entrada = {
      nome: nome.trim(),
      periodicidade,
      diaPrevisto: diaPrevisto.trim() ? Number(diaPrevisto) : null,
      participantes: participantes.map((c) => ({ id: c.id, nome: c.nome })),
      signatarios: signatarios.map((c) => ({ id: c.id, nome: c.nome })),
    };
    try {
      const salvo = tipo
        ? await atualizarTipoReuniao(entrada, tipo.id, getSession())
        : await criarTipoReuniao(entrada, getSession());
      toast.success(tipo ? "Tipo de reunião atualizado" : "Tipo de reunião cadastrado");
      onSalvo(salvo);
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar tipo de reunião" : "Cadastrar tipo de reunião"}</DialogTitle>
          <DialogDescription>
            Nome, periodicidade, dia previsto, participantes e quem assina as atas deste tipo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo rotulo="Nome">
                <Input
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  placeholder="Ex.: Comitê da Qualidade, Reunião de setor…"
                  maxLength={120}
                />
              </Campo>
            </div>

            <Campo rotulo="Periodicidade">
              <Select
                value={periodicidade}
                onValueChange={(valor) => setPeriodicidade(valor as PeriodicidadeReuniao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES_REUNIAO.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {PERIODICIDADE_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Dia previsto">
              <Input
                value={diaPrevisto}
                onChange={(evento) =>
                  setDiaPrevisto(evento.target.value.replace(/\D/g, "").slice(0, 2))
                }
                placeholder="—"
                inputMode="numeric"
                disabled={periodicidade === "avulsa"}
              />
            </Campo>
          </div>

          <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B]">{dicaDia}</div>

          <Campo rotulo="Participantes">
            <CampoMencao
              colaboradores={colaboradores}
              selecionados={participantes}
              onChange={setParticipantes}
              exibirAvatar
            />
            <p className="text-xs italic text-[#94A3B8]">Participantes fixos desta reunião.</p>
          </Campo>

          <Campo rotulo="Signatários">
            <CampoMencao
              colaboradores={colaboradores}
              selecionados={signatarios}
              onChange={setSignatarios}
              exibirAvatar
            />
            <p className="text-xs italic text-[#94A3B8]">Quem assina as atas deste tipo.</p>
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
            {salvando ? "Salvando…" : tipo ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
