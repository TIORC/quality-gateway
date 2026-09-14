import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CampoMencao } from "@/components/campo-mencao";
import { PanelShell } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  COLABORADORES,
  NORMAS_AUDITORIA,
  SETORES,
  TIPOS_AUDITORIA,
  UNIDADES,
  type Colaborador,
  type TipoAuditoria,
} from "@/lib/dados";
import { mascaraDataBr } from "@/lib/utils";

export const Route = createFileRoute("/auditorias")({
  head: () => ({
    meta: [{ title: "Auditorias | Gestão da Qualidade" }],
  }),
  component: Auditorias,
});

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "planejadas", rotulo: "Planejadas" },
  { valor: "execucao", rotulo: "Em execução" },
  { valor: "concluidas", rotulo: "Concluídas" },
] as const;

const ROTEIRO = [
  {
    id: "monitoramento",
    rotulo: "Monitoramento e medição ISO 9001:2015 · 9.1",
    pergunta:
      "Os indicadores do processo são apurados na periodicidade definida e analisados criticamente?",
  },
  {
    id: "nconformidade",
    rotulo: "Não conformidade e ação corretiva ISO 9001:2015 · 10.2",
    pergunta:
      "As não conformidades anteriores foram tratadas com análise de causa e avaliação de eficácia?",
  },
  {
    id: "competencia",
    rotulo: "Competência ISO 9001:2015 · 7.2",
    pergunta: "A equipe tem treinamento registrado para as atividades que executa?",
  },
  {
    id: "riscos",
    rotulo: "Riscos e oportunidades ISO 9001:2015 · 6.1",
    pergunta: "Os riscos do processo estão identificados e existe tratamento definido?",
  },
  {
    id: "informacao",
    rotulo: "Informação documentada ISO 9001:2015 · 7.5",
    pergunta:
      "Os documentos do processo estão atualizados, aprovados e disponíveis na versão vigente?",
  },
  {
    id: "producao",
    rotulo: "Controle da produção e serviço ISO 9001:2015 · 8.5.1",
    pergunta:
      "As atividades seguem os procedimentos operacionais definidos e há registro da execução?",
  },
];

const OLANDSSON: Colaborador = { id: "col_olandson", nome: "Olandson", cargo: "Auditor" };

interface SummaryCardProps {
  label: string;
  value: string;
  footer: string;
  accent: string;
  valueClass: string;
}

function SummaryCard({ label, value, footer, accent, valueClass }: SummaryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D9E0EA] bg-white p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <p className={valueClass}>{value}</p>
      <p className="mt-2 text-[13px] text-[#64748B]">{footer}</p>
    </div>
  );
}

function Auditorias() {
  const [novaAuditoria, setNovaAuditoria] = useState(false);

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Auditorias da qualidade
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Cada não conformidade encontrada vira uma ocorrência com fluxo próprio, sem sair da
            auditoria.
          </p>
        </div>

        <Button className="shrink-0" onClick={() => setNovaAuditoria(true)}>
          <Plus className="h-4 w-4" />
          Nova auditoria
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Auditorias no ano"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
          accent="#1F2937"
          footer="0 concluídas"
        />
        <SummaryCard
          label="Conformidade média"
          value="0%"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#4F46E5]"
          accent="#4F46E5"
          footer="requisitos conformes"
        />
        <SummaryCard
          label="Não conformidades"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#E11D48]"
          accent="#E11D48"
          footer="levantadas nas auditorias"
        />
        <SummaryCard
          label="Ocorrências abertas"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
          accent="#059669"
          footer="a partir de achados"
        />
      </section>

      <Tabs defaultValue="todas">
        <TabsList className="mt-6 flex-wrap">
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
            <ListaAuditorias onNova={() => setNovaAuditoria(true)} />
          </TabsContent>
        ))}
      </Tabs>

      <NovaAuditoriaDialog aberto={novaAuditoria} onFechar={() => setNovaAuditoria(false)} />
    </PanelShell>
  );
}

