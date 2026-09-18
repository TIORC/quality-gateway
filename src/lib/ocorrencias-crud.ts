/**
 * Ocorrências — operações (máquina de fluxo).
 *
 * Toda ação grava evento no histórico imutável e notifica pelo sino
 * (`public.notificacoes`, tipos `ocorrencia_*`).
 */
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import {
  ACOES_ETAPA_LABELS, MACRO_ETAPAS, MACRO_ETAPA_LABELS, calcularPrazoEtapa, idCurto,
  ordenarSubetapas, proximoNumero, subetapaDe,
  type AnexoOcorrencia, type AcaoEtapa, type CampoFormulario, type MacroEtapa,
  type MacroFluxo, type Ocorrencia, type Respostas, type SubetapaFluxo, type TipoOcorrencia,
} from "@/lib/ocorrencias";
import {
  cloud, listarFluxos, listarFormularios, listarOcorrencias, ocorrenciaDoRow, str,
  type EventoLinha,
} from "@/lib/ocorrencias-base";

type Rec = Record<string, unknown>;

function autorDe(sessao: UserSession | null) {
  return {
    autor_id: sessao?.colaboradorId ?? sessao?.id ?? "",
    autor_nome: sessao?.nome ?? "",
    autor_email: (sessao?.email ?? "").toLowerCase(),
  };
}

async function registrarHistorico(
  ocorrenciaId: string, autor: Rec,
  evento: Omit<EventoLinha, "ocorrencia_id" | "autor_id" | "autor_nome" | "autor_email">,
): Promise<void> {
  const { error } = await cloud().from("ocorrencia_historico")
    .insert({ ocorrencia_id: ocorrenciaId, ...autor, ...evento });
  if (error) throw traduzErro(error);
}

/** Notificação no sino (falha silenciosa: nunca bloqueia a tratativa). */
async function notificar(
  itens: { email: string; nome: string; titulo: string; mensagem: string }[],
  autor: Rec,
): Promise<void> {
  const validos = itens.filter((i) => i.email.includes("@"));
  if (!validos.length) return;
  try {
    await cloud().from("notificacoes").insert(validos.map((i) => ({
      destinatario_email: i.email.toLowerCase(),
      destinatario_nome: i.nome,
      titulo: i.titulo,
      mensagem: i.mensagem,
      tipo: "ocorrencia_etapa",
      plano_id: null,
      autor_nome: autor["autor_nome"],
      autor_email: autor["autor_email"],
    })));
  } catch { /* sem tabela de notificações: ignora */ }
}

function nomeDoEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!local) return email;
  return local.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
}

/** Primeira subetapa de uma macro-etapa (ou null = macro sem subetapas). */
function primeiraSubetapa(etapas: MacroFluxo[], macro: MacroEtapa): SubetapaFluxo | null {
  const e = etapas.find((x) => x.macro === macro);
  return e?.subetapas[0] ?? null;
}

/** Fluxo publicado na versão travada na ocorrência (fallback: fluxo vazio). */
export async function carregarFluxoAtivo(tipoId: string, versao: number): Promise<MacroFluxo[]> {
  const versoes = await listarFluxos(tipoId).catch(() => []);
  const escolhida = versoes.find((f) => f.versao === versao) ?? versoes[versoes.length - 1];
  return escolhida?.etapas ?? MACRO_ETAPAS.map((macro) => ({ macro, subetapas: [] }));
}

export async function carregarFormularioAtivo(
  tipoId: string, versao: number,
): Promise<CampoFormulario[]> {
  const versoes = await listarFormularios(tipoId).catch(() => []);
  const escolhida = versoes.find((f) => f.versao === versao) ?? versoes[versoes.length - 1];
  return escolhida?.campos ?? [];
}

/* -------------------------------------------------------------------------- */
/* Abertura                                                                    */
/* -------------------------------------------------------------------------- */

export interface AbrirOcorrenciaInput {
  tipo: TipoOcorrencia;
  formularioVersao: number;
  fluxoVersao: number;
  titulo: string;
  respostas: Respostas;
}

