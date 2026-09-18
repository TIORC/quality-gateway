import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Plus, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CampoMencao } from "@/components/campo-mencao";
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
import { podeGerenciarConteudo } from "@/lib/permissoes";
import { ORIGENS_ACAO, PRIORIDADES } from "@/lib/dados";
import type { Colaborador } from "@/lib/dados";
import { mascaraDataBr } from "@/lib/utils";

export const Route = createFileRoute("/planos-de-acao")({
  head: () => ({
    meta: [{ title: "Planos de Ação | Gestão da Qualidade" }],
  }),
  component: PlanosDeAcao,
});

interface Filtros {
  busca: string;
  origem: string;
  status: string;
  setor: string;
}

const FILTROS_INICIAIS: Filtros = {
  busca: "",
  origem: "todas",
  status: "todos",
  setor: "todos",
};

const ABAS = [
  { valor: "minhas", rotulo: "Minhas ações" },
  { valor: "acompanho", rotulo: "Acompanho" },
  { valor: "organizacao", rotulo: "Toda a organização" },
] as const;

function PlanosDeAcao() {
  const catalogo = useCatalogoOrganizacional();
  const sessao = usePanelSession();
  const podeGerenciar = podeGerenciarConteudo(sessao);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [novoPlanoAberto, setNovoPlanoAberto] = useState(false);

  function atualizarFiltro(campo: keyof Filtros, valor: string) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Todas as ações
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Planos de ação
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Você edita o que é seu. O que acompanha como seguidor fica em leitura.
          </p>
        </div>

        {podeGerenciar ? (
          <Button className="shrink-0" onClick={() => setNovoPlanoAberto(true)}>
            <Plus className="h-4 w-4" />
            Novo plano de ação
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="minhas">
        <TabsList>
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
            <ListaAcoes
              filtros={filtros}
              setores={catalogo.setores}
              onFiltroChange={atualizarFiltro}
              onNovoPlano={() => setNovoPlanoAberto(true)}
              podeGerenciar={podeGerenciar}
            />
          </TabsContent>
        ))}
      </Tabs>

      <NovoPlanoDialog
        aberto={novoPlanoAberto}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setNovoPlanoAberto(false)}
      />
    </PanelShell>
  );
}

interface ListaAcoesProps {
  filtros: Filtros;
  setores: string[];
  onFiltroChange: (campo: keyof Filtros, valor: string) => void;
  onNovoPlano: () => void;
  podeGerenciar: boolean;
}

function ListaAcoes({
  filtros,
  setores,
  onFiltroChange,
  onNovoPlano,
  podeGerenciar,
}: ListaAcoesProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={filtros.busca}
            onChange={(evento) => onFiltroChange("busca", evento.target.value)}
            placeholder="Buscar por título, código ou responsável"
            className="pl-9"
          />
        </div>

        <Select value={filtros.origem} onValueChange={(valor) => onFiltroChange("origem", valor)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="ocorrencias">Ocorrências</SelectItem>
            <SelectItem value="auditorias">Auditorias</SelectItem>
            <SelectItem value="atas">Atas de reunião</SelectItem>
            <SelectItem value="projetos">Projetos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.status} onValueChange={(valor) => onFiltroChange("status", valor)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.setor} onValueChange={(valor) => onFiltroChange("setor", valor)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores.map((setor) => (
              <SelectItem key={setor} value={setor}>
                {setor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <ClipboardList className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma ação encontrada</h3>
        <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
          Ajuste os filtros ou registre um novo plano de ação para começar.
        </p>
        {podeGerenciar ? (
          <Button variant="outline" className="mt-5" onClick={onNovoPlano}>
            <Plus className="h-4 w-4" />
            Novo plano de ação
          </Button>
        ) : null}
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

function Contador({ atual, maximo }: { atual: number; maximo: number }) {
  return (
    <p className="text-right text-[11px] text-[#94A3B8]">
      {atual}/{maximo}
    </p>
  );
}

interface NovoPlanoDialogProps {
  aberto: boolean;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
}

function NovoPlanoDialog({ aberto, setores, colaboradores, onFechar }: NovoPlanoDialogProps) {
  const [oQueFazer, setOQueFazer] = useState("");
  const [detalhamento, setDetalhamento] = useState("");
  const [origem, setOrigem] = useState("");
  const [origemOutros, setOrigemOutros] = useState("");
  const [setor, setSetor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [mencionados, setMencionados] = useState<Colaborador[]>([]);

  function limpar() {
    setOQueFazer("");
    setDetalhamento("");
    setOrigem("");
    setOrigemOutros("");
    setSetor("");
    setPrazo("");
    setPrioridade("");
    setMencionados([]);
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
          <DialogTitle>Novo plano de ação</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar e enviar a ação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Campo rotulo="O que precisa ser feito">
            <Textarea
              value={oQueFazer}
              onChange={(evento) => setOQueFazer(evento.target.value)}
              maxLength={4000}
              placeholder="Descreva o que precisa ser feito…"
              className="min-h-[90px]"
            />
            <Contador atual={oQueFazer.length} maximo={4000} />
          </Campo>

          <Campo rotulo="Detalhamento">
            <Textarea
              value={detalhamento}
              onChange={(evento) => setDetalhamento(evento.target.value)}
              maxLength={6000}
              placeholder="Adicione os detalhes da ação…"
              className="min-h-[120px]"
            />
            <div className="flex items-center justify-between gap-3">
              <em className="text-xs italic text-[#94A3B8]">
                Descreva o problema, a entrega esperado e como será comprovada.
              </em>
              <Contador atual={detalhamento.length} maximo={6000} />
            </div>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Origem da Ação">
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS_ACAO.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {origem === "Outros" ? (
                <div className="pt-3">
                  <Input
                    value={origemOutros}
                    onChange={(evento) => setOrigemOutros(evento.target.value)}
                    placeholder="Qual origem?"
                    maxLength={120}
                  />
                </div>
              ) : null}
            </Campo>

            <Campo rotulo="Setor Responsável">
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar setor" />
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

            <Campo rotulo="Responsável pela Execução">
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar colaborador…" />
                </SelectTrigger>
                <SelectContent />
              </Select>
            </Campo>

            <Campo rotulo="Prazo">
              <Input
                value={prazo}
                onChange={(evento) => setPrazo(mascaraDataBr(evento.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>

            <Campo rotulo="Nível de Prioridade">
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Seguidores Mencionados">
            <CampoMencao
              colaboradores={colaboradores}
              selecionados={mencionados}
              onChange={setMencionados}
            />
            <p className="text-xs italic text-[#94A3B8]">
              Quando for mencionado, recebe a ação por e-mail e acompanha em modo leitura.
            </p>
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
            Criar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
