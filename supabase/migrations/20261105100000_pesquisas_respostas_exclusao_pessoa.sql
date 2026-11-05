-- ---------------------------------------------------------------------------
-- Exclusão de respostas por pessoa (menu Configurações de Pesquisas)
-- ---------------------------------------------------------------------------
--   * Permite apagar envios inteiros de `pesquisas_respostas` (um envio = uma
--     pessoa respondendo uma pesquisa) e as notas NPS desses envios.
--   * Só Desenvolvedor do Sistema e Gestor da Qualidade veem o menu (interface),
--     como nas demais exclusões. A política segue o padrão das outras tabelas.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

drop policy if exists "pesquisas_respostas: exclusao" on public.pesquisas_respostas;
create policy "pesquisas_respostas: exclusao"
  on public.pesquisas_respostas for delete
  to anon, authenticated
  using (true);

drop policy if exists "nps_respostas: exclusao" on public.nps_respostas;
create policy "nps_respostas: exclusao"
  on public.nps_respostas for delete
  to anon, authenticated
  using (true);