export async function abrirOcorrencia(
  input: AbrirOcorrenciaInput, sessao: UserSession | null,
): Promise<Ocorrencia> {
  const existentes = await listarOcorrencias().catch(() => []);
  const numero = proximoNumero(existentes);
  const autor = autorDe(sessao);
  const macro: MacroEtapa = "abertura";
  const { data, error } = await cloud().from("ocorrencias").insert({
    numero,
    titulo: input.titulo.trim(),
    tipo_id: input.tipo.id,
    tipo_nome: input.tipo.nome,
    tipo_cor: input.tipo.cor,
    formulario_versao: input.formularioVersao,
    fluxo_versao: input.fluxoVersao,
    respostas: input.respostas,
    macro_atual: macro,
    subetapa_atual_id: "",
    subetapa_atual_nome: MACRO_ETAPA_LABELS[macro],
    status: "em_andamento",
    aberta_por_id: str(autor["autor_id"]),
    aberta_por_nome: str(autor["autor_nome"]),
    aberta_por_email: str(autor["autor_email"]),
    aberta_por_setor: sessao?.setor ?? "",
    responsavel_id: "",
    responsavel_nome: input.tipo.setorPadrao,
    responsavel_email: "",
    prazo_etapa: calcularPrazoEtapa(input.tipo.slaDias[macro]),
    etapa_entrou_em: new Date().toISOString(),
  }).select("*").single();
  if (error) throw traduzErro(error);
  const o = data as Rec;

  await registrarHistorico(o["id"] as string, autor, {
    acao: "Criação", macro, subetapa: "", de: "",
    para: `Aberta como ${numero}`, comentario: "", anexos: [],
  });

  // Encarregado da primeira etapa do fluxo (se houver) é avisado.
  try {
    const fluxo = await carregarFluxoAtivo(input.tipo.id, input.fluxoVersao);
    const sub = primeiraSubetapa(fluxo, "apuracao");
    if (sub?.notificar) {
      const email = sub.responsavel.email ?? "";
      await notificar([{
        email,
        nome: sub.responsavel.nome || nomeDoEmail(email),
        titulo: `Ocorrência ${numero} entrou em ${MACRO_ETAPA_LABELS["apuracao"]}`,
        mensagem: `${input.titulo} · responsável: ${sub.responsavel.nome || "a definir"} · prazo ${sub.prazoDias}d`,
      }], autor);
    }
  } catch { /* fluxo ainda sem versões: segue */ }

  return ocorrenciaDoRow(o);
}

/* -------------------------------------------------------------------------- */
/* Movimentação                                                                */
/* -------------------------------------------------------------------------- */

function rotuloEtapa(macro: MacroEtapa, sub: SubetapaFluxo | null): string {
  return sub ? `${MACRO_ETAPA_LABELS[macro]} › ${sub.nome}` : MACRO_ETAPA_LABELS[macro];
}

/** Entra na etapa (macro+subetapa), calcula prazo, grava histórico e notifica. */
async function entrarEm(
  o: Ocorrencia, macro: MacroEtapa, sub: SubetapaFluxo | null,
  autor: Rec, acaoHistorico: string, comentario: string, anexos: AnexoOcorrencia[],
): Promise<void> {
  const prazo = sub
    ? calcularPrazoEtapa(sub.prazoDias)
    : calcularPrazoEtapa(30); // macro sem subetapa: 30 dias padrão
  const patch: Rec = {
    macro_atual: macro,
    subetapa_atual_id: sub?.id ?? "",
    subetapa_atual_nome: sub?.nome ?? MACRO_ETAPA_LABELS[macro],
    responsavel_id: sub?.responsavel.id ?? "",
    responsavel_nome: sub?.responsavel.nome ?? "",
    responsavel_email: (sub?.responsavel.email ?? "").toLowerCase(),
    prazo_etapa: prazo,
    etapa_entrou_em: new Date().toISOString(),
    status: "em_andamento",
  };
  const { error } = await cloud().from("ocorrencias").update(patch).eq("id", o.id);
  if (error) throw traduzErro(error);

  await registrarHistorico(o.id, autor, {
    acao: acaoHistorico, macro, subetapa: sub?.nome ?? "",
    de: rotuloEtapa(o.macroAtual, null), para: rotuloEtapa(macro, sub),
    comentario, anexos,
  });

  if (sub?.notificar) {
    const email = sub.responsavel.email ?? "";
    const alvo = email
      ? [{ email, nome: sub.responsavel.nome || nomeDoEmail(email) }]
      : [];
    // Solicitante acompanha a viagem do "metrô" (visão simplificada).
    alvo.push({ email: o.abertaPorEmail, nome: o.abertaPorNome });
    await notificar(alvo.map((d) => ({
      email: d.email,
      nome: d.nome,
      titulo: `Ocorrência ${o.numero} está em ${MACRO_ETAPA_LABELS[macro]}`,
      mensagem: `${o.titulo} · etapa: ${rotuloEtapa(macro, sub)} · previsão: ${prazo ?? "sem prazo"}`,
    })), autor);
  }
}

