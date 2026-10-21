/**
 * Cálculo do NPS: (promotores − detratores) ÷ total × 100, de −100 a 100.
 * Os nomes dos grupos aparecem só nos gráficos, nunca no formulário.
 */

export type GrupoNps = "detratores" | "neutros" | "promotores";

export const GRUPOS_NPS: { chave: GrupoNps; rotulo: string; faixa: string; cor: string }[] = [
  { chave: "detratores", rotulo: "Detratores", faixa: "0 a 6", cor: "#DC2626" },
  { chave: "neutros", rotulo: "Neutros", faixa: "7 a 8", cor: "#F59E0B" },
  { chave: "promotores", rotulo: "Promotores", faixa: "9 e 10", cor: "#16A34A" },
];

/** Grupo de uma nota de 0 a 10. Retorna null para qualquer outro valor. */
export function grupoDaNota(nota: number): GrupoNps | null {
  if (nota >= 0 && nota <= 6) return "detratores";
  if (nota >= 7 && nota <= 8) return "neutros";
  if (nota >= 9 && nota <= 10) return "promotores";
  return null;
}

export interface ApuracaoNps {
  detratores: number;
  neutros: number;
  promotores: number;
  total: number;
  /** Score de −100 a 100. Null quando ainda não há respostas. */
  score: number | null;
}

export function apurarNps(notas: number[]): ApuracaoNps {
  const contagem: Record<GrupoNps, number> = { detratores: 0, neutros: 0, promotores: 0 };
  for (const nota of notas) {
    const grupo = grupoDaNota(nota);
    if (grupo) contagem[grupo] += 1;
  }
  const total = contagem.detratores + contagem.neutros + contagem.promotores;
  const score = total ? ((contagem.promotores - contagem.detratores) / total) * 100 : null;
  return { ...contagem, total, score };
}

/** Zonas do NPS. O valor cai na zona cujo limite superior ainda não foi atingido. */
export const ZONAS_NPS: {
  rotulo: string;
  nomeCompleto: string;
  minimo: number;
  maximo: number;
  cor: string;
  /** Cor do percentual quando o score cai nesta zona. */
  corTexto: string;
}[] = [
  {
    rotulo: "Crítica",
    nomeCompleto: "Zona Crítica",
    minimo: -100,
    maximo: 0,
    cor: "#DC2626",
    corTexto: "#DC2626",
  },
  {
    rotulo: "Aperfeiçoamento",
    nomeCompleto: "Zona de Aperfeiçoamento",
    minimo: 0,
    maximo: 50,
    cor: "#FACC15",
    corTexto: "#EAB308",
  },
  {
    rotulo: "Qualidade",
    nomeCompleto: "Zona de Qualidade",
    minimo: 50,
    maximo: 75,
    cor: "#86EFAC",
    corTexto: "#4ADE80",
  },
  {
    rotulo: "Excelência",
    nomeCompleto: "Zona de Excelência",
    minimo: 75,
    maximo: 100,
    cor: "#15803D",
    corTexto: "#15803D",
  },
];

/** Zona em que o score cai. Retorna undefined sem dados. */
export function zonaDoNps(score: number | null) {
  if (score === null) return undefined;
  return ZONAS_NPS.find((z) => score < z.maximo) ?? ZONAS_NPS[ZONAS_NPS.length - 1];
}

export function formatarNps(score: number | null): string {
  if (score === null) return "—";
  return `${score.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
