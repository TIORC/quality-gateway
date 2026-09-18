import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
  listarTipos, abrirOcorrencia, type Ocorrencia, type TipoOcorrencia,
} from "@/lib/ocorrencias-base";
import {
  MACRO_ETAPA_LABELS, STATUS_OCORRENCIA_LABELS, type MacroEtapa,
  type StatusOcorrencia,
} from "@/lib/ocorrencias";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import { FormatadorSla } from "@/components/ocorrencias/formatador-sla";
import { MetroLinha } from "@/components/ocorrencias/metro-linha";
import { DetalheOcorrenciaDialog } from "@/components/ocorrencias/detalhe-ocorrencia-dialog";
import { FormularioDinamico } from "@/components/ocorrencias/campo-renderer";
import type { CampoFormulario } from "@/lib/ocorrencias";


export const Route = createFileRoute("/ocorrencias")({
  head: () => ({
    meta: [{ title: "Ocorrências | Gestão da Qualidade" }],
  }),
  component: Ocorrencias,
});

const ABAS = [
  { valor: "andamento", rotulo: "Em andamento" },
  { valor: "abri", rotulo: "Que eu abri" },
  { valor: "setor", rotulo: "Do setor Qualidade" },
  { valor: "encerradas", rotulo: "Encerradas" },
] as const;