/** Encerra formalmente a ocorrência. */
async function encerrar(o: Ocorrencia, autor: Rec, motivo: string): Promise<void> {
  const { error } = await cloud().from("ocorrencias").update({
    status: "encerrada", encerrada_em: new Date().toISOString(),
    prazo_etapa: null,
  }).eq("id", o.id);
  if (error) throw traduzErro(error);
  await registrarHistorico(o.id, autor, {
    acao: "Encerramento", macro: o.macroAtual, subetapa: o.subetapaAtualNome,
    de: rotuloEtapa(o.macroAtual, null), para: "Encerrada",
    comentario: motivo, anexos: [],
  });
  await notificar([{
    email: o.abertaPorEmail, nome: o.abertaPorNome,
    titulo: `Ocorrência ${o.numero} foi encerrada`,
    mensagem: `${o.titulo} · ${motivo}`,
  }], autor).catch(() => undefined);
}

export interface AcaoPayload {
  acao: AcaoEtapa;
  respostasEtapa?: Respostas;
  comentario?: string;
  anexos?: AnexoOcorrencia[];
}

/**
 * Ação do responsável pela etapa atual (aprovar/reprovar/solicitar info/escalar).
 * `etapas` é o fluxo travado na ocorrência (versão fixa).
 */
export async function agirNaOcorrencia(
  o: Ocorrencia, etapas: MacroFluxo[], payload: AcaoPayload, sessao: UserSession | null,
): Promise<Ocorrencia> {
  const autor = autorDe(sessao);
  const comentario = payload.comentario?.trim() ?? "";
  const anexos = payload.anexos ?? [];

  if (payload.respostasEtapa && Object.keys(payload.respostasEtapa).length) {
    const mescladas = {
      ...o.respostas,
      [`__etapa_${o.macroAtual}_${o.subetapaAtualId}`]: payload.respostasEtapa,
    };
    const { error } = await cloud().from("ocorrencias")
      .update({ respostas: mescladas }).eq("id", o.id);
    if (error) throw traduzErro(error);
    o = { ...o, respostas: mescladas };
  }

  const macroAtual = o.macroAtual;
  const atual = subetapaDe(etapas, macroAtual, o.subetapaAtualId);
  const ordenadas = ordenarSubetapas(etapas);
  const idx = ordenadas.findIndex((x) => x.macro === macroAtual && x.subetapa.id === (atual?.id ?? ""));
  const proxima = idx >= 0 ? ordenadas[idx + 1] : undefined;
  const anterior = idx > 0 ? ordenadas[idx - 1] : undefined;

  if (payload.acao === "aprovar") {
    if (proxima) {
      await entrarEm(o, proxima.macro, proxima.subetapa, autor, "Aprovação", comentario, anexos);
    } else {
      await encerrar(o, autor, comentario || "Fluxo concluído.");
    }
  } else if (payload.acao === "reprovar") {
    if (atual?.reprovarPara === "encerrar") {
      await encerrar(o, autor, comentario || "Reprovada na etapa.");
    } else if (anterior) {
      await entrarEm(o, anterior.macro, anterior.subetapa, autor, "Reprovação (retorno)", comentario, anexos);
    } else {
      // Sem etapa anterior: volta para o solicitante ajustar (macro de abertura).
      await entrarEm(o, "abertura", null, autor, "Reprovação (retorno ao solicitante)", comentario, anexos);
    }
  } else if (payload.acao === "solicitar_info") {
    await registrarHistorico(o.id, autor, {
      acao: ACOES_ETAPA_LABELS[payload.acao], macro: macroAtual, subetapa: atual?.nome ?? "",
      de: "", para: o.abertaPorNome || "solicitante",
      comentario, anexos,
    });
    await notificar([{
      email: o.abertaPorEmail, nome: o.abertaPorNome,
      titulo: `Informação solicitada na ocorrência ${o.numero}`,
      mensagem: `${o.titulo} · ${comentario || "há pendências a esclarecer."}`,
    }], autor).catch(() => undefined);
  } else if (payload.acao === "escalar") {
    await registrarHistorico(o.id, autor, {
      acao: "Escalado para a Qualidade", macro: macroAtual, subetapa: atual?.nome ?? "",
      de: "", para: "Qualidade", comentario, anexos,
    });
    await notificar([{
      email: o.abertaPorEmail, nome: o.abertaPorNome,
      titulo: `Ocorrência ${o.numero} foi escalada`,
      mensagem: `${o.titulo} · ${comentario || "requer atenção da Qualidade."}`,
    }], autor).catch(() => undefined);
  }

  const lista = await listarOcorrencias();
  return lista.find((x) => x.id === o.id) ?? o;
}

