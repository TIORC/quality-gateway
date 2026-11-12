/**
 * Ocorrências — operações (máquina de fluxo).
 *
 * Toda ação grava evento no histórico imutável e notifica pelo sino
 * (`public.notificacoes`, tipos `ocorrencia_*`).
 *
 * As operações que mudam dados recebem a `loja` como último parâmetro: em
 * produção é o Supabase (padrão); no laboratório de simulação é uma loja em
 * memória, que não grava nada no banco.
 */
import { getSession, type UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import {
  ACOES_ETAPA_LABELS,
  ETAPA_RETORNO_CLIENTE,
  CHAVE_CIENCIAS,
  ACAO_MENSAGEM_COMUNICACAO,
  TIPO_NOTIFICACAO_CONVERSA,
  CHAVE_SETORES_ENVOLVIDOS,
  ehTipoNaoConformidade,
  setoresEnvolvidosDe,
  cienciasDe,
  setoresSemCiencia,
  PROCEDENCIA_LABELS,
  PRIORIDADE_LABELS,
  type PrioridadeOcorrencia,
  SETOR_RESPONSAVEL_OCORRENCIAS,
  calcularPrazoEtapa,
  fluxoVazio,
  fluxoComPlanoAcao,
  idCurto,
  LIMITE_TEXTO_OCORRENCIA,
  type ResultadoEficacia,
  nomeEtapaDoFluxo,
  nomeEtapaDoTipo,
  ocorrenciaAtrasada,
  ordenarSubetapas,
  prefixoNumeroTipo,
  proximoNumero,
  slaDaEtapa,
  subetapaDe,
  type AnexoOcorrencia,
  type AcaoEtapa,
  type ApuracaoFerramentas,
  apuracaoFerramentasDe,
  CAUSAS_ISHIKAWA_MAX,
  EFEITO_ISHIKAWA_PADRAO,
  ISHIKAWA_CATEGORIAS,
  CHAVE_FERRAMENTA_APURACAO,
  causaRaizDaApuracao,
  FERRAMENTA_APURACAO_LABELS,
  CHAVE_EVIDENCIAS,
  CHAVE_PARECER_APURACAO,
  CHAVE_ACOES_EXECUTADAS,
  type AcaoExecutada,
  type ParecerApuracao,
  type EvidenciaApuracao,
  CHAVE_RELATORIO_JULGAMENTO,
  CHAVE_ITENS_JULGAMENTO,
  LIMITE_RELATORIO_JULGAMENTO,
  type ItemJulgamento,
  type RelatorioJulgamento,
  itensJulgamentoDe,
  procedenciaDosItens,
  relatorioJulgamentoDe,
  type CampoFormulario,
  type MacroEtapa,
  type MacroFluxo,
  type Ocorrencia,
  type ProcedenciaOcorrencia,
  type Respostas,
  type SubetapaFluxo,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";
import {
  cloud,
  listarTipos,
  listarFluxos,
  listarFormularios,
  ocorrenciaDoRow,
  str,
  type EventoLinha,
} from "@/lib/ocorrencias-base";
import { lojaSupabase, type LojaOcorrencias } from "@/lib/ocorrencias-loja";

type Rec = Record<string, unknown>;

/**
 * Autor da ação. Se a tela não repassar a sessão (contexto nulo), usa a sessão
 * persistida no navegador: o autor nunca pode ser gravado em branco.
 */
function autorDe(sessao: UserSession | null) {
  const s = sessao ?? getSession();
  return {
    autor_id: s?.colaboradorId || s?.id || "",
    autor_nome: s?.nome ?? "",
    autor_email: (s?.email ?? "").trim().toLowerCase(),
  };
}

async function registrarHistorico(
  ocorrenciaId: string,
  autor: Rec,
  evento: Omit<EventoLinha, "ocorrencia_id" | "autor_id" | "autor_nome" | "autor_email">,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.registrarHistorico({ ocorrencia_id: ocorrenciaId, ...autor, ...evento });
}

/** Notificação no sino (falha silenciosa: nunca bloqueia a tratativa). */
async function notificar(
  itens: { email: string; nome: string; titulo: string; mensagem: string }[],
  autor: Rec,
  loja: LojaOcorrencias = lojaSupabase,
  ocorrenciaId: string | null = null,
): Promise<void> {
  const validos = itens.filter((i) => i.email.includes("@"));
  if (!validos.length) return;
  await loja.notificar(
    validos.map((i) => ({
      destinatario_email: i.email.toLowerCase(),
      destinatario_nome: i.nome,
      titulo: i.titulo,
      mensagem: i.mensagem,
      tipo: "ocorrencia_etapa",
      plano_id: null,
      ocorrencia_id: ocorrenciaId,
      autor_nome: autor["autor_nome"],
      autor_email: autor["autor_email"],
    })),
  );
}

function nomeDoEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  if (!local) return email;
  return local.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
}

/** Primeira subetapa de uma etapa (ou null = etapa sem subetapas). */
function primeiraSubetapa(etapas: MacroFluxo[], macro: MacroEtapa): SubetapaFluxo | null {
  const e = etapas.find((x) => x.macro === macro);
  return e?.subetapas[0] ?? null;
}

/** Fluxo publicado na versão travada na ocorrência (fallback: fluxo vazio). */
export async function carregarFluxoAtivo(tipoId: string, versao: number): Promise<MacroFluxo[]> {
  const versoes = await listarFluxos(tipoId).catch(() => []);
  const escolhida = versoes.find((f) => f.versao === versao) ?? versoes[versoes.length - 1];
  return fluxoComPlanoAcao(escolhida?.etapas ?? fluxoVazio());
}

export async function carregarFormularioAtivo(
  tipoId: string,
  versao: number,
): Promise<CampoFormulario[]> {
  const versoes = await listarFormularios(tipoId).catch(() => []);
  const escolhida = versoes.find((f) => f.versao === versao) ?? versoes[versoes.length - 1];
  return escolhida?.campos ?? [];
}

export interface VersoesPublicadas {
  formularioVersao: number;
  fluxoVersao: number;
  campos: CampoFormulario[];
  /** Títulos das telas do formulário de abertura (vazio = uma tela). */
  telas: string[];
  etapas: MacroFluxo[];
}

/** Últimas versões publicadas de formulário e fluxo de um tipo. */
export async function carregarUltimasVersoes(tipoId: string): Promise<VersoesPublicadas> {
  const [formularios, fluxos] = await Promise.all([
    listarFormularios(tipoId).catch(() => []),
    listarFluxos(tipoId).catch(() => []),
  ]);
  const formulario = formularios[formularios.length - 1];
  const fluxo = fluxos[fluxos.length - 1];
  return {
    formularioVersao: formulario?.versao ?? 1,
    fluxoVersao: fluxo?.versao ?? 1,
    campos: formulario?.campos ?? [],
    telas: formulario?.telas ?? [],
    etapas: fluxoComPlanoAcao(fluxo?.etapas ?? fluxoVazio()),
  };
}

/**
 * Registra uma única notificação/evento de atraso por ocorrência em que o
 * prazo da etapa atual já estourou (idempotente: ignora as já sinalizadas).
 */
export async function detectarAtrasos(
  ocorrencias: Ocorrencia[],
  sessao: UserSession | null,
): Promise<number> {
  const atrasadas = ocorrencias.filter((o) => o.status !== "encerrada" && ocorrenciaAtrasada(o));
  if (atrasadas.length === 0) return 0;
  const autor = autorDe(sessao);
  let registrados = 0;
  try {
    const { data } = await cloud()
      .from("ocorrencia_historico")
      .select("ocorrencia_id, macro, acao")
      .in(
        "ocorrencia_id",
        atrasadas.map((o) => o.id),
      );
    const jaSinalizado = new Set<string>();
    for (const r of data ?? []) {
      const linha = r as Rec;
      if (linha["acao"] === "Atraso") {
        jaSinalizado.add(`${linha["ocorrencia_id"]}::${linha["macro"]}`);
      }
    }
    for (const o of atrasadas) {
      const chave = `${o.id}::${o.macroAtual}`;
      if (jaSinalizado.has(chave)) continue;
      await registrarHistorico(o.id, autor, {
        acao: "Atraso de prazo",
        macro: o.macroAtual,
        subetapa: o.subetapaAtualNome,
        de: "",
        para: "Atrasado",
        comentario: "Prazo da etapa foi estourado e a tratativa segue pendente.",
        anexos: [],
      });
      await notificar(
        o.macroAtual === "avaliacao_eficacia"
          ? // Prazo de eficácia vencido: chama quem conduz a etapa (a Qualidade vê em "Atrasadas").
            o.responsavelEmail
            ? [
                {
                  email: o.responsavelEmail,
                  nome: o.responsavelNome,
                  titulo: `Ocorrência ${o.numero}: avaliar eficácia`,
                  mensagem: `${o.titulo} · o prazo de eficácia venceu. Houve reincidência?`,
                },
              ]
            : []
          : [
              {
                email: o.abertaPorEmail,
                nome: o.abertaPorNome,
                titulo: `Ocorrência ${o.numero} está atrasada`,
                mensagem: `${o.titulo} · etapa ${o.subetapaAtualNome || o.macroAtual} com prazo estourado.`,
              },
            ],
        autor, lojaSupabase, o.id,
      ).catch(() => undefined);
      registrados += 1;
    }
  } catch {
    /* sem tabela de histórico: segue sem sinalizar */
  }
  return registrados;
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
  input: AbrirOcorrenciaInput,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<Ocorrencia> {
  const existentes = await loja.listarOcorrencias().catch(() => []);
  const numero = proximoNumero(existentes, prefixoNumeroTipo(input.tipo));
  const autor = autorDe(sessao);
  const macro: MacroEtapa = "abertura";
  const o = await loja.inserirOcorrencia({
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
    subetapa_atual_nome: nomeEtapaDoTipo(input.tipo, macro),
    status: "em_andamento",
    procedencia: "pendente",
    eficacia_dias: input.tipo.eficaciaDias ?? 30,
    aberta_por_id: str(autor["autor_id"]),
    aberta_por_nome: str(autor["autor_nome"]),
    aberta_por_email: str(autor["autor_email"]),
    aberta_por_setor: (sessao ?? getSession())?.setor ?? "",
    responsavel_id: "",
    // Regra do portal: toda ocorrência (qualquer tipo) é do setor Qualidade.
    responsavel_nome: SETOR_RESPONSAVEL_OCORRENCIAS,
    responsavel_email: "",
    // Dono padrão configurado no tipo (vazio = sem dono até a Qualidade assumir).
    dono_qualidade_id: input.tipo.donoPadraoId ?? "",
    dono_qualidade_nome: input.tipo.donoPadraoNome ?? "",
    dono_qualidade_email: (input.tipo.donoPadraoEmail ?? "").toLowerCase(),
    prazo_etapa: calcularPrazoEtapa(slaDaEtapa(input.tipo, macro)),
    etapa_entrou_em: new Date().toISOString(),
  });

  await registrarHistorico(
    o["id"] as string,
    autor,
    {
      acao: "Criação",
      macro,
      subetapa: "",
      de: "",
      para: `Aberta como ${numero}`,
      comentario: "",
      anexos: [],
    },
    loja,
  );

  // Encarregado da primeira etapa do fluxo (se houver) é avisado.
  try {
    const fluxo = await loja.carregarFluxo(input.tipo.id, input.fluxoVersao);
    const sub = primeiraSubetapa(fluxo, "apuracao");
    if (sub?.notificar) {
      const email = sub.responsavel.email ?? "";
      await notificar(
        [
          {
            email,
            nome: sub.responsavel.nome || nomeDoEmail(email),
            titulo: `Ocorrência ${numero} entrou em ${nomeEtapaDoFluxo(fluxo, "apuracao")}`,
            mensagem: `${input.titulo} · responsável: ${sub.responsavel.nome || "a definir"} · prazo ${sub.prazoDias}d`,
          },
        ],
        autor,
        loja,
        String(o["id"]),
      );
    }
  } catch {
    /* fluxo ainda sem versões: segue */
  }

  return ocorrenciaDoRow(o);
}

/**
 * Envia os anexos da abertura ao Storage e grava os caminhos em
 * `respostas.anexos`, além de registrar um evento no histórico. Usado pelo
 * formulário fixo de Não Conformidade (até 5 arquivos de 10 MB por item).
 */
export async function adicionarAnexosAbertura(
  o: Ocorrencia,
  arquivos: File[],
  sessao: UserSession | null,
): Promise<Ocorrencia> {
  const autor = autorDe(sessao);
  const enviados: AnexoOcorrencia[] = [];
  for (const arquivo of arquivos) {
    enviados.push(await enviarAnexo(o.id, arquivo));
  }
  const anteriores = Array.isArray(o.respostas["anexos"])
    ? (o.respostas["anexos"] as AnexoOcorrencia[]).filter((a) => a.caminho)
    : [];
  const anexos = [...anteriores, ...enviados];
  const respostas: Respostas = { ...o.respostas, anexos };
  const { error } = await cloud().from("ocorrencias").update({ respostas }).eq("id", o.id);
  if (error) throw traduzErro(error);
  await registrarHistorico(o.id, autor, {
    acao: "Anexos da abertura",
    macro: "abertura",
    subetapa: "",
    de: "",
    para: `${anexos.length} anexo(s)`,
    comentario: "",
    anexos,
  });
  return { ...o, respostas };
}

/**
 * Envia ao Storage os arquivos dos campos "arquivo" do formulário dinâmico e
 * grava `respostas[campoId]` com os caminhos (para visualização posterior).
 */
export async function anexarArquivosDosCampos(
  o: Ocorrencia,
  arquivosPorCampo: Record<string, File[]>,
  sessao: UserSession | null,
): Promise<Ocorrencia> {
  const autor = autorDe(sessao);
  const respostas: Respostas = { ...o.respostas };
  const todos: AnexoOcorrencia[] = [];
  for (const [campoId, arquivos] of Object.entries(arquivosPorCampo)) {
    if (arquivos.length === 0) continue;
    const enviados: AnexoOcorrencia[] = [];
    for (const arquivo of arquivos) enviados.push(await enviarAnexo(o.id, arquivo));
    respostas[campoId] = enviados;
    todos.push(...enviados);
  }
  if (todos.length === 0) return o;
  const { error } = await cloud().from("ocorrencias").update({ respostas }).eq("id", o.id);
  if (error) throw traduzErro(error);
  await registrarHistorico(o.id, autor, {
    acao: "Anexos da abertura",
    macro: "abertura",
    subetapa: "",
    de: "",
    para: `${todos.length} anexo(s)`,
    comentario: "",
    anexos: todos,
  });
  return { ...o, respostas };
}

/* -------------------------------------------------------------------------- */
/* Movimentação                                                                */
/* -------------------------------------------------------------------------- */

function rotuloEtapa(etapas: MacroFluxo[], macro: MacroEtapa, sub: SubetapaFluxo | null): string {
  const nome = nomeEtapaDoFluxo(etapas, macro);
  return sub ? `${nome} › ${sub.nome}` : nome;
}

/** Entra na etapa (macro+subetapa), calcula prazo, grava histórico e notifica. */
async function entrarEm(
  o: Ocorrencia,
  etapas: MacroFluxo[],
  macro: MacroEtapa,
  sub: SubetapaFluxo | null,
  autor: Rec,
  acaoHistorico: string,
  comentario: string,
  anexos: AnexoOcorrencia[],
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  // Avaliação de eficácia: o prazo é a data definida no fechamento (30/60/90 dias do tipo).
  const prazo =
    macro === "avaliacao_eficacia" && o.eficaciaPrevistaEm
      ? o.eficaciaPrevistaEm
      : sub
        ? calcularPrazoEtapa(sub.prazoDias)
        : calcularPrazoEtapa(30); // etapa sem subetapa: 30 dias padrão
  // Regra do portal: o setor responsável por toda ocorrência é a Qualidade.
  // Subetapa sem responsável, sem nome ou com responsável do tipo setor
  // assume automaticamente a Qualidade (pessoa/cargo explícitos são mantidos,
  // pois representam delegação feita pela própria Qualidade no fluxo).
  const ehSetorOuVazio = !sub || sub.responsavel.tipo === "setor" || !sub.responsavel.nome.trim();
  const responsavelNome = ehSetorOuVazio
    ? SETOR_RESPONSAVEL_OCORRENCIAS
    : (sub?.responsavel.nome ?? "");
  const patch: Rec = {
    macro_atual: macro,
    subetapa_atual_id: sub?.id ?? "",
    subetapa_atual_nome: sub?.nome ?? nomeEtapaDoFluxo(etapas, macro),
    responsavel_id: ehSetorOuVazio ? "" : (sub?.responsavel.id ?? ""),
    responsavel_nome: responsavelNome,
    responsavel_email: ehSetorOuVazio ? "" : (sub?.responsavel.email ?? "").toLowerCase(),
    prazo_etapa: prazo,
    etapa_entrou_em: new Date().toISOString(),
    status: "em_andamento",
  };
  await loja.atualizarOcorrencia(o.id, patch);

  await registrarHistorico(
    o.id,
    autor,
    {
      acao: acaoHistorico,
      macro,
      subetapa: sub?.nome ?? "",
      de: rotuloEtapa(etapas, o.macroAtual, null),
      para: rotuloEtapa(etapas, macro, sub),
      comentario,
      anexos,
    },
    loja,
  );

  // Comunicado: ao entrar no plano de ação, o solicitante é avisado de que ele foi gerado.
  if (macro === "plano_acao") {
    await registrarHistorico(
      o.id,
      autor,
      {
        acao: "Plano de ação gerado",
        macro,
        subetapa: sub?.nome ?? "",
        de: "",
        para: "",
        comentario: "Um plano de ação foi gerado para esta ocorrência.",
        anexos: [],
      },
      loja,
    );
    await notificar(
      [
        {
          email: o.abertaPorEmail,
          nome: o.abertaPorNome,
          titulo: `Plano de ação gerado — ocorrência ${o.numero}`,
          mensagem: `Foi gerado um plano de ação para a sua ocorrência (${o.titulo}).`,
        },
      ],
      autor,
      loja, o.id,
    ).catch(() => undefined);
  }

  if (sub?.notificar) {
    const email = sub.responsavel.email ?? "";
    const alvo = email ? [{ email, nome: sub.responsavel.nome || nomeDoEmail(email) }] : [];
    // Solicitante acompanha a viagem do "metrô" (visão simplificada).
    alvo.push({ email: o.abertaPorEmail, nome: o.abertaPorNome });
    await notificar(
      alvo.map((d) => ({
        email: d.email,
        nome: d.nome,
        titulo: `Ocorrência ${o.numero} está em ${nomeEtapaDoFluxo(etapas, macro)}`,
        mensagem: `${o.titulo} · etapa: ${rotuloEtapa(etapas, macro, sub)} · previsão: ${prazo ?? "sem prazo"}`,
      })),
      autor,
      loja, o.id,
    );
  }
}

/** Encerra formalmente a ocorrência. */
async function encerrar(
  o: Ocorrencia,
  etapas: MacroFluxo[],
  autor: Rec,
  motivo: string,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, {
    status: "encerrada",
    encerrada_em: new Date().toISOString(),
    prazo_etapa: null,
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Encerramento",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: rotuloEtapa(etapas, o.macroAtual, null),
      para: "Encerrada",
      comentario: motivo,
      anexos: [],
    },
    loja,
  );
  // Retorno ao solicitante: inclui a causa raiz da apuração, quando registrada.
  const causaApuracao = causaRaizDaApuracao(apuracaoFerramentasDe(o)).trim();
  const resultadosApuracao = causaApuracao
    ? `Causa raiz: ${causaApuracao}`
    : (o.respostas[RESULTADOS_APURACAO_CHAVE] as { texto?: string } | undefined)?.texto?.trim();
  await notificar(
    [
      {
        email: o.abertaPorEmail,
        nome: o.abertaPorNome,
        titulo: `Ocorrência ${o.numero} foi encerrada`,
        mensagem: [
          `${o.titulo} · ${motivo}`,
          resultadosApuracao ? `Resultados da apuração: ${resultadosApuracao}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      },
    ],
    autor,
    loja, o.id,
  ).catch(() => undefined);
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
  o: Ocorrencia,
  etapas: MacroFluxo[],
  payload: AcaoPayload,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<Ocorrencia> {
  const autor = autorDe(sessao);
  const comentario = payload.comentario?.trim() ?? "";
  const anexos = payload.anexos ?? [];

  if (payload.respostasEtapa && Object.keys(payload.respostasEtapa).length) {
    const mescladas = {
      ...o.respostas,
      [`__etapa_${o.macroAtual}_${o.subetapaAtualId}`]: payload.respostasEtapa,
    };
    await loja.atualizarOcorrencia(o.id, { respostas: mescladas });
    o = { ...o, respostas: mescladas };
  }

  const macroAtual = o.macroAtual;
  const atual = subetapaDe(etapas, macroAtual, o.subetapaAtualId);
  const ordenadas = ordenarSubetapas(etapas);
  const idx = ordenadas.findIndex(
    (x) => x.macro === macroAtual && x.subetapa.id === (atual?.id ?? ""),
  );
  const proxima = idx >= 0 ? ordenadas[idx + 1] : undefined;
  const anterior = idx > 0 ? ordenadas[idx - 1] : undefined;

  if (
    macroAtual === "avaliacao_eficacia" &&
    o.status !== "encerrada" &&
    (payload.acao === "aprovar" || payload.acao === "reprovar")
  ) {
    throw new Error("Nesta etapa a decisão é registrada em “Avaliar eficácia”.");
  }

  // Comunicação: só avança quando todos os setores envolvidos marcaram ciência.
  if (
    payload.acao === "aprovar" &&
    macroAtual === "comunicacao" &&
    proxima?.macro !== "comunicacao"
  ) {
    const pendentes = setoresSemCiencia(o);
    if (pendentes.length > 0) {
      throw new Error(`Aguardando ciência dos setores: ${pendentes.join(", ")}.`);
    }
  }

  // Retorno ao cliente: etapa obrigatória; aprovar exige o registro do que foi retornado.
  if (
    payload.acao === "aprovar" &&
    macroAtual === ETAPA_RETORNO_CLIENTE &&
    proxima?.macro !== ETAPA_RETORNO_CLIENTE
  ) {
    if (!comentario) {
      throw new Error("Registre o retorno dado ao cliente (campo de comentário) para avançar.");
    }
    const respostas = {
      ...o.respostas,
      __retorno_cliente: {
        texto: comentario,
        em: new Date().toISOString(),
        por: str(autor["autor_nome"]),
      },
    };
    await loja.atualizarOcorrencia(o.id, { respostas });
    o = { ...o, respostas };
  }

  // Última etapa antes da eficácia: o parecer final é obrigatório e define a data da avaliação.
  const saindoDoFechamento = payload.acao === "aprovar" && proxima?.macro === "avaliacao_eficacia";
  if (saindoDoFechamento) {
    if (!comentario) {
      throw new Error("Informe o parecer final (campo de comentário) para fechar a ocorrência.");
    }
    const agora = new Date();
    const previsto =
      o.eficaciaDias > 0
        ? new Date(agora.getTime() + o.eficaciaDias * 24 * 60 * 60 * 1000).toISOString()
        : null;
    await loja.atualizarOcorrencia(o.id, {
      parecer_final: comentario,
      parecer_em: agora.toISOString(),
      eficacia_prevista_em: previsto,
    });
    o = {
      ...o,
      parecerFinal: comentario,
      parecerEm: agora.toISOString(),
      eficaciaPrevistaEm: previsto,
    };
    await notificar(
      [
        {
          email: o.abertaPorEmail,
          nome: o.abertaPorNome,
          titulo: `Parecer final da ocorrência ${o.numero}`,
          mensagem: `${o.titulo} · ${comentario}`,
        },
      ],
      autor,
      loja, o.id,
    ).catch(() => undefined);
  }

  if (payload.acao === "aprovar") {
    if (proxima) {
      await entrarEm(
        o,
        etapas,
        proxima.macro,
        proxima.subetapa,
        autor,
        saindoDoFechamento ? "Parecer final registrado" : "Aprovação",
        comentario,
        anexos,
        loja,
      );
    } else {
      await encerrar(o, etapas, autor, comentario || "Fluxo concluído.", loja);
    }
  } else if (payload.acao === "reprovar") {
    if (atual?.reprovarPara === "encerrar") {
      await encerrar(o, etapas, autor, comentario || "Reprovada na etapa.", loja);
    } else if (anterior) {
      await entrarEm(
        o,
        etapas,
        anterior.macro,
        anterior.subetapa,
        autor,
        "Reprovação (retorno)",
        comentario,
        anexos,
        loja,
      );
    } else {
      // Sem etapa anterior: volta para o solicitante ajustar (etapa de abertura).
      await entrarEm(
        o,
        etapas,
        "abertura",
        null,
        autor,
        "Reprovação (retorno ao solicitante)",
        comentario,
        anexos,
        loja,
      );
    }
  } else if (payload.acao === "solicitar_info") {
    await registrarHistorico(
      o.id,
      autor,
      {
        acao: ACOES_ETAPA_LABELS[payload.acao],
        macro: macroAtual,
        subetapa: atual?.nome ?? "",
        de: "",
        para: o.abertaPorNome || "solicitante",
        comentario,
        anexos,
      },
      loja,
    );
    await notificar(
      [
        {
          email: o.abertaPorEmail,
          nome: o.abertaPorNome,
          titulo: `Informação solicitada na ocorrência ${o.numero}`,
          mensagem: `${o.titulo} · ${comentario || "há pendências a esclarecer."}`,
        },
      ],
      autor,
      loja, o.id,
    ).catch(() => undefined);
  } else if (payload.acao === "escalar") {
    await registrarHistorico(
      o.id,
      autor,
      {
        acao: "Escalado para a Qualidade",
        macro: macroAtual,
        subetapa: atual?.nome ?? "",
        de: "",
        para: "Qualidade",
        comentario,
        anexos,
      },
      loja,
    );
    await notificar(
      [
        {
          email: o.abertaPorEmail,
          nome: o.abertaPorNome,
          titulo: `Ocorrência ${o.numero} foi escalada`,
          mensagem: `${o.titulo} · ${comentario || "requer atenção da Qualidade."}`,
        },
      ],
      autor,
      loja, o.id,
    ).catch(() => undefined);
  }

  const lista = await loja.listarOcorrencias();
  return lista.find((x) => x.id === o.id) ?? o;
}

/** Movimentação manual (Qualidade): joga a ocorrência numa etapa específica. */
export async function moverPara(
  o: Ocorrencia,
  etapas: MacroFluxo[],
  macro: MacroEtapa,
  subetapaId: string,
  sessao: UserSession | null,
  comentario = "",
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  // O retorno ao cliente não pode ser pulado: só avança além dele depois de registrado.
  const ordem = etapas.map((e) => e.macro);
  const iRetorno = ordem.indexOf(ETAPA_RETORNO_CLIENTE);
  if (
    iRetorno >= 0 &&
    ordem.indexOf(macro) > iRetorno &&
    !o.respostas["__retorno_cliente"] &&
    o.macroAtual !== macro
  ) {
    throw new Error("O retorno ao cliente é obrigatório e ainda não foi registrado.");
  }
  const sub = subetapaDe(etapas, macro, subetapaId);
  await entrarEm(
    o,
    etapas,
    macro,
    sub,
    autorDe(sessao),
    "Movimentação manual",
    comentario,
    [],
    loja,
  );
}

/** Comentário/anexo na ocorrência (timeline do histórico). */
export async function comentarOcorrencia(
  o: Ocorrencia,
  texto: string,
  anexos: AnexoOcorrencia[],
  sessao: UserSession | null,
): Promise<void> {
  const autor = autorDe(sessao);
  await registrarHistorico(o.id, autor, {
    acao: "Comentário",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: "",
    comentario: texto,
    anexos,
  });
  // Solicitante e responsável da etapa recebem o aviso (menos quem comentou).
  const destinos = [
    { email: o.abertaPorEmail, nome: o.abertaPorNome },
    { email: o.responsavelEmail, nome: o.responsavelNome },
  ].filter(
    (d, i, lista) =>
      d.email &&
      d.email.toLowerCase() !== str(autor["autor_email"]).toLowerCase() &&
      lista.findIndex((x) => x.email.toLowerCase() === d.email.toLowerCase()) === i,
  );
  await notificar(
    destinos.map((d) => ({
      ...d,
      titulo: `Novo comentário na ocorrência ${o.numero}`,
      mensagem: texto || "Anexo adicionado.",
    })),
    autor, lojaSupabase, o.id,
  ).catch(() => undefined);
}

/**
 * Mensagem do chat da etapa de Comunicação. Fica no histórico da ocorrência
 * (`para` guarda o setor de quem escreveu); não notifica ninguém.
 */
export async function enviarMensagemComunicacao(
  o: Ocorrencia,
  texto: string,
  sessao: UserSession | null,
  envolvidos: { email: string; nome: string }[],
  mencionados: { email: string; nome: string }[] = [],
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const mensagem = texto.trim();
  if (!mensagem) return;
  const autor = autorDe(sessao);
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: ACAO_MENSAGEM_COMUNICACAO,
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: sessao?.setor ?? "",
      comentario: mensagem,
      anexos: [],
    },
    loja,
  );

  // Todos os envolvidos recebem aviso; quem foi marcado com @ recebe um aviso com o título próprio.
  const emailAutor = str(autor["autor_email"]).toLowerCase();
  const alvo = new Map<string, { email: string; nome: string; marcado: boolean }>();
  for (const e of envolvidos) {
    if (e.email) alvo.set(e.email.toLowerCase(), { ...e, marcado: false });
  }
  for (const m of mencionados) {
    if (m.email) alvo.set(m.email.toLowerCase(), { ...m, marcado: true });
  }
  alvo.delete(emailAutor);

  const linhas = [...alvo.entries()]
    .filter(([email]) => email.includes("@"))
    .map(([email, d]) => ({
      destinatario_email: email,
      destinatario_nome: d.nome,
      titulo: d.marcado
        ? `Você foi marcado na ocorrência ${o.numero}`
        : `Nova mensagem na ocorrência ${o.numero}`,
      mensagem,
      tipo: TIPO_NOTIFICACAO_CONVERSA,
      plano_id: null,
      ocorrencia_id: o.id,
      autor_nome: str(autor["autor_nome"]),
      autor_email: emailAutor,
    }));
  if (linhas.length > 0) await loja.notificar(linhas);
}

/* -------------------------------------------------------------------------- */
/* Julgamento (procedência)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Salva o relatório do julgamento (texto de até 50.000 caracteres + anexos).
 * Os anexos já enviados são mantidos; `novosAnexos` são somados a eles.
 */
export async function salvarRelatorioJulgamento(
  o: Ocorrencia,
  texto: string,
  novosAnexos: AnexoOcorrencia[],
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpo = texto.trim();
  if (limpo.length > LIMITE_RELATORIO_JULGAMENTO) {
    throw new Error(`O relatório pode ter no máximo ${LIMITE_RELATORIO_JULGAMENTO} caracteres.`);
  }
  const anteriores = relatorioJulgamentoDe(o)?.anexos ?? [];
  if (!limpo && anteriores.length === 0 && novosAnexos.length === 0) {
    throw new Error("Escreva o relatório ou anexe um documento antes de salvar.");
  }
  const autor = autorDe(sessao);
  const relatorio: RelatorioJulgamento = {
    texto: limpo,
    anexos: [...anteriores, ...novosAnexos],
    salvoPorNome: autor.autor_nome,
    salvoEm: new Date().toISOString(),
  };
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_RELATORIO_JULGAMENTO]: relatorio },
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Relatório do julgamento salvo",
      macro: "julgamento",
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario: "",
      anexos: novosAnexos,
    },
    loja,
  );
}

/**
 * Registra as partes do julgamento (cada uma procedente ou não-procedente).
 * O resultado geral (`procedencia`) é derivado delas. Quem já registrou pode
 * editar depois pela mesma rotina — a permissão de edição é checada na tela.
 */
export async function salvarItensJulgamento(
  o: Ocorrencia,
  itens: ItemJulgamento[],
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpos = itens.map((i) => ({
    ...i,
    descricao: i.descricao.trim(),
    justificativa: (i.justificativa ?? "").trim(),
  }));
  if (limpos.length === 0) throw new Error("Inclua ao menos uma parte no julgamento.");
  if (limpos.some((i) => !i.descricao)) throw new Error("Descreva cada parte do julgamento.");
  if (limpos.some((i) => i.descricao.length > LIMITE_TEXTO_OCORRENCIA)) {
    throw new Error(`Cada parte pode ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  const procedencia = procedenciaDosItens(limpos) as Exclude<ProcedenciaOcorrencia, "pendente">;
  const jaHavia = itensJulgamentoDe(o).length > 0;
  const autor = autorDe(sessao);
  await loja.atualizarOcorrencia(o.id, {
    procedencia,
    respostas: { ...o.respostas, [CHAVE_ITENS_JULGAMENTO]: limpos },
  });
  const resumo = limpos
    .map(
      (i) =>
        `${PROCEDENCIA_LABELS[i.procedencia]}: ${i.descricao}` +
        (i.justificativa ? ` — Motivo: ${i.justificativa}` : ""),
    )
    .join("\n");
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: jaHavia ? "Julgamento editado" : "Julgamento registrado",
      macro: "julgamento",
      subetapa: o.subetapaAtualNome,
      de: jaHavia ? PROCEDENCIA_LABELS[o.procedencia as Exclude<ProcedenciaOcorrencia, "pendente">] ?? "" : "",
      para: PROCEDENCIA_LABELS[procedencia],
      comentario: resumo,
      anexos: [],
    },
    loja,
  );
  await notificar(
    [
      {
        email: o.abertaPorEmail,
        nome: o.abertaPorNome,
        titulo: `Julgamento da ocorrência ${o.numero}`,
        mensagem: `O julgamento da sua não conformidade (${o.titulo}) foi registrado como ${PROCEDENCIA_LABELS[procedencia].toLowerCase()}.`,
      },
    ],
    autor,
    loja, o.id,
  ).catch(() => undefined);
}

/**
 * Acrescenta setores envolvidos à ocorrência (além dos marcados na abertura).
 * Setores já listados são ignorados. Cada setor novo passa a pedir ciência.
 */
export async function adicionarSetoresEnvolvidos(
  o: Ocorrencia,
  novos: string[],
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const atuais = setoresEnvolvidosDe(o);
  const incluir = [...new Set(novos.map((s) => s.trim()).filter(Boolean))].filter(
    (s) => !atuais.includes(s),
  );
  if (incluir.length === 0) {
    throw new Error("Escolha ao menos um setor que ainda não está na lista.");
  }
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_SETORES_ENVOLVIDOS]: [...atuais, ...incluir] },
  });
  await registrarHistorico(
    o.id,
    autorDe(sessao),
    {
      acao: "Setores envolvidos adicionados",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: incluir.join(", "),
      comentario: "",
      anexos: [],
    },
    loja,
  );
}

