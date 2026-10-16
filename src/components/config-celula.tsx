import { Check, Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Colaborador } from "@/lib/dados";

export interface Celula {
  id: string;
  nome: string;
  setor: string;
  colaboradorIds: string[];
}

interface CelulaTabProps {
  setores: { id: string; nome: string }[];
  colaboradores: Colaborador[];
}

/** Aba "Célula": lista as células e abre o modal de cadastro. */
export function CelulaTab({ setores, colaboradores }: CelulaTabProps) {
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">Células</h2>
          <p className="mt-1 text-sm text-[#64748B]">Grupos de colaboradores dentro de um setor.</p>
        </div>
        <Button
          onClick={() => setAberto(true)}
          className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
        >
          <Plus className="h-4 w-4" />
          Nova Célula
        </Button>
      </div>

      {celulas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-sm text-[#64748B]">
          <Users className="h-6 w-6" />
          Nenhuma célula cadastrada.
        </div>
      ) : (
        <ul className="divide-y divide-[#E2E8F0]">
          {celulas.map((celula) => (
            <li key={celula.id} className="px-5 py-3">
              <p className="text-sm font-semibold text-[#1F2937]">{celula.nome}</p>
              <p className="text-xs text-[#64748B]">
                {celula.setor} · {celula.colaboradorIds.length} colaborador(es)
              </p>
            </li>
          ))}
        </ul>
      )}

      <NovaCelulaDialog
        aberto={aberto}
        setores={setores}
        colaboradores={colaboradores}
        onFechar={() => setAberto(false)}
        onSalvar={(celula) => {
          setCelulas((atual) => [...atual, celula]);
          setAberto(false);
        }}
      />
    </div>
  );
}

interface NovaCelulaDialogProps extends CelulaTabProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (celula: Celula) => void;
}

function NovaCelulaDialog({
  aberto,
  setores,
  colaboradores,
  onFechar,
  onSalvar,
}: NovaCelulaDialogProps) {
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [lista, setLista] = useState(false);

  function reiniciar() {
    setNome("");
    setSetor("");
    setSelecionados([]);
    setLista(false);
  }

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  const podeSalvar = nome.trim() !== "" && setor !== "";

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abre) => {
        if (!abre) {
          reiniciar();
          onFechar();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Célula</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!podeSalvar) return;
            onSalvar({
              id: crypto.randomUUID(),
              nome: nome.trim(),
              setor,
              colaboradorIds: selecionados,
            });
            reiniciar();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="celula-nome">Nome da Célula</Label>
            <Input
              id="celula-nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((item) => (
                  <SelectItem key={item.id} value={item.nome}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Colaboradores da célula</Label>
            <Popover open={lista} onOpenChange={setLista}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start font-normal">
                  {selecionados.length > 0
                    ? `${selecionados.length} selecionado(s)`
                    : "Digite para buscar colaboradores"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command
                  filter={(valor, busca) =>
                    valor
                      .toLowerCase()
                      .split(/\s+/)
                      .some((palavra) => palavra.startsWith(busca.toLowerCase()))
                      ? 1
                      : 0
                  }
                >
                  <CommandInput placeholder="Digite as primeiras letras…" />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {colaboradores.map((colaborador) => (
                        <CommandItem
                          key={colaborador.id}
                          value={`${colaborador.nome} ${colaborador.id}`}
                          onSelect={() => alternar(colaborador.id)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selecionados.includes(colaborador.id) ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {colaborador.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selecionados.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selecionados.map((id) => {
                  const colaborador = colaboradores.find((item) => item.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#4F46E5]"
                    >
                      {colaborador?.nome ?? id}
                      <button
                        type="button"
                        aria-label="Remover"
                        onClick={() => alternar(id)}
                        className="hover:text-[#312E81]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!podeSalvar}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
