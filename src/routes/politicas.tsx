import { createFileRoute } from "@tanstack/react-router";
import { Edit3, FileText, Paperclip, Plus, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { getSession, isAdminSession } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import { mascaraDataBr } from "@/lib/utils";

export const Route = createFileRoute("/politicas")({
  head: () => ({
    meta: [{ title: "Políticas | Gestão da Qualidade" }],
  }),
  component: Politicas,
});

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "preciso-ler", rotulo: "Preciso ler" },
  { valor: "meu-parecer", rotulo: "Meu parecer" },
  { valor: "vencendo", rotulo: "Vencendo" },
] as const;

function novaId() {
  return `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface PoliticaItem {
  id: string;
  codigo: string;
  titulo: string;
  doQueTrata: string;
  setores: string[];
  comite: string[];
  prazoResposta: string;
  proximaRevisao: string;
  arquivo: string | null;
}

function Politicas() {
  const catalogo = useCatalogoOrganizacional();
  const [novaPolitica, setNovaPolitica] = useState(false);
  const [politicaEmEdicao, setPoliticaEmEdicao] = useState<PoliticaItem | null>(null);
  const [politicaParaExcluir, setPoliticaParaExcluir] = useState<PoliticaItem | null>(null);
  const [itens, setItens] = useState<PoliticaItem[]>([]);

  const sessao = getSession();
  const podeGerenciar = isAdminSession(sessao);

  function listaDaAba(valor: string) {
    if (valor === "todas") return itens;
    return [];
  }

  function salvarPolitica(politicaId: string | null, dados: Omit<PoliticaItem, "id">) {
    setItens((atual) =>
      politicaId
        ? atual.map((item) => (item.id === politicaId ? { id: politicaId, ...dados } : item))
        : [{ id: novaId(), ...dados }, ...atual],
    );
  }

  function removerPolitica(id: string) {
    setItens((atual) => atual.filter((item) => item.id !== id));
  }

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Documentos normativos
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Políticas
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Da criação à leitura registrada, com rastro de quem aprovou e quem leu.
          </p>
        </div>

        <Button className="shrink-0" onClick={() => setNovaPolitica(true)}>
          <Plus className="h-4 w-4" />
          Nova política
        </Button>
      </div>

      <Tabs defaultValue="todas">
        <TabsList>
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {listaDaAba(aba.valor).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((aba) => (
          <TabsContent key={aba.valor} value={aba.valor}>
            <ListaPoliticas
              itens={listaDaAba(aba.valor)}
              onNova={() => setNovaPolitica(true)}
              podeGerenciar={podeGerenciar}
              onEditar={(item) => setPoliticaEmEdicao(item)}
              onExcluir={(item) => setPoliticaParaExcluir(item)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <PoliticaDialog
        aberto={novaPolitica || politicaEmEdicao !== null}
        politica={politicaEmEdicao}
        opcoesSetores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => {
          setNovaPolitica(false);
          setPoliticaEmEdicao(null);
        }}
        onSalvar={salvarPolitica}
      />

      <Dialog
        open={politicaParaExcluir !== null}
        onOpenChange={(abre) => (abre ? undefined : setPoliticaParaExcluir(null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir política?</DialogTitle>
            <DialogDescription>
              {politicaParaExcluir?.codigo} — {politicaParaExcluir?.titulo}. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPoliticaParaExcluir(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#B91C1C] text-white hover:bg-[#DC2626]"
              onClick={() => {
                if (politicaParaExcluir) removerPolitica(politicaParaExcluir.id);
                setPoliticaParaExcluir(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

function ListaPoliticas({
  itens,
  onNova,
  podeGerenciar,
  onEditar,
  onExcluir,
}: {
  itens: PoliticaItem[];
  onNova: () => void;
  podeGerenciar: boolean;
  onEditar: (item: PoliticaItem) => void;
  onExcluir: (item: PoliticaItem) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <FileText className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma política aqui</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Crie a política, envie para o comitê de aprovação e acompanhe as leituras.
          </p>
          <Button variant="outline" className="mt-5" onClick={onNova}>
            <Plus className="h-4 w-4" />
            Nova política
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-[#E9EEF5] overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      {itens.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-semibold text-[#64748B]">
                {item.codigo}
              </span>
              <p className="truncate text-[14px] font-semibold text-[#1F2937]">{item.titulo}</p>
            </div>
            <p className="text-xs text-[#64748B]">
              {item.setores.length > 0 ? item.setores.join(", ") : "Todos os setores"} · Prazo do
              comitê {item.prazoResposta} · Revisão {item.proximaRevisao}
            </p>
          </div>

          {item.arquivo ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#1E3A8A]">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[240px] truncate">{item.arquivo}</span>
            </span>
          ) : null}

          {podeGerenciar ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#64748B]"
                aria-label={`Editar ${item.titulo}`}
                onClick={() => onEditar(item)}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#64748B] hover:text-rose-600"
                aria-label={`Excluir ${item.titulo}`}
                onClick={() => onExcluir(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
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

interface PoliticaDialogProps {
  aberto: boolean;
  politica: PoliticaItem | null;
  opcoesSetores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
  onSalvar: (politicaId: string | null, dados: Omit<PoliticaItem, "id">) => void;
}

function PoliticaDialog({
  aberto,
  politica,
  opcoesSetores,
  colaboradores,
  onFechar,
  onSalvar,
}: PoliticaDialogProps) {
  const [codigo, setCodigo] = useState("PL-QUA-008");
  const [titulo, setTitulo] = useState("");
  const [sobreOCriterio, setSobreOCriterio] = useState("");
  const [setores, setSetores] = useState<string[]>([]);
  const [comite, setComite] = useState<Colaborador[]>([]);
  const [prazoResposta, setPrazoResposta] = useState("10/09/2026");
  const [proximaRevisao, setProximaRevisao] = useState("10/09/2027");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  function alternarSetor(setor: string) {
    setSetores((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor],
    );
  }

  useEffect(() => {
    const carregar = politica !== null;
    setCodigo(carregar && politica.codigo ? politica.codigo : "PL-QUA-008");
    setTitulo(carregar ? (politica.titulo ?? "") : "");
    setSobreOCriterio(carregar ? (politica.doQueTrata ?? "") : "");
    setSetores(carregar ? (politica.setores ?? []) : []);
    setComite(
      carregar ? colaboradores.filter((c) => (politica.comite ?? []).includes(c.nome)) : [],
    );
    setPrazoResposta(carregar ? (politica.prazoResposta ?? "") : "10/09/2026");
    setProximaRevisao(carregar ? (politica.proximaRevisao ?? "") : "10/09/2027");
    setArquivo(null);
  }, [aberto, politica, colaboradores]);

  function enviar() {
    onSalvar(politica?.id ?? null, {
      codigo,
      titulo,
      doQueTrata: sobreOCriterio,
      setores,
      comite: comite.map((colaborador) => colaborador.nome),
      prazoResposta,
      proximaRevisao,
      arquivo: arquivo?.name ?? politica?.arquivo ?? null,
    });
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{politica ? "Editar política" : "Nova política"}</DialogTitle>
          <DialogDescription>
            {politica
              ? "Ajuste os dados da política e salve as alterações."
              : "Cadastre a política, defina o escopo e envie para o comitê de aprovação."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código">
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </Campo>

            <Campo rotulo="Título">
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Política de Backup e Retenção"
              />
            </Campo>
          </div>

          <Campo rotulo="Do que trata">
            <Textarea
              value={sobreOCriterio}
              onChange={(e) => setSobreOCriterio(e.target.value)}
              placeholder="Resuma o objetivo e o alcance da política."
              className="min-h-[90px]"
            />
          </Campo>

          <Campo rotulo="Setores a que se aplica">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {opcoesSetores.map((setor) => (
                <label
                  key={setor}
                  htmlFor={`setor-politica-${setor}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`setor-politica-${setor}`}
                    checked={setores.includes(setor)}
                    onCheckedChange={() => alternarSetor(setor)}
                  />
                  {setor}
                </label>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Comitê de aprovação">
            <CampoMencao colaboradores={colaboradores} selecionados={comite} onChange={setComite} />
            <p className="text-xs italic text-[#94A3B8]">
              Quem for mencionado recebe a ação por e-mail e acompanha em modo leitura.
            </p>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Prazo para o comitê responder">
              <Input
                value={prazoResposta}
                onChange={(e) => setPrazoResposta(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
              <p className="text-xs italic text-[#94A3B8]">
                Vencido o prazo, a Qualidade pode seguir sem o retorno.
              </p>
            </Campo>

            <Campo rotulo="Próxima revisão prevista">
              <Input
                value={proximaRevisao}
                onChange={(e) => setProximaRevisao(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
              <p className="text-xs italic text-[#94A3B8]">Aviso automático 30 dias antes.</p>
            </Campo>
          </div>

          <Campo rotulo="Arquivo da política">
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.doc,.pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setArquivo(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-6 py-10 text-center transition hover:border-[#94A3B8] hover:bg-[#F1F5F9]"
            >
              <UploadCloud className="h-8 w-8 text-[#94A3B8]" />
              {arquivo ? (
                <>
                  <p className="mt-3 text-[13px] font-semibold text-[#1F2937]">{arquivo.name}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Clique para trocar ou arraste outro arquivo.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] font-medium text-[#1F2937]">
                  Arraste o arquivo .docx ou .pdf, ou clique para selecionar
                </p>
              )}
            </button>
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
            {politica ? "Salvar alterações" : "Criar política"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
