-- ---------------------------------------------------------------------------
-- E-mail de quem respondeu a pesquisa de satisfação.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.pesquisas_satisfacao add column if not exists email text not null default '';
