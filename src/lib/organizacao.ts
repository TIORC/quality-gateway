/**
 * Acesso aos dados da estrutura organizacional no Lovable Cloud (Supabase).
 *
 * As tabelas (`empresas`, `setores`, `cargos`, `unidades`, `colaboradores` e
 * `usuarios`) são criadas em `supabase/migrations/20260915030000_org.sql` e
 * `supabase/migrations/20260916000000_empresas.sql`. Estas funções substituem
 * os antigos mocks em memória (`COLABORADORES`, `SETORES`,
 * `CARGOS_POR_SETOR`, `UNIDADES`, `FUNCIONARIOS`).
 */

import { exigirCloud, lovableCloudConfigurado } from "@/integrations/supabase/client";
import type {
  CargoRow,
  ColaboradorRow,
  EmpresaRow,
  SetorRow,
  UnidadeRow,
} from "@/integrations/supabase/db-types";
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

/** Empresa e filial exibidas na barra superior do painel. */
export interface Empresa {
  id: string;
  nome: string;
  filial: string;
}

function traduzErro(erro: unknown): Error {
  if (erro && typeof erro === "object" && "message" in erro) {
    return new Error(String((erro as { message: unknown }).message));
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

/** Indica que a tabela ainda não existe no Cloud (migration não aplicada). */
function tabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const info = erro as { code?: unknown; message?: unknown };
  const codigo = typeof info.code === "string" ? info.code : "";
  const mensagem = typeof info.message === "string" ? info.message : "";
  return codigo === "42P01" || codigo === "PGRST205" || mensagem.includes("does not exist");
}

/** Conta as linhas de uma tabela de ciência/visualização por e-mail de usuário. */
async function contarPopPorEmail(
  tabela: "pop_leituras" | "pop_visualizacoes",
): Promise<Map<string, number>> {
  const client = exigirCloud();
  const { data, error } = await client.from(tabela).select("usuario_email");
  if (error) {
    if (tabelaAusente(error)) return new Map();
    throw traduzErro(error);
  }
  const mapa = new Map<string, number>();
  for (const linha of data ?? []) {
    const email = linha.usuario_email.trim().toLowerCase();
    mapa.set(email, (mapa.get(email) ?? 0) + 1);
  }
  return mapa;
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

function unidadeDoRow(row: Pick<UnidadeRow, "id" | "nome" | "cidade">): Unidade {
  return { id: row.id, nome: row.nome, cidade: row.cidade };
}

function empresaDoRow(row: EmpresaRow): Empresa {
  return { id: row.id, nome: row.nome, filial: row.filial };
}

function colaboradoraDoRow(
  row: Pick<
    ColaboradorRow,
    | "id"
    | "nome"
    | "cargo"
    | "email"
    | "unidade"
    | "cidade"
    | "setor"
    | "nivel_acesso"
    | "grupos"
    | "exclusao"
  >,
): Colaborador {
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

function funcionarioDoRow(
  row: Pick<
    ColaboradorRow,
    "id" | "nome" | "email" | "cargo" | "setor" | "status" | "ultimo_acesso"
  >,
): Funcionario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    cargo: row.cargo,
    setor: row.setor,
    status: (row.status === "Inativo" ? "Inativo" : "Ativo") as StatusFuncionario,
    ultimoAcesso: row.ultimo_acesso,
    processosVisualizados: 0,
    processosLidos: 0,
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
    .select("id,nome,ordem,created_at,updated_at")
    .order("ordem", { ascending: true });
  if (erroSetores) throw traduzErro(erroSetores);

  const { data: cargos, error: erroCargos } = await client
    .from("cargos")
    .select("id,setor_id,nome,ordem,created_at,updated_at")
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
    .select("id,nome,cidade,ordem,created_at,updated_at")
    .order("ordem", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(unidadeDoRow);
}

/** Cria uma unidade e devolve o registro persistido. */
export async function criarUnidade(nome: string, cidade: string): Promise<Unidade> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome da unidade.");
  const { data, error } = await client
    .from("unidades")
    .insert({ id: novoId("uni"), nome: limpo, cidade: cidade.trim(), ordem: 999 })
    .select("id,nome,cidade")
    .single();
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível criar a unidade.");
  return unidadeDoRow(data);
}

/** Edita o nome e/ou a cidade de uma unidade. */
export async function atualizarUnidade(id: string, nome: string, cidade: string): Promise<void> {
  const client = exigirCloud();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome da unidade.");
  const { error } = await client
    .from("unidades")
    .update({ nome: limpo, cidade: cidade.trim() })
    .eq("id", id);
  if (error) throw traduzErro(error);
}

/** Remove uma unidade. */
export async function removerUnidade(id: string): Promise<void> {
  const client = exigirCloud();
  const { error } = await client.from("unidades").delete().eq("id", id);
  if (error) throw traduzErro(error);
}

/**
 * Empresa (nome + filial) exibida na barra superior do painel — a de menor
 * `ordem` entre as cadastradas.
 *
 * Devolve `null` quando não há nenhuma empresa cadastrada ou quando o banco
 * não está acessível, para o cabeçalho simplesmente não exibir nada.
 */
export async function carregarEmpresaPrincipal(): Promise<Empresa | null> {
  if (!organizacaoDisponivel()) return null;

  try {
    const client = exigirCloud();
    const { data, error } = await client
      .from("empresas")
      .select("id,nome,filial,ordem,created_at,updated_at")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw traduzErro(error);
    return data ? empresaDoRow(data) : null;
  } catch {
    return null;
  }
}

/** Lista de colaboradores cadastrados no portal. */
export async function carregarColaboradores(): Promise<Colaborador[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .select(
      "id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao,status,ultimo_acesso,created_at,updated_at",
    )
    .order("created_at", { ascending: true });
  if (error) throw traduzErro(error);
  return (data ?? []).map(colaboradoraDoRow);
}

/**
 * Lista de funcionários com situação de acesso e leitura de processos.
 *
 * Os contadores são calculados da origem real do sistema: visualizados =
 * `public.pop_visualizacoes` (aberturas) e lidos = `public.pop_leituras`
 * (ciência registrada), somados por e-mail do colaborador.
 */
export async function carregarFuncionarios(): Promise<Funcionario[]> {
  const client = exigirCloud();
  const { data, error } = await client
    .from("colaboradores")
    .select(
      "id,nome,email,cargo,unidade,cidade,setor,nivel_acesso,grupos,exclusao,status,ultimo_acesso,created_at,updated_at",
    )
    .order("created_at", { ascending: true });
  if (error) throw traduzErro(error);

  const [visualizadosPorEmail, lidosPorEmail] = await Promise.all([
    contarPopPorEmail("pop_visualizacoes"),
    contarPopPorEmail("pop_leituras"),
  ]);

  return (data ?? []).map((row) => {
    const base = funcionarioDoRow(row);
    const email = (row.email ?? "").trim().toLowerCase();
    return {
      ...base,
      processosVisualizados: visualizadosPorEmail.get(email) ?? 0,
      processosLidos: lidosPorEmail.get(email) ?? 0,
    };
  });
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
