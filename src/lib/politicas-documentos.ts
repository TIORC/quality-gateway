/**
 * Documentos para download de uma política (planilhas, Word, Excel, PDF...).
 * Metadados em `public.politica_documentos`; funções em
 * 20261124140000_politica_documentos.sql.
 */
import { criarServicoDocumentos } from "@/lib/documentos-download";

export const servicoDocumentosPolitica = criarServicoDocumentos({
  tabela: "politica_documentos",
  colunaEntidade: "politica_id",
  rpcAdicionar: "adicionar_documento_politica",
  paramEntidade: "p_politica_id",
  rpcRemover: "remover_documento_politica",
});
