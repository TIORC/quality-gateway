import { useEffect, useRef, useState, type ReactNode } from "react";
import { CampoMencao } from "@/components/campo-mencao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORIDADES_ACAO, prazoBrParaISO } from "@/lib/planos";
import { criarPlano } from "@/lib/planos-crud";
import { mascaraDataBr } from "@/lib/utils";

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface Props {
  aberto: boolean; setores: string[]; colaboradores: Colaborador[];
  origens: string[]; onFechar: () => void; onCriado: () => void;
  /** Valores iniciais enviados por outro módulo (ex.: indicador abaixo da meta). */
  inicial?: {
    titulo?: string | undefined;
    detalhamento?: string | undefined;
    setor?: string | undefined;
    origem?: string | undefined;
    vinculo?: string | undefined;
  };
}

export function NovoPlanoDialog(p: Props) {
  const { aberto, setores, colaboradores } = p;
  const { origens, onFechar, onCriado, inicial } = p;
  const [titulo, setTitulo] = useState("");
  const [detalhamento, setDetalhamento] = useState("");
  const [origem, setOrigem] = useState("");
  const [origemOutros, setOrigemOutros] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("Média");
  const [vinculo, setVinculo] = useState("");
  const [mencionados, setMencionados] = useState<Colaborador[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Controla o pré-preenchimento vindo de outro módulo (uma vez por abertura).
  const preenchido = useRef(false);

  useEffect(() => {
    if (!aberto) {
      setTitulo(""); setDetalhamento(""); setOrigem(""); setOrigemOutros("");
      setSetor(""); setResponsavelId(""); setPrazo(""); setPrioridade("Média");
      setVinculo(""); setMencionados([]); setErro(""); setSalvando(false);
      preenchido.current = false;
      return;
    }
    // Pré-preenchimento vindo de outro módulo: aplica uma vez por abertura,
    // para não sobrescrever o que a pessoa digita depois.
    if (preenchido.current) return;
    preenchido.current = true;
    if (!inicial) return;
    setTitulo((inicial.titulo ?? "").slice(0, 140));
    setDetalhamento(inicial.detalhamento ?? "");
    setSetor(inicial.setor ?? "");
    setOrigem(inicial.origem ?? "");
    setVinculo(inicial.vinculo ?? "");
  }, [aberto, inicial]);

  const responsavel = colaboradores.find((c) => c.id === responsavelId);
  const prazoIso = prazo.trim() ? prazoBrParaISO(prazo) : null;
  const valido = titulo.trim().length >= 3 && !!responsavel && !!setor && !!prioridade
    && (prazo.trim() === "" || prazoIso !== null)
    && (origem !== "Outros" || origemOutros.trim() !== "");

  async function enviar() {
    if (!valido || !responsavel) return;
    setSalvando(true);
    setErro("");
    try {
      await criarPlano({
        titulo: titulo.trim(),
        descricao: detalhamento.trim() || titulo.trim(),
        origem: origem || "Outros",
        origemOutros: origemOutros.trim(),
        setor,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        responsavelEmail: (responsavel.email ?? "").toLowerCase(),
        seguidoresIds: mencionados.map((m) => m.id),
        seguidoresEmails: mencionados.map((m) => (m.email ?? "").toLowerCase()).filter((e) => e.includes("@")),
        prazo: prazoIso,
        prioridade,
        vinculoTipo: vinculo.trim() ? "registro" : "",
        vinculoId: vinculo.trim(),
      }, getSession());
      onCriado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">Novo plano</span>
            <span className="mt-1.5 block text-lg font-semibold">O que precisa ser feito</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Campo rotulo="O que precisa ser feito *">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar matriz de acessos" maxLength={140} />
          </Campo>
          <Campo rotulo="Detalhamento">
            <Textarea value={detalhamento} onChange={(e) => setDetalhamento(e.target.value)}
              placeholder="Problema, entrega esperada e comprovação." className="min-h-[90px]" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Origem *">
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                <SelectContent>
                  {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {origem === "Outros" ? (
                <div className="pt-2">
                  <Input value={origemOutros} onChange={(e) => setOrigemOutros(e.target.value)}
                    placeholder="Qual origem?" maxLength={120} />
                </div>
              ) : null}
            </Campo>
            <Campo rotulo="Setor *">
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                <SelectContent>
                  {setores.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Responsável *">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue placeholder="Selecionar colaborador…" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} — {c.setor || c.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Prazo">
              <Input value={prazo} onChange={(e) => setPrazo(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa" inputMode="numeric" />
            </Campo>
            <Campo rotulo="Prioridade *">
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue placeholder="Selecionar prioridade" /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES_ACAO.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Vinculação (NC, auditoria…)">
              <Input value={vinculo} onChange={(e) => setVinculo(e.target.value)}
                placeholder="Ex.: NC-2026-003" maxLength={80} />
            </Campo>
          </div>
          <Campo rotulo="Seguidores">
            <CampoMencao colaboradores={colaboradores} selecionados={mencionados} onChange={setMencionados} />
          </Campo>
          {erro ? <p className="text-[13px] text-rose-600">{erro}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void enviar()} disabled={!valido || salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]">
            {salvando ? "Criando…" : "Criar e enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
