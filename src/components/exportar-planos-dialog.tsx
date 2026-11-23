import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORIDADES_ACAO, type PlanoAcao } from "@/lib/planos";
import {
  CAMPOS_DATA,
  GRUPOS_STATUS,
  PERIODOS_RELATORIO,
  exportarRelatorioPlanos,
  intervaloRelatorio,
  opcoesIniciais,
  planosDoRelatorio,
  type OpcoesRelatorio,
} from "@/lib/planos-relatorio";

interface ExportarPlanosDialogProps {
  aberto: boolean;
  planos: PlanoAcao[];
  onFechar: () => void;
}

/** Botão de escolha (período, base de data): destaca a opção selecionada com as cores do tema. */
function opcaoClasse(selecionado: boolean): string {
  return `rounded-lg border px-3 py-2 text-sm font-medium transition ${
    selecionado
      ? "border-primary bg-primary text-primary-foreground shadow-sm"
      : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  }`;
}

function rotuloSecao(texto: string) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{texto}</p>;
}

/** Relatório de Planos de Ação em Excel, com período, base de data e filtros. */
export function ExportarPlanosDialog({ aberto, planos, onFechar }: ExportarPlanosDialogProps) {
  const [op, setOp] = useState<OpcoesRelatorio>(() => opcoesIniciais());
  const [exportando, setExportando] = useState(false);

  const atualizar = (parcial: Partial<OpcoesRelatorio>) => setOp((o) => ({ ...o, ...parcial }));

  const intervalo = useMemo(() => intervaloRelatorio(op), [op]);
  const resultado = useMemo(
    () => (intervalo ? planosDoRelatorio(planos, op, intervalo) : []),
    [planos, op, intervalo],
  );
  const setores = useMemo(
    () => [...new Set(planos.map((p) => p.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [planos],
  );
  const origens = useMemo(
    () => [...new Set(planos.map((p) => p.origem).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [planos],
  );

  const semStatus = op.grupos.length === 0;
  const periodoInvalido = intervalo === null;
  const podeExportar = !periodoInvalido && !semStatus && !exportando;
  const campoAtual = CAMPOS_DATA.find((c) => c.valor === op.campoData);

  function alternarGrupo(valor: string, marcado: boolean) {
    setOp((o) => ({
      ...o,
      grupos: marcado ? [...o.grupos, valor] : o.grupos.filter((g) => g !== valor),
    }));
  }

  async function exportar() {
    setExportando(true);
    try {
      const { arquivo, total } = await exportarRelatorioPlanos(planos, op);
      toast.success(`Relatório gerado: ${total} ação(ões). Arquivo: ${arquivo}`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#2F75B5]" /> Exportar relatório em Excel
          </DialogTitle>
          <DialogDescription>
            Escolha o período, a base de data e os filtros. O arquivo sai com o cabeçalho do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Período */}
          <section className="sm:col-span-2">
            {rotuloSecao("Período")}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PERIODOS_RELATORIO.map((p) => (
                <button key={p.valor} type="button" onClick={() => atualizar({ periodo: p.valor })}
                  className={opcaoClasse(op.periodo === p.valor)}>
                  {p.rotulo}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {op.periodo === "personalizado" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="relatorio-de">De</Label>
                    <Input id="relatorio-de" type="date" value={op.de} max={op.ate}
                      onChange={(e) => atualizar({ de: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="relatorio-ate">Até</Label>
                    <Input id="relatorio-ate" type="date" value={op.ate} min={op.de}
                      onChange={(e) => atualizar({ ate: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor="relatorio-referencia">Data de referência</Label>
                  <Input id="relatorio-referencia" type="date" value={op.referencia}
                    onChange={(e) => atualizar({ referencia: e.target.value })} />
                </div>
              )}
              <p className={`mt-2 text-xs ${periodoInvalido ? "text-destructive" : "text-muted-foreground"}`}>
                {periodoInvalido
                  ? "A data inicial precisa ser anterior ou igual à final."
                  : `Período: ${intervalo.rotulo}`}
              </p>
            </div>
          </section>

          {/* Base de data */}
          <section className="sm:col-span-2">
            {rotuloSecao("Filtrar pela data de")}
            <div className="grid grid-cols-3 gap-2">
              {CAMPOS_DATA.map((c) => (
                <button key={c.valor} type="button" onClick={() => atualizar({ campoData: c.valor })}
                  className={opcaoClasse(op.campoData === c.valor)}>
                  {c.rotulo}
                </button>
              ))}
            </div>
            {campoAtual ? <p className="mt-2 text-xs text-muted-foreground">Considera a {campoAtual.descricao}.</p> : null}
          </section>

          {/* Status */}
          <section>
            {rotuloSecao("Status")}
            <div className="space-y-2.5">
              {GRUPOS_STATUS.map((g) => {
                const id = `status-${g.valor}`;
                return (
                  <div key={g.valor} className="flex items-center gap-2.5">
                    <Checkbox id={id} checked={op.grupos.includes(g.valor)}
                      onCheckedChange={(v) => alternarGrupo(g.valor, v === true)} />
                    <Label htmlFor={id} className="font-normal">{g.rotulo}</Label>
                  </div>
                );
              })}
              <div className="flex items-center gap-2.5 border-t pt-2.5">
                <Checkbox id="somente-atrasadas" checked={op.somenteAtrasadas}
                  onCheckedChange={(v) => atualizar({ somenteAtrasadas: v === true })} />
                <Label htmlFor="somente-atrasadas" className="font-normal">Somente atrasadas</Label>
              </div>
            </div>
            {semStatus ? <p className="mt-2 text-xs text-destructive">Marque ao menos um status.</p> : null}
          </section>

          {/* Filtros de cadastro */}
          <section className="space-y-4">
            {rotuloSecao("Filtros")}
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Select value={op.setor} onValueChange={(v) => atualizar({ setor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={op.origem} onValueChange={(v) => atualizar({ origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as origens</SelectItem>
                  {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={op.prioridade} onValueChange={(v) => atualizar({ prioridade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as prioridades</SelectItem>
                  {PRIORIDADES_ACAO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Conteúdo do arquivo */}
          <section>
            {rotuloSecao("Conteúdo do arquivo")}
            <div className="flex items-start gap-2.5">
              <Checkbox id="incluir-resumo" checked={op.incluirResumo} className="mt-0.5"
                onCheckedChange={(v) => atualizar({ incluirResumo: v === true })} />
              <div>
                <Label htmlFor="incluir-resumo" className="font-normal">Incluir aba de resumo</Label>
                <p className="text-xs text-muted-foreground">Totais por situação, atrasos e concluídas.</p>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{resultado.length}</span> ação(ões) no relatório
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFechar} disabled={exportando}>Cancelar</Button>
            <Button onClick={() => void exportar()} disabled={!podeExportar}>
              <FileSpreadsheet className="h-4 w-4" />
              {exportando ? "Gerando…" : "Baixar Excel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
