-- ---------------------------------------------------------------------------
-- Prazo para aceitar respostas de uma pesquisa (configuração da pesquisa)
-- ---------------------------------------------------------------------------
--   * `prazo_respostas` null = a pesquisa aceita respostas sem prazo.
--   * Depois do prazo, o banco recusa novas respostas (regra no insert), então
--     a checagem não depende só da tela pública.
--   * Editável em "Editar pesquisa"; apagar o prazo volta a aceitar sem limite.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.pesquisas_modelos
  add column if not exists prazo_respostas timestamptz;

drop policy if exists "pesquisas_respostas: resposta" on public.pesquisas_respostas;
create policy "pesquisas_respostas: resposta"
  on public.pesquisas_respostas for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.pesquisas_modelos m
      where m.id = modelo_id
        and (m.prazo_respostas is null or now() < m.prazo_respostas)
    )
  );
