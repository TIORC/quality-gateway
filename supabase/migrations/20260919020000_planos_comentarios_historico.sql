-- Planos de Ação completos + Painel/Notificações (Fase 1) — parte 2/2

create table if not exists public.plano_comentarios (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_de_acao (id) on delete cascade,
  autor_id text not null default '',
  autor_nome text not null default '',
  autor_email text not null default '',
  mensagem text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists plano_comentarios_plano_idx on public.plano_comentarios (plano_id, created_at);

create table if not exists public.plano_historico (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_de_acao (id) on delete cascade,
  autor_id text not null default '',
  autor_nome text not null default '',
  autor_email text not null default '',
  campo text not null default '',
  de text not null default '',
  para text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists plano_historico_plano_idx on public.plano_historico (plano_id, created_at);

alter table public.notificacoes add column if not exists plano_id uuid references public.planos_de_acao (id) on delete cascade;
create index if not exists notificacoes_plano_idx on public.notificacoes (plano_id);
create index if not exists notificacoes_dest_lida_idx on public.notificacoes (destinatario_email, lida, created_at desc);

alter table public.plano_origens enable row level security;
alter table public.plano_comentarios enable row level security;
alter table public.plano_historico enable row level security;

drop policy if exists "plano_origens: leitura" on public.plano_origens;
create policy "plano_origens: leitura" on public.plano_origens for select to anon, authenticated using (true);
drop policy if exists "plano_origens: escrita" on public.plano_origens;
create policy "plano_origens: escrita" on public.plano_origens for all to anon, authenticated using (true) with check (true);

drop policy if exists "plano_comentarios: leitura" on public.plano_comentarios;
create policy "plano_comentarios: leitura" on public.plano_comentarios for select to anon, authenticated using (true);
drop policy if exists "plano_comentarios: escrita" on public.plano_comentarios;
create policy "plano_comentarios: escrita" on public.plano_comentarios for all to anon, authenticated using (true) with check (true);

drop policy if exists "plano_historico: leitura" on public.plano_historico;
create policy "plano_historico: leitura" on public.plano_historico for select to anon, authenticated using (true);
drop policy if exists "plano_historico: escrita" on public.plano_historico;
create policy "plano_historico: escrita" on public.plano_historico for all to anon, authenticated using (true) with check (true);