function ListaAuditorias({ onNova }: { onNova: () => void }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <ClipboardCheck className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma auditoria aqui</h3>
        <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
          Programe a auditoria, monte o roteiro de verificação e registre os achados.
        </p>
        <Button variant="outline" className="mt-5" onClick={onNova}>
          <Plus className="h-4 w-4" />
          Nova auditoria
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

interface NovaAuditoriaDialogProps {
  aberto: boolean;
  onFechar: () => void;
}

function NovaAuditoriaDialog({ aberto, onFechar }: NovaAuditoriaDialogProps) {
  const [codigo, setCodigo] = useState("AUD-2026-05");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoAuditoria>("Interna");
  const [norma, setNorma] = useState("ISO 9001:2015");
  const [unidade, setUnidade] = useState("Matriz");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [setoresAuditados, setSetoresAuditados] = useState<string[]>([]);
  const [escopo, setEscopo] = useState("");
  const [auditores, setAuditores] = useState<Colaborador[]>([OLANDSSON]);
  const [auditados, setAuditados] = useState<Colaborador[]>([]);
  const [roteiroSelecionado, setRoteiroSelecionado] = useState<string[]>([]);

  function alternarSetor(setor: string) {
    setSetoresAuditados((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor],
    );
  }

  function alternarRoteiro(id: string) {
    setRoteiroSelecionado((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  function limpar() {
    setCodigo("AUD-2026-05");
    setTitulo("");
    setTipo("Interna");
    setNorma("ISO 9001:2015");
    setUnidade("Matriz");
    setDataPlanejada("");
    setSetoresAuditados([]);
    setEscopo("");
    setAuditores([OLANDSSON]);
    setAuditados([]);
    setRoteiroSelecionado([]);
  }

  useEffect(() => {
    if (!aberto) limpar();
  }, [aberto]);

  function programar() {
    limpar();
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova auditoria</DialogTitle>
          <DialogDescription>
            Programe a auditoria, defina o escopo e monte o roteiro de verificação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código">
              <Input value={codigo} onChange={(evento) => setCodigo(evento.target.value)} />
            </Campo>

            <Campo rotulo="Título">
              <Input
                value={titulo}
                onChange={(evento) => setTitulo(evento.target.value)}
                placeholder="Ex.: Auditoria interna — Processo de Expedição"
              />
            </Campo>

            <Campo rotulo="Tipo">
              <Select value={tipo} onValueChange={(valor) => setTipo(valor as TipoAuditoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_AUDITORIA.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Norma">
              <Select value={norma} onValueChange={setNorma}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NORMAS_AUDITORIA.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Unidade">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Data planejada">
              <Input
                value={dataPlanejada}
                onChange={(evento) => setDataPlanejada(mascaraDataBr(evento.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>
          </div>

          <Campo rotulo="Setores auditados">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SETORES.map((setor) => (
                <label
                  key={setor}
                  htmlFor={`setor-auditado-${setor}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`setor-auditado-${setor}`}
                    checked={setoresAuditados.includes(setor)}
                    onCheckedChange={() => alternarSetor(setor)}
                  />
                  {setor}
                </label>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Escopo">
            <Textarea
              value={escopo}
              onChange={(evento) => setEscopo(evento.target.value)}
              placeholder="O que será verificado e com qual profundidade."
              className="min-h-[90px]"
            />
          </Campo>

          <Campo rotulo="Auditores">
            <CampoMencao
              colaboradores={COLABORADORES}
              selecionados={auditores}
              onChange={setAuditores}
              exibirAvatar
            />
            <p className="text-xs italic text-[#94A3B8]">
              Quem for mencionado recebe a ação por e-mail e acompanha em modo leitura.
            </p>
          </Campo>

          <Campo rotulo="Auditados">
            <CampoMencao
              colaboradores={COLABORADORES}
              selecionados={auditados}
              onChange={setAuditados}
            />
            <p className="text-xs italic text-[#94A3B8]">
              Quem for mencionado recebe a ação por e-mail e acompanha em modo leitura.
            </p>
          </Campo>

          <Campo rotulo="Roteiro de verificação">
            <div className="space-y-2">
              {ROTEIRO.map((item) => (
                <label
                  key={item.id}
                  htmlFor={`roteiro-${item.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E9EEF5] p-3 transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`roteiro-${item.id}`}
                    checked={roteiroSelecionado.includes(item.id)}
                    onCheckedChange={() => alternarRoteiro(item.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-[#1F2937]">
                      {item.rotulo}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#64748B]">
                      {item.pergunta}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="pt-1 text-xs italic text-[#94A3B8]">
              Outros itens podem ser acrescentados durante a auditoria.
            </p>
          </Campo>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={programar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Programar Auditoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
