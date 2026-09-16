create extension if not exists "pgcrypto";

alter table public.usuarios
  add column if not exists colaborador_id text references public.colaboradores (id) on delete set null;

create unique index if not exists usuarios_colaborador_id_idx
  on public.usuarios (colaborador_id) where colaborador_id is not null;

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

grant select, insert, update, delete on public.documentos_liberados to anon, authenticated;
grant all on public.documentos_liberados to service_role;

create index if not exists documentos_liberados_colaborador_idx
  on public.documentos_liberados (colaborador_id);
create index if not exists documentos_liberados_documento_idx
  on public.documentos_liberados (documento_tipo, documento_id);

alter table public.documentos_liberados enable row level security;

drop policy if exists "documentos_liberados: leitura" on public.documentos_liberados;
create policy "documentos_liberados: leitura" on public.documentos_liberados
  for select to anon, authenticated using (true);

drop policy if exists "documentos_liberados: escrita" on public.documentos_liberados;
create policy "documentos_liberados: escrita" on public.documentos_liberados
  for all to anon, authenticated using (true) with check (true);

update public.usuarios u
set colaborador_id = c.id
from public.colaboradores c
where u.colaborador_id is null
  and lower(u.email) = lower(c.email);

alter table public.pop_favoritos
  add column if not exists colaborador_id text
    references public.colaboradores (id) on delete cascade;

comment on column public.pop_favoritos.colaborador_id is
  'Registro do colaborador que favoritou o POP (public.colaboradores.id).';

update public.pop_favoritos f
   set colaborador_id = c.id
  from public.colaboradores c
 where f.colaborador_id is null
   and lower(c.email) = lower(f.usuario_email);

update public.pop_favoritos f
   set usuario_nome = c.nome
  from public.colaboradores c
 where c.id = f.colaborador_id
   and (f.usuario_nome = '' or f.usuario_nome is null);

create index if not exists pop_favoritos_colaborador_id_idx
  on public.pop_favoritos (colaborador_id);