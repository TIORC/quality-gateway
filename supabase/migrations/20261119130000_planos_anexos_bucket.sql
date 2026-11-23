-- ---------------------------------------------------------------------------
-- Bucket privado `pop-anexos` (anexos de planos de ação, POPs e ocorrências)
-- ---------------------------------------------------------------------------
-- O bucket não existe no projeto atual (a API responde "Bucket not found"), por
-- isso o envio de arquivos falha. Esta migration cria o bucket privado e as
-- políticas no mesmo padrão de 20260916020000_pop_conteudo_anexos_leituras.sql.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).

insert into storage.buckets (id, name, public)
values ('pop-anexos', 'pop-anexos', false)
on conflict (id) do update set public = false;

drop policy if exists "pop-anexos: leitura" on storage.objects;
create policy "pop-anexos: leitura"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: envio" on storage.objects;
create policy "pop-anexos: envio"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: atualizacao" on storage.objects;
create policy "pop-anexos: atualizacao"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'pop-anexos')
  with check (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: exclusao" on storage.objects;
create policy "pop-anexos: exclusao"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'pop-anexos');
