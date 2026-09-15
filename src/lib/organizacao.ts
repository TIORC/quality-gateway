/**
 * Acesso aos dados da estrutura organizacional no Lovable Cloud (Supabase).
 *
 * As tabelas (`setores`, `cargos`, `unidades`, `colaboradores` e `usuarios`)
 * são criadas em `supabase/migrations/20260915030000_org.sql`. Estas funções
 * substituem os antigos mocks em memória (`COLABORADORES`, `SETORES`,
 * `CARGOS_POR_SETOR`, `UNIDADES`, `FUNCIONARIOS`).
 */

import { exigirCloud, lovableCloudConfigurado } from "@/integrations/supabase/client";
import type {
  CargoRow,
  ColaboradorRow,
  SetorRow,
  UnidadeRow,
} from "@/integrations/supabase/types";
import type { Colaborador, Funcionario, StatusFuncionario } from "@/lib/dados";

/** `true` quando o Lovable Cloud está configurado (fonte de dados da org). */
export function organizacaoDisponivel(): boolean {
  return lovableCloudConfigurado;
}

export interface CargoConfig {
  id: string;
  nome: string;
}

export interface SetorConfig {
  id: string;
  nome: string;
  cargos: CargoConfig[];
}

export interface Unidade {
  id: string;
  nome: string;
  cidade: string;
}

function traduzErro(erro: unknown): Error {
  if (erro && typeof erro === "object" && "message" in erro) {
    return new Error(String((erro as { message: unknown }).message));
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function setorDoRow(row: SetorRow): { id: string; nome: string } {
  return { id: row.id, nome: row.nome };
}

function cargoDoRow(row: CargoRow): CargoConfig {
  return { id: row.id, nome: row.nome };
}

function unidadeDoRow(row: UnidadeRow): Unidade {
  return { id: row.id, nome: row.nome, cidade: row.cidade };
}

function colaboradoraDoRow(row: ColaboradorRow): Colaborador {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    email: row.email,
    unidade: row.unidade,
    cidade: row.cidade,
    setor: row.setor,
    nivelAcesso: row.nivel_acesso,
    grupos: row.grupos,
    exclusao: row.exclusao,
  };
}

function funcionarioDoRow(row: ColaboradorRow): Funcionario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    cargo: row.cargo,
    setor: row.setor,
    status: (row.status === "Inativo" ? "Inativo" : "Ativo") as StatusFuncionario,
    ultimoAcesso: row.ultimo_acesso,
    processosVisualizados: row.processos_visualizados,
    processosLidos: row.processos_lidos,
  };
}

function colaboradorParaInsercao(dados: Colaborador): {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  unidade: string;
  cidade: string;
  setor: string;
  nivel_acesso: string;
  grupos: string;
  exclusao: string;
} {
  return {
    id: dados.id,
    nome: dados.nome,
    email: dados.email ?? "",
    cargo: dados.cargo,
    unidade: dados.unidade ?? "Matriz",
    cidade: dados.cidade ?? "",
    setor: dados.setor ?? "",
    nivel_acesso: dados.nivelAcesso ?? "Colaborador",
    grupos: dados.grupos ?? "",
    exclusao: dados.exclusao ?? "Sem acesso",
  };
}

function colaboradorParaAtualizacao(dados: Colaborador): {
  nome: string;
  email: string;
  cargo: string;
  unidade: string;
  cidade: string;
  setor: string;
  nivel_acesso: string;
  grupos: string;
  exclusao: string;
} {
  return {
    nome: dados.nome,
    email: dados.email ?? "",
    cargo: dados.cargo,
    unidade: dados.unidade ?? "Matriz",
    cidade: dados.cidade ?? "",
    setor: dados.setor ?? "",
    nivel_acesso: dados.nivelAcesso ?? "Colaborador",
    grupos: dados.grupos ?? "",
    exclusao: dados.exclusao ?? "Sem acesso",
  };
}

