/**
 * Ocorrências — camada de dados usada pela máquina de fluxo.
 *
 * As operações de `ocorrencias-crud.ts` recebem uma loja. Em produção ela é o
 * Supabase (`lojaSupabase`); no laboratório de simulação é uma loja em memória,
 * que não toca no banco.
 */
import { traduzErro } from "@/lib/organizacao";
import { fluxoVazio, type MacroFluxo, type Ocorrencia } from "@/lib/ocorrencias";
import {
  cloud,
  listarFluxos,
  listarOcorrencias,
  type Linha,
} from "@/lib/ocorrencias-base";

export interface LojaOcorrencias {
  inserirOcorrencia(linha: Linha): Promise<Linha>;
  atualizarOcorrencia(id: string, patch: Linha): Promise<void>;
  listarOcorrencias(): Promise<Ocorrencia[]>;
  registrarHistorico(linha: Linha): Promise<void>;
  /** Falha silenciosa: notificação nunca bloqueia a tratativa. */
  notificar(linhas: Linha[]): Promise<void>;
  carregarFluxo(tipoId: string, versao: number): Promise<MacroFluxo[]>;
}

export const lojaSupabase: LojaOcorrencias = {
  async inserirOcorrencia(linha) {
    const { data, error } = await cloud().from("ocorrencias").insert(linha).select("*").single();
    if (error) throw traduzErro(error);
    return data as Linha;
  },

  async atualizarOcorrencia(id, patch) {
    const { error } = await cloud().from("ocorrencias").update(patch).eq("id", id);
    if (error) throw traduzErro(error);
  },

  listarOcorrencias,

  async registrarHistorico(linha) {
    const { error } = await cloud().from("ocorrencia_historico").insert(linha);
    if (error) throw traduzErro(error);
  },

  async notificar(linhas) {
    try {
      await cloud().from("notificacoes").insert(linhas);
    } catch {
      /* sem tabela de notificações: ignora */
    }
  },

  async carregarFluxo(tipoId, versao) {
    const versoes = await listarFluxos(tipoId).catch(() => []);
    const escolhida = versoes.find((f) => f.versao === versao) ?? versoes[versoes.length - 1];
    return escolhida?.etapas ?? fluxoVazio();
  },
};