/** A Qualidade define (ou muda) a prioridade da ocorrência após a abertura. */
export async function definirPrioridade(
  o: Ocorrencia,
  prioridade: PrioridadeOcorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  if (o.prioridade === prioridade) return;
  await loja.atualizarOcorrencia(o.id, { prioridade });
  await registrarHistorico(
    o.id,
    autorDe(sessao),
    {
      acao: "Prioridade: " + PRIORIDADE_LABELS[prioridade],
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: PRIORIDADE_LABELS[o.prioridade],
      para: PRIORIDADE_LABELS[prioridade],
      comentario: "",
      anexos: [],
    },
    loja,
  );
}

/**
 * Marca a etapa atual como impedida: o prazo para de contar até a retomada.
 * Vale para qualquer etapa de uma ocorrência em andamento.
 */
export async function marcarImpedida(
  o: Ocorrencia,
  sessao: UserSession | null,
  motivo: string,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  if (o.status === "encerrada") throw new Error("A ocorrência já está encerrada.");
  if (o.impedidaEm) throw new Error("Esta etapa já está impedida.");
  const texto = motivo.trim();
  if (!texto) throw new Error("Informe o motivo do impedimento.");
  if (texto.length > LIMITE_TEXTO_OCORRENCIA) {
    throw new Error(`O motivo deve ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  const agora = new Date().toISOString();
  await loja.atualizarOcorrencia(o.id, { impedida_em: agora, impedida_motivo: texto });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Etapa impedida",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "Impedida",
      comentario: texto,
      anexos: [],
    },
    loja,
  );
}

/**
 * Retoma a etapa impedida: o tempo parado é somado ao prazo da etapa e à data
 * prevista da eficácia, para que o impedimento não consuma o prazo.
 */
export async function retomarImpedida(
  o: Ocorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  if (!o.impedidaEm) throw new Error("Esta etapa não está impedida.");
  const agora = new Date();
  const pausadoMs = agora.getTime() - new Date(o.impedidaEm).getTime();
  const diasPausados = Math.ceil(pausadoMs / 86_400_000);
  const patch: Rec = { impedida_em: null, impedida_motivo: "" };
  if (o.prazoEtapa) {
    const prazo = new Date(`${o.prazoEtapa}T12:00:00`);
    prazo.setDate(prazo.getDate() + diasPausados);
    const mes = String(prazo.getMonth() + 1).padStart(2, "0");
    const dia = String(prazo.getDate()).padStart(2, "0");
    patch["prazo_etapa"] = `${prazo.getFullYear()}-${mes}-${dia}`;
  }
  if (o.eficaciaPrevistaEm) {
    patch["eficacia_prevista_em"] = new Date(
      new Date(o.eficaciaPrevistaEm).getTime() + pausadoMs,
    ).toISOString();
  }
  await loja.atualizarOcorrencia(o.id, patch);
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Impedimento resolvido",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "Impedida",
      para: `Prazo retomado (+${diasPausados} dia(s))`,
      comentario: "",
      anexos: [],
    },
    loja,
  );
}

/** Puxa a ocorrência: a pessoa da Qualidade passa a responder por ela até o encerramento. */
export async function assumirOcorrencia(
  o: Ocorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  if (o.donoQualidadeEmail && o.donoQualidadeEmail !== autor.autor_email) {
    throw new Error(`Esta ocorrência já está com ${o.donoQualidadeNome || o.donoQualidadeEmail}.`);
  }
  await loja.atualizarOcorrencia(o.id, {
    dono_qualidade_id: autor.autor_id,
    dono_qualidade_nome: autor.autor_nome,
    dono_qualidade_email: autor.autor_email,
    dono_qualidade_em: new Date().toISOString(),
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Tratativa assumida",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: o.donoQualidadeNome,
      para: autor.autor_nome,
      comentario: "",
      anexos: [],
    },
    loja,
  );
}

/** Solta a tratativa para que outra pessoa da Qualidade possa puxá-la. */
export async function liberarOcorrencia(
  o: Ocorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  await loja.atualizarOcorrencia(o.id, {
    dono_qualidade_id: "",
    dono_qualidade_nome: "",
    dono_qualidade_email: "",
    dono_qualidade_em: null,
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Tratativa liberada",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: o.donoQualidadeNome,
      para: "",
      comentario: "",
      anexos: [],
    },
    loja,
  );
}

export const DESCONSIDERAR_MOTIVO_MIN = 20;
export const DESCONSIDERADA_CHAVE = "__desconsiderada";

/** Encerra a ocorrência como desconsiderada, registrando o motivo. */
export async function desconsiderarOcorrencia(
  o: Ocorrencia,
  etapas: MacroFluxo[],
  motivo: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpo = motivo.trim();
  if (limpo.length < DESCONSIDERAR_MOTIVO_MIN) {
    throw new Error(`O motivo deve ter ao menos ${DESCONSIDERAR_MOTIVO_MIN} caracteres.`);
  }
  const autor = autorDe(sessao);
  await loja.atualizarOcorrencia(o.id, {
    respostas: {
      ...o.respostas,
      [DESCONSIDERADA_CHAVE]: { motivo: limpo, em: new Date().toISOString() },
    },
  });
  await encerrar(o, etapas, autor, `Ocorrência desconsiderada: ${limpo}`, loja);
}

/** Resultados da etapa de Apuração (Qualidade): texto + evidências. */
/** Grava a lista de ações executadas (Eficácia) e registra a ação no histórico. */
export async function salvarAcoesExecutadas(
  o: Ocorrencia,
  lista: AcaoExecutada[],
  acao: string,
  comentario: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_ACOES_EXECUTADAS]: lista },
  });
  await registrarHistorico(
    o.id,
    autorDe(sessao),
    {
      acao,
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario,
      anexos: [],
    },
    loja,
  );
}

/** Registra o parecer final da Apuração (texto livre, com autor e data). */
export async function salvarParecerApuracao(
  o: Ocorrencia,
  texto: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Escreva o parecer final antes de salvar.");
  if (limpo.length > LIMITE_TEXTO_OCORRENCIA) {
    throw new Error(`O parecer pode ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  const autor = autorDe(sessao);
  const parecer: ParecerApuracao = {
    texto: limpo,
    salvoPorNome: autor.autor_nome,
    salvoEm: new Date().toISOString(),
  };
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_PARECER_APURACAO]: parecer },
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Parecer final da apuração registrado",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario: limpo,
      anexos: [],
    },
    loja,
  );
}

