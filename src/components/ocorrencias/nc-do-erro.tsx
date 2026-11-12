/**
 * Pergunta do fim do Plano de ação do Erro Operacional:
 * "Esse erro se caracteriza como uma Não-Conformidade?"
 *
 * Não: só marca a resposta.
 * Sim: pede a justificativa e abre o formulário de Não Conformidade, que gera
 * uma NC com a origem "Erro Operacional" e ligada a este erro.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ESTADO_NC_VAZIO,
  FormularioNaoConformidade,
  LIMITE_ANEXOS_NC,
  LIMITE_TEXTO_NC,
  TAMANHO_MAX_ANEXO_NC,
  type EstadoNaoConformidade,
} from "@/components/ocorrencias/formulario-nao-conformidade";
import type { UserSession } from "@/lib/auth";
import type { Ocorrencia } from "@/lib/ocorrencias";
import {
  CHAVE_ERRO_CARACTERIZA_NC,
  CHAVE_ERRO_NC_JUSTIFICATIVA,
  CHAVE_ERRO_NC_OCORRENCIA_NUMERO,
  gerarNaoConformidadeDoErro,
  registrarNaoCaracterizaErro,
} from "@/lib/ocorrencias-crud";
import { traduzErro } from "@/lib/organizacao";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";

interface NaoConformidadeDoErroProps {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  /** Chamado depois de salvar, para a tela recarregar a ocorrência. */
  onAtualizado: () => void;
}

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

export function NaoConformidadeDoErro({ ocorrencia: o, session, onAtualizado }: NaoConformidadeDoErroProps) {
  const { setores } = useCatalogoOrganizacional();
  const salvo = o.respostas[CHAVE_ERRO_CARACTERIZA_NC];
  const ncNumero = textoDe(o.respostas[CHAVE_ERRO_NC_OCORRENCIA_NUMERO]);

  const [caracteriza, setCaracteriza] = useState<boolean | null>(
    typeof salvo === "boolean" ? salvo : null,
  );
  const [justificativa, setJustificativa] = useState(textoDe(o.respostas[CHAVE_ERRO_NC_JUSTIFICATIVA]));
  const [salvando, setSalvando] = useState(false);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [nc, setNc] = useState<EstadoNaoConformidade>(ESTADO_NC_VAZIO);
  const [ncErros, setNcErros] = useState<Record<string, string>>({});

  async function marcarNao() {
    setSalvando(true);
    try {
      await registrarNaoCaracterizaErro(o, session);
      setCaracteriza(false);
      setJustificativa("");
      toast.success("Registrado: o erro não é uma Não-Conformidade.");
      onAtualizado();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  function abrirFormularioNc() {
    if (!justificativa.trim()) {
      toast.error("Justifique por que o erro se caracteriza como Não-Conformidade.");
      return;
    }
    // A justificativa já vira a descrição da NC; a pessoa pode ajustar antes de abrir.
    setNc({ ...ESTADO_NC_VAZIO, descricao: justificativa.trim() });
    setNcErros({});
    setDialogoAberto(true);
  }

  function validar(): boolean {
    const erros: Record<string, string> = {};
    if (!nc.area.trim()) erros.area = "Selecione a área envolvida.";
    if (!nc.descricao.trim()) erros.descricao = "Descreva a Não Conformidade.";
    else if (nc.descricao.length > LIMITE_TEXTO_NC) erros.descricao = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (!nc.consequencia.trim()) erros.consequencia = "Informe a consequência.";
    else if (nc.consequencia.length > LIMITE_TEXTO_NC) erros.consequencia = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (nc.sugestao.length > LIMITE_TEXTO_NC) erros.sugestao = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
    if (nc.multa === "sim" && !nc.assinouMulta)
      erros.termoMulta = "É obrigatório assinar o termo de multa para gerar a ocorrência.";
    if (nc.arquivos.length > LIMITE_ANEXOS_NC) erros.anexos = `Máximo de ${LIMITE_ANEXOS_NC} anexos.`;
    else if (nc.arquivos.some((a) => a.size > TAMANHO_MAX_ANEXO_NC))
      erros.anexos = "Cada anexo deve ter até 10 MB.";
    setNcErros(erros);
    return Object.keys(erros).length === 0;
  }

  async function gerarNc() {
    if (!validar()) {
      toast.error("Verifique os campos obrigatórios do formulário.");
      return;
    }
    setSalvando(true);
    try {
      const criada = await gerarNaoConformidadeDoErro(
        o,
        {
          justificativa,
          area: nc.area,
          descricao: nc.descricao,
          consequencia: nc.consequencia,
          sugestao: nc.sugestao,
          multa: nc.multa === "sim",
          assinouMulta: nc.assinouMulta,
          arquivos: nc.arquivos,
        },
        session,
      );
      toast.success(`Não conformidade ${criada.numero} aberta a partir deste erro.`);
      setCaracteriza(true);
      setDialogoAberto(false);
      onAtualizado();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Caracterização do erro
      </h3>
      <p className="mt-2 text-[14px] font-medium text-[#1F2937]">
        Esse erro se caracteriza como uma Não-Conformidade?
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={caracteriza === true ? "default" : "outline"}
          disabled={salvando || ncNumero !== ""}
          onClick={() => setCaracteriza(true)}
        >
          Sim
        </Button>
        <Button
          type="button"
          size="sm"
          variant={caracteriza === false ? "default" : "outline"}
          disabled={salvando || ncNumero !== ""}
          onClick={() => void marcarNao()}
        >
          Não
        </Button>
      </div>

      {ncNumero ? (
        <p className="mt-3 text-[13px] text-[#334155]">
          Não Conformidade gerada a partir deste erro:{" "}
          <span className="font-mono font-semibold text-[#1E3A8A]">{ncNumero}</span>
        </p>
      ) : null}

      {caracteriza === true && !ncNumero ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="justificativa-nc-erro" className="text-[13px] font-medium text-[#1F2937]">
            Justifique-se
          </label>
          <Textarea
            id="justificativa-nc-erro"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Por que este erro operacional é uma Não-Conformidade?"
            className="min-h-[90px]"
            disabled={salvando}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={salvando || !justificativa.trim()} onClick={abrirFormularioNc}>
              Abrir Não Conformidade
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogoAberto} onOpenChange={(v) => !salvando && setDialogoAberto(v)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Não Conformidade a partir do erro {o.numero}</DialogTitle>
            <DialogDescription>
              Origem: Erro Operacional. A NC fica ligada a este erro.
            </DialogDescription>
          </DialogHeader>
          <FormularioNaoConformidade
            setores={setores}
            valor={nc}
            onChange={setNc}
            erros={ncErros}
            desabilitado={salvando}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvando} onClick={() => setDialogoAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvando} onClick={() => void gerarNc()}>
              {salvando ? "Abrindo…" : "Abrir Não Conformidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
