-- ---------------------------------------------------------------------------
-- Ocorrências: volta à RLS aberta original (mesmo padrão das demais tabelas do
-- portal). Desfaz a tentativa de RLS por papel baseada em JWT. Idempotente.
-- ---------------------------------------------------------------------------

drop view if exists public.ocorrencias_visiveis;
drop view if exists public.ocorrencia_historico_visivel;
drop function if exists public.ocorrencia_numeros() cascade;
drop function if exists public.sgq_ve_internos(text) cascade;
drop function if exists public.sgq_configurador() cascade;
drop function if exists public.sgq_desenvolvedor() cascade;
drop function if exists public.sgq_operador() cascade;
drop function if exists public.sgq_nivel() cascade;
drop function if exists public.sgq_email() cascade;

do $$
declare
  t text;
begin
  foreach t in array array['ocorrencia_tipos','ocorrencia_formularios','ocorrencia_fluxos','ocorrencias','ocorrencia_historico'] loop
    execute format('drop policy if exists %I on public.%I', t || ': leitura', t);
    execute format('drop policy if exists %I on public.%I', t || ': escrita', t);
    execute format('drop policy if exists %I on public.%I', t || ': insert', t);
    execute format('drop policy if exists %I on public.%I', t || ': update', t);
    execute format('drop policy if exists %I on public.%I', t || ': delete', t);
  end loop;

  foreach t in array array['ocorrencia_tipos','ocorrencia_formularios','ocorrencia_fluxos','ocorrencias'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || ': leitura', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || ': escrita', t);
  end loop;
end $$;

create policy "ocorrencia_historico: leitura"
  on public.ocorrencia_historico for select
  to anon, authenticated
  using (true);

create policy "ocorrencia_historico: insert"
  on public.ocorrencia_historico for insert
  to anon, authenticated
  with check (true);