/** Grava a lista de evidências da Apuração e registra a ação no histórico. */
export async function salvarEvidencias(
  o: Ocorrencia,
  lista: EvidenciaApuracao[],
  acao: string,
  comentario: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_EVIDENCIAS]: lista },
  });
  await registrarHistorico(
    o.id,
    autorDe(sessao),
    {
      acao,
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario,
      anexos: [],
    },
    loja,
  );
}

/** Chave em `respostas` dos participantes do julgamento (marcados com @). */
export const CHAVE_PARTICIPANTES_JULGAMENTO = "__participantes_julgamento";

export interface ParticipanteJulgamento {
  id: string;
  nome: string;
  email?: string;
}

export function participantesJulgamentoDe(o: Pick<Ocorrencia, "respostas">): ParticipanteJulgamento[] {
  const v = o.respostas[CHAVE_PARTICIPANTES_JULGAMENTO];
  return Array.isArray(v) ? (v as ParticipanteJulgamento[]) : [];
}

/** Grava quem participou do julgamento e registra no histórico. */
export async function salvarParticipantesJulgamento(
  o: Ocorrencia,
  lista: ParticipanteJulgamento[],
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_PARTICIPANTES_JULGAMENTO]: lista },
  });
  await registrarHistorico(o.id, autorDe(sessao), {
    acao: "Participantes do julgamento",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: `${lista.length} participante(s)`,
    comentario: lista.map((p) => `@${p.nome}`).join(", "),
    anexos: [],
  }, loja);
}

