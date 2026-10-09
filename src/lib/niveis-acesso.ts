export const NIVEIS_ACESSO = [
  {
    rotulo: "Desenvolvedor do Sistema",
    cor: "text-red-600",
    descricao:
      "Acesso total e irrestrito, exclusivo da TI Maracas. Registro imutável e não excluível.",
  },
  {
    rotulo: "Gestor da Qualidade",
    cor: "text-purple-600",
    descricao:
      "Acesso total. Cria, aprova e publica documentos, atas, projetos e indicadores. Gerencia usuários.",
  },
  {
    rotulo: "Auxiliar da Qualidade",
    cor: "text-pink-500",
    descricao:
      "Tem acesso total ao sistema, auxiliando na elaboração, mas não libera e nem aprova documentos, sejam eles POPs ou políticas.",
  },
  {
    rotulo: "Diretoria",
    cor: "text-orange-500",
    descricao: "Enxerga tudo em leitura. Assina atas e aprova políticas.",
  },
  {
    rotulo: "Líder de setor",
    cor: "text-blue-600",
    descricao:
      "Lidera o seu ou vários setores, aprovando ações, documentos, ocorrências e atas de setores.",
  },
  {
    rotulo: "Colaborador",
    cor: "text-green-600",
    descricao:
      "Pode realizar a leitura, comentários e aceitação/concordância de documentos, POPs e políticas destinadas ao setor dele. Pode abrir ocorrências e verificar seus próprios indicadores.",
  },
  {
    rotulo: "Colaborador de outra unidade",
    cor: "text-teal-500",
    descricao: "Apenas lê as políticas e os POPs liberados para ele.",
  },
] as const;

/** Rótulos dos níveis de acesso (mesma ordem do array acima). */
export const ROTULOS_NIVEIS_ACESSO = NIVEIS_ACESSO.map((nivel) => nivel.rotulo);

/**
 * Nível exclusivo da TI Maracas: imutável no banco (trigger
 * `colaboradores_travar_dev`) e com acesso total ao portal.
 */
export const NIVEL_DESENVOLVEDOR_SISTEMA = "Desenvolvedor do Sistema";

/** Nível Gestor da Qualidade (antigo "Administrador", que foi eliminado). */
export const NIVEL_GESTOR_QUALIDADE = "Gestor da Qualidade";

/** Nível Auxiliar da Qualidade: acesso total, sem aprovação de documentos. */
export const NIVEL_AUXILIAR_QUALIDADE = "Auxiliar da Qualidade";

/** Nível Líder de setor: lidera um ou mais setores (`setores_liderados`). */
export const NIVEL_LIDER_SETOR = "Líder de setor";

/** Níveis que só podem ser atribuídos por quem já tem acesso de gestão. */
export const NIVEIS_RESERVADOS_GESTAO = new Set<string>([
  NIVEL_GESTOR_QUALIDADE,
  NIVEL_DESENVOLVEDOR_SISTEMA,
]);

/** Níveis que enxergam todos os POPs, sem liberação nem filtro de setor. */
export const NIVEIS_ACESSO_TOTAL_POPS = new Set<string>([
  NIVEL_DESENVOLVEDOR_SISTEMA,
  NIVEL_GESTOR_QUALIDADE,
  NIVEL_AUXILIAR_QUALIDADE,
]);

/** Níveis que filtram POPs e políticas pelo setor do colaborador. */
export const NIVEIS_FILTRAM_POR_SETOR = new Set<string>([
  "Colaborador",
  "Desenvolvedor",
  NIVEL_LIDER_SETOR,
]);

/** Níveis com acesso total (inclusive Configurações). */
export const NIVEIS_GESTAO = new Set<string>([
  NIVEL_DESENVOLVEDOR_SISTEMA,
  NIVEL_GESTOR_QUALIDADE,
  NIVEL_AUXILIAR_QUALIDADE,
]);

/** Papel interno derivado do nível de acesso (o nível sempre prevalece). */
export function roleDoNivel(nivel: string): "admin" | "gestor" | "usuario" {
  if (nivel === NIVEL_GESTOR_QUALIDADE) return "gestor";
  if (nivel === NIVEL_DESENVOLVEDOR_SISTEMA) return "admin";
  return "usuario";
}

/** Nível que vê somente o que foi liberado individualmente. */
export const NIVEL_SOMENTE_LIBERADOS = "Colaborador de outra unidade";

/* -------------------------------------------------------------------------- */
/* Mapa setor → prefixo de código (POPs) e helpers de comparação              */
/* -------------------------------------------------------------------------- */

/**
 * Mapa pragmático do nome do setor organizacional para o prefixo dos POPs
 * (ex.: "Fiscal" → "FIS"). Comparação por `pop.codigo.startsWith(prefixo)`.
 */
export const SETOR_PARA_PREFIXO: Record<string, string> = {
  fiscal: "FIS",
  contabil: "CTB",
  contábil: "CTB",
  pessoal: "PES",
  rh: "RH",
  financeiro: "FIN",
  "bpo financeiro": "BPO",
  bpo: "BPO",
  comercial: "COM",
  marketing: "MKT",
  "marketing m7": "MKT",
  "sucesso do cliente": "SUC",
  sucesso: "SUC",
  legalizacao: "LEG",
  legalização: "LEG",
  qualidade: "QUA",
  ti: "TI",
  "ti/desenvolvimento": "TI",
  desenvolvimento: "TI",
  tecnico: "TEC",
  técnico: "TEC",
  direcao: "DIR",
  direção: "DIR",
  geral: "GER",
};

/** Nome de setor normalizado (sem acentos, minúsculo) para comparações. */
export function normalizarSetor(nome: string | null | undefined): string {
  return (nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Prefixo de código POP associado ao nome do setor, ou `null` se não mapeado. */
export function prefixoDoSetor(nomeSetor: string): string | null {
  const chave = normalizarSetor(nomeSetor);
  return SETOR_PARA_PREFIXO[chave] ?? null;
}

/** Política marcada como geral (todos os setores): array vazio ou contém "Todos". */
export function politicaEhGeral(setores: string[]): boolean {
  if (setores.length === 0) return true;
  return setores.some((nome) => normalizarSetor(nome) === "todos");
}

/** Política aplicável ao setor informado (comparação normalizada). */
export function politicaDoSetor(setores: string[], setorUsuario: string): boolean {
  const alvo = normalizarSetor(setorUsuario);
  if (!alvo) return false;
  return setores.some((nome) => normalizarSetor(nome) === alvo);
}
