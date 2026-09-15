-- ---------------------------------------------------------------------------
-- POPs — Anotações / discussão (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Como aplicar:
--   Cole este arquivo inteiro no SQL editor do Lovable Cloud e execute. É
--   idempotente: pode rodar de novo sem duplicar a tabela ou as políticas.
-- ---------------------------------------------------------------------------

-- Anotações (comentários) registrados em cada POP -----------------------------
create table if not exists public.pop_anotacoes (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  autor_nome text not null default '',
  autor_email text not null default '',
  mensagem text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.pop_anotacoes is 'Comentários/discussão registrados nos POPs.';
comment on column public.pop_anotacoes.autor_nome is 'Nome de quem escreveu a anotação.';
comment on column public.pop_anotacoes.autor_email is 'E-mail de quem escreveu a anotação.';
create index if not exists pop_anotacoes_pop_id_idx on public.pop_anotacoes (pop_id);
create index if not exists pop_anotacoes_created_at_idx on public.pop_anotacoes (pop_id, created_at);

-- Acesso ----------------------------------------------------------------------
alter table public.pop_anotacoes enable row level security;

drop policy if exists "pop_anotacoes: leitura" on public.pop_anotacoes;
create policy "pop_anotacoes: leitura"
  on public.pop_anotacoes for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_anotacoes: escrita" on public.pop_anotacoes;
create policy "pop_anotacoes: escrita"
  on public.pop_anotacoes for all
  to anon, authenticated
  using (true)
  with check (true);