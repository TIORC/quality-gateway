import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CampoMencao } from "@/components/campo-mencao";
import {
  FormularioNaoConformidade,
  LIMITE_ANEXOS_NC,
  LIMITE_TEXTO_NC,
  TAMANHO_MAX_ANEXO_NC,
  type EstadoNaoConformidade,
  ESTADO_NC_VAZIO,
} from "@/components/ocorrencias/formulario-nao-conformidade";
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
import { getSession } from "@/lib/auth";
import { RESULTADOS_AUDITORIA, type Auditoria, type ResultadoAuditoria } from "@/lib/auditorias";
import { criarAuditoria } from "@/lib/auditorias-crud";
import { TIPOS_AUDITORIA, type Colaborador, type TipoAuditoria } from "@/lib/dados";
import {
  adicionarAnexosAbertura,
  abrirOcorrencia,
  carregarUltimasVersoes,
} from "@/lib/ocorrencias-crud";
import { listarTipos } from "@/lib/ocorrencias-base";
import { ehTipoNaoConformidade } from "@/lib/ocorrencias";
import { traduzErro } from "@/lib/organizacao";
import { criarPlano } from "@/lib/planos-crud";
import { PRIORIDADES_ACAO, prazoBrParaISO } from "@/lib/planos";
import { mascaraDataBr } from "@/lib/utils";

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
  onCriado?: (auditoria: Auditoria) => void;
}

