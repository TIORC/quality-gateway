export const NIVEIS_ACESSO = [
  {
    rotulo: "Administrador",
    descricao:
      "Acesso total e irrestrito. Gerencia usuários e concede permissões de administração a qualquer pessoa.",
  },
  {
    rotulo: "Gestor da Qualidade",
    descricao: "Acesso total. Cria e publica documentos, atas, projetos e indicadores.",
  },
  {
    rotulo: "Auxiliar da Qualidade",
    descricao: "Elabora e apura, mas não libera divulgação de POP.",
  },
  {
    rotulo: "Diretoria",
    descricao: "Enxerga tudo em leitura. Assina atas e aprova políticas.",
  },
  {
    rotulo: "Líder de setor",
    descricao: "Seu setor: ações, documentos, ocorrências e projetos.",
  },
  {
    rotulo: "Desenvolvedor",
    descricao:
      "Acesso como colaborador: suas ações, o que segue e o que foi divulgado ao seu setor.",
  },
  {
    rotulo: "Colaborador",
    descricao: "Suas ações, o que segue e o que foi divulgado a ele.",
  },
  {
    rotulo: "Colaborador de outra unidade",
    descricao: "Somente POPs expressamente liberados.",
  },
] as const;

/** Rótulos dos níveis de acesso (mesma ordem do array acima). */
export const ROTULOS_NIVEIS_ACESSO = NIVEIS_ACESSO.map((nivel) => nivel.rotulo);

/** Níveis que enxergam todos os POPs, sem liberação nem filtro de setor. */
export const NIVEIS_ACESSO_TOTAL_POPS = new Set<string>(["Administrador", "Gestor da Qualidade"]);

/** Níveis que filtram POPs e políticas pelo setor do colaborador. */
export const NIVEIS_FILTRAM_POR_SETOR = new Set<string>([
  "Colaborador",
  "Líder de setor",
  "Desenvolvedor",
]);

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
