/**
 * Ocorrências — domínio, constantes e helpers.
 *
 * Etapas (a "linha do metrô") são configuradas por tipo de ocorrência em
 * "Configurar": nome, SLA e etapas extras. As etapas padrão (Abertura,
 * Apuração, Julgamento, Comunicação, Fechamento, Avaliação de Eficácia) mantêm
 * ids fixos, porque as regras de Apuração, Julgamento e Eficácia dependem
 * deles. Dentro de cada etapa o tipo pode ter subetapas próprias (fluxo).
 */
import {
  AlertTriangle,
  FileWarning,
  Flame,
  GitBranch,
  HardHat,
  MessageSquareWarning,
  OctagonAlert,
  PackageX,
  ShieldAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { hojeISO } from "@/lib/planos";

/** Ícones disponíveis para tipos de ocorrência (string → componente lucide). */
export const ICONES_OCORRENCIA: Record<string, LucideIcon> = {
  AlertTriangle,
  MessageSquareWarning,
  OctagonAlert,
  GitBranch,
  HardHat,
  ShieldAlert,
  FileWarning,
  PackageX,
  Flame,
  UserX,
};

/** Resolve o componente do ícone informado (fallback: AlertTriangle). */
export function iconeTipoOcorrencia(nome: string | null | undefined): LucideIcon {
  return ICONES_OCORRENCIA[nome ?? ""] ?? AlertTriangle;
}

export const MACRO_ETAPAS = [
  "abertura",
  "apuracao",
  "julgamento",
  "plano_acao",
  "implementacao",
  "comunicacao",
  "fechamento",
  "avaliacao_eficacia",
] as const;

/**
 * Linha do metrô padrão. Julgamento só entra para Reclamação de Cliente e Multa
 * (ver `etapasDoTipo`); os demais tipos seguem com as 6 etapas restantes.
 */
const ETAPAS_PADRAO_IDS = [
  "abertura",
  "apuracao",
  "julgamento",
  "comunicacao",
  "plano_acao",
  "implementacao",
  "avaliacao_eficacia",
] as const;

/** Etapa removida do fluxo: a Finalização foi absorvida pelo plano de ação (parecer final). */
const ETAPA_REMOVIDA = "fechamento";

/** Id de uma etapa do tipo (padrão ou criada no Configurar). */
export type MacroEtapa = string;

/** Ids das etapas padrão, com regra própria no fluxo. */
/** Etapa obrigatória de retorno ao cliente (criada pelo tipo que a exige). */
export const ETAPA_RETORNO_CLIENTE = "retorno_cliente";

export const ETAPAS_FIXAS: readonly string[] = [...MACRO_ETAPAS, ETAPA_RETORNO_CLIENTE];

/** Nomes padrão (fallback para ids sem configuração). */
export const MACRO_ETAPA_LABELS: Record<string, string> = {
  abertura: "Abertura",
  apuracao: "Apuração",
  julgamento: "Julgamento",
  plano_acao: "Plano de ação",
  implementacao: "Implementação",
  comunicacao: "Comunicação",
  fechamento: "Finalização",
  avaliacao_eficacia: "Eficácia",
};

export const MACRO_ETAPA_DESCRICAO: Partial<Record<MacroEtapa, string>> = {
  abertura: "Registro inicial da ocorrência via formulário.",
  apuracao: "Investigação, coleta de evidências e causa raiz (5 Porquês, Ishikawa).",
  julgamento: "Decisão sobre procedência, gravidade e responsabilização.",
  comunicacao: "Notificação às partes envolvidas e áreas afetadas sobre a decisão e plano de ação.",
  fechamento: "Execução das ações corretivas e encerramento formal.",
  avaliacao_eficacia:
    "Verificação posterior (30/60/90 dias) se a ação resolveu o problema. Reabre automática se ineficaz.",
};

export type StatusOcorrencia = "em_andamento" | "encerrada" | "reaberta";

export const STATUS_OCORRENCIA_LABELS: Record<StatusOcorrencia, string> = {
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  reaberta: "Reaberta",
};

/** Resultado do julgamento da ocorrência (visível ao solicitante). */
export type ProcedenciaOcorrencia =
  | "pendente"
  | "procedente"
  | "parcialmente_procedente"
  | "nao_procedente";

export const PROCEDENCIA_LABELS: Record<ProcedenciaOcorrencia, string> = {
  pendente: "Em análise",
  procedente: "Procedente",
  parcialmente_procedente: "Parcialmente Procedente",
  nao_procedente: "Não-procedente",
};

/** Prioridade da ocorrência, definida pela Qualidade após a abertura. */
export type PrioridadeOcorrencia = "a_definir" | "baixa" | "media" | "alta";

export const PRIORIDADES_OCORRENCIA: readonly PrioridadeOcorrencia[] = [
  "a_definir",
  "baixa",
  "media",
  "alta",
];

export const PRIORIDADE_LABELS: Record<PrioridadeOcorrencia, string> = {
  a_definir: "A definir",
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

/** Ações permitidas em uma etapa. */
export const ACOES_ETAPA = ["aprovar", "reprovar", "solicitar_info", "escalar"] as const;
export type AcaoEtapa = (typeof ACOES_ETAPA)[number];

export const ACOES_ETAPA_LABELS: Record<AcaoEtapa, string> = {
  aprovar: "Aprovar",
  reprovar: "Reprovar",
  solicitar_info: "Solicitar mais informação",
  escalar: "Escalar",
};

/* -------------------------------------------------------------------------- */
/* Formulários (schema)                                                        */
/* -------------------------------------------------------------------------- */

export const TIPOS_CAMPO = [
  "texto",
  "textarea",
  "select",
  "multi",
  "lista",
  "arquivo",
  "data",
  "numero",
  "assinatura",
  "responsavel",
  "checkbox",
  "moeda",
  "escala",
  "setores",
] as const;

export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const TIPO_CAMPO_LABELS: Record<TipoCampo, string> = {
  texto: "Resposta curta",
  textarea: "Parágrafo",
  numero: "Número",
  data: "Data",
  select: "Múltipla escolha",
  multi: "Caixas de seleção",
  lista: "Lista suspensa",
  arquivo: "Upload de arquivo",
  assinatura: "Assinatura",
  responsavel: "Setor/Responsável",
  checkbox: "Confirmação (sim/não)",
  moeda: "Valor em reais",
  escala: "Escala de 1 a 5",
  setores: "Setores envolvidos",
};

/** Máximo de telas no formulário de abertura. */
export const MAX_TELAS = 5;

export interface CampoFormulario {
  id: string;
  tipo: TipoCampo;
  label: string;
  placeholder?: string;
  obrigatorio: boolean;
  opcoes?: string[];
  regex?: string;
  min?: number | null;
  max?: number | null;
  /** "inteira" (1 coluna) ou "metade" (2 colunas). */
  largura?: "inteira" | "metade";
  /** Tela do formulário de abertura (índice a partir de 0). Ausente = tela 1. */
  tela?: number;
  /** Mostrar somente quando o campo `campoId` responder `valor`. */
  condicao?: { campoId: string; valor: string } | null;
}

export type Respostas = Record<string, unknown>;

export interface AnexoOcorrencia {
  nome: string;
  caminho: string;
  tipo?: string;
  tamanho?: number;
}

/* -------------------------------------------------------------------------- */
/* Fluxo                                                                       */
/* -------------------------------------------------------------------------- */

export type ResponsavelTipo = "pessoa" | "cargo" | "setor";

export interface ResponsavelEtapa {
  tipo: ResponsavelTipo;
  id: string;
  nome: string;
  email?: string;
}

export interface SubetapaFluxo {
  id: string;
  nome: string;
  responsavel: ResponsavelEtapa;
  prazoDias: number;
  acoes: AcaoEtapa[];
  campos: CampoFormulario[];
  notificar: boolean;
  /** Ao reprovar: "voltar" (etapa anterior) ou "encerrar". */
  reprovarPara: "voltar" | "encerrar";
}

export interface MacroFluxo {
  macro: MacroEtapa;
  /** Nome exibido da etapa (vem do tipo no momento da publicação). */
  nome: string;
  subetapas: SubetapaFluxo[];
}

/**
 * Setor responsável por TODA ocorrência aberta no portal, qualquer que seja
 * o tipo (Reclamação, NC, Desvio, Acidente…). A Qualidade recebe, tria e
 * delega pelo fluxo/histórico — por isso a abertura e cada movimentação da
 * linha do metrô assumem este setor como responsável atual.
 */
export const SETOR_RESPONSAVEL_OCORRENCIAS = "Qualidade";

/** Etapa configurada no tipo: id, nome e SLA em dias. */
export interface EtapaTipo {
  id: string;
  nome: string;
  slaDias: number;
}

/** Etapas padrão da linha do metrô, com SLA inicial de 5 dias. */
export function etapasPadrao(): EtapaTipo[] {
  return ETAPAS_PADRAO_IDS.map((id) => ({ id, nome: MACRO_ETAPA_LABELS[id] ?? id, slaDias: 5 }));
}

/**
 * Julgamento só existe para Reclamação de Cliente e Multa (7 etapas). Os demais
 * tipos seguem com 6 etapas, sem julgamento.
 */
export function tipoTemJulgamento(
  tipo: { nome?: string; temJulgamento?: boolean | null } | null | undefined,
): boolean {
  // Configuração explícita do tipo vale primeiro; sem ela, a regra pelo nome.
  if (typeof tipo?.temJulgamento === "boolean") return tipo.temJulgamento;
  if (!tipo?.nome) return true;
  const normalizado = tipo.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return normalizado.includes("reclamacao") || normalizado.includes("multa");
}

/** Etapas do tipo na ordem configurada (sem configuração: as padrão). */
export function etapasDoTipo(
  tipo: { etapas?: EtapaTipo[]; nome?: string } | null | undefined,
): EtapaTipo[] {
  const etapas = etapasComPlanoAcao(tipo?.etapas?.length ? tipo.etapas : etapasPadrao());
  return tipoTemJulgamento(tipo) ? etapas : etapas.filter((e) => e.id !== "julgamento");
}

export function nomeEtapaDoTipo(tipo: { etapas?: EtapaTipo[] } | null | undefined, id: string) {
  return etapasDoTipo(tipo).find((e) => e.id === id)?.nome ?? MACRO_ETAPA_LABELS[id] ?? id;
}

export function nomeEtapaDoFluxo(etapas: MacroFluxo[], id: string): string {
  return etapas.find((e) => e.macro === id)?.nome ?? MACRO_ETAPA_LABELS[id] ?? id;
}

export function slaDaEtapa(tipo: { etapas?: EtapaTipo[] }, id: string): number | undefined {
  return etapasDoTipo(tipo).find((e) => e.id === id)?.slaDias;
}

export function fluxoVazio(etapas: EtapaTipo[] = etapasPadrao()): MacroFluxo[] {
  return etapas.map((e) => ({ macro: e.id, nome: e.nome, subetapas: [] }));
}

/**
 * Todo fluxo tem a etapa de plano de ação, logo após a Comunicação (ou, se o
 * tipo não tiver Comunicação, após o Julgamento ou a Apuração). Vale também para
 * tipos e ocorrências criadas antes dessa regra.
 */
function posicaoDoPlanoAcao(ids: string[]): number {
  for (const ref of ["comunicacao", "julgamento", "apuracao"]) {
    const i = ids.indexOf(ref);
    if (i >= 0) return i + 1;
  }
  const eficacia = ids.indexOf("avaliacao_eficacia");
  return eficacia >= 0 ? eficacia : ids.length;
}

/**
 * Normaliza as etapas do tipo: remove a Finalização (fechamento) e garante o
 * plano de ação logo após a Comunicação (ou Julgamento/Apuração, se faltar).
 */
export function etapasComPlanoAcao(etapas: EtapaTipo[]): EtapaTipo[] {
  const semFinalizacao = etapas.filter((e) => e.id !== ETAPA_REMOVIDA);
  if (semFinalizacao.some((e) => e.id === "plano_acao")) return semFinalizacao;
  const copia = [...semFinalizacao];
  copia.splice(posicaoDoPlanoAcao(semFinalizacao.map((e) => e.id)), 0, {
    id: "plano_acao",
    nome: MACRO_ETAPA_LABELS.plano_acao ?? "Plano de ação",
    slaDias: 5,
  });
  return copia;
}

/** Mesma normalização de `etapasComPlanoAcao`, para o fluxo publicado. */
export function fluxoComPlanoAcao(fluxo: MacroFluxo[]): MacroFluxo[] {
  const semFinalizacao = fluxo.filter((e) => e.macro !== ETAPA_REMOVIDA);
  if (semFinalizacao.some((e) => e.macro === "plano_acao")) return semFinalizacao;
  const copia = [...semFinalizacao];
  copia.splice(posicaoDoPlanoAcao(semFinalizacao.map((e) => e.macro)), 0, {
    macro: "plano_acao",
    nome: MACRO_ETAPA_LABELS.plano_acao ?? "Plano de ação",
    subetapas: [],
  });
  return copia;
}

/** Subetapa automática de uma etapa: sob a Qualidade, com o SLA da etapa. */
function subetapaPadrao(e: EtapaTipo): SubetapaFluxo {
  return {
    id: `${e.id}-padrao`,
    nome: e.nome,
    responsavel: { tipo: "setor", id: "", nome: SETOR_RESPONSAVEL_OCORRENCIAS },
    prazoDias: e.slaDias,
    acoes: e.id === "abertura" ? ["aprovar"] : ["aprovar", "reprovar", "solicitar_info"],
    campos: [],
    notificar: true,
    reprovarPara: "voltar",
  };
}

export function fluxoDefault(tipo: TipoOcorrencia): MacroFluxo[] {
  // Fluxo mínimo: 1 subetapa por etapa sob responsabilidade da Qualidade
  // (regra do portal: toda ocorrência é da Qualidade), herdando o SLA do tipo.
  return etapasDoTipo(tipo).map((e) => ({ macro: e.id, nome: e.nome, subetapas: [subetapaPadrao(e)] }));
}

/**
 * Alinha um fluxo publicado às etapas atuais do tipo: nomes e SLA vêm do
 * tipo; subetapas personalizadas são mantidas; a automática acompanha o SLA.
 */
export function alinharFluxoAoTipo(tipo: TipoOcorrencia, fluxo: MacroFluxo[]): MacroFluxo[] {
  return etapasDoTipo(tipo).map((e) => {
    const existente = fluxo.find((f) => f.macro === e.id);
    const subetapas = existente
      ? existente.subetapas.map((s) =>
          s.id === `${e.id}-padrao` ? { ...s, nome: e.nome, prazoDias: e.slaDias } : s,
        )
      : [subetapaPadrao(e)];
    return { macro: e.id, nome: e.nome, subetapas };
  });
}

/* -------------------------------------------------------------------------- */
/* Tipos de ocorrência e ocorrência                                            */
/* -------------------------------------------------------------------------- */

export interface TipoOcorrencia {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  setorPadrao: string;
  /** Etapas do tipo, na ordem da linha do metrô. */
  etapas: EtapaTipo[];
  /** Dias após o fechamento para avaliar a eficácia (30, 60 ou 90). */
  eficaciaDias: number;
  /** Exige a etapa obrigatória de retorno ao cliente (não pode ser pulada). */
  retornoCliente: boolean;
  /** Exige o parecer final ao concluir a Apuração. */
  parecerApuracao: boolean;
  /** Sigla do número (ex.: "NC"). Vazia = sigla padrão pelo nome do tipo. */
  sigla: string;
  /** Tem etapa de julgamento. Nulo = regra padrão pelo nome do tipo. */
  temJulgamento: boolean | null;
  /** Permite anexar arquivos nos comentários e evidências. */
  permiteAnexos: boolean;
  /** Link externo exibido no detalhe da ocorrência. Vazio = sem link. */
  linkExterno: string;
  /** Dono padrão da Qualidade atribuído a toda ocorrência nova deste tipo. */
  donoPadraoId: string;
  donoPadraoNome: string;
  donoPadraoEmail: string;
  ativo: boolean;
  ordem: number;
}

export const PRAZOS_EFICACIA = [30, 60] as const;

/** Limite de caracteres para observações, justificativas e motivos de impedimento. */
export const LIMITE_TEXTO_OCORRENCIA = 12000;

/** Resultado da avaliação de eficácia: eficaz encerra; não eficaz reabre; impedida para o prazo. */
export type ResultadoEficacia = "eficaz" | "nao_eficaz" | "impedida";

/**
 * O tipo "Não Conformidade" tem formulário de abertura fixo (área envolvida,
 * descrição, consequência, sugestão, gerou multa e anexos), independente do
 * formulário publicado no Form Builder.
 */
export function ehTipoNaoConformidade(
  tipo: Pick<TipoOcorrencia, "nome"> | null | undefined,
): boolean {
  const normalizado = (tipo?.nome ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, " ");
  return normalizado.includes("nao conformidade");
}

export interface AvaliacaoEficacia {
  prazoDias: number;
  verificacaoEm: string | null;
  /** Resultado do relatório de eficácia (Eficaz, Não eficaz ou Impedida). */
  resultado: ResultadoEficacia | null;
  eficaz: boolean | null;
  observacao: string;
  /** Fotos, vídeos e documentos anexados à justificativa do relatório. */
  anexos: AnexoOcorrencia[];
}

export interface Ocorrencia {
  id: string;
  numero: string;
  titulo: string;
  tipoId: string;
  tipoNome: string;
  tipoCor: string;
  procedencia: ProcedenciaOcorrencia;
  prioridade: PrioridadeOcorrencia;
  formularioVersao: number;
  fluxoVersao: number;
  respostas: Respostas;
  macroAtual: MacroEtapa;
  subetapaAtualId: string;
  subetapaAtualNome: string;
  status: StatusOcorrencia;
  abertaPorId: string;
  abertaPorNome: string;
  abertaPorEmail: string;
  abertaPorSetor: string;
  responsavelId: string;
  responsavelNome: string;
  responsavelEmail: string;
  /** Pessoa da Qualidade que assumiu a tratativa (vazio = ninguém assumiu ainda). */
  donoQualidadeId: string;
  donoQualidadeNome: string;
  donoQualidadeEmail: string;
  prazoEtapa: string | null;
  etapaEntrouEm: string;
  avaliacao: AvaliacaoEficacia | null;
  /** Prazo de eficácia do tipo, copiado na abertura. */
  eficaciaDias: number;
  /** Parecer final registrado no fechamento. */
  parecerFinal: string;
  parecerEm: string | null;
  /** Data prevista da avaliação de eficácia (fechamento + eficaciaDias). */
  eficaciaPrevistaEm: string | null;
  reaberturas: number;
  /** Quando a etapa foi marcada como impedida (o prazo fica parado). Nulo = não impedida. */
  impedidaEm: string | null;
  impedidaMotivo: string;
  encerradaEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormularioVersao {
  id: string;
  tipoId: string;
  versao: number;
  campos: CampoFormulario[];
  /** Títulos das telas (vazio = uma tela só). */
  telas: string[];
  publicada: boolean;
  criadoPorNome: string;
  criadoPorEmail: string;
  createdAt: string;
}

export interface FluxoVersao {
  id: string;
  tipoId: string;
  versao: number;
  etapas: MacroFluxo[];
  publicada: boolean;
  criadoPorNome: string;
  criadoPorEmail: string;
  createdAt: string;
}

export interface EventoOcorrencia {
  id: string;
  ocorrenciaId: string;
  autorId: string;
  autorNome: string;
  autorEmail: string;
  acao: string;
  macro: string;
  subetapa: string;
  de: string;
  para: string;
  comentario: string;
  anexos: AnexoOcorrencia[];
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function idCurto(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Título curto da ocorrência: a resposta do campo "titulo"; se o formulário não tem esse
 * campo, a primeira resposta curta preenchida; se nada foi preenchido, o nome do tipo.
 */
export function tituloDaOcorrencia(
  campos: CampoFormulario[],
  respostas: Respostas,
  nomeTipo: string,
): string {
  const explicito = String(respostas["titulo"] ?? "").trim();
  if (explicito) return explicito;
  const primeiroTexto = campos.find(
    (c) => c.tipo === "texto" && String(respostas[c.id] ?? "").trim() !== "",
  );
  if (primeiroTexto) return String(respostas[primeiroTexto.id]).trim();
  return nomeTipo;
}

/**
 * Prefixo do número da ocorrência, conforme o tipo: NC (Não Conformidade),
 * RC (Reclamação de Cliente), MT (Multas), EO (Erro Operacional),
 * OM (Oportunidade de Melhoria). Tipos criados depois usam "OC".
 */
export function prefixoNumeroTipo(
  tipo: Pick<TipoOcorrencia, "nome"> & { sigla?: string } | null | undefined,
): string {
  const siglaConfigurada = (tipo?.sigla ?? "").trim().toUpperCase();
  if (siglaConfigurada) return siglaConfigurada;
  const normalizado = (tipo?.nome ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (normalizado.includes("nao conformidade")) return "NC";
  if (normalizado.includes("reclamacao")) return "RC";
  if (normalizado.includes("multa")) return "MT";
  if (normalizado.includes("erro")) return "EO";
  if (normalizado.includes("oportunidade")) return "OM";
  return "OC";
}

/** Próximo número do tipo no ano: `NC-2026-001`, `NC-2026-002` e assim por diante. */
export function proximoNumero(ocorrencias: Ocorrencia[], prefixo: string): string {
  const ano = new Date().getFullYear();
  let max = 0;
  for (const o of ocorrencias) {
    const m = new RegExp(`^${prefixo}-(\\d{4})-(\\d+)$`).exec(o.numero);
    if (!m) continue;
    const anoM = m[1];
    const numM = m[2];
    if (anoM === undefined || numM === undefined) continue;
    if (Number(anoM) === ano) max = Math.max(max, Number(numM));
  }
  return `${prefixo}-${ano}-${String(max + 1).padStart(3, "0")}`;
}

/** Data (ISO dia) em que o prazo da etapa atual estoura. */
export function calcularPrazoEtapa(dias: number | undefined): string | null {
  const n = Number(dias);
  if (!n || n <= 0) return null;
  const base = new Date(`${hojeISO()}T12:00:00`);
  base.setDate(base.getDate() + Math.round(n));
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/** Dias restantes até o prazo (negativo = estourado). */
export function diasParaPrazo(prazo: string | null): number | null {
  if (!prazo) return null;
  const base = new Date(`${hojeISO()}T12:00:00`);
  const alvo = new Date(`${prazo}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

export function ocorrenciaAtrasada(o: Ocorrencia): boolean {
  if (o.status === "encerrada" || o.impedidaEm) return false;
  const dias = diasParaPrazo(o.prazoEtapa);
  return dias !== null && dias < 0;
}

export function formatarPrazo(prazo: string | null): string {
  if (!prazo) return "—";
  const partes = prazo.split("-");
  const a = partes[0];
  const m = partes[1];
  const d = partes[2];
  return d && m && a ? `${d}/${m}/${a}` : prazo;
}

export function rotuloRelativoPrazo(prazo: string | null): string {
  const dias = diasParaPrazo(prazo);
  if (dias === null) return "Sem prazo";
  if (dias === 0) return "Vence hoje";
  if (dias < 0) return `Atrasado há ${Math.abs(dias)}d`;
  return `Faltam ${dias}d`;
}

/** Subetapas "achatadas" na ordem do fluxo (para navegar de/para). */
export function ordenarSubetapas(
  etapas: MacroFluxo[],
): { macro: MacroEtapa; subetapa: SubetapaFluxo }[] {
  const lista: { macro: MacroEtapa; subetapa: SubetapaFluxo }[] = [];
  for (const e of etapas) {
    for (const s of e.subetapas) lista.push({ macro: e.macro, subetapa: s });
  }
  return lista;
}

export function subetapaDe(
  etapas: MacroFluxo[],
  macro: MacroEtapa,
  subetapaId: string,
): SubetapaFluxo | null {
  const e = etapas.find((x) => x.macro === macro);
  if (!e) return null;
  return e.subetapas.find((s) => s.id === subetapaId) ?? e.subetapas[0] ?? null;
}

/** Responsável em texto legível (pessoa / cargo / setor). */
export function rotuloResponsavel(r: ResponsavelEtapa): string {
  if (!r || (!r.nome && !r.email)) return "A definir";
  const sufixo = r.tipo === "setor" ? "" : r.tipo === "cargo" ? " (cargo)" : "";
  return `${r.nome || "—"}${sufixo}`;
}

/** Texto que resume a resposta de um campo (para resumo/preview). */
export function textoResposta(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return v
      .map((i) =>
        typeof i === "object" && i && "nome" in i ? String((i as AnexoOcorrencia).nome) : String(i),
      )
      .join(", ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return typeof o["nome"] === "string" ? o["nome"] : "—";
  }
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

/** Progresso geral (0–100): posição atual do fluxo sobre o total de etapas. */
export function progressoOcorrencia(
  o: Pick<Ocorrencia, "macroAtual" | "subetapaAtualId" | "status">,
  etapas: MacroFluxo[],
): number {
  if (o.status === "encerrada") return 100;
  // Etapas sem subetapas também contam (ex.: Eficácia), com id vazio.
  const posicoes = etapas.flatMap((e) =>
    e.subetapas.length > 0
      ? e.subetapas.map((s) => ({ macro: e.macro, id: s.id }))
      : [{ macro: e.macro, id: "" }],
  );
  const total = posicoes.length;
  if (total === 0) return 0;
  let idx = posicoes.findIndex((p) => p.macro === o.macroAtual && p.id === o.subetapaAtualId);
  if (idx < 0) idx = posicoes.findIndex((p) => p.macro === o.macroAtual);
  return Math.round(((idx < 0 ? 0 : idx) / total) * 100);
}

/* -------------------------------------------------------------------------- */
/* Setores envolvidos e ciência                                                */
/* -------------------------------------------------------------------------- */

export const CHAVE_SETORES_ENVOLVIDOS = "__setores_envolvidos";
export const CHAVE_CIENCIAS = "__ciencias";

export interface CienciaSetor {
  setor: string;
  por: string;
  email: string;
  em: string;
}

/** Setores marcados nos campos "Setores envolvidos" do formulário de abertura. */
export function setoresDoFormulario(campos: CampoFormulario[], respostas: Respostas): string[] {
  const setores = new Set<string>();
  for (const c of campos) {
    if (c.tipo !== "setores") continue;
    const v = respostas[c.id];
    if (Array.isArray(v)) for (const s of v) if (typeof s === "string" && s) setores.add(s);
  }
  return [...setores];
}

export function setoresEnvolvidosDe(o: Pick<Ocorrencia, "respostas">): string[] {
  const v = o.respostas[CHAVE_SETORES_ENVOLVIDOS];
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

export function cienciasDe(o: Pick<Ocorrencia, "respostas">): Record<string, CienciaSetor> {
  const v = o.respostas[CHAVE_CIENCIAS];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, CienciaSetor>) : {};
}

/** Setores envolvidos que ainda não marcaram ciência. */
export function setoresSemCiencia(o: Pick<Ocorrencia, "respostas">): string[] {
  const feitas = cienciasDe(o);
  return setoresEnvolvidosDe(o).filter((s) => !feitas[s]);
}

/* -------------------------------------------------------------------------- */
/* Ferramentas de apuração (Análise direta, 5 Porquês, Ishikawa 6M)            */
/* -------------------------------------------------------------------------- */

/** Chave em `respostas` onde fica a apuração da ocorrência. */
export const CHAVE_FERRAMENTA_APURACAO = "__ferramenta_apuracao";

export const FERRAMENTAS_APURACAO = ["analise_direta", "cinco_porques", "ishikawa"] as const;
export type FerramentaApuracao = (typeof FERRAMENTAS_APURACAO)[number];

export const FERRAMENTA_APURACAO_LABELS: Record<FerramentaApuracao, string> = {
  analise_direta: "Análise direta",
  cinco_porques: "5 Porquês",
  ishikawa: "Ishikawa (6M)",
};

/** Os 6 Ms do diagrama de Ishikawa. */
/**
 * Categorias do Ishikawa, com id estável (o nome pode ser editado no diagrama).
 * `lado` define se a categoria fica em cima ou embaixo da espinha.
 */
export const ISHIKAWA_CATEGORIAS = [
  { id: "metodo", padrao: "Método", lado: "topo" },
  { id: "mao_de_obra", padrao: "Mão de obra", lado: "topo" },
  { id: "material", padrao: "Material", lado: "topo" },
  { id: "medicao", padrao: "Medição", lado: "base" },
  { id: "meio_ambiente", padrao: "Meio ambiente", lado: "base" },
  { id: "maquina", padrao: "Máquina", lado: "base" },
] as const;

/** Máximo de causas por categoria no diagrama. */
export const CAUSAS_ISHIKAWA_MAX = 4;

/** Problema da cabeça do peixe começa vazio (o campo mostra "Problema" como dica). */
export const EFEITO_ISHIKAWA_PADRAO = "";

export interface IshikawaApuracao {
  /** Texto da cabeça do peixe (o efeito/problema). */
  efeito: string;
  /** Nome exibido de cada categoria, por id. */
  rotulos: Record<string, string>;
  /** Causas de cada categoria, por id (uma por item). */
  causas: Record<string, string[]>;
  causaRaiz: string;
}

/** Quantidade de "Por quê" antes da causa raiz no 5 Porquês. */
export const PORQUES_QTD = 4;

export interface ApuracaoFerramentas {
  /** Ferramenta escolhida pela Qualidade para esta apuração. */
  metodo: FerramentaApuracao;
  analiseDireta: { texto: string; causaRaiz: string };
  cincoPorques: { porques: string[]; causaRaiz: string };
  ishikawa: IshikawaApuracao;
  /** Quem salvou por último e quando (preenchido ao salvar). */
  salvoPorNome: string;
  salvoEm: string | null;
}

export function ishikawaVazio(): IshikawaApuracao {
  return {
    efeito: EFEITO_ISHIKAWA_PADRAO,
    rotulos: Object.fromEntries(ISHIKAWA_CATEGORIAS.map((c) => [c.id, c.padrao])),
    causas: Object.fromEntries(ISHIKAWA_CATEGORIAS.map((c) => [c.id, [] as string[]])),
    causaRaiz: "",
  };
}

/**
 * Normaliza o Ishikawa salvo. Aceita o formato antigo (causas por nome da categoria,
 * em texto com uma causa por linha) e completa o que faltar com o padrão.
 */
function normalizarIshikawa(raw: unknown): IshikawaApuracao {
  const base = ishikawaVazio();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as {
    efeito?: unknown;
    rotulos?: Record<string, unknown>;
    causas?: Record<string, unknown>;
    causaRaiz?: unknown;
  };
  const rotulos: Record<string, string> = {};
  const causas: Record<string, string[]> = {};
  for (const c of ISHIKAWA_CATEGORIAS) {
    const nome = r.rotulos?.[c.id];
    rotulos[c.id] = typeof nome === "string" && nome.trim() ? nome : c.padrao;
    const v = r.causas?.[c.id] ?? r.causas?.[c.padrao];
    const itens: unknown[] = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
    causas[c.id] = itens
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, CAUSAS_ISHIKAWA_MAX);
  }
  return {
    // "EFEITO" era o texto fixo da versão anterior; não é um problema digitado.
    efeito:
      typeof r.efeito === "string" && r.efeito.trim() && r.efeito.trim() !== "EFEITO"
        ? r.efeito
        : base.efeito,
    rotulos,
    causas,
    causaRaiz: typeof r.causaRaiz === "string" ? r.causaRaiz : "",
  };
}

export function apuracaoFerramentasVazia(): ApuracaoFerramentas {
  return {
    metodo: "analise_direta",
    analiseDireta: { texto: "", causaRaiz: "" },
    cincoPorques: { porques: Array.from({ length: PORQUES_QTD }, () => ""), causaRaiz: "" },
    ishikawa: ishikawaVazio(),
    salvoPorNome: "",
    salvoEm: null,
  };
}

/** Apuração salva da ocorrência, completando campos ausentes com o padrão. */
export function apuracaoFerramentasDe(o: Pick<Ocorrencia, "respostas">): ApuracaoFerramentas {
  const base = apuracaoFerramentasVazia();
  const salvo = o.respostas[CHAVE_FERRAMENTA_APURACAO] as Partial<ApuracaoFerramentas> | undefined;
  if (!salvo || typeof salvo !== "object") return base;
  return {
    ...base,
    ...salvo,
    analiseDireta: { ...base.analiseDireta, ...salvo.analiseDireta },
    cincoPorques: {
      porques: Array.from({ length: PORQUES_QTD }, (_, i) => salvo.cincoPorques?.porques?.[i] ?? ""),
      causaRaiz: salvo.cincoPorques?.causaRaiz ?? "",
    },
    ishikawa: normalizarIshikawa(salvo.ishikawa),
  };
}

/** Causa raiz da ferramenta escolhida (é o que libera a saída da Apuração). */
export function causaRaizDaApuracao(f: ApuracaoFerramentas): string {
  if (f.metodo === "cinco_porques") return f.cincoPorques.causaRaiz;
  if (f.metodo === "ishikawa") return f.ishikawa.causaRaiz;
  return f.analiseDireta.causaRaiz;
}

/* -------------------------------------------------------------------------- */
/* Evidências levantadas (Apuração)                                            */
/* -------------------------------------------------------------------------- */

/** Chave em `respostas` onde ficam as evidências levantadas na Apuração. */
export const CHAVE_EVIDENCIAS = "__evidencias_apuracao";

export interface EvidenciaApuracao {
  id: string;
  /** O que é (ex.: e-mail do cliente, print do fluxo, ocorrências relacionadas). */
  oQue: string;
  /** O que a evidência comprova. */
  evidencia: string;
  /** Arquivo anexado, quando houver. */
  anexo: AnexoOcorrencia | null;
  /** Vínculo com outra(s) ocorrência(s), sem arquivo. */
  vinculo: boolean;
  criadoEm: string;
}

export function evidenciasDe(o: Pick<Ocorrencia, "respostas">): EvidenciaApuracao[] {
  const v = o.respostas[CHAVE_EVIDENCIAS];
  return Array.isArray(v) ? (v as EvidenciaApuracao[]) : [];
}

/* -------------------------------------------------------------------------- */
/* Ações executadas (Eficácia)                                                  */
/* -------------------------------------------------------------------------- */

/** Chave em `respostas` das ações executadas para resolver a ocorrência. */
export const CHAVE_ACOES_EXECUTADAS = "__acoes_executadas";

export const STATUS_ACAO = ["pendente", "em_andamento", "pausada", "concluida"] as const;
export type StatusAcao = (typeof STATUS_ACAO)[number];

export const STATUS_ACAO_LABELS: Record<StatusAcao, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

export interface AcaoExecutada {
  id: string;
  descricao: string;
  /** Área responsável pela ação (ex.: Qualidade, Contábil). */
  area: string;
  /** Prazo no formato AAAA-MM-DD, ou vazio. */
  prazo: string;
  status: StatusAcao;
  criadoEm: string;
}

export function acoesExecutadasDe(o: Pick<Ocorrencia, "respostas">): AcaoExecutada[] {
  const v = o.respostas[CHAVE_ACOES_EXECUTADAS];
  return Array.isArray(v) ? (v as AcaoExecutada[]) : [];
}

/** Chave em `respostas` do parecer final registrado ao concluir a Apuração. */
export const CHAVE_PARECER_APURACAO = "__parecer_apuracao";

export interface ParecerApuracao {
  texto: string;
  salvoPorNome: string;
  salvoEm: string;
}

export function parecerApuracaoDe(o: Pick<Ocorrencia, "respostas">): ParecerApuracao | null {
  const v = o.respostas[CHAVE_PARECER_APURACAO] as ParecerApuracao | undefined;
  return v && typeof v.texto === "string" ? v : null;
}

/* -------------------------------------------------------------------------- */
/* Julgamento: relatório e partes procedentes / não procedentes                */
/* -------------------------------------------------------------------------- */

/** Limite do relatório do julgamento (bem maior que o texto comum). */
export const LIMITE_RELATORIO_JULGAMENTO = 50000;

/** Chave em `respostas` do relatório escrito pelo responsável no julgamento. */
export const CHAVE_RELATORIO_JULGAMENTO = "__relatorio_julgamento";

export interface RelatorioJulgamento {
  texto: string;
  anexos: AnexoOcorrencia[];
  salvoPorNome: string;
  salvoEm: string;
}

export function relatorioJulgamentoDe(o: Pick<Ocorrencia, "respostas">): RelatorioJulgamento | null {
  const v = o.respostas[CHAVE_RELATORIO_JULGAMENTO] as RelatorioJulgamento | undefined;
  return v && typeof v.texto === "string" ? v : null;
}

/** Chave em `respostas` das partes do julgamento (cada uma procedente ou não). */
export const CHAVE_ITENS_JULGAMENTO = "__itens_julgamento";

export interface ItemJulgamento {
  id: string;
  /** Parte da reclamação/não conformidade julgada. */
  descricao: string;
  procedencia: "procedente" | "nao_procedente";
}

export function itensJulgamentoDe(o: Pick<Ocorrencia, "respostas">): ItemJulgamento[] {
  const v = o.respostas[CHAVE_ITENS_JULGAMENTO];
  return Array.isArray(v) ? (v as ItemJulgamento[]) : [];
}

/**
 * Resultado geral do julgamento a partir das partes: todas procedentes →
 * procedente; todas não-procedentes → não-procedente; mistura → parcialmente
 * procedente; sem partes → pendente.
 */
export function procedenciaDosItens(itens: ItemJulgamento[]): ProcedenciaOcorrencia {
  if (itens.length === 0) return "pendente";
  const procedentes = itens.filter((i) => i.procedencia === "procedente").length;
  if (procedentes === itens.length) return "procedente";
  if (procedentes === 0) return "nao_procedente";
  return "parcialmente_procedente";
}
