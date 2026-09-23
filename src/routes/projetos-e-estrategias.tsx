import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, FolderKanban, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NovaAuditoriaDialog } from "@/components/nova-auditoria-dialog";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
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
import { Textarea } from "@/components/ui/textarea";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { podeGerenciarConteudo } from "@/lib/permissoes";
import type { Colaborador } from "@/lib/dados";
import { mascaraDataBr } from "@/lib/utils";
import { criarProjeto } from "@/lib/projetos-crud";
import { listarProjetos } from "@/lib/projetos-base";
import type { PrioridadeProjeto, ProjetoEstrategico } from "@/lib/projetos";
import { TIPOS_PROJETO, PRIORIDADES_PROJETO } from "@/lib/projetos";
import { CartaoProjeto } from "@/components/cartao-projeto";
import { toast } from "sonner";

export const Route = createFileRoute("/projetos-e-estrategias")({
  head: () => ({
    meta: [{ title: "Projetos e Estratégias | Gestão da Qualidade" }],
  }),
  component: ProjetosEEstrategias,
});

function ProjetosEEstrategias() {
  const catalogo = useCatalogoOrganizacional();
  const sessao = usePanelSession();
  const podeGerenciar = podeGerenciarConteudo(sessao);
  const [novoProjetoAberto, setNovoProjetoAberto] = useState(false);
  const [novaAuditoriaAberta, setNovaAuditoriaAberta] = useState(false);
  const [projetos, setProjetos] = useState<ProjetoEstrategico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  async function recarregar() {
    setCarregando(true);
    try {
      setProjetos(await listarProjetos(sessao));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
      setProjetos([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = projetos.filter((p) => {
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return `${p.codigo} ${p.nome} ${p.objetivo} ${p.responsavelNome}`.toLowerCase().includes(b);
  });

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Longo prazo
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Projetos e planejamento estratégico
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Cada projeto tem seu próprio quadro. As ações continuam no plano de ação de quem
            executa.
          </p>
        </div>

        {podeGerenciar ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setNovaAuditoriaAberta(true)}>
              <ClipboardCheck className="h-4 w-4" />
              Nova auditoria
            </Button>
            <Button onClick={() => setNovoProjetoAberto(true)}>
              <Plus className="h-4 w-4" />
              Novo projeto
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, nome ou responsável"
          className="max-w-md bg-white"
        />
        <span className="text-[12px] text-[#64748B]">{filtrados.length} projeto(s)</span>
      </div>

      {carregando ? (
        <p className="rounded-2xl border border-[#D9E0EA] bg-white px-6 py-12 text-center text-sm text-[#64748B]">
          Carregando projetos...
        </p>
      ) : filtrados.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <FolderKanban className="h-7 w-7 text-[#94A3B8]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#1F2937]">
              Nenhum projeto para você ainda
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
              Projetos aparecem aqui quando o seu setor participa ou quando você é o responsável.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => (
            <CartaoProjeto
              key={p.id}
              projeto={p}
              onAlterado={(atual) =>
                setProjetos((lista) => lista.map((x) => (x.id === atual.id ? atual : x)))
              }
              onExcluido={(id) => setProjetos((lista) => lista.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      <NovaAuditoriaDialog
        aberto={novaAuditoriaAberta}
        unidades={catalogo.unidades}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        onFechar={() => setNovaAuditoriaAberta(false)}
      />

      <NovoProjetoDialog
        aberto={novoProjetoAberto}
        setores={catalogo.setores}
        colaboradores={catalogo.colaboradores}
        projetos={projetos}
        onFechar={() => setNovoProjetoAberto(false)}
        onCriado={(p) => {
          setProjetos((lista) => [p, ...lista]);
          setNovoProjetoAberto(false);
          toast.success(`Projeto ${p.codigo} criado.`);
        }}
      />
    </PanelShell>
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

interface NovoProjetoDialogProps {
  aberto: boolean;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
}

function NovoProjetoDialog({ aberto, setores, colaboradores, onFechar }: NovoProjetoDialogProps) {
  const [codigo, setCodigo] = useState("PE-2026-02");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>("Planejamento Estratégico");
  const [objetivo, setObjetivo] = useState("");
  const [setoresEnvolvidos, setSetoresEnvolvidos] = useState<string[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [frentes, setFrentes] = useState("");
  const [inicio, setInicio] = useState("01/09/2026");
  const [fimPrevisto, setFimPrevisto] = useState("31/08/2027");
  const [usarSwot, setUsarSwot] = useState(false);
  const [forcas, setForcas] = useState("");
  const [fraquezas, setFraquezas] = useState("");
  const [oportunidades, setOportunidades] = useState("");
  const [ameacas, setAmeacas] = useState("");

  function alternarSetor(setor: string) {
    setSetoresEnvolvidos((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor],
    );
  }

  function limpar() {
    setCodigo("PE-2026-02");
    setNome("");
    setTipo("Planejamento Estratégico");
    setObjetivo("");
    setSetoresEnvolvidos([]);
    setResponsavelId("");
    setFrentes("");
    setInicio("01/09/2026");
    setFimPrevisto("31/08/2027");
    setUsarSwot(false);
    setForcas("");
    setFraquezas("");
    setOportunidades("");
    setAmeacas("");
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">
            Longo prazo
          </p>
          <DialogTitle>Novo projeto ou planejamento</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo projeto ou planejamento estratégico.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Código">
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </Campo>

            <Campo rotulo="Nome">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Expansão comercial no interior"
              />
            </Campo>

            <Campo rotulo="Tipo">
              <Select value={tipo} onValueChange={(v) => setTipo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PROJETO.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Responsável">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável…" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Objetivo">
            <Textarea
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="O que precisa estar verdadeiro no fim do prazo."
              className="min-h-[90px]"
            />
          </Campo>

          <Campo rotulo="Setores envolvidos">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {setores.map((setor) => (
                <label
                  key={setor}
                  htmlFor={`setor-projeto-${setor}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`setor-projeto-${setor}`}
                    checked={setoresEnvolvidos.includes(setor)}
                    onCheckedChange={() => alternarSetor(setor)}
                  />
                  {setor}
                </label>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Frentes de trabalho">
            <Textarea
              value={frentes}
              onChange={(e) => setFrentes(e.target.value)}
              placeholder="Uma por linha. Podem ser criadas depois."
              className="min-h-[80px]"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Início">
              <Input
                value={inicio}
                onChange={(e) => setInicio(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>

            <Campo rotulo="Fim previsto">
              <Input
                value={fimPrevisto}
                onChange={(e) => setFimPrevisto(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>
          </div>

          <div className="border-t border-[#E9EEF5] pt-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E9EEF5] p-3 transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]">
              <Checkbox
                checked={usarSwot}
                onCheckedChange={(checked) => setUsarSwot(checked === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[13px] font-semibold text-[#1F2937]">
                  Usar matriz SWOT neste projeto
                </span>
                <span className="mt-0.5 block text-xs text-[#64748B]">
                  Sem a matriz, o projeto parte direto do objetivo e das ações.
                </span>
              </span>
            </label>
          </div>

          {usarSwot ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Forças">
                <Textarea
                  value={forcas}
                  onChange={(e) => setForcas(e.target.value)}
                  placeholder="Um ponto por linha."
                  className="min-h-[80px]"
                />
              </Campo>

              <Campo rotulo="Fraquezas">
                <Textarea
                  value={fraquezas}
                  onChange={(e) => setFraquezas(e.target.value)}
                  placeholder="Um ponto por linha."
                  className="min-h-[80px]"
                />
              </Campo>

              <Campo rotulo="Oportunidades">
                <Textarea
                  value={oportunidades}
                  onChange={(e) => setOportunidades(e.target.value)}
                  placeholder="Um ponto por linha."
                  className="min-h-[80px]"
                />
              </Campo>

              <Campo rotulo="Ameaças e riscos">
                <Textarea
                  value={ameacas}
                  onChange={(e) => setAmeacas(e.target.value)}
                  placeholder="Um ponto por linha."
                  className="min-h-[80px]"
                />
              </Campo>
            </div>
          ) : null}
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
            Criar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
