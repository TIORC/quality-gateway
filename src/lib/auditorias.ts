import type { TipoAuditoria } from "@/lib/dados";

export type ResultadoAuditoria = "nenhum" | "nao_conformidade" | "ponto_atencao" | "oportunidade";

export const RESULTADOS_AUDITORIA: { valor: ResultadoAuditoria; rotulo: string }[] = [
  { valor: "nao_conformidade", rotulo: "Não Conformidade" },
  { valor: "ponto_atencao", rotulo: "Ponto de Atenção" },
  { valor: "oportunidade", rotulo: "Oportunidade" },
];

export function rotuloResultado(resultado: ResultadoAuditoria): string {
  const achado = RESULTADOS_AUDITORIA.find((r) => r.valor === resultado);
  return achado?.rotulo ?? "—";
}

export interface PessoaAuditoria {
  id: string;
  nome: string;
}

export interface Auditoria {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoAuditoria;
  norma: string;
  unidade: string;
  dataPlanejada: string | null;
  setoresAuditados: string[];
  relatorio: string;
  evidencias: string;
  auditores: PessoaAuditoria[];
  auditados: PessoaAuditoria[];
  resultado: ResultadoAuditoria;
  resultadoRef: string;
  criadaPorNome: string;
  criadaPorEmail: string;
  createdAt: string;
  updatedAt: string;
}
