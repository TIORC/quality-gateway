-- ---------------------------------------------------------------------------
-- Exclusão de pesquisas criadas (botão "Excluir" na lista de pesquisas)
-- ---------------------------------------------------------------------------
--   * Só Desenvolvedor do Sistema e Gestor da Qualidade veem o botão (interface),
--     como na criação e edição. A política segue o mesmo padrão das outras.
--   * As respostas da pesquisa são apagadas junto (on delete cascade).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

drop policy if exists "pesquisas_modelos: exclusao" on public.pesquisas_modelos;
create policy "pesquisas_modelos: exclusao"
  on public.pesquisas_modelos for delete
  to anon, authenticated
  using (true);
