import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import type { Colaborador } from "@/lib/dados";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [{ title: "Indicadores | Gestão da Qualidade" }],
  }),
  component: Indicadores,
});

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function mesFechamento() {
  const agora = new Date();
  const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  return `${MESES_CURTOS[anterior.getMonth()]}/${String(anterior.getFullYear()).slice(-2)}`;
}

const UNIDADES = ["%", "R$", "Unidade(s)", "Dias", "Horas"] as const;

const SENTIDOS = ["Quanto maior, melhor", "Quanto menor, melhor", "Dentro da faixa"] as const;

const FORMAS_ALIMENTACAO = ["Manual", "Automática"] as const;

interface SummaryCardProps {
  label: string;
  value: string;
  valueClass: string;
  accent: string;
  footer: string;
}

function SummaryCard({ label, value, valueClass, accent, footer }: SummaryCardProps) {
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

function Indicadores() {
  const catalogo = useCatalogoOrganizacional();
  const [novoIndicador, setNovoIndicador] = useState(false);

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Medição
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Indicadores
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Onde o número não bate a meta, sai um plano de ação para o setor dono do indicador.
          </p>
        </div>

        <Button className="shrink-0" onClick={() => setNovoIndicador(true)}>
          <Plus className="h-4 w-4" />
          Novo indicador
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Indicadores acompanhados"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#1F2937]"
          accent="#1F2937"
          footer="em toda a operação"
        />
        <SummaryCard
          label="Dentro da meta"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#059669]"
          accent="#059669"
          footer="no último mês apurado"
        />
        <SummaryCard
          label="Abaixo da meta"
          value="0"
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#E11D48]"
          accent="#E11D48"
          footer="exigem plano de ação"
        />
        <SummaryCard
          label="Último fechamento"
          value={mesFechamento()}
          valueClass="mt-3 text-[30px] font-semibold leading-none text-[#4F46E5]"
          accent="#4F46E5"
          footer="mês de referência"
        />
      </section>

      <Tabs defaultValue="visao-geral">
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="meu-setor">Meu setor</TabsTrigger>
          </TabsList>

          <Select defaultValue="todos">
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {catalogo.setores.map((setor) => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="visao-geral">
          <ListaIndicadores onNovo={() => setNovoIndicador(true)} />
        </TabsContent>

        <TabsContent value="meu-setor">
          <ListaIndicadores onNovo={() => setNovoIndicador(true)} />
        </TabsContent>
      </Tabs>

      <NovoIndicadorDialog
        aberto={novoIndicador}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setNovoIndicador(false)}
      />

      <p className="mt-8 text-center text-[11px] text-[#94A3B8]">
        Desenvolvido com 💙 pelos Desenvolvedores Orcoma Contabilidade
      </p>
    </PanelShell>
  );
}

function ListaIndicadores({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <BarChart3 className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
          Nenhum indicador cadastrado aqui
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
          A Qualidade cadastra o indicador, define a meta e como ele é apurado.
        </p>
        <Button variant="outline" className="mt-5" onClick={onNovo}>
          <Plus className="h-4 w-4" />
          Novo indicador
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

interface NovoIndicadorDialogProps {
  aberto: boolean;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
}

function NovoIndicadorDialog({
  aberto,
  setores,
  colaboradores,
  onFechar,
}: NovoIndicadorDialogProps) {
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("Qualidade");
  const [donoId, setDonoId] = useState("");
  const [unidade, setUnidade] = useState("%");
  const [meta, setMeta] = useState("90");
  const [sentido, setSentido] = useState("Quanto maior, melhor");
  const [comoApurado, setComoApurado] = useState("");
  const [alimentacao, setAlimentacao] = useState("Manual");
  const [modelo, setModelo] = useState("modelo-indicador.xlsx");

  function limpar() {
    setNome("");
    setSetor("Qualidade");
    setDonoId("");
    setUnidade("%");
    setMeta("90");
    setSentido("Quanto maior, melhor");
    setComoApurado("");
    setAlimentacao("Manual");
    setModelo("modelo-indicador.xlsx");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo indicador</DialogTitle>
          <DialogDescription>
            Cadastre o indicador, defina a meta e como ele é apurado.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Campo rotulo="Nome do indicador">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Tarefas concluídas no prazo"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor">
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Dono do indicador">
              <Select value={donoId} onValueChange={setDonoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar colaborador…" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colaborador) => (
                    <SelectItem key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
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

            <Campo rotulo="Meta">
              <Input
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                placeholder="Ex.: 90"
                inputMode="numeric"
              />
            </Campo>
          </div>

          <Campo rotulo="Sentido">
            <Select value={sentido} onValueChange={setSentido}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENTIDOS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Como é apurado">
            <Textarea
              value={comoApurado}
              onChange={(e) => setComoApurado(e.target.value)}
              placeholder="Ex.: Apurado mensalmente pela Qualidade…"
              className="min-h-[80px]"
            />
            <p className="text-xs italic text-[#94A3B8]">
              Fica visível para quem lança a apuração todo mês.
            </p>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Forma de alimentação">
              <Select value={alimentacao} onValueChange={setAlimentacao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_ALIMENTACAO.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Modelo de documento">
              <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
              <p className="text-xs italic text-[#94A3B8]">
                Nome do arquivo padrão usado no lançamento.
              </p>
            </Campo>
          </div>
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
            Criar indicador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
