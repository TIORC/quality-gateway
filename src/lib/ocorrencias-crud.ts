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
  cienciasDe,
  setoresSemCiencia,
  PROCEDENCIA_LABELS,
  PRIORIDADE_LABELS,
  type PrioridadeOcorrencia,
  SETOR_RESPONSAVEL_OCORRENCIAS,
  calcularPrazoEtapa,
  fluxoVazio,
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
  return escolhida?.etapas ?? fluxoVazio();
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
    etapas: fluxo?.etapas ?? fluxoVazio(),
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
        autor,
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
      loja,
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
  // Retorno ao solicitante: inclui o resultado da apuração, quando registrado.
  const resultadosApuracao = (
    o.respostas[RESULTADOS_APURACAO_CHAVE] as { texto?: string } | undefined
  )?.texto?.trim();
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
    loja,
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

  // Fechamento: o parecer final é obrigatório e define a data da avaliação de eficácia.
  const saindoDoFechamento =
    payload.acao === "aprovar" && macroAtual === "fechamento" && proxima?.macro !== "fechamento";
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
      loja,
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
        saindoDoFechamento ? "Fechamento com parecer final" : "Aprovação",
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
      loja,
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
      loja,
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
    autor,
  ).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Julgamento (procedência)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Registra a decisão do julgamento: procedente ou não-procedente. Essa é a
 * informação que o solicitante acompanha em tempo real junto ao status.
 */
export async function decidirProcedencia(
  o: Ocorrencia,
  procedencia: Exclude<ProcedenciaOcorrencia, "pendente">,
  comentario: string,
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const autor = autorDe(sessao);
  await loja.atualizarOcorrencia(o.id, { procedencia });

  await registrarHistorico(
    o.id,
    autor,
    {
      acao: "Julgamento: " + PROCEDENCIA_LABELS[procedencia],
      macro: "julgamento",
      subetapa: o.subetapaAtualNome,
      de: "",
      para: PROCEDENCIA_LABELS[procedencia],
      comentario,
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
        mensagem: `Sua não conformidade foi considerada ${PROCEDENCIA_LABELS[procedencia].toLowerCase()} (${o.titulo}).`,
      },
    ],
    autor,
    loja,
  ).catch(() => undefined);
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
export const RESULTADOS_APURACAO_CHAVE = "__resultados_apuracao";
export const RESULTADOS_APURACAO_MIN = 100;
export const RESULTADOS_APURACAO_MAX = 12000;

export async function salvarResultadosApuracao(
  o: Ocorrencia,
  texto: string,
  anexos: AnexoOcorrencia[],
  sessao: UserSession | null,
  loja: LojaOcorrencias = lojaSupabase,
): Promise<void> {
  const limpo = texto.trim();
  if (limpo.length < RESULTADOS_APURACAO_MIN) {
    throw new Error(`Os resultados devem ter ao menos ${RESULTADOS_APURACAO_MIN} caracteres.`);
  }
  if (limpo.length > RESULTADOS_APURACAO_MAX) {
    throw new Error(`Os resultados podem ter no máximo ${RESULTADOS_APURACAO_MAX} caracteres.`);
  }
  await loja.atualizarOcorrencia(o.id, {
    respostas: { ...o.respostas, [RESULTADOS_APURACAO_CHAVE]: { texto: limpo, anexos } },
  });
  await registrarHistorico(
    o.id,
    autorDe(sessao),
    {
      acao: "Resultados da apuração registrados",
      macro: o.macroAtual,
      subetapa: o.subetapaAtualNome,
      de: "",
      para: "",
      comentario: "",
      anexos,
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
}

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

  // Novo ciclo: reincidência volta para o plano de ação (e exige novo retorno ao cliente).
  const { __retorno_cliente: _retorno, ...respostasCiclo } = o.respostas;
  void _retorno;
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
  await entrarEm(
    base,
    etapas,
    destino?.macro ?? "apuracao",
    destino?.subetapas[0] ?? null,
    autor,
    `Novo ciclo ${o.reaberturas + 2} (reincidência)`,
    input.observacao || "A ação não resolveu o problema.",
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

export async function urlAssinada(caminho: string): Promise<string> {
  const { data, error } = await cloud()
    .storage.from(BUCKET)
    .createSignedUrl(caminho, 60 * 5);
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