/** Relação setor × cargos (estrutura usada na tela de Configurações). */
export async function carregarSetoresECargos(): Promise<SetorConfig[]> {
  const client = exigirCloud();
  const { data: setores, error: erroSetores } = await client
    .from("setores")
    .select("id,nome,ordem")
    .order("ordem", { ascending: true });
  if (erroSetores) throw traduzErro(erroSetores);

  const { data: cargos, error: erroCargos } = await client
    .from("cargos")
    .select("id,setor_id,nome,ordem")
    .order("ordem", { ascending: true });
  if (erroCargos) throw traduzErro(erroCargos);

  const cargosPorSetor = new Map<string, CargoConfig[]>();
  for (const cargo of cargos ?? []) {
    const lista = cargosPorSetor.get(cargo.setor_id) ?? [];
    lista.push(cargoDoRow(cargo));
    cargosPorSetor.set(cargo.setor_id, lista);
  }

  return (setores ?? []).map((setor) => {
    const base = setorDoRow(setor);
    return { ...base, cargos: cargosPorSetor.get(setor.id) ?? [] };
  });
}

/** Lista de unidades cadastradas. */
export async function carregarUnidades(): Promise<Unidade[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("unidades")
    .select("id,nome,cidade,ordem")
    .order("ordem", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(unidadeDoRow);
}

/** Lista de colaboradores cadastrados no portal. */
export async function carregarColaboradores(): Promise<Colaborador[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .select("id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao")
    .order("created_at", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(colaboradoraDoRow);
}

/** Lista de funcionários com situação de acesso e leitura de processos. */
export async function carregarFuncionarios(): Promise<Funcionario[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .select(
      "id,nome,email,cargo,setor,status,ultimo_acesso,processos_visualizados,processos_lidos",
    )
    .order("created_at", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(funcionarioDoRow);
}

/** Cria um colaborador no banco e devolve o registro persistido. */
export async function criarColaborador(dados: Colaborador): Promise<Colaborador> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .insert(colaboradorParaInsercao({ ...dados, id: dados.id || novoId("col") }))
    .select("id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao")
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar o colaborador.");
  return colaboradoraDoRow(data);
}

/** Atualiza um colaborador no banco e devolve o registro persistido. */
export async function atualizarColaborador(dados: Colaborador): Promise<Colaborador> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .update(colaboradorParaAtualizacao(dados))
    .eq("id", dados.id)
    .select("id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao")
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Colaborador não encontrado.");
  return colaboradoraDoRow(data);
}

/** Cria um setor e devolve a estrutura com a lista de cargos vazia. */
export async function criarSetor(nome: string): Promise<SetorConfig> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome do setor.");
  const { data, error } = await client
    .from("setores")
    .insert({ id: novoId("setor"), nome: limpo, ordem: 999 })
    .select("id,nome")
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar o setor.");
  return { id: data.id, nome: data.nome, cargos: [] };
}

/** Renomeia um setor. */
export async function renomearSetor(setorId: string, nome: string): Promise<void> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome do setor.");
  const { error } = await client.from("setores").update({ nome: limpo }).eq("id", setorId);
  if (error) throw traduzErro(error);
}

/** Remove um setor (cargos associados são removidos em cascata). */
export async function removerSetor(setorId: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("setores").delete().eq("id", setorId);
  if (error) throw traduzErro(error);
}

/** Cria um cargo dentro de um setor e devolve o setor atualizado. */
export async function criarCargo(setorId: string, nome: string): Promise<SetorConfig> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome do cargo.");
  const { error } = await client
    .from("cargos")
    .insert({ id: novoId("cargo"), setor_id: setorId, nome: limpo, ordem: 999 });
  if (error) throw traduzErro(error);
  return setorAposMutacao(setorId);
}

/** Edita um cargo (nome e/ou setor de destino) e devolve o setor atualizado. */
export async function editarCargo(
  cargoId: string,
  setorDestinoId: string,
  nome: string,
): Promise<void> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome do cargo.");
  const { error } = await client
    .from("cargos")
    .update({ nome: limpo, setor_id: setorDestinoId })
    .eq("id", cargoId);
  if (error) throw traduzErro(error);
}

/** Remove um cargo do setor. */
export async function removerCargo(cargoId: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("cargos").delete().eq("id", cargoId);
  if (error) throw traduzErro(error);
}

/** Recarrega setores + cargos e devolve o setor com o id informado. */
async function setorAposMutacao(setorId: string): Promise<SetorConfig> {
  const setores = await carregarSetoresECargos();
  const setor = setores.find((item) => item.id === setorId);
  if (!setor) throw new Error("Setor não encontrado.");
  return setor;
}