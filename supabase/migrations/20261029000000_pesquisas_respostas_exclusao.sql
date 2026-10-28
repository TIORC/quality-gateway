-- ---------------------------------------------------------------------------
-- Exclusão de dados de respostas (botão "Exclusão de Dados" em Pesquisas)
-- ---------------------------------------------------------------------------
--   * Permite apagar a resposta de uma pergunta (uma empresa + pessoa) e
--     remover uma pergunta inteira de uma pesquisa (ajuste das respostas).
--   * Só Desenvolvedor do Sistema e Gestor da Qualidade veem o botão (interface),
--     como na exclusão de pesquisas. A política segue o mesmo padrão das outras.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

drop policy if exists "pesquisas_respostas: edicao" on public.pesquisas_respostas;
create policy "pesquisas_respostas: edicao"
  on public.pesquisas_respostas for update
  to anon, authenticated
  using (true)
  with check (true);