function Ocorrencias() {
  const session = usePanelSession();
  const [abrirAberto, setAbrirAberto] = useState(false);
  const tipos = useAsync(listarTipos);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<Ocorrencia | null>(null);

  const carregando = tipos.loading;
  const lista = tipos.data ?? [];

  const filtrar = (aba: (typeof ABAS)[number]["valor"], o: Ocorrencia): boolean => {
    const email = session?.email;
    if (aba === "abri") return o.abertoPor.email === email;
    if (aba === "setor")
      return ehUsuarioDaQualidade(session) || o.responsavelAtual?.setor === "Qualidade";
    if (aba === "encerradas") return o.status === "encerrada";
    return o.status !== "encerrada";
  };

  const porAba = (aba: string) => lista.filter((o) => filtrar(aba as (typeof ABAS)[number]["valor"]));

  return (
    <PanelShell wide>
      <div className="flex min-h-[calc(100vh-6rem)] flex-col">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Tratativa
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
              Ocorrências
            </h1>
            <p className="mt-1.5 text-sm text-[#64748B]">
              Quem abre acompanha a etapa como quem acompanha o metrô: só sabe onde está e
              quando chega.
            </p>
          </div>

          <Button className="shrink-0" onClick={() => setAbrirAberto(true)}>
            <Plus className="h-4 w-4" />
            Abrir ocorrência
          </Button>
        </div>

        <Tabs defaultValue="andamento">
          <TabsList className="flex-wrap">
            {ABAS.map((aba) => {
              const total = porAba(aba.valor).length;
              return (
                <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
                  {aba.rotulo}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                    {total}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ABAS.map((aba) => (
            <TabsContent key={aba.valor} value={aba.valor}>
              <ListaOcorrencias
                ocorrencias={porAba(aba.valor)}
                carregando={carregando}
                onAbrir={() => setAbrirAberto(true)}
                onDetalhar={(o) => setOcorrenciaSelecionada(o)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AbrirOcorrenciaDialog
        aberto={abrirAberto}
        tipos={lista}
        onFechar={() => setAbrirAberto(false)}
        onCriado={(o) => {
          setAbrirAberto(false);
          setOcorrenciaSelecionada(o);
        }}
      />

      <DetalheOcorrenciaDialog
        aberto={!!ocorrenciaSelecionada}
        onClose={() => setOcorrenciaSelecionada(null)}
        ocorrencia={ocorrenciaSelecionada}
      />
    </PanelShell>
  );
}


function ListaOcorrencias({
  ocorrencias, carregando, onAbrir, onDetalhar,
}: {
  ocorrencias: Ocorrencia[];
  carregando: boolean;
  onAbrir: () => void;
  onDetalhar: (o: Ocorrencia) => void;
}) {
  if (carregando) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-[#F1F5F9] animate-pulse" />
        ))}
      </div>
    );
  }

  if (ocorrencias.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#94A3B8]">
            Formulários e fluxos
          </p>
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <ClipboardList className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
            Nenhuma ocorrência nesta lista
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Ao abrir uma ocorrência, ela segue o fluxo do tipo escolhido até a
            avaliação de eficácia.
          </p>
          <Button variant="outline" className="mt-5" onClick={onAbrir}>
            <Plus className="h-4 w-4" />
            Abrir ocorrência
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#D9E0EA] bg-white">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Título</th>
            <th className="px-3 py-2 text-left">Etapa</th>
            <th className="px-3 py-2 text-left">Responsável</th>
            <th className="px-3 py-2 text-left">Abertura</th>
            <th className="px-3 py-2 text-left">SLA</th>
          </tr>
        </thead>
        <tbody>
          {ocorrencias.map((o) => {
            const etapaLbl = MACRO_ETAPA_LABELS[o.macroAtual];
            const sla = FormatadorSla.calcular(o.macroAtual, o.prazoEtapa);
            return (
              <tr
                key={o.id}
                className="border-t border-[#E9EEF5] transition hover:bg-[#F8FAFC]"
                onClick={() => onDetalhar(o)}
              >
                <td className="px-3 py-2 font-medium text-[#1F2937]">{o.numero}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: o.tipo.cor }}
                  >
                    {o.tipo.icone}
                    {o.tipo.nome}
                  </span>
                </td>
                <td className="px-3 py-2 text-[#1F2937]">{o.tituloCurto || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: sla.atrasado ? "#FDECEE" : sla.critical ? "#FFFBEB" : "#ECFDF5",
                      color: sla.atrasado ? "#991A1A" : sla.critical ? "#92400E" : "#065F46",
                    }}
                  >
                    {etapaLbl}
                  </span>
                </td>
                <td className="px-3 py-2 text-[#334155]">{o.responsavelAtual?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-[#64748B]">{FormatadorSla.formatarData(o.abertoEm)}</td>
                <td className="px-3 py-2">
                  <FormatadorSla sla={sla} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface AbrirOcorrenciaDialogProps {
  aberto: boolean;
  tipos: TipoOcorrencia[];
  onFechar: () => void;
  onCriado: (o: Ocorrencia) => void;
}

function AbrirOcorrenciaDialog({ aberto, tipos, onFechar, onCriado }: AbrirOcorrenciaDialogProps) {
  const session = usePanelSession();
  const [etapa, setEtapa] = useState<"tipo" | "formulario">("tipo");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (aberto) {
      setEtapa("tipo"); setTipoId(null); setRespostas({});
    }
  }, [aberto]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const campos = tipo?.formulario?.campos ?? [];

  async function confirmar() {
    const titulo = (respostas.titulo as string) ?? "";
    if (!titulo) {
      toast.error("O título é obrigatório");
      return;
    }
    const res = await abrirOcorrencia(tipo!.id, {
      titulo_curto: titulo,
      respostas,
      abertoPor: {
        id: session?.id, nome: session?.nome, email: session?.email,
        setor: (session as any)?.setor ?? "",
      },
    });
    if (res.ok && res.dados) {
      toast.success("Ocorrência aberta com sucesso");
      onCriado(res.dados);
    } else {
      toast.error(res.erro ?? "Não foi possível abrir a ocorrência");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abrir ocorrência</DialogTitle>
          <DialogDescription>
            {etapa === "tipo"
              ? "Escolha o tipo de ocorrência para carregar o formulário correspondente."
              : "Preencha o formulário do tipo escolhido."}
          </DialogDescription>
        </DialogHeader>

        {etapa === "tipo" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {tipos.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex flex-col items-start gap-2 rounded-lg border border-[#D9E0EA] p-3 text-left transition hover:border-[#1E3A8A] hover:bg-[#F0F4FF]"
                onClick={() => { setTipoId(t.id); setEtapa("formulario"); }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: t.cor }}
                  >
                    {t.icone}
                  </span>
                  <span className="text-[13px] font-semibold text-[#1F2937]">{t.nome}</span>
                </span>
                <span className="text-[11px] text-[#64748B]">{t.descricao}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {tipo && (
              <div className="flex items-center gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: tipo.cor }}
                >
                  {tipo.icone}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#1F2937]">{tipo.nome}</p>
                  <p className="text-[11px] text-[#64748B]">{tipo.descricao}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => { setTipoId(null); setEtapa("tipo"); }}
                >
                  Trocar tipo
                </Button>
              </div>
            )}

            <FormularioDinamico
              campos={campos as CampoFormulario[]}
              respostas={respostas}
              onChange={(id, valor) => setRespostas((r) => ({ ...r, [id]: valor }))}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          {etapa === "formulario" && (
            <Button
              type="button"
              onClick={() => void confirmar()}
              className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            >
              Criar Ocorrência
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
