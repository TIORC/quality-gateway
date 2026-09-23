import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import { criarPlano } from "@/lib/planos-crud";
import type { ProjetoEstrategico } from "@/lib/projetos";
import { gerarSugestoesDeAcoes, type SugestaoAcao } from "@/lib/projetos-ia";
import type { Colaborador } from "@/lib/dados";
import { toast } from "sonner";

interface Props {
  aberto: boolean;
  projeto: ProjetoEstrategico;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
  onCriadas: () => void;
}

export function SugestoesIaDialog({ aberto, projeto, setores, colaboradores, onFechar, onCriadas }: Props) {
  const sugestoesIniciais = useMemo(
    () => gerarSugestoesDeAcoes({ objetivo: projeto.objetivo, swot: projeto.swot, frentes: projeto.frentes }),
    [projeto],
  );
  const [itens, setItens] = useState<SugestaoAcao[]>(sugestoesIniciais);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(sugestoesIniciais.map((s) => s.id)));
  const [setor, setSetor] = useState(projeto.setor || "");
  const [responsavelId, setResponsavelId] = useState(projeto.responsavelId || "");
  const [salvando, setSalvando] = useState(false);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const prox = new Set(atual);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  }

  function editar(id: string, campo: "titulo" | "descricao" | "prioridade", valor: string) {
    setItens((atual) => atual.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function descartar(id: string) {
    setItens((atual) => atual.filter((s) => s.id !== id));
    setSelecionados((atual) => {
      const prox = new Set(atual);
      prox.delete(id);
      return prox;
    });
  }

  async function aceitar() {
    const escolhidas = itens.filter((s) => selecionados.has(s.id));
    if (escolhidas.length === 0) {
      toast.error("Selecione ao menos uma sugestão.");
      return;
    }
    const responsavel = colaboradores.find((c) => c.id === responsavelId);
    if (!responsavel || !setor) {
      toast.error("Escolha setor e responsável para as ações.");
      return;
    }
    setSalvando(true);
    try {
      const sessao = getSession();
      for (const s of escolhidas) {
        await criarPlano({
          titulo: s.titulo,
          descricao: s.descricao,
          origem: "Planejamento Estratégico",
          origemOutros: `${projeto.codigo} - ${s.origemSwot}: ${s.origemTexto}`.slice(0, 120),
          setor,
          responsavelId: responsavel.id,
          responsavelNome: responsavel.nome,
          responsavelEmail: (responsavel.email ?? "").toLowerCase(),
          seguidoresIds: [],
          seguidoresEmails: [],
          prazo: null,
          prioridade: s.prioridade,
          vinculoTipo: "Projeto",
          vinculoId: projeto.id,
        }, sessao);
      }
      toast.success(`${escolhidas.length} ação(ões) criada(s) no projeto.`);
      onCriadas();
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar as ações.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => (!a ? onFechar() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              <Sparkles className="h-3.5 w-3.5 text-[#4F46E5]" /> Ações sugeridas por IA
            </span>
            <span className="mt-1.5 block text-lg font-semibold">Revise, edite e aceite</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Setor das ações *</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
              <SelectContent>{setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium">Responsável *</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
              <SelectContent>{colaboradores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
          {itens.map((s) => (
            <ItemSugestao key={s.id} item={s} marcado={selecionados.has(s.id)}
              onAlternar={() => alternar(s.id)} onEditar={editar} onDescartar={() => descartar(s.id)} />
          ))}
          {itens.length === 0 ? <p className="py-8 text-center text-sm text-[#94A3B8]">Todas as sugestões foram descartadas.</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>Fechar</Button>
          <Button type="button" onClick={() => void aceitar()} disabled={salvando} className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]">
            {salvando ? "Criando..." : `Aceitar (${itens.filter((s) => selecionados.has(s.id)).length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemSugestao({ item: s, marcado, onAlternar, onEditar, onDescartar }: {
  item: SugestaoAcao; marcado: boolean;
  onAlternar: () => void;
  onEditar: (id: string, campo: "titulo" | "descricao" | "prioridade", valor: string) => void;
  onDescartar: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#E9EEF5] p-3">
      <div className="flex items-start gap-2.5">
        <Checkbox checked={marcado} onCheckedChange={onAlternar} className="mt-1" />
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={s.titulo} onChange={(e) => onEditar(s.id, "titulo", e.target.value)} className="font-medium" maxLength={140} />
          <Textarea value={s.descricao} onChange={(e) => onEditar(s.id, "descricao", e.target.value)} className="min-h-[56px] text-[13px]" />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
            <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 font-semibold text-[#4F46E5]">{s.origemSwot} - {s.origemTexto.slice(0, 60)}</span>
            {s.frenteNome ? <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5">{s.frenteNome}</span> : null}
            <Select value={s.prioridade} onValueChange={(v) => onEditar(s.id, "prioridade", v)}>
              <SelectTrigger className="h-7 w-28 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>{["Baixa", "Média", "Alta", "Crítica"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <button type="button" onClick={onDescartar} className="ml-auto font-semibold text-rose-600 hover:underline">Descartar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

