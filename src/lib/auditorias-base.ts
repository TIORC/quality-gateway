import { traduzErro, tabelaAusente } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import type { TipoAuditoria } from "@/lib/dados";
import {
  RESULTADOS_AUDITORIA,
  type Auditoria,
  type PessoaAuditoria,
  type ResultadoAuditoria,
  type StatusAuditoria,
} from "@/lib/auditorias";

export type Rec = Record<string, unknown>;
export const str = (r: unknown, p = ""): string => (typeof r === "string" ? r : p);

function pessoasDoJson(v: unknown): PessoaAuditoria[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((i) => {
    const o = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
    const nome = str(o["nome"]).trim();
    if (!nome) return [];
    return [{ id: str(o["id"]), nome }];
  });
}

function textosDoJson(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

const RESULTADOS_OK = RESULTADOS_AUDITORIA.map((r) => r.valor);
const TIPOS_OK: TipoAuditoria[] = ["Interna", "Externa"];
const STATUS_OK: StatusAuditoria[] = ["planejada", "em_execucao", "concluida"];

/** Registros antigos (sem coluna `status`): deduz a situação atual. */
function statusLegado(row: Rec, resultado: ResultadoAuditoria): StatusAuditoria {
  if (resultado !== "nenhum") return "concluida";
  const data = typeof row["data_planejada"] === "string" ? row["data_planejada"] : "";
  if (data && data < new Date().toISOString().slice(0, 10)) return "em_execucao";
  return "planejada";
}

export function auditoriaDoRow(row: Rec): Auditoria {
  const tipo = str(row["tipo"], "Interna") as TipoAuditoria;
  const resultado = str(row["resultado"], "nenhum") as ResultadoAuditoria;
  const statusBruto = str(row["status"], "");
  const status = STATUS_OK.includes(statusBruto as StatusAuditoria)
    ? (statusBruto as StatusAuditoria)
    : statusLegado(row, resultado);
  return {
    id: str(row["id"]),
    codigo: str(row["codigo"]),
    titulo: str(row["titulo"]),
    tipo: TIPOS_OK.includes(tipo) ? tipo : "Interna",
    norma: str(row["norma"]),
    unidade: str(row["unidade"]),
    dataPlanejada: typeof row["data_planejada"] === "string" ? row["data_planejada"] : null,
    setoresAuditados: textosDoJson(row["setores_auditados"]),
    relatorio: str(row["relatorio"]),
    evidencias: str(row["evidencias"]),
    auditores: pessoasDoJson(row["auditores"]),
    auditados: pessoasDoJson(row["auditados"]),
    status,
    resultado: RESULTADOS_OK.includes(resultado) ? resultado : "nenhum",
    resultadoRef: str(row["resultado_ref"]),
    criadaPorNome: str(row["criada_por_nome"]),
    criadaPorEmail: str(row["criada_por_email"]),
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

/** Lista as auditorias programadas (mais recentes primeiro). */
export async function listarAuditorias(): Promise<Auditoria[]> {
  try {
    const client = clienteLivre();
    const { data, error } = await client
      .from("auditorias")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => auditoriaDoRow(r as unknown as Rec));
  } catch (e) {
    // Cloud não configurado ou tabela ainda não criada -> lista vazia.
    if (e instanceof Error && /não configurado|does not exist|42P01|PGRST205/i.test(e.message))
      return [];
    throw e;
  }
}