/** Chaves em `respostas` do checklist "Gerou multa?" da Apuração. */
export const CHAVE_GEROU_MULTA = "gerou_multa";
export const CHAVE_MULTA_OCORRENCIA_ID = "multa_ocorrencia_id";
export const CHAVE_MULTA_OCORRENCIA_NUMERO = "multa_ocorrencia_numero";
export const LIMITE_PDFS_MULTA = 10;

export interface DadosMulta {
  areas: string[];
  responsavelProcesso: string;
  nomeEmpresa: string;
  declaracao: string;
  competencia: string;
  valor: string;
  descricao: string;
  pdfs: File[];
}

/** Checklist da Apuração: "Gerou multa? Não" (limpa qualquer marcação anterior). */
export async function registrarSemMulta(
  o: Ocorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, { respostas: { ...o.respostas, [CHAVE_GEROU_MULTA]: false } });
  await registrarHistorico(o.id, autorDe(sessao), {
    acao: "Checklist da apuração: não gerou multa",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: "Não",
    comentario: "",
    anexos: [],
  }, loja);
}

/**
 * Checklist da Apuração: "Gerou multa? Sim". Abre uma nova ocorrência do tipo
 * Multas (com o seu próprio trilho) ligada a esta, com os dados da multa e os PDFs.
 */
