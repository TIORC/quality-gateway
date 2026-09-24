/**
 * Atas de Reunião — domínio, constantes e tipos (modelo).
 *
 * As tabelas (`tipos_reuniao`, `atas`, `ata_setores_citados`, `ata_acoes`,
 * `ata_assinaturas` e `ata_arquivos`) vivem no Lovable Cloud
 * (migration `20260926000000_atas_de_reuniao.sql`). Este arquivo concentra
 * somente o modelo: enumerações com rótulos em pt-BR e interfaces que espelham
 * as linhas do banco. Sem interface (UI), sem regras de negócio e sem acesso a
 * dados.
 *
 * Referências do modelo já existente no portal:
 *   * setores  -> `public.setores` (id);
 *   * usuários -> `public.usuarios` (id);
 *   * planos   -> `public.planos_de_acao` (id).
 */

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

export const PERIODICIDADES_REUNIAO = [
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "avulsa",
] as const;
export type PeriodicidadeReuniao = (typeof PERIODICIDADES_REUNIAO)[number];

export const PERIODICIDADE_LABELS: Record<PeriodicidadeReuniao, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  avulsa: "Avulsa",
};

/** De onde a ata veio: digitada, gerada pelo portal ou importada de arquivo. */
export const ORIGENS_ATA = ["simples", "sistema", "arquivo"] as const;
export type OrigemAta = (typeof ORIGENS_ATA)[number];

export const ORIGEM_ATA_LABELS: Record<OrigemAta, string> = {
  simples: "Ata simples",
  sistema: "Ata do sistema",
  arquivo: "Arquivo anterior",
};

export const STATUS_ATA = ["rascunho", "aguardando_assinatura", "assinada"] as const;
export type StatusAta = (typeof STATUS_ATA)[number];

export const STATUS_ATA_LABELS: Record<StatusAta, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  assinada: "Assinada",
};

/** Situação da ação sugerida a partir do texto da ata. */
export const STATUS_SUGESTAO_ACAO = ["sugerida", "confirmada", "descartada"] as const;
export type StatusSugestaoAcao = (typeof STATUS_SUGESTAO_ACAO)[number];

export const STATUS_SUGESTAO_ACAO_LABELS: Record<StatusSugestaoAcao, string> = {
  sugerida: "Sugerida",
  confirmada: "Confirmada",
  descartada: "Descartada",
};

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/* -------------------------------------------------------------------------- */

/** Usuário referenciado nas listas (`id` de `public.usuarios`). */
export interface UsuarioRef {
  id: string;
  nome: string;
}

export interface TipoReuniao {
  id: string;
  nome: string;
  periodicidade: PeriodicidadeReuniao;
  /**
   * Dia previsto do período: dia do mês (1–31) ou, nas periodicidades
   * semanais/quinzenais, dia da semana (1 = segunda ... 7 = domingo).
   * `null` quando não definido.
   */
  diaPrevisto: number | null;
  participantes: UsuarioRef[];
  signatarios: UsuarioRef[];
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ata {
  id: string;
  /** Tipo de reunião vinculado; `null` para ata avulsa sem tipo. */
  tipoReuniaoId: string | null;
  origem: OrigemAta;
  titulo: string;
  /** Data da reunião no formato `AAAA-MM-DD`. */
  dataReuniao: string;
  texto: string;
  status: StatusAta;
  /** Usuário que criou a ata (`id` de `public.usuarios`). */
  criadoPor: string;
  createdAt: string;
  updatedAt: string;
}

export interface AtaSetorCitado {
  id: string;
  ataId: string;
  /** Setor citado (`id` de `public.setores`). */
  setor: string;
  trecho: string;
}

export interface AtaAcao {
  id: string;
  ataId: string;
  /** Trecho da ata que deu origem à ação (preserva a origem). */
  trechoOrigem: string;
  descricao: string;
  /** Setor que executa (`id` de `public.setores`). */
  setorDestino: string;
  /** Responsável opcional (`id` de `public.usuarios`). */
  responsavel: string | null;
  /** Prazo no formato `AAAA-MM-DD`; `null` quando não definido. */
  prazo: string | null;
  /** Plano de ação existente vinculado (`id` de `public.planos_de_acao`). */
  planoAcaoId: string | null;
  statusSugestao: StatusSugestaoAcao;
}

export interface AtaAssinatura {
  id: string;
  ataId: string;
  /** Usuário assinante (`id` de `public.usuarios`) — único por ata. */
  usuario: string;
  /** Momento da assinatura (ISO 8601). */
  assinadoEm: string;
  /** Hash do conteúdo da ata no instante da assinatura. */
  hashConteudo: string;
}

export interface AtaArquivo {
  id: string;
  ataId: string;
  /** Caminho do upload no bucket privado `atas-arquivos`. */
  arquivo: string;
  nomeOriginal: string;
  /** Tamanho em bytes. */
  tamanho: number;
  /** Usuário que enviou (`id` de `public.usuarios`). */
  enviadoPor: string;
  /** Momento do envio (ISO 8601). */
  enviadoEm: string;
}