export function NovaAuditoriaDialog({
  aberto,
  unidades,
  setores,
  colaboradores,
  onFechar,
  onCriado,
}: NovaAuditoriaDialogProps) {
  const [codigo, setCodigo] = useState("AUD-2026-05");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoAuditoria>("Interna");
  const [unidade, setUnidade] = useState("Matriz");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [setoresAuditados, setSetoresAuditados] = useState<string[]>([]);
  const [relatorio, setRelatorio] = useState("");
  const [evidencias, setEvidencias] = useState("");
  const [auditores, setAuditores] = useState<Colaborador[]>([OLANDSSON]);
  const [auditados, setAuditados] = useState<Colaborador[]>([]);

  const [resultado, setResultado] = useState<ResultadoAuditoria>("nenhum");
  const [nc, setNc] = useState<EstadoNaoConformidade>(ESTADO_NC_VAZIO);
  const [ncErros, setNcErros] = useState<Record<string, string>>({});
  const [planoTitulo, setPlanoTitulo] = useState("");
  const [planoDetalhamento, setPlanoDetalhamento] = useState("");
  const [planoSetor, setPlanoSetor] = useState("");
  const [planoResponsavelId, setPlanoResponsavelId] = useState("");
  const [planoPrazo, setPlanoPrazo] = useState("");
  const [planoPrioridade, setPlanoPrioridade] = useState("Média");
  const [planoSeguidores, setPlanoSeguidores] = useState<Colaborador[]>([]);
  const [salvando, setSalvando] = useState(false);

  function alternarSetor(setor: string) {
    setSetoresAuditados((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor],
    );
  }

  const origemRotulo = tipo === "Interna" ? "Auditoria Interna" : "Auditoria Externa";

  function limpar() {
    setCodigo("AUD-2026-05");
    setTitulo("");
    setTipo("Interna");
    setUnidade("Matriz");
    setDataPlanejada("");
    setSetoresAuditados([]);
    setRelatorio("");
    setEvidencias("");
    setAuditores([OLANDSSON]);
    setAuditados([]);
    setResultado("nenhum");
    setNc(ESTADO_NC_VAZIO);
    setNcErros({});
    setPlanoTitulo("");
    setPlanoDetalhamento("");
    setPlanoSetor("");
    setPlanoResponsavelId("");
    setPlanoPrazo("");
    setPlanoPrioridade("Média");
    setPlanoSeguidores([]);
    setSalvando(false);
  }

  useEffect(() => {
    if (!aberto) limpar();
  }, [aberto]);

  async function programar() {
    if (salvando) return;
    if (!titulo.trim()) {
      toast.error("Informe o título da auditoria.");
      return;
    }
    setSalvando(true);
    let resultadoRef = "";

    if (resultado === "nao_conformidade") {
      const erros: Record<string, string> = {};
      if (!nc.area.trim()) erros["area"] = "Informe a área envolvida.";
      if (!nc.descricao.trim()) erros["descricao"] = "Descreva a não conformidade.";
      else if (nc.descricao.length > LIMITE_TEXTO_NC)
        erros["descricao"] = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
      if (!nc.consequencia.trim()) erros["consequencia"] = "Informe a consequência.";
      else if (nc.consequencia.length > LIMITE_TEXTO_NC)
        erros["consequencia"] = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
      if (nc.sugestao.length > LIMITE_TEXTO_NC)
        erros["sugestao"] = `Limite de ${LIMITE_TEXTO_NC} caracteres.`;
      if (nc.multa === "sim" && !nc.assinouMulta)
        erros["termoMulta"] = "É obrigatório assinar o termo de multa para gerar a ocorrência.";
      if (nc.arquivos.length > LIMITE_ANEXOS_NC)
        erros["anexos"] = `Máximo de ${LIMITE_ANEXOS_NC} anexos.`;
      else if (nc.arquivos.some((a) => a.size > TAMANHO_MAX_ANEXO_NC))
        erros["anexos"] = "Cada anexo deve ter até 10 MB.";
      if (Object.keys(erros).length > 0) {
        setNcErros(erros);
        setSalvando(false);
        toast.error("Verifique os campos obrigatórios do formulário.");
        return;
      }
      try {
        const tipos = await listarTipos();
        const tipoNC = tipos.find((t) => ehTipoNaoConformidade(t));
        if (!tipoNC) {
          toast.error("Não há tipo 'Não Conformidade' cadastrado em Ocorrências.");
          setSalvando(false);
          return;
        }
        const versoes = await carregarUltimasVersoes(tipoNC.id);
        const descricao = nc.descricao.trim();
        const tituloNC = descricao.length > 80 ? `${descricao.slice(0, 80)}…` : descricao;
        const criada = await abrirOcorrencia(
          {
            tipo: tipoNC,
            formularioVersao: versoes.formularioVersao,
            fluxoVersao: versoes.fluxoVersao,
            titulo: tituloNC,
            respostas: {
              origem_nc: origemRotulo,
              area_envolvida: nc.area.trim(),
              descricao_nc: descricao,
              consequencia: nc.consequencia.trim(),
              sugestao_solucao: nc.sugestao.trim(),
              gerou_multa: nc.multa === "sim",
              assinou_termo_multa: nc.assinouMulta,
              anexos: nc.arquivos.map((a) => ({ nome: a.name })),
            },
          },
          getSession(),
        );
        try {
          await adicionarAnexosAbertura(criada, nc.arquivos, getSession());
        } catch (eAnexo) {
          // A NC já existe: anexo é complementar e não pode travar o modal.
          toast.warning(
            `NC ${criada.numero} aberta, mas os anexos não puderam ser anexados (${traduzErro(eAnexo).message}).`,
          );
        }
        resultadoRef = criada.numero;
        toast.success(`Não conformidade ${criada.numero} aberta com sucesso`);
      } catch (e) {
        toast.error(traduzErro(e).message);
        setSalvando(false);
        return;
      }
    } else if (resultado === "ponto_atencao" || resultado === "oportunidade") {
      const responsavel = colaboradores.find((c) => c.id === planoResponsavelId);
      const prazoIso = planoPrazo.trim() ? prazoBrParaISO(planoPrazo) : null;
      const tituloPlano = planoTitulo.trim();
      if (
        tituloPlano.length < 3 ||
        !responsavel ||
        !planoSetor ||
        !planoPrioridade ||
        (planoPrazo.trim() !== "" && prazoIso === null)
      ) {
        setSalvando(false);
        toast.error("Preencha os campos obrigatórios do plano de ação.");
        return;
      }
      try {
        const plano = await criarPlano(
          {
            titulo: tituloPlano,
            descricao: planoDetalhamento.trim() || tituloPlano,
            origem: origemRotulo,
            origemOutros: "",
            setor: planoSetor,
            responsavelId: responsavel.id,
            responsavelNome: responsavel.nome,
            responsavelEmail: (responsavel.email ?? "").toLowerCase(),
            seguidoresIds: planoSeguidores.map((m) => m.id),
            seguidoresEmails: planoSeguidores
              .map((m) => (m.email ?? "").toLowerCase())
              .filter((e) => e.includes("@")),
            prazo: prazoIso,
            prioridade: planoPrioridade,
          },
          getSession(),
        );
        resultadoRef = plano.codigo;
        toast.success(`Plano de ação ${plano.codigo} criado com sucesso`);
      } catch (e) {
        toast.error(traduzErro(e).message);
        setSalvando(false);
        return;
      }
    }

    try {
      const auditoria = await criarAuditoria(
        {
          codigo,
          titulo,
          tipo,
          norma: "ISO 9001:2015",
          unidade,
          dataPlanejada,
          setoresAuditados,
          relatorio,
          evidencias,
          auditores: auditores.map((a) => ({ id: a.id, nome: a.nome })),
          auditados: auditados.map((a) => ({ id: a.id, nome: a.nome })),
          resultado,
          resultadoRef,
        },
        getSession(),
      );
      toast.success("Auditoria programada");
      onCriado?.(auditoria);
    } catch (e) {
      if (resultadoRef) {
        // NC/plano já foram criados: manter o modal aberto faria o usuário
        // clicar de novo e duplicar o registro. Fecha com aviso.
        toast.error(
          `${resultado === "nao_conformidade" ? `Não conformidade ${resultadoRef} aberta` : `Plano ${resultadoRef} criado`}, mas não foi possível gravar a auditoria: ${traduzErro(e).message}`,
        );
        setSalvando(false);
        limpar();
        onFechar();
        return;
      }
      toast.error(traduzErro(e).message);
      setSalvando(false);
      return;
    }

    setSalvando(false);
    limpar();
    onFechar();
  }

  const rotuloAcaoFinal =
    resultado === "nao_conformidade"
      ? "Programar e abrir NC"
      : resultado === "ponto_atencao" || resultado === "oportunidade"
        ? "Programar e criar plano"
        : "Programar Auditoria";

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova auditoria</DialogTitle>
          <DialogDescription>
            Programe a auditoria e registre o relatório, as evidências e o resultado da verificação.
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
              <Input value="ISO 9001:2015" readOnly className="bg-[#F1F5F9] text-[#475569]" />
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

          <Campo rotulo="Relatório">
            <Textarea
              value={relatorio}
              onChange={(evento) => setRelatorio(evento.target.value)}
              placeholder="Resumo da auditoria e o que foi verificado."
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

          <Campo rotulo="Evidências">
            <Textarea
              value={evidencias}
              onChange={(evento) => setEvidencias(evento.target.value)}
              placeholder="Descreva as evidências coletadas durante a auditoria."
              className="min-h-[140px]"
              maxLength={20000}
            />
            <p className="text-xs italic text-[#94A3B8]">
              {evidencias.length.toLocaleString("pt-BR")} / 20.000 caracteres
            </p>
          </Campo>

          <Campo rotulo="Resultado">
            <div className="flex flex-wrap gap-2">
              {RESULTADOS_AUDITORIA.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    setResultado((atual) => (atual === opcao.valor ? "nenhum" : opcao.valor))
                  }
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                    resultado === opcao.valor
                      ? "border-[#1E3A8A] bg-[#EEF2FF] text-[#1E3A8A]"
                      : "border-[#D9E0EA] bg-white text-[#475569] hover:bg-[#F8FAFC]"
                  } ${salvando ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
            <p className="text-xs italic text-[#94A3B8]">
              A Não Conformidade abre em Ocorrências com origem {origemRotulo}; Ponto de Atenção e
              Oportunidade geram um plano de ação preenchido pelo auditor.
            </p>
          </Campo>

          {resultado === "nao_conformidade" ? (
            <div className="space-y-3 rounded-xl border border-[#D9E0EA] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Não conformidade da auditoria
                </p>
                <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E3A8A]">
                  {origemRotulo}
                </span>
              </div>
              <FormularioNaoConformidade
                setores={setores}
                valor={nc}
                onChange={(estado) => {
                  setNc(estado);
                  if (Object.keys(ncErros).length > 0) setNcErros({});
                }}
                erros={ncErros}
                desabilitado={salvando}
              />
            </div>
          ) : null}

          {resultado === "ponto_atencao" || resultado === "oportunidade" ? (
            <div className="space-y-3 rounded-xl border border-[#D9E0EA] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Plano de ação —{" "}
                  {resultado === "ponto_atencao" ? "Ponto de Atenção" : "Oportunidade"}
                </p>
                <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E3A8A]">
                  {origemRotulo}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Campo rotulo="O que precisa ser feito *">
                    <Input
                      value={planoTitulo}
                      onChange={(evento) => setPlanoTitulo(evento.target.value)}
                      placeholder="Ex.: Revisar procedimento de expedição"
                      maxLength={140}
                    />
                  </Campo>
                </div>
                <div className="sm:col-span-2">
                  <Campo rotulo="Detalhamento">
                    <Textarea
                      value={planoDetalhamento}
                      onChange={(evento) => setPlanoDetalhamento(evento.target.value)}
                      placeholder="Problema, entrega esperada e comprovação."
                      className="min-h-[90px]"
                    />
                  </Campo>
                </div>
                <Campo rotulo="Setor *">
                  <Select value={planoSetor} onValueChange={setPlanoSetor}>
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
                <Campo rotulo="Responsável *">
                  <Select value={planoResponsavelId} onValueChange={setPlanoResponsavelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar colaborador…" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} — {c.setor || c.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo rotulo="Prazo">
                  <Input
                    value={planoPrazo}
                    onChange={(evento) => setPlanoPrazo(mascaraDataBr(evento.target.value))}
                    placeholder="dd/mm/aaaa"
                    inputMode="numeric"
                  />
                </Campo>
                <Campo rotulo="Prioridade *">
                  <Select value={planoPrioridade} onValueChange={setPlanoPrioridade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES_ACAO.map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {opcao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <div className="sm:col-span-2">
                  <Campo rotulo="Seguidores">
                    <CampoMencao
                      colaboradores={colaboradores}
                      selecionados={planoSeguidores}
                      onChange={setPlanoSeguidores}
                    />
                  </Campo>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void programar()}
            disabled={salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Salvando…" : rotuloAcaoFinal}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
