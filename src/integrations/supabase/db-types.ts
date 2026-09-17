/**
 * Apelidos de tipos das tabelas do Lovable Cloud.
 *
 * `types.ts` é gerado automaticamente a partir do banco, por isso os apelidos
 * usados pelo projeto ficam aqui.
 */

import type { Database } from "@/integrations/supabase/types";

export type PopSetorRow = Database["public"]["Tables"]["pop_setores"]["Row"];
export type PopRow = Database["public"]["Tables"]["pops"]["Row"];
export type PopInsert = Database["public"]["Tables"]["pops"]["Insert"];
export type PopUpdate = Database["public"]["Tables"]["pops"]["Update"];
export type PopAnotacaoRow = Database["public"]["Tables"]["pop_anotacoes"]["Row"];
export type PopAnotacaoInsert = Database["public"]["Tables"]["pop_anotacoes"]["Insert"];
export type PopAnotacaoUpdate = Database["public"]["Tables"]["pop_anotacoes"]["Update"];
export type PopFavoritoRow = Database["public"]["Tables"]["pop_favoritos"]["Row"];
export type PopFavoritoInsert = Database["public"]["Tables"]["pop_favoritos"]["Insert"];
export type PopFavoritoUpdate = Database["public"]["Tables"]["pop_favoritos"]["Update"];
export type PopLeituraRow = Database["public"]["Tables"]["pop_leituras"]["Row"];
export type PopLeituraInsert = Database["public"]["Tables"]["pop_leituras"]["Insert"];
export type PopLeituraUpdate = Database["public"]["Tables"]["pop_leituras"]["Update"];
export type NotificacaoRow = Database["public"]["Tables"]["notificacoes"]["Row"];
export type NotificacaoInsert = Database["public"]["Tables"]["notificacoes"]["Insert"];
export type NotificacaoUpdate = Database["public"]["Tables"]["notificacoes"]["Update"];
export type PlanoDeAcaoRow = Database["public"]["Tables"]["planos_de_acao"]["Row"];
export type PlanoDeAcaoInsert = Database["public"]["Tables"]["planos_de_acao"]["Insert"];
export type PlanoDeAcaoUpdate = Database["public"]["Tables"]["planos_de_acao"]["Update"];
export type PoliticaRow = Database["public"]["Tables"]["politicas"]["Row"];
export type PoliticaInsert = Database["public"]["Tables"]["politicas"]["Insert"];
export type PoliticaUpdate = Database["public"]["Tables"]["politicas"]["Update"];
export type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
export type EmpresaInsert = Database["public"]["Tables"]["empresas"]["Insert"];
export type EmpresaUpdate = Database["public"]["Tables"]["empresas"]["Update"];
export type SetorRow = Database["public"]["Tables"]["setores"]["Row"];
export type SetorInsert = Database["public"]["Tables"]["setores"]["Insert"];
export type SetorUpdate = Database["public"]["Tables"]["setores"]["Update"];
export type CargoRow = Database["public"]["Tables"]["cargos"]["Row"];
export type CargoInsert = Database["public"]["Tables"]["cargos"]["Insert"];
export type CargoUpdate = Database["public"]["Tables"]["cargos"]["Update"];
export type UnidadeRow = Database["public"]["Tables"]["unidades"]["Row"];
export type UnidadeInsert = Database["public"]["Tables"]["unidades"]["Insert"];
export type UnidadeUpdate = Database["public"]["Tables"]["unidades"]["Update"];
export type ColaboradorRow = Database["public"]["Tables"]["colaboradores"]["Row"];
export type ColaboradorInsert = Database["public"]["Tables"]["colaboradores"]["Insert"];
export type ColaboradorUpdate = Database["public"]["Tables"]["colaboradores"]["Update"];
export type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
export type UsuarioInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
export type UsuarioUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
export type DocumentoLiberadoRow = Database["public"]["Tables"]["documentos_liberados"]["Row"];
export type DocumentoLiberadoInsert =
  Database["public"]["Tables"]["documentos_liberados"]["Insert"];
export type DocumentoLiberadoUpdate =
  Database["public"]["Tables"]["documentos_liberados"]["Update"];
