import { traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import type { UserSession } from "@/lib/auth";
import { dataBrParaISO } from "@/lib/projetos";
import { projetoDoRow } from "@/lib/projetos-base";
import type { ProjetoEstrategico } from "@/lib/projetos";
import type { Swot, FrenteTrabalho, KanbanColuna, TipoProjeto, StatusProjeto, PrioridadeProjeto } from "@/lib/projetos";

type Rec = Record<string, unknown>;

export interface NovoProjetoInput {
  codigo: string; nome: string; tipo: TipoProjeto; objetivo: string;
  setor: string; responsavelId: string; responsavelNome: string; responsavelEmail: string;
  grupoAlvo: string; inicio: string; fimPrevisto: string; usarSwot: boolean;
  forcas: string; fraquezas: string; oportunidades: string; ameacas: string;
  frentes: string; prioridade: PrioridadeProjeto;
}

export interface GrupoAcesso {
  id: string; nome: string; descricao: string; modulosPerm: Record<string, unknown>; createdAt: string; updatedAt: string;
}

function swotDeInput(input: NovoProjetoInput): Swot {
  const linhas = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    forcas: linhas(input.forcas), fraquezas: linhas(input.fraquezas),
    oportunidades: linhas(input.oportunidades), ameacas: linhas(input.ameacas),
  };
}

function frentesDeInput(input: NovoProjetoInput): FrenteTrabalho[] {
  const linhas = input.frentes.split("\n").map((l) => l.trim()).filter(Boolean);
  return linhas.map((nome, i) => ({ id: `fr-${i + 1}`, nome, descricao: "", setores: [] }));
}

function proximoCodigoExistente(existentes: ProjetoEstrategico[]): string {
  const ano = new Date().getFullYear();
  let max = 0;
  for (const p of existentes) {
    const m = /^PE-(\d{4})-(\d+)$/.exec(p.codigo);
    if (m && Number(m[1]) === ano) max = Math.max(max, Number(m[2]));
  }
  return `PE-${ano}-${String(max + 1).padStart(3, "0")}`;
}

/** Cria um projeto (e, se solicitado, persiste a matriz SWOT). */
export async function criarProjeto(input: NovoProjetoInput, sessao: UserSession | null, existentes: ProjetoEstrategico[]): Promise<ProjetoEstrategico> {
    const client = clienteLivre();
  const codigo = input.codigo.trim() || proximoCodigoExistente(existentes);
  const inicio = dataBrParaISO(input.inicio);
  const fimPrevisto = dataBrParaISO(input.fimPrevisto);
  const swot = input.usarSwot ? swotDeInput(input) : { forcas: [], fraquezas: [], oportunidades: [], ameacas: [] };
  const frentes = frentesDeInput(input);
  const { data, error } = await client.from("projetos_estrategicos").insert({
    codigo, nome: input.nome.trim(), tipo: input.tipo, objetivo: input.objetivo.trim(),
    setor: input.setor, prioridade: input.prioridade,
    responsavel_id: input.responsavelId, responsavel_nome: input.responsavelNome,
    responsavel_email: input.responsavelEmail.toLowerCase(),
    grupo_alvo: input.grupoAlvo, inicio, fim_previsto: fimPrevisto,
        status: "planejamento", swot, frentes,
  }).select("*").single();
  if (error) throw traduzErro(error);
  const plano = projetoDoRow(data as unknown as Rec);
  return plano;
}

export interface AtualizacaoProjeto {
  nome?: string; objetivo?: string; setor?: string; tipo?: TipoProjeto;
  prioridade?: PrioridadeProjeto; status?: StatusProjeto;
  responsavelId?: string; responsavelNome?: string; responsavelEmail?: string;
  grupoAlvo?: string; inicio?: string | null; fimPrevisto?: string | null; fimReal?: string | null;
  swot?: Swot; frentes?: FrenteTrabalho[]; kanbanColunas?: KanbanColuna[];
}

export async function atualizarProjeto(projeto: ProjetoEstrategico, patch: AtualizacaoProjeto, sessao: UserSession | null): Promise<ProjetoEstrategico> {
    const client = clienteLivre();
  const u: Rec = {};
  if (patch.nome !== undefined) u["nome"] = patch.nome;
  if (patch.objetivo !== undefined) u["objetivo"] = patch.objetivo;
  if (patch.setor !== undefined) u["setor"] = patch.setor;
  if (patch.tipo !== undefined) u["tipo"] = patch.tipo;
  if (patch.prioridade !== undefined) u["prioridade"] = patch.prioridade;
  if (patch.status !== undefined) u["status"] = patch.status;
  if (patch.responsavelId !== undefined) u["responsavel_id"] = patch.responsavelId;
  if (patch.responsavelNome !== undefined) u["responsavel_nome"] = patch.responsavelNome;
  if (patch.responsavelEmail !== undefined) u["responsavel_email"] = patch.responsavelEmail.toLowerCase();
  if (patch.grupoAlvo !== undefined) u["grupo_alvo"] = patch.grupoAlvo;
  if (patch.inicio !== undefined) u["inicio"] = patch.inicio;
  if (patch.fimPrevisto !== undefined) u["fim_previsto"] = patch.fimPrevisto;
  if (patch.fimReal !== undefined) u["fim_real"] = patch.fimReal;
  if (patch.swot !== undefined) u["swot"] = patch.swot;
  if (patch.frentes !== undefined) u["frentes"] = patch.frentes;
  if (patch.kanbanColunas !== undefined) u["kanban_colunas"] = patch.kanbanColunas;
  const { data, error } = await client.from("projetos_estrategicos").update(u).eq("id", projeto.id).select("*").single();
  if (error) throw traduzErro(error);
  return projetoDoRow(data as unknown as Rec);
}

export async function excluirProjeto(id: string): Promise<void> {
  const client = clienteLivre();
  const { error } = await client.from("projetos_estrategicos").delete().eq("id", id);
    if (error) throw traduzErro(error);
}

