export const NIVEIS_ACESSO = [
  { rotulo: "Desenvolvedor do Sistema", descricao: "Acesso a tudo, imutável. Exclusivo da TI." },
  { rotulo: "Gestor da Qualidade", descricao: "Dono do sistema. Acesso total, inclusive Configurações." },
  { rotulo: "Administrador", descricao: "Opera e vê absolutamente tudo, inclusive Configurações." },
  { rotulo: "Líder de setor", descricao: "Vê e aprova os POPs e políticas do seu setor." },
  { rotulo: "Colaborador", descricao: "Vê os POPs e políticas do seu setor." },
  { rotulo: "Colaborador de outra unidade", descricao: "Apenas lê os POPs e políticas." },
] as const;

/** Rótulos dos níveis de acesso (mesma ordem do array acima). */
export const ROTULOS_NIVEIS_ACESSO = NIVEIS_ACESSO.map((nivel) => nivel.rotulo);

/**
 * Nível exclusivo da TI Maracas: imutável no banco (trigger
 * `colaboradores_travar_dev`) e com acesso total ao portal.
 */
export const NIVEL_DESENVOLVEDOR_SISTEMA = "Desenvolvedor do Sistema";

/** Níveis que só podem ser atribuídos por quem já tem acesso de gestão. */
export const NIVEIS_RESERVADOS_GESTAO = new Set<string>([
  "Administrador",
  NIVEL_DESENVOLVEDOR_SISTEMA,
]);

/** Níveis que enxergam todos os POPs, sem liberação nem filtro de setor. */
export const NIVEIS_ACESSO_TOTAL_POPS = new Set<string>([
  "Desenvolvedor do Sistema",
  "Administrador",
  "Gestor da Qualidade",
]);

/** Níveis que filtram POPs e políticas pelo setor do colaborador. */
export const NIVEIS_FILTRAM_POR_SETOR = new Set<string>([
  "Colaborador",
  "Líder de setor",
]);

/** Níveis com acesso total (inclusive Configurações). */
export const NIVEIS_GESTAO = new Set<string>([
  "Desenvolvedor do Sistema",
  "Gestor da Qualidade",
  "Administrador",
]);

/** Papel interno derivado do nível de acesso (o nível sempre prevalece). */
export function roleDoNivel(nivel: string): "admin" | "gestor" | "usuario" {
  if (nivel === "Gestor da Qualidade") return "gestor";
  if (nivel === "Administrador" || nivel === "Desenvolvedor do Sistema" || nivel === "Desenvolvedor")
    return "admin";
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