export async function gerarOcorrenciaMulta(
  o: Ocorrencia,
  dados: DadosMulta,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<Ocorrencia> {
  if (dados.areas.length === 0) throw new Error("Informe a área envolvida.");
  if (!dados.responsavelProcesso.trim()) throw new Error("Informe o responsável pelo processo.");
  if (!dados.nomeEmpresa.trim()) throw new Error("Informe o nome da empresa.");
  if (!dados.declaracao.trim()) throw new Error("Informe a declaração geradora da multa.");
  if (!dados.competencia.trim()) throw new Error("Informe a competência da multa.");
  if (!dados.valor.trim()) throw new Error("Informe o valor da multa.");
  if (!dados.descricao.trim()) throw new Error("Descreva o processo ocorrido.");
  if (dados.pdfs.length === 0) throw new Error("Anexe ao menos um PDF da multa.");
  if (dados.pdfs.length > LIMITE_PDFS_MULTA) throw new Error(`Máximo de ${LIMITE_PDFS_MULTA} PDFs.`);

  const tipos = await listarTipos();
  const tipo = tipos.find((t) => t.ativo && prefixoNumeroTipo(t) === "MT");
  if (!tipo) throw new Error('Tipo de ocorrência "Multas" não encontrado ou inativo.');
  const versoes = await carregarUltimasVersoes(tipo.id);

  const criada = await abrirOcorrencia(
    {
      tipo,
      formularioVersao: versoes.formularioVersao,
      fluxoVersao: versoes.fluxoVersao,
      titulo: `Multa — ${dados.nomeEmpresa.trim()} (${dados.competencia.trim()})`,
      respostas: {
        area_envolvida: dados.areas.join(", "),
        [CHAVE_SETORES_ENVOLVIDOS]: dados.areas,
        responsavel_processo: dados.responsavelProcesso.trim(),
        nome_empresa: dados.nomeEmpresa.trim(),
        declaracao_multa: dados.declaracao.trim(),
        competencia_multa: dados.competencia.trim(),
        valor_multa: dados.valor.trim(),
        descricao_processo: dados.descricao.trim(),
        ocorrencia_origem_id: o.id,
        ocorrencia_origem_numero: o.numero,
      },
    },
    sessao,
    loja,
  );
  await adicionarAnexosAbertura(criada, dados.pdfs, sessao);

  await loja.atualizarOcorrencia(o.id, {
    respostas: {
      ...o.respostas,
      [CHAVE_GEROU_MULTA]: true,
      [CHAVE_MULTA_OCORRENCIA_ID]: criada.id,
      [CHAVE_MULTA_OCORRENCIA_NUMERO]: criada.numero,
    },
  });
  await registrarHistorico(o.id, autorDe(sessao), {
    acao: "Checklist da apuração: gerou multa",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: `Multa ${criada.numero} aberta`,
    comentario: `${dados.nomeEmpresa.trim()} · competência ${dados.competencia.trim()} · ${dados.valor.trim()}`,
    anexos: [],
  }, loja);
  return criada;
}

/* -------------------------------------------------------------------------- */
/* Erro Operacional → Não Conformidade                                          */
/* -------------------------------------------------------------------------- */

export const CHAVE_ERRO_CARACTERIZA_NC = "erro_caracteriza_nc";
export const CHAVE_ERRO_NC_JUSTIFICATIVA = "erro_nc_justificativa";
export const CHAVE_ERRO_NC_OCORRENCIA_ID = "erro_nc_ocorrencia_id";
export const CHAVE_ERRO_NC_OCORRENCIA_NUMERO = "erro_nc_ocorrencia_numero";
/** Valor de "origem_nc" nas NCs abertas a partir de um Erro Operacional. */
export const ORIGEM_NC_ERRO_OPERACIONAL = "Erro Operacional";

/** Resposta de "Esse erro se caracteriza como uma Não-Conformidade?" quando a resposta é "Não". */
export async function registrarNaoCaracterizaErro(
  o: Ocorrencia,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  await loja.atualizarOcorrencia(o.id, {
    respostas: {
      ...o.respostas,
      [CHAVE_ERRO_CARACTERIZA_NC]: false,
      [CHAVE_ERRO_NC_JUSTIFICATIVA]: "",
    },
  });
  await registrarHistorico(o.id, autorDe(sessao), {
    acao: "Erro operacional: não caracterizado como Não-Conformidade",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: "Não",
    comentario: "",
    anexos: [],
  }, loja);
}

export interface DadosNaoConformidadeDoErro {
  /** Justificativa de por que o erro é uma Não-Conformidade. */
  justificativa: string;
  area: string;
  descricao: string;
  consequencia: string;
  sugestao: string;
  multa: boolean;
  assinouMulta: boolean;
  arquivos: File[];
}

/**
 * Abre uma Não Conformidade ligada a este Erro Operacional: a origem fica
 * como "Erro Operacional" e as duas ocorrências apontam uma para a outra.
 */
export async function gerarNaoConformidadeDoErro(
  o: Ocorrencia,
  dados: DadosNaoConformidadeDoErro,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<Ocorrencia> {
  const tipos = await listarTipos();
  const tipo = tipos.find((t) => t.ativo && ehTipoNaoConformidade(t));
  if (!tipo) throw new Error('Tipo de ocorrência "Não Conformidade" não encontrado ou inativo.');
  const versoes = await carregarUltimasVersoes(tipo.id);
  const descricao = dados.descricao.trim();
  const titulo = descricao.length > 80 ? `${descricao.slice(0, 80)}…` : descricao;

  const criada = await abrirOcorrencia(
    {
      tipo,
      formularioVersao: versoes.formularioVersao,
      fluxoVersao: versoes.fluxoVersao,
      titulo,
      respostas: {
        area_envolvida: dados.area.trim(),
        descricao_nc: descricao,
        consequencia: dados.consequencia.trim(),
        sugestao_solucao: dados.sugestao.trim(),
        gerou_multa: dados.multa,
        assinou_termo_multa: dados.assinouMulta,
        origem_nc: ORIGEM_NC_ERRO_OPERACIONAL,
        ocorrencia_origem_id: o.id,
        ocorrencia_origem_numero: o.numero,
        anexos: dados.arquivos.map((a) => ({ nome: a.name })),
      },
    },
    sessao,
    loja,
  );
  const final =
    dados.arquivos.length > 0 ? await adicionarAnexosAbertura(criada, dados.arquivos, sessao) : criada;

  const justificativa = dados.justificativa.trim();
  await loja.atualizarOcorrencia(o.id, {
    respostas: {
      ...o.respostas,
      [CHAVE_ERRO_CARACTERIZA_NC]: true,
      [CHAVE_ERRO_NC_JUSTIFICATIVA]: justificativa,
      [CHAVE_ERRO_NC_OCORRENCIA_ID]: criada.id,
      [CHAVE_ERRO_NC_OCORRENCIA_NUMERO]: criada.numero,
    },
  });
  await registrarHistorico(o.id, autorDe(sessao), {
    acao: "Erro operacional: Não Conformidade gerada",
    macro: o.macroAtual,
    subetapa: o.subetapaAtualNome,
    de: "",
    para: `NC ${criada.numero} aberta`,
    comentario: justificativa,
    anexos: [],
  }, loja);
  return final;
}

/** Ação registrada no histórico quando um retorno parcial é enviado ao solicitante. */
export const RETORNO_PARCIAL_ACAO = "Retorno parcial enviado ao solicitante";

/** Chave da versão antiga ("Resultados da Etapa"); mantida só para ler registros antigos. */
export const RESULTADOS_APURACAO_CHAVE = "__resultados_apuracao";

/**
 * Envia um retorno parcial a quem abriu a ocorrência. Não muda a etapa nem encerra:
 * fica registrado no histórico e avisa o solicitante pelo sino.
 */
export async function enviarRetornoParcial(
  o: Ocorrencia,
  texto: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Escreva o retorno antes de enviar.");
  if (limpo.length > LIMITE_TEXTO_OCORRENCIA) {
    throw new Error(`O retorno pode ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  const autor = autorDe(sessao);
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: RETORNO_PARCIAL_ACAO,
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario: limpo,
      anexos: [],
    },
    loja,
  );
  await notificar(
    [
      {
        email: o.abertaPorEmail,
        nome: o.abertaPorNome,
        titulo: `Retorno parcial sobre ${o.numero}`,
        mensagem: `${o.titulo} · ${limpo}`,
      },
    ],
    autor,
    loja, o.id,
  ).catch(() => undefined);
}

/**
 * Salva a ferramenta de apuração (Análise direta, 5 Porquês ou Ishikawa 6M).
 * Exige a causa raiz da ferramenta escolhida. Quem pode editar é decidido na tela
 * (Qualidade e Desenvolvedor do Sistema).
 */
export async function salvarFerramentaApuracao(
  o: Ocorrencia,
  apuracao: ApuracaoFerramentas,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpar = (t: string) => t.trim();
  const causa = limpar(causaRaizDaApuracao(apuracao));
  if (!causa) {
    throw new Error("Informe a causa raiz antes de salvar a apuração.");
  }
  const todosOsTextos = [
    apuracao.analiseDireta.texto,
    apuracao.analiseDireta.causaRaiz,
    apuracao.cincoPorques.causaRaiz,
    apuracao.ishikawa.causaRaiz,
    ...apuracao.cincoPorques.porques,
    apuracao.ishikawa.efeito,
    ...Object.values(apuracao.ishikawa.rotulos),
    ...Object.values(apuracao.ishikawa.causas).flat(),
  ];
  if (todosOsTextos.some((t) => t.trim().length > LIMITE_TEXTO_OCORRENCIA)) {
    throw new Error(`Cada campo da apuração pode ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  const autor = autorDe(sessao);
  const salvo: ApuracaoFerramentas = {
    metodo: apuracao.metodo,
    analiseDireta: {
      texto: limpar(apuracao.analiseDireta.texto),
      causaRaiz: limpar(apuracao.analiseDireta.causaRaiz),
    },
    cincoPorques: {
      porques: apuracao.cincoPorques.porques.map(limpar),
      causaRaiz: limpar(apuracao.cincoPorques.causaRaiz),
    },
    ishikawa: {
      efeito: limpar(apuracao.ishikawa.efeito) || EFEITO_ISHIKAWA_PADRAO,
      rotulos: Object.fromEntries(
        ISHIKAWA_CATEGORIAS.map((c) => [c.id, limpar(apuracao.ishikawa.rotulos[c.id] ?? "") || c.padrao]),
      ),
      causas: Object.fromEntries(
        ISHIKAWA_CATEGORIAS.map((c) => [
          c.id,
          (apuracao.ishikawa.causas[c.id] ?? []).map(limpar).filter(Boolean).slice(0, CAUSAS_ISHIKAWA_MAX),
        ]),
      ),
      causaRaiz: limpar(apuracao.ishikawa.causaRaiz),
    },
    salvoPorNome: autor.autor_nome,
    salvoEm: new Date().toISOString(),
  };
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [CHAVE_FERRAMENTA_APURACAO]: salvo },
  });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: `Apuração registrada (${FERRAMENTA_APURACAO_LABELS[salvo.metodo]})`,
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario: `Causa raiz: ${causa}`,
      anexos: [],
    },
    loja,
  );
}

