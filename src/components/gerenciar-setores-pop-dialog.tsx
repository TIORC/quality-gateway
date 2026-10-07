import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { criarSetorPop, removerSetorPop, type SetorPop } from "@/lib/pops";

interface GerenciarSetoresPopDialogProps {
  aberto: boolean;
  setores: SetorPop[];
  /** Quantidade de POPs por id de setor (setores com POPs não podem ser removidos). */
  contagens: Record<string, number>;
  onFechar: () => void;
  /** Recarrega a grade depois de criar ou remover um setor. */
  onAlterado: () => Promise<void> | void;
}

export function GerenciarSetoresPopDialog({
  aberto,
  setores,
  contagens,
  onFechar,
  onAlterado,
}: GerenciarSetoresPopDialogProps) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  async function cadastrar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      await criarSetorPop(nome);
      toast.success(`Setor "${nome.trim()}" cadastrado.`);
      setNome("");
      await onAlterado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível cadastrar o setor.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(setor: SetorPop) {
    setRemovendo(setor.id);
    try {
      await removerSetorPop(setor.id);
      toast.success(`Setor "${setor.nome}" removido.`);
      setConfirmando(null);
      await onAlterado();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível remover o setor.");
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar ou remover setor</DialogTitle>
          <DialogDescription>
            Os setores aparecem como cards na grade de POPs. Só é possível remover um setor que não
            tenha POPs.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            void cadastrar();
          }}
        >
          <Input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Nome do novo setor"
            maxLength={60}
          />
          <Button type="submit" disabled={!nome.trim() || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Cadastrar
          </Button>
        </form>

        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-[#E9EEF5]">
          {setores.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#64748B]">Nenhum setor cadastrado.</p>
          ) : (
            setores.map((setor) => {
              const quantidade = contagens[setor.id] ?? 0;
              const emUso = quantidade > 0;
              return (
                <div
                  key={setor.id}
                  className="flex items-center justify-between gap-3 border-b border-[#E9EEF5] px-3 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1F2937]">
                      {setor.nome}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {quantidade} POP(s) · prefixo {setor.prefixo}
                    </p>
                  </div>

                  {confirmando === setor.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={removendo === setor.id}
                        onClick={() => void remover(setor)}
                      >
                        {removendo === setor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Confirmar remoção
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmando(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={emUso}
                      title={emUso ? "Este setor possui POPs e não pode ser removido." : "Remover"}
                      onClick={() => setConfirmando(setor.id)}
                      className="shrink-0 text-[#E11D48] hover:text-[#BE123C]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
