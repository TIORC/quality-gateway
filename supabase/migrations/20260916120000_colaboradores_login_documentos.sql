-- ---------------------------------------------------------------------------
-- Login de colaboradores e liberação individual de documentos
-- ---------------------------------------------------------------------------
-- 1. Vincula a conta de login (usuarios) ao registro organizacional
--    (colaboradores) da mesma pessoa.
-- 2. Cria a tabela `documentos_liberados`, que guarda os POPs liberados
--    individualmente a um colaborador (nível "Colaborador de outra unidade").
--
-- Idempotente: pode rodar de novo sem duplicar colunas, índices ou políticas.
-- As políticas seguem o padrão aberto já usado nas outras tabelas do projeto.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Vínculo login (usuarios) <-> registro organizacional (colaboradores)
alter table public.usuarios
  add column if not exists colaborador_id text references public.colaboradores (id) on delete set null;

create unique index if not exists usuarios_colaborador_id_idx
  on public.usuarios (colaborador_id) where colaborador_id is not null;

-- Liberação individual de documentos por colaborador
create table if not exists public.documentos_liberados (
  id uuid primary key default gen_random_uuid(),
  colaborador_id text not null references public.colaboradores (id) on delete cascade,
  documento_tipo text not null default 'pop',
  documento_id uuid not null references public.pops (id) on delete cascade,
  criado_por text not null default '',
  created_at timestamptz not null default now(),
  unique (colaborador_id, documento_tipo, documento_id)
);

comment on table public.documentos_liberados is 'Documentos (POPs) liberados individualmente a um colaborador.';

create index if not exists documentos_liberados_colaborador_idx
  on public.documentos_liberados (colaborador_id);
create index if not exists documentos_liberados_documento_idx
  on public.documentos_liberados (documento_tipo, documento_id);

-- RLS no mesmo padrão das outras tabelas (aberta, igual ao resto do projeto)
alter table public.documentos_liberados enable row level security;

drop policy if exists "documentos_liberados: leitura" on public.documentos_liberados;
create policy "documentos_liberados: leitura" on public.documentos_liberados
  for select to anon, authenticated using (true);

drop policy if exists "documentos_liberados: escrita" on public.documentos_liberados;
create policy "documentos_liberados: escrita" on public.documentos_liberados
  for all to anon, authenticated using (true) with check (true);

-- Vincula os usuários já existentes ao colaborador de mesmo e-mail
update public.usuarios u
set colaborador_id = c.id
from public.colaboradores c
where u.colaborador_id is null
  and lower(u.email) = lower(c.email);