/* -------------------------------------------------------------------------- */
/* Avaliação de eficácia                                                       */
/* -------------------------------------------------------------------------- */

export interface AvaliacaoInput {
  resultado: ResultadoEficacia;
  observacao: string;
  /** Anexos já enviados ao Storage (fotos, vídeos, documentos). */
  anexos?: AnexoOcorrencia[];
  /** Ocorrências (ex.: ANC-1252) agrupadas no novo plano quando não é eficaz. */
  agrupadas?: string[];
}

/** Chave em `respostas` das ocorrências agrupadas em cada plano de ação. */
export const CHAVE_AGRUPADAS_PLANO = "__agrupadas_plano";

/** Etapa de plano de ação do tipo (por nome); sem ela, volta para a Apuração. */
function etapaDoPlanoDeAcao(etapas: MacroFluxo[]): MacroFluxo | undefined {
  const plano = etapas.find((e) =>
    e.nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes("plano de acao"),
  );
  return plano ?? etapas.find((e) => e.macro === "apuracao") ?? etapas[0];
}

/**
 * Registra a avaliação de eficácia (houve reincidência?). Eficaz → encerra de
 * vez. Ineficaz → abre um novo ciclo, voltando para a etapa de plano de ação
 * (ou Apuração, se o tipo não tiver essa etapa), e avisa os envolvidos.
 */
