import { useEffect, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Pill, SeloAutomatico } from "@/components/indicador-badges";
import { getSession } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import {
  FONTE_LABELS,
  FONTES_INDICADOR,
  SENTIDO_LABELS,
  SENTIDOS_INDICADOR,
  STATUS_APURACAO_LABELS,
  UNIDADE_LABELS,
  UNIDADES_INDICADOR,
  calcularStatus,
  formatarValor,
  mascaraNumero,
  mesReferenciaAtual,
  paraNumero,
  rotuloMes,
  rotuloMesLongo,
  ultimosMeses,
  type Apuracao,
  type FonteIndicador,
  type Indicador,
  type IndicadorForm,
  type SentidoIndicador,
  type UnidadeIndicador,
} from "@/lib/indicadores";
import { calcularValorAutomatico } from "@/lib/indicadores-auto";
import {
  ativarModelo,
  atualizarIndicador,
  criarIndicador,
  lancarApuracao,
  vincularPlanoApuracao,
} from "@/lib/indicadores-crud";
import { listarPlanos } from "@/lib/planos-base";
import type { PlanoAcao } from "@/lib/planos";

/** Origem padronizada no módulo Planos de Ação para ações vindas de indicador. */
export const ORIGEM_INDICADOR = "Indicador de Desempenho";

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Criar / editar indicador                                                    */
/* -------------------------------------------------------------------------- */

interface FormularioProps {
  aberto: boolean;
  /** Indicador em edição; `null` cria um novo. */
  indicador: Indicador | null;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
  onSalvo: () => void;
}

