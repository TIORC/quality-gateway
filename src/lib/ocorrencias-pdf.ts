/**
 * Ocorrências: relatório em PDF da lista que está na tela.
 *
 * Monta um HTML de impressão (mesmo padrão de `pesquisas-pdf.ts` e `projetos-pdf.ts`):
 * cabeçalho com sistema, data/hora da impressão e quem imprimiu; resumo com totais e
 * gráficos de barras; e uma seção por ocorrência com dados gerais, abertura, cada
 * etapa com o que foi apurado, histórico e pendências para ser considerada completa.
 * A caixa de impressão do navegador salva o arquivo como PDF.
 *
 * Os dados vêm das mesmas funções que a tela usa. Nada é enviado a outro serviço.
 */

import type { UserSession } from "@/lib/auth";
import { esc } from "@/lib/projetos-pdf";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import { listarPlanos } from "@/lib/planos-base";
import { STATUS_ACAO_LABELS as STATUS_PLANO_LABELS, type PlanoAcao } from "@/lib/planos";
import { listarHistoricoDe } from "@/lib/ocorrencias-base";
import {
  DESCONSIDERADA_CHAVE,
  carregarFluxoAtivo,
  carregarFormularioAtivo,
  participantesJulgamentoDe,
} from "@/lib/ocorrencias-crud";
import { podeExportarOcorrencias, podeVerInternos } from "@/lib/ocorrencias-permissoes";
import {
  ACAO_MENSAGEM_COMUNICACAO,
  FERRAMENTA_APURACAO_LABELS,
  ISHIKAWA_CATEGORIAS,
  MACRO_ETAPA_LABELS,
  PRIORIDADE_LABELS,
  PROCEDENCIA_LABELS,
  STATUS_ACAO_LABELS,
  STATUS_OCORRENCIA_LABELS,
  acoesExecutadasDe,
  apuracaoFerramentasDe,
  causaRaizDaApuracao,
  cienciasDe,
  evidenciasDe,
  fluxoDoTipo,
  formatarPrazo,
  itensJulgamentoDe,
  nomeEtapaDoFluxo,
  ocorrenciaAtrasada,
  parecerApuracaoDe,
  relatorioJulgamentoDe,
  setoresEnvolvidosDe,
  setoresSemCiencia,
  textoResposta,
  type AcaoExecutada,
  type AnexoOcorrencia,
  type CampoFormulario,
  type EventoOcorrencia,
  type MacroFluxo,
  type Ocorrencia,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";

const SISTEMA = "Gestão da Qualidade";
const COR_PADRAO = "#1E3A8A";

/** Eventos que o solicitante vê. Mesma regra do detalhe da ocorrência. */
const VISIVEIS_SOLICITANTE = [
  "criação",
  "comentário",
  "parecer",
  "encerramento",
  "atraso",
  "reabert",
  "escalad",
  "julgamento",
  "plano de ação",
];

export interface OpcoesRelatorioOcorrencias {
  /** Ocorrências da lista na tela, já filtradas. */
  ocorrencias: Ocorrencia[];
  tipos: TipoOcorrencia[];
  sessao: UserSession | null;
  /** Texto que descreve a aba e os filtros da tela (vai no cabeçalho). */
  visao: string;
}

type Situacao = "completa" | "incompleta" | "desconsiderada";

const ROTULO_SITUACAO: Record<Situacao, string> = {
  completa: "Completa",
  incompleta: "Incompleta",
  desconsiderada: "Desconsiderada",
};

const COR_SITUACAO: Record<Situacao, string> = {
  completa: "#059669",
  incompleta: "#E11D48",
  desconsiderada: "#94A3B8",
};

interface OcorrenciaRelatorio {
  o: Ocorrencia;
  tipo: TipoOcorrencia | undefined;
  fluxo: MacroFluxo[];
  campos: CampoFormulario[];
  eventos: EventoOcorrencia[];
  planos: PlanoAcao[];
  internos: boolean;
  desconsiderada: boolean;
  pendencias: string[];
}

interface Contagem {
  rotulo: string;
  valor: number;
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                  */
/* -------------------------------------------------------------------------- */

const txt = (v: unknown): string => esc(v === undefined || v === null ? "" : String(v));

const dataHora = (iso: string | null | undefined): string =>
  iso ? formatarDataHoraBrasilia(iso) : "—";

function vazio(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function memo<T>(
  cache: Map<string, Promise<T>>,
  chave: string,
  carregar: () => Promise<T>,
): Promise<T> {
  let existente = cache.get(chave);
  if (!existente) {
    existente = carregar();
    cache.set(chave, existente);
  }
  return existente;
}

function visivelParaSolicitante(acao: string): boolean {
  const normalizada = acao.toLowerCase();
  return VISIVEIS_SOLICITANTE.some((v) => normalizada.includes(v));
}

function anexosDe(v: unknown): AnexoOcorrencia[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (a): a is AnexoOcorrencia =>
      !!a && typeof a === "object" && typeof (a as { nome?: unknown }).nome === "string",
  );
}

function anexosHtml(anexos: AnexoOcorrencia[]): string {
  if (anexos.length === 0) return "—";
  return `<ul class="anexos">${anexos
    .map((a) => {
      const extra = [
        a.tipo ? txt(a.tipo) : "",
        a.tamanho ? `${Math.max(1, Math.round(a.tamanho / 1024))} KB` : "",
      ].filter(Boolean);
      return `<li>${txt(a.nome)}${extra.length ? ` <span class="meta">· ${extra.join(" · ")}</span>` : ""}</li>`;
    })
    .join("")}</ul>`;
}

function linhas(pares: [string, string][]): string {
  return `<table class="dados">${pares
    .map(([rotulo, valor]) => `<tr><th>${txt(rotulo)}</th><td>${valor}</td></tr>`)
    .join("")}</table>`;
}

function situacaoDe(r: OcorrenciaRelatorio): Situacao {
  if (r.desconsiderada) return "desconsiderada";
  return r.pendencias.length === 0 ? "completa" : "incompleta";
}

/* -------------------------------------------------------------------------- */
/* Completude                                                                  */
/* -------------------------------------------------------------------------- */

/** A resposta de um campo condicional só conta quando a condição vale. */
function campoAtivo(c: CampoFormulario, respostas: Record<string, unknown>): boolean {
  return !c.condicao || String(respostas[c.condicao.campoId] ?? "") === c.condicao.valor;
}

/**
 * Critério de completude. Uma ocorrência está COMPLETA quando está encerrada (e não
 * desconsiderada) e, para cada etapa do fluxo dela, o que é obrigatório foi registrado:
 * - abertura: campos obrigatórios do formulário respondidos;
 * - apuração: causa raiz (e parecer final, se o tipo exige);
 * - julgamento: relatório e ao menos uma parte julgada;
 * - plano de ação: ao menos uma ação (no módulo de Planos ou em ações executadas);
 * - comunicação: todos os setores envolvidos deram ciência;
 * - finalização: parecer final registrado;
 * - eficácia: avaliação registrada como eficaz.
 * As etapas são as do fluxo que a ocorrência seguiu (erro operacional tem só 3).
 */
function pendenciasDe(
  o: Ocorrencia,
  tipo: TipoOcorrencia | undefined,
  fluxo: MacroFluxo[],
  campos: CampoFormulario[],
  planos: PlanoAcao[],
): string[] {
  const pendencias: string[] = [];
  const temEtapa = (macro: string) => fluxo.some((e) => e.macro === macro);

  if (o.status !== "encerrada") {
    pendencias.push(
      `Ocorrência não encerrada (etapa atual: ${nomeEtapaDoFluxo(fluxo, o.macroAtual)})`,
    );
  }
  if (o.impedidaEm) pendencias.push("Etapa marcada como impedida");

  const faltando = campos
    .filter((c) => c.obrigatorio && campoAtivo(c, o.respostas) && vazio(o.respostas[c.id]))
    .map((c) => c.label);
  if (faltando.length)
    pendencias.push(`Campos obrigatórios da abertura sem resposta: ${faltando.join(", ")}`);

  if (temEtapa("apuracao")) {
    if (!causaRaizDaApuracao(apuracaoFerramentasDe(o)).trim()) {
      pendencias.push("Apuração sem causa raiz registrada");
    }
    if (tipo?.parecerApuracao && !parecerApuracaoDe(o)) {
      pendencias.push("Parecer final da apuração é obrigatório neste tipo e não foi registrado");
    }
  }

  if (temEtapa("julgamento")) {
    if (!relatorioJulgamentoDe(o)?.texto?.trim()) pendencias.push("Julgamento sem relatório");
    if (itensJulgamentoDe(o).length === 0) pendencias.push("Julgamento sem partes julgadas");
  }

  if (temEtapa("plano_acao") && planos.length === 0 && acoesExecutadasDe(o).length === 0) {
    pendencias.push("Plano de ação sem nenhuma ação registrada");
  }

  if (temEtapa("comunicacao")) {
    const semCiencia = setoresSemCiencia(o);
    if (semCiencia.length)
      pendencias.push(`Setores envolvidos sem ciência: ${semCiencia.join(", ")}`);
  }

  if (o.parecerFinal.trim() === "") pendencias.push("Parecer final não registrado");

  if (temEtapa("avaliacao_eficacia")) {
    const av = o.avaliacao;
    const eficaz = av ? (av.resultado ? av.resultado === "eficaz" : av.eficaz === true) : false;
    if (!eficaz) pendencias.push("Avaliação de eficácia não registrada como eficaz");
  }

  return pendencias;
}

/* -------------------------------------------------------------------------- */
/* Seções de cada ocorrência                                                   */
/* -------------------------------------------------------------------------- */

function empresaDe(o: Ocorrencia, campos: CampoFormulario[]): string {
  const multa = o.respostas["nome_empresa"];
  if (typeof multa === "string" && multa.trim()) return multa.trim();
  const campo = campos.find((c) => /empresa|loja/i.test(c.label));
  if (campo) {
    const texto = textoResposta(o.respostas[campo.id]);
    if (texto !== "—") return texto;
  }
  return "—";
}

function listaEventos(eventos: EventoOcorrencia[]): string {
  if (eventos.length === 0) return `<p class="vazio">Sem registros no histórico.</p>`;
  return `<ul class="eventos">${eventos
    .map(
      (ev) =>
        `<li><b>${dataHora(ev.createdAt)}</b> · ${txt(ev.acao)} · ${txt(ev.autorNome || "Sistema")}${
          ev.de || ev.para
            ? `<br><span class="meta">${txt(ev.de || "—")} → ${txt(ev.para || "—")}</span>`
            : ""
        }${ev.comentario ? `<br><span class="texto">${txt(ev.comentario)}</span>` : ""}${
          ev.anexos.length ? `<br>${anexosHtml(ev.anexos)}` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

function valorCampo(tipo: string, valor: unknown): string {
  if (tipo === "arquivo") return anexosHtml(anexosDe(valor));
  if (tipo === "moeda" && typeof valor === "number") {
    return txt(valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  }
  return vazio(valor) ? "—" : `<span class="texto">${txt(textoResposta(valor))}</span>`;
}

function aberturaHtml(r: OcorrenciaRelatorio): string {
  const { o, campos, internos } = r;
  let pares: [string, string][];
  if (campos.length > 0) {
    pares = campos
      .filter((c) => campoAtivo(c, o.respostas) || !vazio(o.respostas[c.id]))
      .map((c): [string, string] => [c.label, valorCampo(c.tipo, o.respostas[c.id])]);
  } else {
    // Sem formulário publicado na versão da ocorrência: mostra o que foi gravado na abertura.
    pares = Object.entries(o.respostas)
      .filter(([chave]) => !chave.startsWith("__"))
      .map(([chave, valor]): [string, string] => [chave, valorCampo("texto", valor)]);
  }
  const eventosAbertura = r.eventos.filter(
    (ev) => ev.macro === "abertura" && (internos || visivelParaSolicitante(ev.acao)),
  );
  const corpo = pares.length
    ? linhas(pares)
    : `<p class="vazio">Sem respostas registradas na abertura.</p>`;
  return `${corpo}<h4>Registros da abertura</h4>${listaEventos(eventosAbertura)}`;
}

function ferramentaApuracaoHtml(r: OcorrenciaRelatorio): string {
  const { o } = r;
  const f = apuracaoFerramentasDe(o);
  let detalhe = "";
  if (f.metodo === "analise_direta") {
    detalhe = f.analiseDireta.texto.trim()
      ? `<p class="texto">${txt(f.analiseDireta.texto)}</p>`
      : `<p class="vazio">Sem texto de análise registrado.</p>`;
  } else if (f.metodo === "cinco_porques") {
    const porques = f.cincoPorques.porques.filter((p) => p.trim());
    detalhe = porques.length
      ? `<ol>${porques.map((p) => `<li>${txt(p)}</li>`).join("")}</ol>`
      : `<p class="vazio">Nenhum porquê preenchido.</p>`;
  } else {
    const categorias = ISHIKAWA_CATEGORIAS.map((c) => {
      const causas = f.ishikawa.causas[c.id] ?? [];
      if (causas.length === 0) return "";
      return `<li><b>${txt(f.ishikawa.rotulos[c.id] ?? c.padrao)}:</b> ${causas.map((x) => txt(x)).join("; ")}</li>`;
    }).join("");
    detalhe = `<p>Efeito: ${txt(f.ishikawa.efeito) || "—"}</p>${categorias ? `<ul>${categorias}</ul>` : `<p class="vazio">Nenhuma causa preenchida.</p>`}`;
  }
  const causaRaiz = causaRaizDaApuracao(f).trim();
  return `${linhas([
    ["Ferramenta", txt(FERRAMENTA_APURACAO_LABELS[f.metodo])],
    [
      "Causa raiz",
      causaRaiz
        ? `<span class="texto">${txt(causaRaiz)}</span>`
        : '<span class="vazio">Não registrada</span>',
    ],
  ])}${detalhe}${f.salvoPorNome ? `<p class="meta">Último registro: ${txt(f.salvoPorNome)} · ${dataHora(f.salvoEm)}</p>` : ""}`;
}

function apuracaoHtml(r: OcorrenciaRelatorio): string {
  const { o, tipo } = r;
  let html = `<h4>Ferramenta de apuração</h4>${ferramentaApuracaoHtml(r)}`;

  const parecer = parecerApuracaoDe(o);
  html += `<h4>Parecer final da apuração</h4>`;
  html += parecer
    ? `<p class="texto">${txt(parecer.texto)}</p><p class="meta">Registrado por ${txt(parecer.salvoPorNome || "—")} · ${dataHora(parecer.salvoEm)}</p>`
    : tipo?.parecerApuracao
      ? `<p class="pendencia">Obrigatório neste tipo e não registrado.</p>`
      : `<p class="vazio">Não registrado.</p>`;

  const evidencias = evidenciasDe(o);
  html += `<h4>Evidências levantadas (${evidencias.length})</h4>`;
  html += evidencias.length
    ? `<table><thead><tr><th>O que é</th><th>O que comprova</th><th>Arquivo / vínculo</th></tr></thead><tbody>${evidencias
        .map(
          (e) =>
            `<tr><td>${txt(e.oQue)}</td><td>${txt(e.evidencia)}</td><td>${
              e.anexo ? txt(e.anexo.nome) : e.vinculo ? "Vínculo com outra ocorrência" : "—"
            }</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="vazio">Nenhuma evidência levantada.</p>`;
  return html;
}

function julgamentoHtml(r: OcorrenciaRelatorio): string {
  const { o } = r;
  const relatorio = relatorioJulgamentoDe(o);
  const itens = itensJulgamentoDe(o);
  const participantes = participantesJulgamentoDe(o);
  let html = linhas([
    ["Procedência", txt(PROCEDENCIA_LABELS[o.procedencia])],
    [
      "Participantes",
      participantes.length ? participantes.map((p) => txt(p.nome)).join(", ") : "—",
    ],
  ]);
  html += `<h4>Relatório do julgamento</h4>`;
  html += relatorio?.texto?.trim()
    ? `<p class="texto">${txt(relatorio.texto)}</p>${
        relatorio.anexos.length ? `<p class="meta">Anexos:</p>${anexosHtml(relatorio.anexos)}` : ""
      }<p class="meta">Salvo por ${txt(relatorio.salvoPorNome || "—")} · ${dataHora(relatorio.salvoEm)}</p>`
    : `<p class="pendencia">Relatório não registrado.</p>`;
  html += `<h4>Partes julgadas (${itens.length})</h4>`;
  html += itens.length
    ? `<table><thead><tr><th>Parte</th><th>Resultado</th><th>Justificativa</th></tr></thead><tbody>${itens
        .map(
          (i) =>
            `<tr><td>${txt(i.descricao)}</td><td>${i.procedencia === "procedente" ? "Procedente" : "Não-procedente"}</td><td>${txt(i.justificativa || "—")}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="pendencia">Nenhuma parte julgada.</p>`;
  return html;
}

function planoHtml(r: OcorrenciaRelatorio): string {
  if (r.planos.length === 0) {
    return `<p class="vazio">Nenhuma ação do módulo de Planos vinculada a esta ocorrência.</p>`;
  }
  return `<table><thead><tr><th>Código</th><th>Ação</th><th>Status</th><th>Responsável</th><th>Prazo</th><th>Progresso</th></tr></thead><tbody>${r.planos
    .map(
      (p) =>
        `<tr><td>${txt(p.codigo)}</td><td>${txt(p.titulo)}</td><td>${txt(STATUS_PLANO_LABELS[p.status])}</td><td>${txt(
          p.responsavelNome || "—",
        )}</td><td>${txt(formatarPrazo(p.prazo))}</td><td>${p.progresso}%</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function comunicacaoHtml(r: OcorrenciaRelatorio): string {
  const { o } = r;
  const setores = setoresEnvolvidosDe(o);
  const ciencias = cienciasDe(o);
  let html = `<p><b>Setores envolvidos:</b> ${setores.length ? setores.map((s) => txt(s)).join(", ") : "nenhum"}</p>`;
  if (setores.length) {
    html += `<table><thead><tr><th>Setor</th><th>Ciência registrada por</th><th>Em</th></tr></thead><tbody>${setores
      .map((s) => {
        const c = ciencias[s];
        return `<tr><td>${txt(s)}</td><td>${c ? txt(c.por) : `<span class="pendencia">Sem ciência</span>`}</td><td>${
          c ? dataHora(c.em) : "—"
        }</td></tr>`;
      })
      .join("")}</tbody></table>`;
  }
  const mensagens = r.eventos.filter((ev) => ev.acao === ACAO_MENSAGEM_COMUNICACAO);
  html += `<h4>Conversa da comunicação (${mensagens.length})</h4>`;
  html += mensagens.length
    ? `<ul class="eventos">${mensagens
        .map(
          (ev) =>
            `<li><b>${dataHora(ev.createdAt)}</b> · ${txt(ev.autorNome)}<br><span class="texto">${txt(ev.comentario)}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="vazio">Sem mensagens.</p>`;
  return html;
}

function resultadoEficacia(av: NonNullable<Ocorrencia["avaliacao"]>): string {
  if (av.resultado === "impedida") return "Impedida";
  if (av.resultado === "nao_eficaz" || av.eficaz === false) return "Não eficaz";
  if (av.resultado === "eficaz" || av.eficaz === true) return "Eficaz";
  return "Pendente";
}

function eficaciaHtml(r: OcorrenciaRelatorio): string {
  const { o } = r;
  const av = o.avaliacao;
  let html = av
    ? linhas([
        ["Resultado", txt(resultadoEficacia(av))],
        ["Verificação", av.verificacaoEm ? txt(formatarPrazo(av.verificacaoEm)) : "—"],
        ["Observação", av.observacao ? `<span class="texto">${txt(av.observacao)}</span>` : "—"],
        ["Anexos", anexosHtml(av.anexos)],
      ])
    : `<p class="pendencia">Avaliação de eficácia ainda não registrada.</p>`;
  const acoes: AcaoExecutada[] = acoesExecutadasDe(o);
  html += `<h4>Ações executadas (${acoes.length})</h4>`;
  html += acoes.length
    ? `<table><thead><tr><th>Ação</th><th>Área</th><th>Prazo</th><th>Status</th></tr></thead><tbody>${acoes
        .map(
          (a) =>
            `<tr><td>${txt(a.descricao)}</td><td>${txt(a.area || "—")}</td><td>${txt(formatarPrazo(a.prazo || null))}</td><td>${txt(
              STATUS_ACAO_LABELS[a.status],
            )}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="vazio">Nenhuma ação executada registrada.</p>`;
  return html;
}

function conteudoDaEtapa(r: OcorrenciaRelatorio, macro: string): string {
  switch (macro) {
    case "apuracao":
      return apuracaoHtml(r);
    case "julgamento":
      return julgamentoHtml(r);
    case "plano_acao":
      return planoHtml(r);
    case "comunicacao":
      return comunicacaoHtml(r);
    case "avaliacao_eficacia":
      return eficaciaHtml(r);
    default:
      return "";
  }
}

function etapaHtml(r: OcorrenciaRelatorio, etapa: MacroFluxo): string {
  const eventos = r.eventos.filter(
    (ev) => ev.macro === etapa.macro && ev.acao !== ACAO_MENSAGEM_COMUNICACAO,
  );
  const atual = r.o.macroAtual === etapa.macro ? " · etapa atual" : "";
  return `<div class="etapa"><h3>${txt(etapa.nome || MACRO_ETAPA_LABELS[etapa.macro] || etapa.macro)}${atual}</h3>${conteudoDaEtapa(
    r,
    etapa.macro,
  )}<h4>Histórico da etapa</h4>${listaEventos(eventos)}</div>`;
}

function completudeHtml(r: OcorrenciaRelatorio): string {
  if (r.desconsiderada) {
    return `<h3>Completude</h3><p>Ocorrência desconsiderada: o critério de completude não se aplica.</p>`;
  }
  if (r.pendencias.length === 0) {
    return `<h3>Completude</h3><p><b class="ok">Completa.</b> Encerrada, com todas as etapas obrigatórias registradas.</p>`;
  }
  return `<h3>Completude</h3><p><b class="pendencia">Incompleta.</b> Pendências:</p><ul class="pend">${r.pendencias
    .map((p) => `<li>${txt(p)}</li>`)
    .join("")}</ul>`;
}

function ocorrenciaHtml(r: OcorrenciaRelatorio): string {
  const { o, fluxo, internos } = r;
  const situacao = situacaoDe(r);
  const statusTexto = r.desconsiderada ? "Desconsiderada" : STATUS_OCORRENCIA_LABELS[o.status];
  const nomeEtapa = nomeEtapaDoFluxo(fluxo, o.macroAtual);
  // Sem repetir o nome da etapa quando a subetapa tem o mesmo nome (ex.: "Julgamento › Julgamento").
  const etapaTexto =
    o.subetapaAtualNome && o.subetapaAtualNome !== nomeEtapa
      ? `${nomeEtapa} › ${o.subetapaAtualNome}`
      : nomeEtapa;
  const prazo = o.prazoEtapa
    ? `${formatarPrazo(o.prazoEtapa)}${ocorrenciaAtrasada(o) ? ` <span class="pendencia">(atrasado)</span>` : ""}`
    : "—";
  const impedida = o.impedidaEm
    ? `<span class="pendencia">Impedida desde ${txt(formatarPrazo(o.impedidaEm.slice(0, 10)))}</span>${
        o.impedidaMotivo ? ` · ${txt(o.impedidaMotivo)}` : ""
      }`
    : "";

  const cabecalho = `<header class="ocor-cab"><div><span class="numero">${txt(o.numero)}</span><h2>${txt(
    o.titulo || "Sem título",
  )}</h2><p class="meta">${txt(o.tipoNome)}${o.reaberturas > 0 ? ` · Ciclo ${o.reaberturas + 1}` : ""}</p></div><span class="selo ${situacao}">${
    ROTULO_SITUACAO[situacao]
  }</span></header>`;

  const dadosGerais = linhas([
    ["Código", txt(o.numero)],
    ["Assunto", txt(o.titulo || "Sem título")],
    ["Tipo", txt(o.tipoNome)],
    ["Empresa", txt(empresaDe(o, r.campos))],
    ["Status", txt(statusTexto)],
    ["Procedência", txt(PROCEDENCIA_LABELS[o.procedencia])],
    ["Prioridade", txt(PRIORIDADE_LABELS[o.prioridade])],
    ["Etapa atual", txt(etapaTexto) + (impedida ? `<br>${impedida}` : "")],
    ["Prazo da etapa", prazo],
    ["Eficácia prevista", o.eficaciaPrevistaEm ? txt(formatarPrazo(o.eficaciaPrevistaEm)) : "—"],
    ["Aberta em", txt(dataHora(o.createdAt))],
    [
      "Aberta por",
      txt(`${o.abertaPorNome || "—"}${o.abertaPorSetor ? ` (${o.abertaPorSetor})` : ""}`),
    ],
    ["Setores envolvidos", txt(setoresEnvolvidosDe(o).join(", ") || "—")],
    ["Responsável", txt(o.responsavelNome || "A definir")],
    ["Tratativa da Qualidade", txt(o.donoQualidadeNome || "Ninguém assumiu ainda")],
    ["Encerrada em", o.encerradaEm ? txt(dataHora(o.encerradaEm)) : "—"],
  ]);

  let corpo: string;
  if (internos) {
    const macrosDoFluxo = new Set(fluxo.map((e) => e.macro));
    const outros = r.eventos.filter(
      (ev) =>
        !macrosDoFluxo.has(ev.macro) &&
        ev.macro !== "abertura" &&
        ev.acao !== ACAO_MENSAGEM_COMUNICACAO,
    );
    corpo = `${completudeHtml(r)}
      <h3>Dados da abertura</h3>${aberturaHtml(r)}
      <h3>Etapas e o que foi apurado</h3>
      ${fluxo
        .filter((e) => e.macro !== "abertura")
        .map((e) => etapaHtml(r, e))
        .join("")}
      ${outros.length ? `<h3>Outros registros</h3>${listaEventos(outros)}` : ""}`;
  } else {
    corpo = `<h3>Dados da abertura</h3>${aberturaHtml(r)}
      <h3>Histórico</h3>${listaEventos(r.eventos.filter((ev) => visivelParaSolicitante(ev.acao)))}`;
  }

  const parecerFinal = o.parecerFinal.trim()
    ? `<p class="texto">${txt(o.parecerFinal)}</p>${
        o.parecerEm ? `<p class="meta">Registrado em ${txt(formatarPrazo(o.parecerEm))}</p>` : ""
      }`
    : `<p class="vazio">Parecer final não registrado.</p>`;

  return `<section class="ocorrencia">${cabecalho}<h3>Dados gerais</h3>${dadosGerais}${corpo}<h3>Parecer final</h3>${parecerFinal}</section>`;
}

/* -------------------------------------------------------------------------- */
/* Resumo: totais e gráficos                                                   */
/* -------------------------------------------------------------------------- */

function contar(
  itens: OcorrenciaRelatorio[],
  chave: (r: OcorrenciaRelatorio) => string,
): Contagem[] {
  const mapa = new Map<string, number>();
  for (const r of itens) {
    const k = chave(r);
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function graficoBarras(
  titulo: string,
  dados: Contagem[],
  corDe?: (rotulo: string) => string,
): string {
  if (dados.length === 0)
    return `<div class="grafico"><h3>${txt(titulo)}</h3><p class="vazio">Sem dados.</p></div>`;
  const maior = Math.max(...dados.map((d) => d.valor));
  const soma = dados.reduce((s, d) => s + d.valor, 0);
  const barras = dados
    .map((d) => {
      const cor = corDe?.(d.rotulo) ?? COR_PADRAO;
      const pct = Math.round((d.valor / soma) * 100);
      return `<div class="barra"><span class="rot">${txt(d.rotulo)}</span><span class="trilho"><span class="preench" style="width:${(
        (d.valor / maior) *
        100
      ).toFixed(
        1,
      )}%;background:${cor}"></span></span><span class="num">${d.valor} · ${pct}%</span></div>`;
    })
    .join("");
  return `<div class="grafico"><h3>${txt(titulo)}</h3>${barras}</div>`;
}

function resumoHtml(
  itens: OcorrenciaRelatorio[],
  visao: string,
  sessao: UserSession | null,
  geradoEm: string,
): string {
  const total = itens.length;
  const emAndamento = itens.filter((r) => r.o.status !== "encerrada").length;
  const encerradas = itens.filter((r) => r.o.status === "encerrada" && !r.desconsiderada).length;
  const desconsideradas = itens.filter((r) => r.desconsiderada).length;
  const atrasadas = itens.filter((r) => ocorrenciaAtrasada(r.o)).length;
  const completas = itens.filter((r) => situacaoDe(r) === "completa").length;
  const incompletas = itens.filter((r) => situacaoDe(r) === "incompleta").length;

  const cartoes = [
    ["Ocorrências", total],
    ["Em andamento", emAndamento],
    ["Encerradas", encerradas],
    ["Desconsideradas", desconsideradas],
    ["Atrasadas", atrasadas],
    ["Completas", completas],
    ["Incompletas", incompletas],
  ] as const;

  const corSituacao = (rotulo: string) => {
    const par = Object.entries(ROTULO_SITUACAO).find(([, nome]) => nome === rotulo);
    return par ? COR_SITUACAO[par[0] as Situacao] : COR_PADRAO;
  };

  return `<header class="topo">
      <p class="kicker">${txt(SISTEMA)}</p>
      <h1>Relatório de ocorrências</h1>
      <dl class="impressao">
        <dt>Sistema</dt><dd>${txt(SISTEMA)}</dd>
        <dt>Impresso em</dt><dd>${txt(geradoEm)}</dd>
        <dt>Impresso por</dt><dd>${txt(sessao?.nome || "—")}${sessao?.email ? ` (${txt(sessao.email)})` : ""}</dd>
        <dt>Tela</dt><dd>${txt(visao)}</dd>
      </dl>
    </header>
    <div class="totais">${cartoes
      .map(
        ([rotulo, valor]) => `<div class="total"><span>${txt(rotulo)}</span><b>${valor}</b></div>`,
      )
      .join("")}</div>
    <p class="criterio"><b>Critério de completude:</b> a ocorrência é completa quando está encerrada (e não desconsiderada) e cada etapa do seu fluxo tem o registro obrigatório: abertura com campos obrigatórios, causa raiz na apuração, relatório e partes no julgamento, ação no plano, ciência dos setores envolvidos, parecer final e eficácia avaliada como eficaz.</p>
    <div class="graficos">
      ${graficoBarras(
        "Por status",
        contar(itens, (r) =>
          r.desconsiderada ? "Desconsiderada" : STATUS_OCORRENCIA_LABELS[r.o.status],
        ),
      )}
      ${graficoBarras(
        "Por completude",
        contar(itens, (r) => ROTULO_SITUACAO[situacaoDe(r)]),
        corSituacao,
      )}
      ${graficoBarras(
        "Por tipo",
        contar(itens, (r) => r.o.tipoNome || "Sem tipo"),
      )}
      ${graficoBarras(
        "Por etapa atual",
        contar(itens, (r) => nomeEtapaDoFluxo(r.fluxo, r.o.macroAtual)),
      )}
      ${graficoBarras(
        "Por prioridade",
        contar(itens, (r) => PRIORIDADE_LABELS[r.o.prioridade]),
      )}
      ${graficoBarras(
        "Por setor de abertura",
        contar(itens, (r) => r.o.abertaPorSetor || "Sem setor"),
      )}
    </div>`;
}

/* -------------------------------------------------------------------------- */
/* Montagem                                                                    */
/* -------------------------------------------------------------------------- */

const CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2937; font-size: 11px; margin: 0; }
  h1 { font-size: 20px; margin: 2px 0 0; }
  h2 { font-size: 15px; margin: 2px 0 0; color: #1F2937; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #1E3A8A; border-bottom: 1px solid #E9EEF5; padding-bottom: 3px; margin: 12px 0 6px; break-after: avoid; }
  h4 { font-size: 11px; color: #334155; margin: 10px 0 4px; break-after: avoid; }
  .topo { background: #1E3A8A; color: #fff; border-radius: 8px; padding: 14px 16px; }
  .kicker { margin: 0; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; opacity: .85; }
  .impressao { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 10px 0 0; font-size: 11px; }
  .impressao dt { opacity: .8; }
  .impressao dd { margin: 0; }
  .totais { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 12px 0; }
  .total { border: 1px solid #D9E0EA; border-radius: 6px; padding: 6px; text-align: center; }
  .total span { display: block; font-size: 9px; text-transform: uppercase; color: #64748B; }
  .total b { display: block; font-size: 16px; color: #1E3A8A; margin-top: 2px; }
  .criterio { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; color: #334155; }
  .graficos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .grafico { break-inside: avoid; }
  .grafico h3 { margin-top: 4px; }
  .barra { display: grid; grid-template-columns: 150px 1fr 80px; gap: 6px; align-items: center; margin: 4px 0; }
  .rot { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trilho { display: block; height: 9px; background: #EEF2F7; border-radius: 4px; overflow: hidden; }
  .preench { display: block; height: 100%; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  section.ocorrencia { break-before: page; }
  .ocor-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #1E3A8A; padding-bottom: 6px; }
  .numero { font-family: "Courier New", monospace; color: #1E3A8A; font-weight: bold; font-size: 12px; }
  .selo { border-radius: 999px; padding: 3px 10px; font-size: 10px; font-weight: bold; color: #fff; white-space: nowrap; }
  .selo.completa { background: #059669; }
  .selo.incompleta { background: #E11D48; }
  .selo.desconsiderada { background: #94A3B8; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  th, td { border: 1px solid #D9E0EA; padding: 4px 6px; text-align: left; vertical-align: top; }
  thead th { background: #F1F5F9; font-size: 10px; text-transform: uppercase; color: #475569; }
  table.dados th { width: 26%; background: #F8FAFC; font-weight: bold; color: #334155; }
  .etapa { margin-top: 4px; }
  .texto { white-space: pre-wrap; }
  .meta { color: #64748B; font-size: 10px; margin: 2px 0; }
  .vazio { color: #94A3B8; font-style: italic; margin: 3px 0; }
  .pendencia { color: #B91C1C; margin: 3px 0; }
  .ok { color: #047857; }
  ul, ol { margin: 3px 0 3px 18px; padding: 0; }
  li { margin: 2px 0; }
  ul.eventos { list-style: none; margin: 0; padding: 0; }
  ul.eventos li { border-bottom: 1px dotted #E2E8F0; padding: 4px 0; }
  ul.pend li { color: #B91C1C; }
  ul.anexos { margin: 2px 0 2px 14px; }
  .rodape { margin-top: 14px; color: #94A3B8; font-size: 10px; border-top: 1px solid #E9EEF5; padding-top: 6px; }
  h3, h4, table, tr, .ocor-cab { break-inside: avoid; }
`;

/**
 * Monta o HTML do relatório (carrega fluxo, formulário, histórico e planos das
 * ocorrências). Quem chama abre a janela e imprime.
 */
export async function montarRelatorioOcorrenciasHtml(
  opcoes: OpcoesRelatorioOcorrencias,
): Promise<string> {
  const { ocorrencias, tipos, sessao, visao } = opcoes;
  if (!podeExportarOcorrencias(sessao)) {
    throw new Error("Você não tem permissão para exportar o PDF das ocorrências.");
  }

  const [historico, planos] = await Promise.all([
    listarHistoricoDe(ocorrencias.map((o) => o.id)),
    listarPlanos(),
  ]);

  const historicoPorOcorrencia = new Map<string, EventoOcorrencia[]>();
  for (const ev of historico) {
    const lista = historicoPorOcorrencia.get(ev.ocorrenciaId) ?? [];
    lista.push(ev);
    historicoPorOcorrencia.set(ev.ocorrenciaId, lista);
  }
  const planosPorOcorrencia = new Map<string, PlanoAcao[]>();
  for (const p of planos) {
    if (p.vinculoTipo !== "ocorrencia") continue;
    const lista = planosPorOcorrencia.get(p.vinculoId) ?? [];
    lista.push(p);
    planosPorOcorrencia.set(p.vinculoId, lista);
  }

  // Fluxo e formulário são os publicados na versão travada em cada ocorrência (com cache).
  const cacheFluxo = new Map<string, Promise<MacroFluxo[]>>();
  const cacheFormulario = new Map<string, Promise<CampoFormulario[]>>();

  const itens: OcorrenciaRelatorio[] = [];
  for (const o of ocorrencias) {
    const tipo = tipos.find((t) => t.id === o.tipoId);
    const fluxoPublicado = await memo(cacheFluxo, `${o.tipoId}|${o.fluxoVersao}`, () =>
      carregarFluxoAtivo(o.tipoId, o.fluxoVersao),
    );
    const campos = await memo(cacheFormulario, `${o.tipoId}|${o.formularioVersao}`, () =>
      carregarFormularioAtivo(o.tipoId, o.formularioVersao),
    );
    const fluxo = fluxoDoTipo({ nome: o.tipoNome }, fluxoPublicado);
    const planosDaOcorrencia = planosPorOcorrencia.get(o.id) ?? [];
    itens.push({
      o,
      tipo,
      fluxo,
      campos,
      eventos: historicoPorOcorrencia.get(o.id) ?? [],
      planos: planosDaOcorrencia,
      internos: podeVerInternos(sessao, o),
      desconsiderada: o.respostas[DESCONSIDERADA_CHAVE] !== undefined,
      pendencias: pendenciasDe(o, tipo, fluxo, campos, planosDaOcorrencia),
    });
  }

  const agora = new Date();
  const geradoEm = formatarDataHoraBrasilia(agora);
  const corpoOcorrencias =
    itens.length === 0
      ? `<p class="vazio">Nenhuma ocorrência nesta tela.</p>`
      : itens.map((r) => ocorrenciaHtml(r)).join("");

  const corpo = `${resumoHtml(itens, visao, sessao, geradoEm)}${corpoOcorrencias}
    <p class="rodape">${txt(SISTEMA)} · relatório gerado em ${txt(geradoEm)} · ${itens.length} ocorrência(s)</p>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório de ocorrências · ${txt(SISTEMA)}</title><style>${CSS}</style></head><body>${corpo}<script>window.onload = () => window.print();</script></body></html>`;
}