export async function avaliarEficacia(
  o: Ocorrencia,
  etapas: MacroFluxo[],
  input: AvaliacaoInput,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  if (input.observacao.length > LIMITE_TEXTO_OCORRENCIA) {
    throw new Error(`A observação deve ter no máximo ${LIMITE_TEXTO_OCORRENCIA} caracteres.`);
  }
  if (!input.observacao.trim()) {
    throw new Error("Informe a justificativa do relatório de eficácia.");
  }
  if (o.impedidaEm) {
    throw new Error("Esta etapa está impedida. Retome-a antes de avaliar a eficácia.");
  }
  // Relatório de eficácia: registra o resultado e a justificativa, em qualquer caso.
  const eficaz = input.resultado === "eficaz";
  await loja.atualizarOcorrencia(o.id, {
    avaliacao: {
      prazoDias: o.eficaciaDias,
      verificacaoEm: new Date().toISOString(),
      resultado: input.resultado,
      eficaz: input.resultado === "impedida" ? null : eficaz,
      observacao: input.observacao,
      anexos: input.anexos ?? [],
    },
  });

  if (input.resultado === "impedida") {
    await marcarImpedida(o, sessao, input.observacao, loja);
    return;
  }

  await registrarHistorico(
    o.id,
    autor,
    {
      acao: eficaz ? "Avaliação de eficácia: eficaz" : "Avaliação de eficácia: não eficaz",
      macro: "avaliacao_eficacia",
      subetapa: "",
      de: "",
      para: eficaz ? "Encerrada" : `Novo ciclo (${o.reaberturas + 2})`,
      comentario: input.observacao,
      anexos: input.anexos ?? [],
    },
    loja,
  );

  if (eficaz) {
    if (o.status !== "encerrada") {
      await encerrar(o, etapas, autor, input.observacao || "Eficácia confirmada.", loja);
    }
    return;
  }

  // Novo ciclo: reincidência volta para o plano de ação como "Plano N" (exige novo retorno ao
  // cliente). Respostas, ações executadas e histórico continuam; agrupadas entram no plano.
  const { __retorno_cliente: _retorno, ...respostasCiclo } = o.respostas;
  void _retorno;
  const numeroPlano = o.reaberturas + 2;
  const agrupadas = (input.agrupadas ?? []).map((n) => n.trim()).filter(Boolean);
  if (agrupadas.length > 0) {
    const anteriores = Array.isArray(respostasCiclo[CHAVE_AGRUPADAS_PLANO])
      ? (respostasCiclo[CHAVE_AGRUPADAS_PLANO] as unknown[])
      : [];
    respostasCiclo[CHAVE_AGRUPADAS_PLANO] = [
      ...anteriores,
      { plano: numeroPlano, numeros: agrupadas, em: new Date().toISOString() },
    ];
  }
  await loja.atualizarOcorrencia(o.id, {
    respostas: respostasCiclo,
    status: "reaberta",
    reaberturas: o.reaberturas + 1,
    encerrada_em: null,
    eficacia_prevista_em: null,
  });
  const base: Ocorrencia = {
    ...o,
    reaberturas: o.reaberturas + 1,
    status: "reaberta",
    eficaciaPrevistaEm: null,
  };
  const destino = etapaDoPlanoDeAcao(etapas);
  const subPadrao = destino?.subetapas[0] ?? null;
  // A etapa passa a se chamar "Plano N" (Plano 2 na primeira reincidência).
  const subPlano = subPadrao ? { ...subPadrao, nome: `Plano ${numeroPlano}` } : null;
  const comentarioCiclo = [
    input.observacao || "A ação não resolveu o problema.",
    agrupadas.length > 0 ? `Agrupadas no Plano ${numeroPlano}: ${agrupadas.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  await entrarEm(
    base,
    etapas,
    destino?.macro ?? "apuracao",
    subPlano,
    autor,
    `Novo ciclo ${numeroPlano} (reincidência)`,
    comentarioCiclo,
    [],
    loja,
  );
}

/* -------------------------------------------------------------------------- */
/* Anexos (Storage — bucket de anexos do portal)                               */
/* -------------------------------------------------------------------------- */

const BUCKET = "pop-anexos";

export async function enviarAnexo(ocorrenciaId: string, arquivo: File): Promise<AnexoOcorrencia> {
  const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
  const caminho = `ocorrencias/${ocorrenciaId}/${Date.now()}.${(extensao ?? "bin").toLowerCase()}`;
  const { error } = await cloud().storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  });
  if (error) throw traduzErro(error);
  return {
    nome: arquivo.name,
    caminho,
    tipo: arquivo.type,
    tamanho: arquivo.size,
  };
}

/** Redimensiona a imagem no servidor (Supabase), para visualização mais leve. */
export interface OtimizacaoImagem {
  largura: number;
  qualidade: number;
}

export async function urlAssinada(
  caminho: string,
  otimizacao?: OtimizacaoImagem,
): Promise<string> {
  const { data, error } = await cloud()
    .storage.from(BUCKET)
    .createSignedUrl(
      caminho,
      60 * 5,
      otimizacao
        ? { transform: { width: otimizacao.largura, quality: otimizacao.qualidade } }
        : undefined,
    );
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível abrir o anexo.");
  return data.signedUrl;
}

/**
 * Exclui a ocorrência (Qualidade/administradores). Remove também os anexos do
 * Storage; o histórico é apagado em cascata pelo banco.
 */
export async function excluirOcorrencia(o: Ocorrencia): Promise<void> {
  try {
    const anexos = Array.isArray(o.respostas["anexos"])
      ? (o.respostas["anexos"] as AnexoOcorrencia[])
      : [];
    const caminhos = anexos.map((a) => a.caminho).filter(Boolean);
    if (caminhos.length > 0) {
      await cloud()
        .storage.from(BUCKET)
        .remove(caminhos as string[]);
    }
  } catch {
    /* storage indisponível: segue com a exclusão da linha */
  }
  const { error } = await cloud().from("ocorrencias").delete().eq("id", o.id);
  if (error) throw traduzErro(error);
}

/** Utilitário exportado para o Form Builder gerar ids de campos. */
export { idCurto };

/* -------------------------------------------------------------------------- */
/* Ciência dos setores envolvidos                                              */
/* -------------------------------------------------------------------------- */

/** O setor envolvido marca ciência da comunicação (a Qualidade pode marcar por ele). */
export async function registrarCiencia(
  o: Ocorrencia,
  setor: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  if (cienciasDe(o)[setor]) return;
  const respostas: Respostas = {
    ...o.respostas,
    [CHAVE_CIENCIAS]: {
      ...cienciasDe(o),
      [setor]: {
        setor,
        por: str(autor["autor_nome"]),
        email: str(autor["autor_email"]),
        em: new Date().toISOString(),
      },
    },
  };
  await loja.atualizarOcorrencia(o.id, { respostas });
  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Ciência do setor",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: setor,
      comentario: "",
      anexos: [],
    },
    loja,
  );
}
