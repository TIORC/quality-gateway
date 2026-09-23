import { useEffect, useState, type ReactNode } from "react";
import { CampoMencao } from "@/components/campo-mencao";
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
import {
  NORMAS_AUDITORIA,
  TIPOS_AUDITORIA,
  type Colaborador,
  type TipoAuditoria,
} from "@/lib/dados";
import { mascaraDataBr } from "@/lib/utils";

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
  unidades: string[];
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
}

export function NovaAuditoriaDialog({
  aberto,
  unidades,
  setores,
  colaboradores,
  onFechar,
}: NovaAuditoriaDialogProps) {
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
                  {unidades.map((opcao) => (
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
              {setores.map((setor) => (
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
              colaboradores={colaboradores}
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
              colaboradores={colaboradores}
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
