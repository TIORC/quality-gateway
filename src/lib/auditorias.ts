import type { TipoAuditoria } from "@/lib/dados";

export type StatusAuditoria = "planejada" | "em_execucao" | "concluida";

export const STATUS_AUDITORIA: { valor: StatusAuditoria; rotulo: string }[] = [
  { valor: "planejada", rotulo: "Planejada" },
  { valor: "em_execucao", rotulo: "Em Execução" },
  { valor: "concluida", rotulo: "Concluída" },
];

export function rotuloStatus(status: StatusAuditoria): string {
  return STATUS_AUDITORIA.find((s) => s.valor === status)?.rotulo ?? "—";
}

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
  status: StatusAuditoria;
  resultado: ResultadoAuditoria;
  resultadoRef: string;
  criadaPorNome: string;
  criadaPorEmail: string;
  createdAt: string;
  updatedAt: string;
}
