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
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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
  const [abrirOcorrencia, setAbrirOcorrencia] = useState(false);

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
              Quem abre acompanha a etapa como quem acompanha o metrô: só sabe onde está e quando
              chega.
            </p>
          </div>

          <Button className="shrink-0" onClick={() => setAbrirOcorrencia(true)}>
            <Plus className="h-4 w-4" />
            Abrir ocorrência
          </Button>
        </div>

        <Tabs defaultValue="andamento">
          <TabsList className="flex-wrap">
            {ABAS.map((aba) => (
              <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
                {aba.rotulo}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                  0
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {ABAS.map((aba) => (
            <TabsContent key={aba.valor} value={aba.valor}>
              <ListaOcorrencias onAbrir={() => setAbrirOcorrencia(true)} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AbrirOcorrenciaDialog aberto={abrirOcorrencia} onFechar={() => setAbrirOcorrencia(false)} />
    </PanelShell>
  );
}

function ListaOcorrencias({ onAbrir }: { onAbrir: () => void }) {
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
          Ao abrir uma ocorrência, ela segue o fluxo do tipo escolhido até a avaliação de eficácia.
        </p>
        <Button variant="outline" className="mt-5" onClick={onAbrir}>
          <Plus className="h-4 w-4" />
          Abrir ocorrência
        </Button>
      </div>
    </div>
  );
}

interface CampoProps {
  rotulo: string;
  children: ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface AbrirOcorrenciaDialogProps {
  aberto: boolean;
  onFechar: () => void;
}

function AbrirOcorrenciaDialog({ aberto, onFechar }: AbrirOcorrenciaDialogProps) {
  const session = usePanelSession();
  const [relato, setRelato] = useState("");

  function limpar() {
    setRelato("");
  }

  useEffect(() => {
    if (!aberto) limpar();
  }, [aberto]);

  function enviar() {
    limpar();
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir ocorrência</DialogTitle>
          <DialogDescription>
            Registre os dados da ocorrência para iniciar a tratativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Campo rotulo="Nome da pessoa que abriu">
            <Input value={session?.nome ?? "Usuário"} disabled />
          </Campo>

          <Campo rotulo="Setor">
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar setor…" />
              </SelectTrigger>
              <SelectContent />
            </Select>
          </Campo>

          <Campo rotulo="Relatar o ocorrido">
            <Textarea
              value={relato}
              onChange={(evento) => setRelato(evento.target.value)}
              placeholder="Descreva o que aconteceu…"
              className="min-h-[130px]"
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={enviar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Criar Ocorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
