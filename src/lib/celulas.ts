/**
 * Células (Configurações > Célula) no Lovable Cloud (Supabase).
 *
 * As tabelas `celulas` e `celula_colaboradores` são criadas em
 * `supabase/migrations/20261016000000_celulas.sql`.
 */
import { exigirCloud } from "@/integrations/supabase/client";
import { tabelaAusente, traduzErro } from "@/lib/organizacao";

export interface Celula {
  id: string;
  nome: string;
  setorId: string;
  colaboradorIds: string[];
}

const MIGRATION = "20261016000000_celulas.sql";

function erroDaCelula(erro: unknown): Error {
  if (tabelaAusente(erro)) {
    return new Error(`As tabelas de células ainda não existem. Aplique a migration ${MIGRATION}.`);
  }
  const codigo = (erro as { code?: unknown } | null)?.code;
  if (codigo === "23505") return new Error("Já existe uma célula com esse nome neste setor.");
  return traduzErro(erro);
}

export async function carregarCelulas(): Promise<Celula[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("celulas")
    .select("id,nome,setor_id,celula_colaboradores(colaborador_id)")
    .order("nome", { ascending: true });
  if (error) throw erroDaCelula(error);
  return ((data ?? []) as {
    id: string;
    nome: string;
    setor_id: string;
    celula_colaboradores: { colaborador_id: string }[];
  }[]).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    setorId: linha.setor_id,
    colaboradorIds: linha.celula_colaboradores.map((v) => v.colaborador_id),
  }));
}

function validar(nome: string, setorId: string): string {
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome da célula.");
  if (!setorId) throw new Error("Selecione o setor da célula.");
  return limpo;
}

async function gravarColaboradores(celulaId: string, colaboradorIds: string[]): Promise<void> {
  if (colaboradorIds.length === 0) return;
  const client = exigirCloud();
  const { error } = await client
    .from("celula_colaboradores")
    .insert(colaboradorIds.map((colaborador_id) => ({ celula_id: celulaId, colaborador_id })));
  if (error) throw erroDaCelula(error);
}

/** Cria a célula com seus colaboradores e devolve o registro persistido. */
export async function criarCelula(nome: string, setorId: string, colaboradorIds: string[]): Promise<Celula> {
  const limpo = validar(nome, setorId);
  const client = exigirCloud();
  const { data, error } = await client
    .from("celulas")
    .insert({ nome: limpo, setor_id: setorId })
    .select("id")
    .single();
  if (error) throw erroDaCelula(error);
  if (!data) throw new Error("Não foi possível criar a célula.");
  await gravarColaboradores(data.id, colaboradorIds);
  return { id: data.id, nome: limpo, setorId, colaboradorIds };
}

/** Edita nome, setor e colaboradores da célula (os colaboradores são substituídos pela lista enviada). */
export async function atualizarCelula(
  id: string,
  nome: string,
  setorId: string,
  colaboradorIds: string[],
): Promise<void> {
  const limpo = validar(nome, setorId);
  const client = exigirCloud();
  const { error } = await client
    .from("celulas")
    .update({ nome: limpo, setor_id: setorId })
    .eq("id", id);
  if (error) throw erroDaCelula(error);
  const { error: erroApagar } = await client.from("celula_colaboradores").delete().eq("celula_id", id);
  if (erroApagar) throw erroDaCelula(erroApagar);
  await gravarColaboradores(id, colaboradorIds);
}

/** Remove a célula; os vínculos com colaboradores saem junto (cascata). */
export async function removerCelula(id: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("celulas").delete().eq("id", id);
  if (error) throw erroDaCelula(error);
}