/** Movimentação manual (Qualidade): joga a ocorrência numa etapa específica. */
export async function moverPara(
  o: Ocorrencia, etapas: MacroFluxo[], macro: MacroEtapa, subetapaId: string,
  sessao: UserSession | null, comentario = "",
): Promise<void> {
  const sub = subetapaDe(etapas, macro, subetapaId);
  await entrarEm(o, macro, sub, autorDe(sessao), "Movimentação manual", comentario, []);
}

/** Comentário/anexo na ocorrência (timeline do histórico). */
export async function comentarOcorrencia(
  o: Ocorrencia, texto: string, anexos: AnexoOcorrencia[], sessao: UserSession | null,
): Promise<void> {
  const autor = autorDe(sessao);
  await registrarHistorico(o.id, autor, {
    acao: "Comentário", macro: o.macroAtual, subetapa: o.subetapaAtualNome,
    de: "", para: "", comentario: texto, anexos,
  });
  await notificar([{
    email: o.abertaPorEmail, nome: o.abertaPorNome,
    titulo: `Novo comentário na ocorrência ${o.numero}`,
    mensagem: texto || "Anexo adicionado.",
  }], autor).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Avaliação de eficácia                                                       */
/* -------------------------------------------------------------------------- */

export interface AvaliacaoInput {
  eficaz: boolean;
  observacao: string;
  prazoDias: number;
}

/**
 * Registra a avaliação de eficácia. Ineficaz → reabre automaticamente na
 * macro-etapa de Apuração (conta como reincidência) e avisa os envolvidos.
 */
export async function avaliarEficacia(
  o: Ocorrencia, etapas: MacroFluxo[], input: AvaliacaoInput, sessao: UserSession | null,
): Promise<void> {
  const autor = autorDe(sessao);
  const verificacaoEm = calcularPrazoEtapa(input.prazoDias);
  const { error } = await cloud().from("ocorrencias").update({
    avaliacao: {
      prazoDias: input.prazoDias, verificacaoEm,
      eficaz: input.eficaz, observacao: input.observacao,
    },
  }).eq("id", o.id);
  if (error) throw traduzErro(error);

  await registrarHistorico(o.id, autor, {
    acao: input.eficaz ? "Avaliação de eficácia: eficaz" : "Avaliação de eficácia: INEFICAZ",
    macro: "avaliacao_eficacia", subetapa: "", de: "",
    para: input.eficaz ? "Mantida encerrada" : "Reaberta",
    comentario: input.observacao, anexos: [],
  });

  if (input.eficaz) return;

  // Reabertura automática: volta para Apuração (nova rodada de tratativa).
  const { error: erroReabrir } = await cloud().from("ocorrencias").update({
    status: "reaberta",
    reaberturas: o.reaberturas + 1,
    encerrada_em: null,
  }).eq("id", o.id);
  if (erroReabrir) throw traduzErro(erroReabrir);
  const base: Ocorrencia = { ...o, reaberturas: o.reaberturas + 1, status: "reaberta" };
  const apuracao = etapas.find((e) => e.macro === "apuracao");
  await entrarEm(base, "apuracao", apuracao?.subetapas[0] ?? null, autor,
    "Reabertura por ineficácia", input.observacao || "Ação não resolveu o problema.", []);
}

/* -------------------------------------------------------------------------- */
/* Anexos (Storage — bucket de anexos do portal)                               */
/* -------------------------------------------------------------------------- */

const BUCKET = "pop-anexos";

export async function enviarAnexo(
  ocorrenciaId: string, arquivo: File,
): Promise<AnexoOcorrencia> {
  const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
  const caminho = `ocorrencias/${ocorrenciaId}/${Date.now()}.${(extensao ?? "bin").toLowerCase()}`;
  const { error } = await cloud().storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type, upsert: false,
  });
  if (error) throw traduzErro(error);
  return {
    nome: arquivo.name, caminho,
    tipo: arquivo.type, tamanho: arquivo.size,
  };
}

export async function urlAssinada(caminho: string): Promise<string> {
  const { data, error } = await cloud().storage.from(BUCKET).createSignedUrl(caminho, 60 * 5);
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível abrir o anexo.");
  return data.signedUrl;
}

/** Utilitário exportado para o Form Builder gerar ids de campos. */
export { idCurto };
