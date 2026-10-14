alter table public.pop_anotacoes add column if not exists destinatario_email text not null default '';
alter table public.politicas add column if not exists aprovado_por_nome text not null default '';
alter table public.politicas add column if not exists aprovado_em timestamptz;
alter table public.politicas add column if not exists divulgado_por_nome text not null default '';
alter table public.politicas add column if not exists divulgado_em timestamptz;
create table if not exists public.logs_atividade (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  acao text not null check (acao in ('adicionado','editado','movimentado','excluido')),
  entidade text not null check (entidade in ('pop','politica')),
  entidade_id text not null default '', codigo text not null default '',
  titulo text not null default '', detalhe text not null default '',
  dados jsonb not null default '{}'::jsonb,
  ator_id text not null default '', ator_nome text not null default '', ator_email text not null default ''
);
create index if not exists logs_atividade_created_idx on public.logs_atividade (created_at desc);
grant select, insert on public.logs_atividade to anon, authenticated;
grant all on public.logs_atividade to service_role;
alter table public.logs_atividade enable row level security;
drop policy if exists "logs_atividade: leitura" on public.logs_atividade;
create policy "logs_atividade: leitura" on public.logs_atividade for select to anon, authenticated using (true);
drop policy if exists "logs_atividade: registro" on public.logs_atividade;
create policy "logs_atividade: registro" on public.logs_atividade for insert to anon, authenticated with check (true);