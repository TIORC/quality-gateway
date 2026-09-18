import { exigirCloud } from "@/integrations/supabase/client";
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import type { OrigemAcao, PlanoAcao, StatusAcao } from "@/lib/planos";
import { ORIGENS_ACAO_FIXAS, ORIGENS_ATIVAS_PADRAO, STATUS_ACAO } from "@/lib/planos";

export type Linha = Record<string, unknown>;
export const str = (v: unknown, p = ""): string => (typeof v === "string" ? v : p);

export function planoDoRow(row: Record<string, unknown>): PlanoAcao {
  const status = str(row["status"], "aberta");
  return {
    id: str(row["id"]), codigo: str(row["codigo"]), titulo: str(row["titulo"]),
    descricao: str(row["descricao"]), detalhamento: str(row["detalhamento"]),
    status: (STATUS_ACAO as readonly string[]).includes(status) ? (status as StatusAcao) : "aberta",
    origem: str(row["origem"], "Outros"), origemOutros: str(row["origem_outros"]),
    setor: str(row["setor"]), prioridade: str(row["prioridade"], "Média"),
    responsavelId: str(row["responsavel_id"]), responsavelNome: str(row["responsavel_nome"]),
    responsavelEmail: str(row["responsavel_email"]),
    seguidores: Array.isArray(row["seguidores"]) ? (row["seguidores"] as string[]) : [],
    seguidoresIds: Array.isArray(row["seguidores_ids"]) ? (row["seguidores_ids"] as string[]) : [],
    prazo: typeof row["prazo"] === "string" ? row["prazo"] : null,
    progresso: typeof row["progresso"] === "number" ? row["progresso"] : Number(row["progresso"] ?? 0) || 0,
    vinculoTipo: str(row["vinculo_tipo"]), vinculoId: str(row["vinculo_id"]),
    anexos: Array.isArray(row["anexos"]) ? (row["anexos"] as PlanoAcao["anexos"]) : [],
    concluidaEm: typeof row["concluida_em"] === "string" ? row["concluida_em"] : null,
    createdAt: str(row["created_at"]), updatedAt: str(row["updated_at"]),
  };
}

export async function listarOrigens(): Promise<OrigemAcao[]> {
  const client = exigirCloud();
  const { data, error } = await client.from("plano_origens")
    .select("id,nome,ativa,ordem").order("ordem", { ascending: true });
  if (error) {
    if (tabelaAusente(error))
      return [...ORIGENS_ACAO_FIXAS].map((nome, i) => ({
        id: `local-${i}`, nome, ativa: ORIGENS_ATIVAS_PADRAO.has(nome), ordem: i + 1,
      }));
    throw traduzErro(error);
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      id: str(row["id"]), nome: str(row["nome"]),
      ativa: Boolean(row["ativa"]), ordem: Number(row["ordem"] ?? 0),
    };
  });
}

export async function listarPlanos(): Promise<PlanoAcao[]> {
  const client = exigirCloud();
  const { data, error } = await client.from("planos_de_acao")
    .select("*").order("created_at", { ascending: false });
  if (error) throw traduzErro(error);
  return (data ?? []).map((r) => planoDoRow(r as unknown as Record<string, unknown>));
}