export function FormularioIndicadorDialog(props: FormularioProps) {
  const { aberto, indicador, setores, colaboradores } = props;
  const { onFechar, onSalvo } = props;

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [unidade, setUnidade] = useState<UnidadeIndicador>("percentual");
  const [formula, setFormula] = useState("");
  const [meta, setMeta] = useState("");
  const [sentido, setSentido] = useState<SentidoIndicador>("maior_melhor");
  const [fonte, setFonte] = useState<FonteIndicador>("manual");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    setSalvando(false);
    if (indicador) {
      setNome(indicador.nome);
      setDescricao(indicador.descricao);
      setSetor(indicador.setor);
      setResponsavelId(indicador.responsavelId);
      setUnidade(indicador.unidade);
      setFormula(indicador.formulaDescricao);
      setMeta(indicador.meta === null ? "" : String(indicador.meta).replace(".", ","));
      setSentido(indicador.sentido);
      setFonte(indicador.fonte);
      return;
    }
    setNome("");
    setDescricao("");
    setSetor("");
    setResponsavelId("");
    setUnidade("percentual");
    setFormula("");
    setMeta("");
    setSentido("maior_melhor");
    setFonte("manual");
  }, [aberto, indicador, setores]);

  const responsavel = colaboradores.find((c) => c.id === responsavelId);
  const metaNumero = paraNumero(meta);

  /** Setor padrão do cadastro: primeiro setor da organização cadastrado. */
  const setorPadrao = setor || setores[0] || "";
  const opcoesSetor = setores.includes(setorPadrao) ? setores : [setorPadrao, ...setores].filter(Boolean);
  const valido =
    nome.trim().length >= 3 && !!setorPadrao.trim() && metaNumero !== null && !!formula.trim();

  async function enviar() {
    if (!valido || metaNumero === null) return;
    const form: IndicadorForm = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      setor: setorPadrao.trim(),
      responsavelId,
      responsavelNome: responsavel?.nome ?? indicador?.responsavelNome ?? "",
      unidade,
      formulaDescricao: formula.trim(),
      meta: metaNumero,
      sentido,
      fonte,
    };
    setSalvando(true);
    setErro("");
    try {
      if (indicador) await atualizarIndicador(indicador, form, getSession());
      else await criarIndicador(form, getSession());
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o indicador.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              {indicador ? "Editar indicador" : "Novo indicador"}
            </span>
            <span className="mt-1.5 block text-lg font-semibold">
              {indicador ? indicador.nome : "O que o setor vai acompanhar"}
            </span>
          </DialogTitle>
          <DialogDescription>
            A meta vale para os próximos lançamentos: o histórico já registrado mantém a meta do dia do
            lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Campo rotulo="Nome do indicador *">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: % de obrigações entregues no prazo"
              maxLength={140}
            />
          </Campo>

          <Campo rotulo="Descrição">
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que este número mostra para o setor."
              className="min-h-[70px]"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor *">
              {opcoesSetor.length === 0 ? (
                <Input
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  placeholder="Ex.: Fiscal"
                />
              ) : (
                <Select value={setorPadrao} onValueChange={setSetor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesSetor.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Campo>

            <Campo rotulo="Responsável">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar colaborador…" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colaborador) => (
                    <SelectItem key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                      {colaborador.setor ? ` — ${colaborador.setor}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Unidade *">
              <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeIndicador)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_INDICADOR.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {UNIDADE_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Meta *">
              <Input
                value={meta}
                onChange={(e) => setMeta(mascaraNumero(e.target.value))}
                placeholder="Ex.: 95"
                inputMode="decimal"
              />
              {metaNumero !== null ? (
                <p className="text-xs italic text-[#94A3B8]">
                  Exibida como {formatarValor(metaNumero, unidade)}.
                </p>
              ) : null}
            </Campo>

            <Campo rotulo="Sentido *">
              <Select value={sentido} onValueChange={(v) => setSentido(v as SentidoIndicador)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENTIDOS_INDICADOR.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {SENTIDO_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Fonte do dado *">
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteIndicador)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTES_INDICADOR.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {FONTE_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Como é apurado *">
            <Textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ex.: Obrigações entregues no prazo ÷ total de obrigações do mês × 100."
              className="min-h-[80px]"
            />
            <p className="text-xs italic text-[#94A3B8]">
              Fica visível para quem lança a apuração todo mês. A periodicidade é mensal.
            </p>
          </Campo>

          {erro ? <p className="text-[13px] text-[#E11D48]">{erro}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void enviar()}
            disabled={!valido || salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Salvando…" : indicador ? "Salvar alterações" : "Criar indicador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Biblioteca de modelos prontos                                               */
/* -------------------------------------------------------------------------- */

interface BibliotecaProps {
  aberto: boolean;
  modelos: Indicador[];
  carregando: boolean;
  setores: string[];
  colaboradores: Colaborador[];
  onFechar: () => void;
  onAtivado: () => void;
}

export function BibliotecaModelosDialog(props: BibliotecaProps) {
  const { aberto, modelos, carregando, setores, colaboradores } = props;
  const { onFechar, onAtivado } = props;
  const [selecionado, setSelecionado] = useState<Indicador | null>(null);
  const [meta, setMeta] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (aberto) return;
    setSelecionado(null);
    setMeta("");
    setSetor("");
    setResponsavelId("");
    setErro("");
    setSalvando(false);
  }, [aberto]);

  function escolher(modelo: Indicador) {
    setSelecionado(modelo);
    setMeta("");
    setSetor(modelo.setor);
    setResponsavelId("");
    setErro("");
  }

  const metaNumero = paraNumero(meta);
  const opcoesSetor = setor && !setores.includes(setor) ? [setor, ...setores] : setores;
  const porSetor = new Map<string, Indicador[]>();
  for (const modelo of modelos) {
    const lista = porSetor.get(modelo.setor) ?? [];
    lista.push(modelo);
    porSetor.set(modelo.setor, lista);
  }

  async function ativar() {
    if (!selecionado || metaNumero === null) return;
    setSalvando(true);
    setErro("");
    try {
      const responsavel = colaboradores.find((c) => c.id === responsavelId);
      await ativarModelo(
        selecionado,
        { meta: metaNumero, setor, responsavelId, responsavelNome: responsavel?.nome ?? "" },
        getSession(),
      );
      onAtivado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar o modelo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Biblioteca
            </span>
            <span className="mt-1.5 block text-lg font-semibold">Usar indicador pronto</span>
          </DialogTitle>
          <DialogDescription>
            Modelos sugeridos por setor, sem meta definida: ao ativar, informe a meta e o responsável do
            seu contexto.
          </DialogDescription>
        </DialogHeader>

        {selecionado ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#D9E0EA] bg-[#F8FAFC] p-3">
              <p className="text-[14px] font-semibold text-[#1F2937]">{selecionado.nome}</p>
              <p className="mt-1 text-[13px] text-[#64748B]">{selecionado.descricao}</p>
              <p className="mt-2 text-[12px] italic text-[#94A3B8]">{selecionado.formulaDescricao}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Pill tom="neutro">{UNIDADE_LABELS[selecionado.unidade]}</Pill>
                <Pill tom="neutro">{SENTIDO_LABELS[selecionado.sentido]}</Pill>
                {selecionado.automatico ? <SeloAutomatico /> : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Meta *">
                <Input
                  value={meta}
                  onChange={(e) => setMeta(mascaraNumero(e.target.value))}
                  placeholder="Ex.: 95"
                  inputMode="decimal"
                />
                <p className="text-xs italic text-[#94A3B8]">
                  O modelo não traz meta: informe o número acordado com o setor.
                </p>
              </Campo>

              <Campo rotulo="Setor *">
                {opcoesSetor.length === 0 ? (
                  <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex.: Fiscal" />
                ) : (
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesSetor.map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {opcao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>

              <Campo rotulo="Responsável">
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar colaborador…" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((colaborador) => (
                      <SelectItem key={colaborador.id} value={colaborador.id}>
                        {colaborador.nome}
                        {colaborador.setor ? ` — ${colaborador.setor}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </div>

            {erro ? <p className="text-[13px] text-[#E11D48]">{erro}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelecionado(null)}>
                Voltar para a lista
              </Button>
              <Button
                type="button"
                onClick={() => void ativar()}
                disabled={metaNumero === null || salvando || !setor.trim()}
                className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
              >
                {salvando ? "Ativando…" : "Ativar indicador"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">

            {carregando ? (
              <p className="py-10 text-center text-sm text-[#94A3B8]">Carregando modelos…</p>
            ) : modelos.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#64748B]">
                Nenhum modelo disponível. Se esta é a primeira vez, aplique a migração
                <span className="font-mono"> 20260925000000_indicadores.sql</span> no Lovable Cloud.
              </p>
            ) : (
              [...porSetor.entries()].map(([nomeSetor, lista]) => (
                <div key={nomeSetor}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    {nomeSetor}
                  </p>
                  <div className="mt-2 space-y-2">
                    {lista.map((modelo) => (
                      <div
                        key={modelo.id}
                        className="flex flex-col gap-2 rounded-xl border border-[#D9E0EA] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#1F2937]">{modelo.nome}</p>
                          <p className="mt-0.5 text-[12px] text-[#64748B]">{modelo.descricao}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Pill tom="neutro">{UNIDADE_LABELS[modelo.unidade]}</Pill>
                            <Pill tom="neutro">{SENTIDO_LABELS[modelo.sentido]}</Pill>
                            {modelo.automatico ? <SeloAutomatico /> : null}
                          </div>
                        </div>
                        <Button variant="outline" className="shrink-0" onClick={() => escolher(modelo)}>
                          Usar este
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onFechar}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Lançar apuração do mês                                                      */
/* -------------------------------------------------------------------------- */

interface LancarProps {
  aberto: boolean;
  indicador: Indicador | null;
  /** Apurações do indicador (para avisar mês já fechado). */
  apuracoes: Apuracao[];
  onFechar: () => void;
  /** Recebe a apuração gravada: o pai abre o fluxo de plano quando ficou abaixo da meta. */
  onLancado: (apuracao: Apuracao) => void;
}

export function LancarApuracaoDialog(props: LancarProps) {
  const { aberto, indicador, apuracoes, onFechar, onLancado } = props;
  const meses = [...ultimosMeses(12)].reverse();
  const [mes, setMes] = useState(mesReferenciaAtual());
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [automatico, setAutomatico] = useState<{ valor: number; detalhe: string } | null>(null);
  const [carregandoAuto, setCarregandoAuto] = useState(false);

  useEffect(() => {
    if (!aberto || !indicador) return;
    setErro("");
    setSalvando(false);
    setAutomatico(null);
    setValor("");
    setMes(mesReferenciaAtual());
  }, [aberto, indicador]);

  // Indicador automático: sugere o valor apurado no módulo de origem.
  useEffect(() => {
    let ativo = true;
    if (!aberto || !indicador || !indicador.automatico || !indicador.regraAutomatica) return;
    setCarregandoAuto(true);
    setAutomatico(null);
    calcularValorAutomatico(indicador.regraAutomatica, mes)
      .then((resultado) => {
        if (!ativo) return;
        setAutomatico(resultado);
        setValor(resultado ? String(resultado.valor).replace(".", ",") : "");
      })
      .catch(() => {
        if (ativo) setAutomatico(null);
      })
      .finally(() => {
        if (ativo) setCarregandoAuto(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, indicador, mes]);

  const valorNumero = paraNumero(valor);
  const apuracaoDoMes = apuracoes.find((a) => a.mesReferencia === mes) ?? null;
  const statusPrevisto =
    indicador && valorNumero !== null
      ? calcularStatus(valorNumero, indicador.meta, indicador.sentido)
      : null;
  const bloqueado = apuracaoDoMes?.fechado === true;
  const valido =
    !!indicador && valorNumero !== null && indicador.meta !== null && !bloqueado && !carregandoAuto;

  async function enviar() {
    if (!valido || !indicador || valorNumero === null) return;
    setSalvando(true);
    setErro("");
    try {
      const apuracao = await lancarApuracao(
        indicador,
        { mesReferencia: mes, valor: valorNumero },
        getSession(),
      );
      onLancado(apuracao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível lançar a apuração.");
    } finally {
      setSalvando(false);
    }
  }

  if (!indicador) return null;

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Apuração mensal
            </span>
            <span className="mt-1.5 block text-lg font-semibold">{indicador.nome}</span>
          </DialogTitle>
          <DialogDescription>
            {indicador.setor ? `${indicador.setor} · ` : ""}
            Meta {formatarValor(indicador.meta, indicador.unidade)} · {SENTIDO_LABELS[indicador.sentido]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Mês de referência *">
              <Select value={mes} onValueChange={setMes} disabled={bloqueado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {rotuloMesLongo(opcao)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo={`Valor apurado (${UNIDADE_LABELS[indicador.unidade]}) *`}>
              <Input
                value={valor}
                onChange={(e) => setValor(mascaraNumero(e.target.value))}
                placeholder="Ex.: 92,5"
                inputMode="decimal"
                disabled={bloqueado}
              />
            </Campo>
          </div>

          {indicador.automatico && indicador.regraAutomatica ? (
            <div className="rounded-xl border border-[#D9E0EA] bg-[#F8FAFC] p-3 text-[13px] text-[#64748B]">
              {carregandoAuto ? (
                <p>Calculando o valor a partir do módulo de origem…</p>
              ) : automatico ? (
                <p>
                  <span className="font-semibold text-[#1F2937]">
                    {formatarValor(automatico.valor, indicador.unidade)}
                  </span>{" "}
                  sugerido automaticamente. {automatico.detalhe}
                </p>
              ) : (
                <p>
                  Não há dados suficientes em {rotuloMes(mes)} para calcular automaticamente. Informe o
                  valor manualmente.
                </p>
              )}
            </div>
          ) : null}

          {indicador.formulaDescricao ? (
            <p className="text-[12px] italic text-[#94A3B8]">
              Como é apurado: {indicador.formulaDescricao}
            </p>
          ) : null}

          {valorNumero !== null && statusPrevisto ? (
            <p className="text-[13px] text-[#64748B]">
              Status previsto:{" "}
              <span
                className={
                  statusPrevisto === "dentro_da_meta"
                    ? "font-semibold text-[#059669]"
                    : "font-semibold text-[#E11D48]"
                }
              >
                {STATUS_APURACAO_LABELS[statusPrevisto]}
              </span>
              {statusPrevisto === "abaixo_da_meta"
                ? " — será obrigatório vincular um plano de ação para fechar o mês."
                : "."}
            </p>
          ) : null}

          {bloqueado ? (
            <p className="text-[13px] text-[#E11D48]">
              A apuração de {rotuloMes(mes)} já foi fechada e não pode ser alterada.
            </p>
          ) : apuracaoDoMes ? (
            <p className="text-[13px] text-[#64748B]">
              Já existe lançamento para {rotuloMes(mes)} (
              {formatarValor(apuracaoDoMes.valorRealizado, indicador.unidade)}). O registro será
              atualizado.
            </p>
          ) : null}

          {erro ? <p className="text-[13px] text-[#E11D48]">{erro}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void enviar()}
            disabled={!valido || salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Lançando…" : "Lançar apuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Plano de ação obrigatório (meta não batida)                                 */
/* -------------------------------------------------------------------------- */

interface PlanoObrigatorioProps {
  aberto: boolean;
  indicador: Indicador | null;
  apuracao: Apuracao | null;
  /** Abre o formulário de novo plano no módulo Planos de Ação, já preenchido. */
  onCriarPlano: (indicador: Indicador, apuracao: Apuracao) => void;
  onFechar: () => void;
  onVinculado: () => void;
}

export function PlanoObrigatorioDialog(props: PlanoObrigatorioProps) {
  const { aberto, indicador, apuracao, onCriarPlano, onFechar, onVinculado } = props;
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto || !indicador) return;
    let ativo = true;
    setErro("");
    setPlanoId("");
    setSalvando(false);
    setCarregando(true);
    listarPlanos()
      .then((lista) => {
        if (!ativo) return;
        const doSetor = lista.filter(
          (p) =>
            p.setor.trim().toLowerCase() === indicador.setor.trim().toLowerCase() &&
            p.status !== "concluida" &&
            p.status !== "cancelado",
        );
        setPlanos(doSetor.length > 0 ? doSetor : lista);
      })
      .catch(() => {
        if (ativo) setPlanos([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, indicador]);

  async function vincular() {
    if (!indicador || !apuracao || !planoId) return;
    setSalvando(true);
    setErro("");
    try {
      await vincularPlanoApuracao(indicador, apuracao, planoId, getSession());
      onVinculado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível vincular o plano de ação.");
    } finally {
      setSalvando(false);
    }
  }

  if (!indicador || !apuracao) return null;

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
              Plano de ação obrigatório
            </span>
            <span className="mt-1.5 block text-lg font-semibold">
              Meta não batida em {rotuloMesLongo(apuracao.mesReferencia)}
            </span>
          </DialogTitle>
          <DialogDescription>
            {indicador.nome} · {formatarValor(apuracao.valorRealizado, indicador.unidade)} contra a meta de{" "}
            {formatarValor(apuracao.metaNoMes, indicador.unidade)}. O fechamento do mês só é liberado com um
            plano de ação vinculado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Campo rotulo="Plano de ação do mês">
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={carregando ? "Carregando planos…" : "Selecionar plano de ação"}
                />
              </SelectTrigger>
              <SelectContent>
                {planos.map((plano) => (
                  <SelectItem key={plano.id} value={plano.id}>
                    {plano.codigo ? `${plano.codigo} · ` : ""}
                    {plano.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!carregando && planos.length === 0 ? (
              <p className="text-xs italic text-[#94A3B8]">
                Nenhum plano de ação cadastrado ainda: crie o primeiro pelo botão abaixo.
              </p>
            ) : null}
          </Campo>

          {erro ? <p className="text-[13px] text-[#E11D48]">{erro}</p> : null}
        </div>

        <DialogFooter className="!flex-col gap-2 sm:!flex-row">
          <Button type="button" variant="outline" onClick={onFechar}>
            Depois
          </Button>
          <Button type="button" variant="outline" onClick={() => onCriarPlano(indicador, apuracao)}>
            Criar plano de ação
          </Button>
          <Button
            type="button"
            onClick={() => void vincular()}
            disabled={!planoId || salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Vinculando…" : "Vincular plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}








