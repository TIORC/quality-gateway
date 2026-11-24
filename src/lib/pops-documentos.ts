/**
 * Documentos para download de um POP (planilhas, Word, Excel, PDF...).
 * Metadados em `public.pop_documentos`; funções em
 * 20261124130000_pop_documentos.sql.
 */
import { criarServicoDocumentos } from "@/lib/documentos-download";

export const servicoDocumentosPop = criarServicoDocumentos({
  tabela: "pop_documentos",
  colunaEntidade: "pop_id",
  rpcAdicionar: "adicionar_documento_pop",
  paramEntidade: "p_pop_id",
  rpcRemover: "remover_documento_pop",
});
