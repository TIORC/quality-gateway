/**
 * Indicadores — gravação (criar, editar, arquivar, ativar modelo e apurar).
 *
 * As permissões são revalidadas aqui antes de cada escrita: esconder botão não
 * é controle de acesso. Erros em português do Brasil para exibir no diálogo.
 */
import { traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import { apuracaoDoRow, indicadorDoRow, type Linha } from "@/lib/indicadores-base";
import {
  calcularStatus,
  podeGerenciarIndicadores,
  podeLancarApuracao,
  rotuloMes,
  type Apuracao,
  type Indicador,
  type IndicadorForm,
} from "@/lib/indicadores";
import type { UserSession } from "@/lib/auth";

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/* -------------------------------------------------------------------------- */
/* Validação                                                                   */
/* -------------------------------------------------------------------------- */

function exigirGerenciar(sessao: UserSession | null): void {
  if (!podeGerenciarIndicadores(sessao)) {
    throw new Error("Somente a Qualidade (ou administração) cadastra e edita indicadores.");
  }
}

function exigirLancamento(sessao: UserSession | null, indicador: Indicador): void {
  if (!podeLancarApuracao(sessao, indicador)) {
    throw new Error(
      "Você só pode lançar a apuração dos indicadores do seu setor (nível de acesso Líder de setor).",
    );
  }
}

function validarFormulario(form: IndicadorForm): void {
  if (form.nome.trim().length < 3) throw new Error("Informe o nome do indicador (mínimo 3 letras).");
  if (!form.setor.trim()) throw new Error("Informe o setor responsável pelo indicador.");
  if (form.meta === null) throw new Error("Informe a meta do indicador.");
  if (!form.formulaDescricao.trim()) throw new Error("Descreva como o indicador é apurado.");
}

function payload(form: IndicadorForm): Linha {
  return {
    nome: form.nome.trim(),
    descricao: form.descricao.trim(),
    setor: form.setor.trim(),
    responsavel_id: form.responsavelId,
    responsavel_nome: form.responsavelNome,
    unidade: form.unidade,
    formula_descricao: form.formulaDescricao.trim(),
    meta: form.meta,
    sentido: form.sentido,
    fonte: form.fonte,
  };
}

/* -------------------------------------------------------------------------- */
/* Indicadores                                                                 */
/* -------------------------------------------------------------------------- */

/** Cria um indicador novo (já ativo e fora da biblioteca de modelos). */
export async function criarIndicador(
  form: IndicadorForm,
  sessao: UserSession | null,
): Promise<Indicador> {
  exigirGerenciar(sessao);
  validarFormulario(form);
  const { data, error } = await clienteLivre()
    .from("indicadores")
    .insert({ ...payload(form), ativo: true, automatico: false, criado_de_modelo: false })
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return indicadorDoRow(data as Linha);
}

/**
 * Edita o indicador. A meta nova vale para os próximos lançamentos: as
 * apurações já registradas mantêm a `meta_no_mes` do momento do lançamento.
 */
export async function atualizarIndicador(
  indicador: Indicador,
  form: IndicadorForm,
  sessao: UserSession | null,
): Promise<Indicador> {
  exigirGerenciar(sessao);
  validarFormulario(form);
  const { data, error } = await clienteLivre()
    .from("indicadores")
    .update(payload(form))
    .eq("id", indicador.id)
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return indicadorDoRow(data as Linha);
}

/** Arquiva (some da visão geral e não recebe apuração) ou reativa o indicador. */
export async function definirArquivamento(
  indicador: Indicador,
  arquivado: boolean,
  sessao: UserSession | null,
): Promise<Indicador> {
  exigirGerenciar(sessao);
  const { data, error } = await clienteLivre()
    .from("indicadores")
    .update({ ativo: !arquivado })
    .eq("id", indicador.id)
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return indicadorDoRow(data as Linha);
}

export interface AjustesModelo {
  meta: number | null;
  setor: string;
  responsavelId: string;
  responsavelNome: string;
  nome?: string;
}

/** Ativa um modelo da biblioteca, com a meta e o responsável informados. */
export async function ativarModelo(
  modelo: Indicador,
  ajustes: AjustesModelo,
  sessao: UserSession | null,
): Promise<Indicador> {
  exigirGerenciar(sessao);
  if (ajustes.meta === null) throw new Error("Informe a meta do indicador.");
  if (!ajustes.setor.trim()) throw new Error("Informe o setor responsável pelo indicador.");
  const { data, error } = await clienteLivre()
    .from("indicadores")
    .update({
      meta: ajustes.meta,
      setor: ajustes.setor.trim(),
      responsavel_id: ajustes.responsavelId,
      responsavel_nome: ajustes.responsavelNome,
      nome: (ajustes.nome ?? modelo.nome).trim(),
      ativo: true,
      criado_de_modelo: true,
    })
    .eq("id", modelo.id)
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return indicadorDoRow(data as Linha);
}

/* -------------------------------------------------------------------------- */
/* Apurações                                                                   */
/* -------------------------------------------------------------------------- */

export interface LancamentoApuracao {
  mesReferencia: string;
  valor: number;
}

/**
 * Lança (ou corrige) a apuração do mês. A meta do indicador é copiada para
 * `meta_no_mes`, então mudar a meta depois não reescreve o histórico.
 */
export async function lancarApuracao(
  indicador: Indicador,
  lancamento: LancamentoApuracao,
  sessao: UserSession | null,
): Promise<Apuracao> {
  exigirLancamento(sessao, indicador);
  if (!indicador.ativo) throw new Error("Indicador arquivado não recebe nova apuração.");
  if (indicador.meta === null) {
    throw new Error("Defina a meta do indicador antes de lançar a apuração.");
  }
  if (!FORMATO_MES.test(lancamento.mesReferencia)) throw new Error("Informe o mês de referência.");
  if (!Number.isFinite(lancamento.valor)) throw new Error("Informe o valor apurado no mês.");

  const status = calcularStatus(lancamento.valor, indicador.meta, indicador.sentido);
  const client = clienteLivre();
  const { data: existente, error: erroBusca } = await client
    .from("apuracoes")
    .select("*")
    .eq("indicador_id", indicador.id)
    .eq("mes_referencia", lancamento.mesReferencia)
    .maybeSingle();
  if (erroBusca) throw traduzErro(erroBusca);

  const atual = existente ? apuracaoDoRow(existente as Linha) : null;
  if (atual?.fechado) {
    throw new Error(
      `A apuração de ${rotuloMes(lancamento.mesReferencia)} já foi fechada e não pode ser alterada.`,
    );
  }

  const dados = {
    valor_realizado: lancamento.valor,
    meta_no_mes: indicador.meta,
    status,
    lancado_por: sessao?.nome || sessao?.email || "",
    lancado_em: new Date().toISOString(),
  };

  const { data, error } = atual
    ? await client.from("apuracoes").update(dados).eq("id", atual.id).select("*").single()
    : await client
        .from("apuracoes")
        .insert({
          ...dados,
          indicador_id: indicador.id,
          mes_referencia: lancamento.mesReferencia,
          plano_acao_id: null,
          fechado: false,
        })
        .select("*")
        .single();
  if (error) throw traduzErro(error);
  return apuracaoDoRow(data as Linha);
}

/**
 * Vincula o plano de ação do mês (obrigatório quando a meta não foi batida).
 * Usa a tabela `planos_de_acao` do módulo Planos de Ação — não há segunda
 * estrutura de planos.
 */
export async function vincularPlanoApuracao(
  indicador: Indicador,
  apuracao: Apuracao,
  planoId: string | null,
  sessao: UserSession | null,
): Promise<Apuracao> {
  exigirLancamento(sessao, indicador);
  if (apuracao.fechado) {
    throw new Error("Apuração fechada: o vínculo com o plano de ação não pode mais ser alterado.");
  }
  if (apuracao.status === "abaixo_da_meta" && !planoId) {
    throw new Error("Meta não batida: o mês precisa de um plano de ação vinculado.");
  }
  const { data, error } = await clienteLivre()
    .from("apuracoes")
    .update({ plano_acao_id: planoId })
    .eq("id", apuracao.id)
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return apuracaoDoRow(data as Linha);
}

/**
 * Fecha o mês. Regra obrigatória: quando o status é `abaixo_da_meta`, só fecha
 * com plano de ação vinculado.
 */
export async function fecharApuracao(
  apuracao: Apuracao,
  sessao: UserSession | null,
): Promise<Apuracao> {
  exigirGerenciar(sessao);
  if (apuracao.valorRealizado === null) {
    throw new Error(`Lance o valor de ${rotuloMes(apuracao.mesReferencia)} antes de fechar o mês.`);
  }
  if (apuracao.status === "abaixo_da_meta" && !apuracao.planoAcaoId) {
    throw new Error(
      `Meta não batida em ${rotuloMes(apuracao.mesReferencia)}: vincule um plano de ação antes de fechar o mês.`,
    );
  }
  const { data, error } = await clienteLivre()
    .from("apuracoes")
    .update({ fechado: true })
    .eq("id", apuracao.id)
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return apuracaoDoRow(data as Linha);
}

