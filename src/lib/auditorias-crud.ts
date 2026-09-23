import { traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";
import type { UserSession } from "@/lib/auth";
import type { TipoAuditoria } from "@/lib/dados";
import { dataBrParaISO } from "@/lib/projetos";
import { auditoriaDoRow, type Rec } from "@/lib/auditorias-base";
import type { Auditoria, PessoaAuditoria, ResultadoAuditoria } from "@/lib/auditorias";

export interface NovaAuditoriaInput {
  codigo: string;
  titulo: string;
  tipo: TipoAuditoria;
  norma: string;
  unidade: string;
  dataPlanejada: string;
  setoresAuditados: string[];
  relatorio: string;
  evidencias: string;
  auditores: PessoaAuditoria[];
  auditados: PessoaAuditoria[];
  resultado: ResultadoAuditoria;
  resultadoRef: string;
}

/** Registra uma auditoria programada (e, se houver, o resultado gerado). */
export async function criarAuditoria(
  input: NovaAuditoriaInput,
  sessao: UserSession | null,
): Promise<Auditoria> {
  const client = clienteLivre();
  const dataPlanejada = input.dataPlanejada.trim() ? dataBrParaISO(input.dataPlanejada) : null;
  const { data, error } = await client
    .from("auditorias")
    .insert({
      codigo: input.codigo.trim(),
      titulo: input.titulo.trim(),
      tipo: input.tipo,
      norma: input.norma,
      unidade: input.unidade,
      data_planejada: dataPlanejada,
      setores_auditados: input.setoresAuditados,
      relatorio: input.relatorio.trim(),
      evidencias: input.evidencias.trim(),
      auditores: input.auditores,
      auditados: input.auditados,
      resultado: input.resultado,
      resultado_ref: input.resultadoRef,
      criada_por_nome: sessao?.nome ?? "",
      criada_por_email: (sessao?.email ?? "").toLowerCase(),
    })
    .select("*")
    .single();
  if (error) throw traduzErro(error);
  return auditoriaDoRow(data as unknown as Rec);
}
