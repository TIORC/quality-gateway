import { motion } from "framer-motion";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { atualizarCelula, carregarCelulas, criarCelula, removerCelula, type Celula } from "@/lib/celulas";
import type { Colaborador } from "@/lib/dados";

interface CelulaTabProps {
  setores: { id: string; nome: string }[];
  colaboradores: Colaborador[];
}

/** Cor sólida de cada card de célula, em rodízio. */
const CORES_CELULA = [
  "bg-[#1E3A8A]",
  "bg-[#0F766E]",
  "bg-[#7C3AED]",
  "bg-[#B45309]",
  "bg-[#BE185D]",
  "bg-[#0369A1]",
];

/** Aba "Célula": lista as células gravadas no banco e abre o modal de cadastro e edição. */
export function CelulaTab({ setores, colaboradores }: CelulaTabProps) {
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** "nova" abre o cadastro; uma célula abre a edição; `null` = fechado. */
  const [edicao, setEdicao] = useState<Celula | "nova" | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<Celula | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function recarregar() {
    try {
      setCelulas(await carregarCelulas());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar as células.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  async function confirmarExcluir() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    try {
      await removerCelula(excluirAlvo.id);
      toast.success("Célula excluída.");
      setExcluirAlvo(null);
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a célula.");
    } finally {
      setExcluindo(false);
    }
  }

  const nomeDoSetor = (id: string) => setores.find((s) => s.id === id)?.nome ?? "Setor removido";

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">Células</h2>
          <p className="mt-1 text-sm text-[#64748B]">Grupos de colaboradores dentro de um setor.</p>
        </div>
        <Button
          onClick={() => setEdicao("nova")}
          className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
        >
          <Plus className="h-4 w-4" />
          Nova Célula
        </Button>
      </div>

      {carregando ? (
        <p className="px-6 py-12 text-center text-sm text-[#64748B]">Carregando células...</p>
      ) : celulas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-sm text-[#64748B]">
          <Users className="h-6 w-6" />
          Nenhuma célula cadastrada.
        </div>
      ) : (
        <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {celulas.map((celula, indice) => (
            <li
              key={celula.id}
              className={`relative flex items-start justify-between gap-3 overflow-hidden rounded-xl px-5 py-4 text-white shadow-sm ${CORES_CELULA[indice % CORES_CELULA.length]}`}
            >
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 text-white/15"
                initial={{ opacity: 0, rotate: -12 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <motion.g
                  animate={{ rotate: 360 }}
                  transition={{ duration: 60, ease: "linear", repeat: Infinity }}
                  style={{ originX: "100px", originY: "100px" }}
                >
                  <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" />
                </motion.g>
                <motion.circle
                  cx="100"
                  cy="100"
                  r="30"
                  fill="currentColor"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
                  style={{ originX: "100px", originY: "100px" }}
                />
                <motion.path
                  d="M0 150 Q 50 120 100 150 T 200 150"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  animate={{ d: ["M0 150 Q 50 120 100 150 T 200 150", "M0 130 Q 50 160 100 130 T 200 130", "M0 150 Q 50 120 100 150 T 200 150"] }}
                  transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
                />
              </motion.svg>
              <div className="relative min-w-0">
                <p className="text-sm font-semibold">{celula.nome}</p>
                <p className="mt-1 text-xs text-white/80">
                  {nomeDoSetor(celula.setorId)} · {celula.colaboradorIds.length} colaborador(es)
                </p>
              </div>
              <div className="relative flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar célula"
                  className="text-white hover:bg-white/20 hover:text-white"
                  onClick={() => setEdicao(celula)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir célula"
                  className="text-white hover:bg-white/20 hover:text-white"
                  onClick={() => setExcluirAlvo(celula)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edicao !== null ? (
        <CelulaDialog
          key={edicao === "nova" ? "nova" : edicao.id}
          celula={edicao === "nova" ? null : edicao}
          setores={setores}
          colaboradores={colaboradores}
          onFechar={() => setEdicao(null)}
          onSalvo={async () => {
            setEdicao(null);
            await recarregar();
          }}
        />
      ) : null}

      <ConfirmarDialog
        open={excluirAlvo !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setExcluirAlvo(null);
        }}
        tom="danger"
        titulo="Excluir célula?"
        descricao={`A célula ${excluirAlvo?.nome ?? ""} e seus vínculos com colaboradores serão removidos.`}
        textoConfirmar="Excluir"
        carregando={excluindo}
        onConfirmar={() => void confirmarExcluir()}
      />
    </div>
  );
}

/** Minúsculas e sem acento: compara nomes de setor e de colaborador sem depender da grafia. */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

interface CelulaDialogProps extends CelulaTabProps {
  celula: Celula | null;
  onFechar: () => void;
  onSalvo: () => void;
}

/** Montado só enquanto aberto: o formulário começa com os dados da célula (ou vazio, no cadastro). */
function CelulaDialog({ celula, setores, colaboradores, onFechar, onSalvo }: CelulaDialogProps) {
  const [nome, setNome] = useState(celula?.nome ?? "");
  const [setorId, setSetorId] = useState(celula?.setorId ?? "");
  const [selecionados, setSelecionados] = useState<string[]>(celula?.colaboradorIds ?? []);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  // Só os colaboradores do setor escolhido aparecem na lista.
  const nomeSetor = setores.find((s) => s.id === setorId)?.nome ?? "";
  const doSetor = nomeSetor
    ? colaboradores.filter((c) => normalizar(c.setor ?? "") === normalizar(nomeSetor))
    : [];
  const visiveis = doSetor.filter((c) => normalizar(c.nome).includes(normalizar(busca)));
  // Selecionados de outros setores continuam na célula, mesmo fora da lista.
  const deOutrosSetores = selecionados.filter((id) => !doSetor.some((c) => c.id === id)).length;

  const podeSalvar = nome.trim() !== "" && setorId !== "" && !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      if (celula) await atualizarCelula(celula.id, nome, setorId, selecionados);
      else await criarCelula(nome, setorId, selecionados);
      toast.success(celula ? "Célula atualizada." : "Célula cadastrada.");
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a célula.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abre) => !abre && !salvando && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{celula ? "Editar Célula" : "Nova Célula"}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
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
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Colaboradores da célula</Label>
              <span className="text-xs text-[#64748B]">{selecionados.length} selecionado(s)</span>
            </div>

            {setorId === "" ? (
              <p className="rounded-md border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#64748B]">
                Selecione um setor para listar os colaboradores.
              </p>
            ) : (
              <>
                <Input
                  placeholder="Buscar colaborador"
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                />
                <div className="max-h-60 divide-y divide-[#E2E8F0] overflow-y-auto rounded-md border border-[#E2E8F0]">
                  {visiveis.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-[#64748B]">
                      Nenhum colaborador neste setor.
                    </p>
                  ) : (
                    visiveis.map((colaborador) => (
                      <label
                        key={colaborador.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#F8FAFC]"
                      >
                        <Checkbox
                          checked={selecionados.includes(colaborador.id)}
                          onCheckedChange={() => alternar(colaborador.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-[#1F2937]">{colaborador.nome}</span>
                          {colaborador.cargo ? (
                            <span className="block text-xs text-[#64748B]">{colaborador.cargo}</span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {deOutrosSetores > 0 ? (
                  <p className="text-xs text-[#64748B]">
                    {deOutrosSetores} colaborador(es) de outros setores continuam marcados.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!podeSalvar}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
