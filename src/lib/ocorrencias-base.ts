/**
 * Ocorrências — acesso ao Cloud (Supabase): mapeamento de linhas e listagens.
 *
 * `types.ts` do Supabase é gerado automaticamente e ainda não conhece as
 * tabelas deste módulo; por isso o cliente é castado para uma interface
 * livre (mesma técnica de fallback usada em pops.ts/planos-base.ts) e toda
 * leitura tolera a migration ainda não aplicada (`tabelaAusente`).
 */
import { exigirCloud } from "@/integrations/supabase/client";
import { tabelaAusente, traduzErro } from "@/lib/organizacao";
import type {
  AnexoOcorrencia,
  AcaoEtapa,
  CampoFormulario,
  EventoOcorrencia,
  FluxoVersao,
  FormularioVersao,
  MacroEtapa,
  MacroFluxo,
  Ocorrencia,
  ResponsavelEtapa,
  ResponsavelTipo,
  Respostas,
  StatusOcorrencia,
  SubetapaFluxo,
  TipoCampo,
  TipoOcorrencia,
} from "@/lib/ocorrencias";
import { MACRO_ETAPAS } from "@/lib/ocorrencias";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CloudLivre {
  from: (tabela: string) => any;
  storage: ReturnType<typeof exigirCloud>["storage"];
}

/** Cliente sem tipagem de tabelas (o schema do módulo ainda não está em types.ts). */
export function cloud(): CloudLivre {
  return exigirCloud() as unknown as CloudLivre;
}

export type Linha = Record<string, unknown>;
export const str = (v: unknown, p = ""): string => (typeof v === "string" ? v : p);
export const num = (v: unknown, p = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : p;

/* -------------------------------------------------------------------------- */
/* Tipos de ocorrência                                                         */
/* -------------------------------------------------------------------------- */

export function tipoDoRow(row: Linha): TipoOcorrencia {
  const slaRaw = row["sla_dias"];
  const slaDias: TipoOcorrencia["slaDias"] = {};
  if (slaRaw && typeof slaRaw === "object") {
    for (const macro of MACRO_ETAPAS) {
      const v = (slaRaw as Linha)[macro];
      if (typeof v === "number" && v > 0) slaDias[macro] = v;
    }
  }
  return {
    id: str(row["id"]),
    nome: str(row["nome"]),
    descricao: str(row["descricao"]),
    cor: str(row["cor"], "#1E3A8A"),
    icone: str(row["icone"], "AlertTriangle"),
    setorPadrao: str(row["setor_padrao"], "Qualidade"),
    slaDias,
    ativo: row["ativo"] === undefined ? true : Boolean(row["ativo"]),
    ordem: num(row["ordem"]),
  };
}

export async function listarTipos(): Promise<TipoOcorrencia[]> {
  try {
    const { data, error } = await cloud()
      .from("ocorrencia_tipos")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => tipoDoRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}

export async function salvarTipo(
  tipo: Partial<TipoOcorrencia> & { nome: string },
): Promise<TipoOcorrencia> {
  const payload: Linha = {
    nome: tipo.nome,
    descricao: tipo.descricao ?? "",
    cor: tipo.cor ?? "#1E3A8A",
    icone: tipo.icone ?? "AlertTriangle",
    setor_padrao: tipo.setorPadrao ?? "Qualidade",
    sla_dias: tipo.slaDias ?? {},
    ativo: tipo.ativo ?? true,
    ordem: tipo.ordem ?? 0,
  };
  const { data, error } = tipo.id
    ? await cloud().from("ocorrencia_tipos").update(payload).eq("id", tipo.id).select("*").single()
    : await cloud().from("ocorrencia_tipos").insert(payload).select("*").single();
  if (error) throw traduzErro(error);
  return tipoDoRow(data as Linha);
}

/* -------------------------------------------------------------------------- */
/* Formulários e fluxos (versionados)                                          */
/* -------------------------------------------------------------------------- */

function camposDeJson(v: unknown): CampoFormulario[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c) => {
    const o = c as Linha;
    const id = str(o["id"]);
    if (!id) return [];
    const cond = o["condicao"] as Linha | null | undefined;
    return [
      {
        id,
        tipo: str(o["tipo"], "texto") as TipoCampo,
        label: str(o["label"], id),
        placeholder: str(o["placeholder"]),
        obrigatorio: Boolean(o["obrigatorio"]),
        opcoes: Array.isArray(o["opcoes"]) ? (o["opcoes"] as string[]) : [],
        regex: str(o["regex"]),
        min: typeof o["min"] === "number" ? (o["min"] as number) : null,
        max: typeof o["max"] === "number" ? (o["max"] as number) : null,
        largura:
          str(o["largura"], "inteira") === "metade" ? ("metade" as const) : ("inteira" as const),
        condicao:
          cond && str(cond["campoId"])
            ? { campoId: str(cond["campoId"]), valor: str(cond["valor"]) }
            : null,
      },
    ] satisfies CampoFormulario[];
  });
}

