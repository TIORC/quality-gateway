-- ---------------------------------------------------------------------------
-- Empresas exibidas no portal (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Guarda o nome da empresa e a filial mostrados na barra superior do painel,
-- no formato "NOME DA EMPRESA | FILIAL". Quando a tabela está vazia, o painel
-- simplesmente não exibe esse texto.
--
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente: pode rodar de
--      novo sem duplicar a tabela, as políticas ou o registro de exemplo.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Empresas ---------------------------------------------------------------------
create table if not exists public.empresas (
  id text primary key,
  nome text not null,
  filial text not null default '',
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.empresas is 'Empresas (nome + filial) exibidas na barra superior do painel.';

-- updated_at automático --------------------------------------------------------
create or replace function public.empresas_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists empresas_set_updated_at on public.empresas;
create trigger empresas_set_updated_at
  before update on public.empresas
  for each row execute function public.empresas_set_updated_at();

-- Acesso -----------------------------------------------------------------------
alter table public.empresas enable row level security;

drop policy if exists "empresas: leitura" on public.empresas;
create policy "empresas: leitura" on public.empresas
  for select to anon, authenticated using (true);

drop policy if exists "empresas: escrita" on public.empresas;
create policy "empresas: escrita" on public.empresas
  for all to anon, authenticated using (true) with check (true);

-- Registro inicial -------------------------------------------------------------
-- A empresa com a menor `ordem` é a exibida no painel.
-- Para deixar o cabeçalho sem nenhuma empresa, basta apagar a tabela:
--   delete from public.empresas;
insert into public.empresas (id, nome, filial, ordem) values
  ('empresa-principal', 'ORCOMA ORGANIZACAO COMERCIAL E SERVICOS LTDA', 'Matriz', 0)
on conflict (id) do update set
  nome = excluded.nome,
  filial = excluded.filial,
  ordem = excluded.ordem;
