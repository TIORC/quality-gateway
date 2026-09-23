-- ---------------------------------------------------------------------------
-- Projetos e Planejamento Estratégico (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Idempotent: pode rodar de novo sem duplicar tabelas, políticas ou registros.
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor.
--   2. Cole este arquivo inteiro e execute.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Projetos / planejamentos estratégicos --------------------------------------
create table if not exists public.projetos_estrategicos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null default 'Planejamento Estratégico'
    check (tipo in ('Planejamento Estratégico', 'Projeto')),
  objetivo text not null default '',
  setor text not null default 'Qualidade',
  responsavel_id text not null default '',
  responsavel_nome text not null default '',
  responsavel_email text not null default '',
  grupo_alvo text not null default '',
  inicio date,
  fim_previsto date,
  fim_real date,
  prioridade text not null default 'Média'
    check (prioridade in ('Crítica', 'Alta', 'Média', 'Baixa')),
  status text not null default 'planejamento'
    check (status in ('planejamento', 'em_andamento', 'concluido', 'cancelado', 'pausado')),
    swot jsonb not null default ('{"forcas":[],"fraquezas":[],"oportunidades":[],"ameacas":[]}'::jsonb),
  frentes jsonb not null default '[]'::jsonb,
  kanban_colunas jsonb not null default '[{"id":"afazer","nome":"A fazer","status":["nao_iniciado","aberta"]},{"id":"andamento","nome":"Em andamento","status":["em_andamento","atrasada"]},{"id":"concluido","nome":"Concluído","status":["concluida","cancelado"]}]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projetos_estrategicos is 'Projetos e planos de longo prazo alinhados à estratégia.';
comment on column public.projetos_estrategicos.swot is 'Matriz SWOT: forças, fraquezas, oportunidades e ameaças (arrays de texto).';
comment on column public.projetos_estrategicos.frentes is 'Frentes de trabalho do projeto: [{id, nome, descricao, setores}].';
comment on column public.projetos_estrategicos.kanban_colunas is 'Definição das colunas do Kanban de ações deste projeto.';
comment on column public.projetos_estrategicos.grupo_alvo is 'Grupo de acesso que pode visualizar/editar este projeto.';

create index if not exists projetos_estrategicos_status_idx on public.projetos_estrategicos (status);
create index if not exists projetos_estrategicos_setor_idx on public.projetos_estrategicos (setor);
create index if not exists projetos_estrategicos_responsavel_idx on public.projetos_estrategicos (responsavel_email);

-- updated_at automático ------------------------------------------------------
create or replace function public.projetos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projetos_set_updated_at on public.projetos_estrategicos;
create trigger projetos_set_updated_at
  before update on public.projetos_estrategicos
  for each row
  execute function public.projetos_set_updated_at();

-- Acesso ---------------------------------------------------------------------
alter table public.projetos_estrategicos enable row level security;

drop policy if exists "projetos_estrategicos: leitura" on public.projetos_estrategicos;
create policy "projetos_estrategicos: leitura"
  on public.projetos_estrategicos for select
  to anon, authenticated
  using (true);

drop policy if exists "projetos_estrategicos: escrita" on public.projetos_estrategicos;
create policy "projetos_estrategicos: escrita"
  on public.projetos_estrategicos for all
  to anon, authenticated
  using (true)
  with check (true);

-- Grupos de acesso ----------------------------------------------------------
create table if not exists public.grupos_acessos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  modulos_perm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grupos_acessos_nome_unique'
  ) then
    alter table public.grupos_acessos
      add constraint grupos_acessos_nome_unique unique (nome);
  end if;
end
$$;

create table if not exists public.grupo_membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_acessos (id) on delete cascade,
  colaborador_id text not null,
  created_at timestamptz not null default now(),
  unique (grupo_id, colaborador_id)
);
create index if not exists grupo_membros_grupo_idx on public.grupo_membros (grupo_id);
create index if not exists grupo_membros_colaborador_idx on public.grupo_membros (colaborador_id);

create table if not exists public.projeto_grupos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos_estrategicos (id) on delete cascade,
  grupo_id uuid not null references public.grupos_acessos (id) on delete cascade,
  pode_ver boolean not null default true,
  pode_editar boolean not null default false,
  created_at timestamptz not null default now(),
  unique (projeto_id, grupo_id)
);
create index if not exists projeto_grupos_projeto_idx on public.projeto_grupos (projeto_id);
create index if not exists projeto_grupos_grupo_idx on public.projeto_grupos (grupo_id);

-- Acesso (grupos) -------------------------------------------------------------
alter table public.grupos_acessos enable row level security;
alter table public.grupo_membros enable row level security;
alter table public.projeto_grupos enable row level security;

drop policy if exists "grupos_acessos: leitura" on public.grupos_acessos;
create policy "grupos_acessos: leitura"
  on public.grupos_acessos for select
  to anon, authenticated
  using (true);

drop policy if exists "grupos_acessos: escrita" on public.grupos_acessos;
create policy "grupos_acessos: escrita"
  on public.grupos_acessos for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "grupo_membros: leitura" on public.grupo_membros;
create policy "grupo_membros: leitura"
  on public.grupo_membros for select
  to anon, authenticated
  using (true);

drop policy if exists "grupo_membros: escrita" on public.grupo_membros;
create policy "grupo_membros: escrita"
  on public.grupo_membros for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "projeto_grupos: leitura" on public.projeto_grupos;
create policy "projeto_grupos: leitura"
  on public.projeto_grupos for select
  to anon, authenticated
  using (true);

drop policy if exists "projeto_grupos: escrita" on public.projeto_grupos;
create policy "projeto_grupos: escrita"
  on public.projeto_grupos for all
  to anon, authenticated
  using (true)
  with check (true);

-- Seed: grupos compatíveis com os grupos personalizados legados --------------
insert into public.grupos_acessos (nome, descricao, modulos_perm)
values
  ('Rotina de indicadores', 'Acompanhamento de indicadores', '{"projetos":{"ver":true,"editar":false}}'::jsonb),
  ('Aprovadores de POP', 'Aprovação de POPs', '{"projetos":{"ver":true,"editar":false}}'::jsonb),
  ('Comitê de riscos', 'Gestão de riscos', '{"projetos":{"ver":true,"editar":true}}'::jsonb),
  ('CIPA', 'Comissão de prevenção de acidentes', '{"projetos":{"ver":true,"editar":false}}'::jsonb)
on conflict (nome) do nothing;