export function formularioDoRow(row: Linha): FormularioVersao {
  return {
    id: str(row["id"]),
    tipoId: str(row["tipo_id"]),
    versao: num(row["versao"], 1),
    campos: camposDeJson(row["campos"]),
    publicada: Boolean(row["publicada"]),
    criadoPorNome: str(row["criado_por_nome"]),
    criadoPorEmail: str(row["criado_por_email"]),
    createdAt: str(row["created_at"]),
  };
}

export function fluxoDoRow(row: Linha): FluxoVersao {
  const raw = Array.isArray(row["etapas"]) ? (row["etapas"] as unknown[]) : [];
  const etapas: MacroFluxo[] = MACRO_ETAPAS.map((macro) => {
    const item = raw.find((r) => str((r as Linha)?.["macro"]) === macro) as Linha | undefined;
    const subsRaw = Array.isArray(item?.["subetapas"]) ? (item?.["subetapas"] as unknown[]) : [];
    const subetapas: SubetapaFluxo[] = subsRaw.flatMap((s) => {
      const o = s as Linha;
      const id = str(o["id"]);
      if (!id) return [];
      const respRaw = (o["responsavel"] ?? {}) as Linha;
      const responsavel: ResponsavelEtapa = {
        tipo: (str(respRaw["tipo"], "setor") as ResponsavelTipo) ?? "setor",
        id: str(respRaw["id"]),
        nome: str(respRaw["nome"]),
        email: str(respRaw["email"]),
      };
      return [
        {
          id,
          nome: str(o["nome"], id),
          responsavel,
          prazoDias: num(o["prazoDias"], 5),
          acoes: (Array.isArray(o["acoes"]) ? o["acoes"] : []).filter(
            (a): a is AcaoEtapa => typeof a === "string",
          ) as AcaoEtapa[],
          campos: camposDeJson(o["campos"]),
          notificar: o["notificar"] === undefined ? true : Boolean(o["notificar"]),
          reprovarPara: str(o["reprovarPara"], "voltar") === "encerrar" ? "encerrar" : "voltar",
        },
      ] satisfies SubetapaFluxo[];
    });
    return { macro: macro as MacroEtapa, subetapas };
  });
  return {
    id: str(row["id"]),
    tipoId: str(row["tipo_id"]),
    versao: num(row["versao"], 1),
    etapas,
    publicada: Boolean(row["publicada"]),
    criadoPorNome: str(row["criado_por_nome"]),
    criadoPorEmail: str(row["criado_por_email"]),
    createdAt: str(row["created_at"]),
  };
}

async function listarVersoes<T>(
  tabela: string,
  tipoId: string,
  doRow: (r: Linha) => T,
): Promise<T[]> {
  try {
    const { data, error } = await cloud()
      .from(tabela)
      .select("*")
      .eq("tipo_id", tipoId)
      .order("versao", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => doRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}

export function listarFormularios(tipoId: string): Promise<FormularioVersao[]> {
  return listarVersoes<FormularioVersao>("ocorrencia_formularios", tipoId, formularioDoRow);
}

export function listarFluxos(tipoId: string): Promise<FluxoVersao[]> {
  return listarVersoes<FluxoVersao>("ocorrencia_fluxos", tipoId, fluxoDoRow);
}

/** Publica nova versão do formulário do tipo (versões anteriores preservadas). */
export async function publicarFormulario(
  tipoId: string,
  campos: CampoFormulario[],
  sessao: { nome: string; email: string },
): Promise<FormularioVersao> {
  const existentes = await listarFormularios(tipoId);
  const versao = existentes.reduce((m, f) => Math.max(m, f.versao), 0) + 1;
  const { data, error } = await cloud()
    .from("ocorrencia_formularios")
    .insert({
      tipo_id: tipoId,
      versao,
      campos,
      publicada: true,
      criado_por_nome: sessao.nome,
      criado_por_email: sessao.email,
    })
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return formularioDoRow(data as Linha);
}

/** Publica nova versão do fluxo do tipo. */
export async function publicarFluxo(
  tipoId: string,
  etapas: MacroFluxo[],
  sessao: { nome: string; email: string },
): Promise<FluxoVersao> {
  const existentes = await listarFluxos(tipoId);
  const versao = existentes.reduce((m, f) => Math.max(m, f.versao), 0) + 1;
  const { data, error } = await cloud()
    .from("ocorrencia_fluxos")
    .insert({
      tipo_id: tipoId,
      versao,
      etapas,
      publicada: true,
      criado_por_nome: sessao.nome,
      criado_por_email: sessao.email,
    })
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return fluxoDoRow(data as Linha);
}

/* -------------------------------------------------------------------------- */
/* Ocorrências                                                                 */
/* -------------------------------------------------------------------------- */

export function ocorrenciaDoRow(row: Linha): Ocorrencia {
  const macro = MACRO_ETAPAS.includes(str(row["macro_atual"]) as MacroEtapa)
    ? (str(row["macro_atual"]) as MacroEtapa)
    : "abertura";
  const status = str(row["status"], "em_andamento") as StatusOcorrencia;
  const avaliacaoRaw = row["avaliacao"] as Linha | null;
  const respostas =
    row["respostas"] && typeof row["respostas"] === "object" ? (row["respostas"] as Respostas) : {};
  return {
    id: str(row["id"]),
    numero: str(row["numero"]),
    titulo: str(row["titulo"]),
    tipoId: str(row["tipo_id"]),
    tipoNome: str(row["tipo_nome"]),
    tipoCor: str(row["tipo_cor"], "#1E3A8A"),
    procedencia: (str(row["procedencia"], "pendente") as Ocorrencia["procedencia"]) || "pendente",
    formularioVersao: num(row["formulario_versao"], 1),
    fluxoVersao: num(row["fluxo_versao"], 1),
    respostas,
    macroAtual: macro,
    subetapaAtualId: str(row["subetapa_atual_id"]),
    subetapaAtualNome: str(row["subetapa_atual_nome"]),
    status: status === "encerrada" || status === "reaberta" ? status : "em_andamento",
    abertaPorId: str(row["aberta_por_id"]),
    abertaPorNome: str(row["aberta_por_nome"]),
    abertaPorEmail: str(row["aberta_por_email"]),
    abertaPorSetor: str(row["aberta_por_setor"]),
    responsavelId: str(row["responsavel_id"]),
    responsavelNome: str(row["responsavel_nome"]),
    responsavelEmail: str(row["responsavel_email"]),
    prazoEtapa: typeof row["prazo_etapa"] === "string" ? (row["prazo_etapa"] as string) : null,
    etapaEntrouEm: str(row["etapa_entrou_em"]),
    avaliacao: avaliacaoRaw
      ? {
          prazoDias: num(avaliacaoRaw["prazoDias"], 30),
          verificacaoEm: str(avaliacaoRaw["verificacaoEm"]) || null,
          eficaz:
            typeof avaliacaoRaw["eficaz"] === "boolean"
              ? (avaliacaoRaw["eficaz"] as boolean)
              : null,
          observacao: str(avaliacaoRaw["observacao"]),
        }
      : null,
    reaberturas: num(row["reaberturas"]),
    encerradaEm: typeof row["encerrada_em"] === "string" ? (row["encerrada_em"] as string) : null,
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

export async function listarOcorrencias(): Promise<Ocorrencia[]> {
  try {
    const { data, error } = await cloud()
      .from("ocorrencias")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => ocorrenciaDoRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}

export interface EventoLinha {
  ocorrencia_id: string;
  autor_id: string;
  autor_nome: string;
  autor_email: string;
  acao: string;
  macro: string;
  subetapa: string;
  de: string;
  para: string;
  comentario: string;
  anexos: AnexoOcorrencia[];
}

export function eventoDoRow(row: Linha): EventoOcorrencia {
  return {
    id: str(row["id"]),
    ocorrenciaId: str(row["ocorrencia_id"]),
    autorId: str(row["autor_id"]),
    autorNome: str(row["autor_nome"]),
    autorEmail: str(row["autor_email"]),
    acao: str(row["acao"]),
    macro: str(row["macro"]),
    subetapa: str(row["subetapa"]),
    de: str(row["de"]),
    para: str(row["para"]),
    comentario: str(row["comentario"]),
    anexos: Array.isArray(row["anexos"]) ? (row["anexos"] as AnexoOcorrencia[]) : [],
    createdAt: str(row["created_at"]),
  };
}

export async function listarHistorico(ocorrenciaId: string): Promise<EventoOcorrencia[]> {
  try {
    const { data, error } = await cloud()
      .from("ocorrencia_historico")
      .select("*")
      .eq("ocorrencia_id", ocorrenciaId)
      .order("created_at", { ascending: true });
    if (error) {
      if (tabelaAusente(error)) return [];
      throw traduzErro(error);
    }
    return (data ?? []).map((r: unknown) => eventoDoRow(r as Linha));
  } catch (e) {
    if (tabelaAusente(e)) return [];
    throw e instanceof Error ? e : traduzErro(e);
  }
}
