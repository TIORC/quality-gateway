-- ---------------------------------------------------------------------------
-- Células: grupos de colaboradores dentro de um setor (Configurações > Célula).
-- ---------------------------------------------------------------------------
-- Idempotente: pode rodar de novo sem duplicar tabelas, políticas ou gatilhos.
-- Segue o padrão das tabelas da estrutura organizacional (20260915030000_org.sql):
-- o app não usa o login do Supabase Auth, então as políticas liberam anon e
-- authenticated, como em `setores` e `colaboradores`.

-- Células ---------------------------------------------------------------------
create table if not exists public.celulas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  setor_id text not null references public.setores (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint celulas_nome_nao_vazio check (btrim(nome) <> '')
);

comment on table public.celulas is 'Células: grupos de colaboradores dentro de um setor.';

-- Uma célula não repete nome dentro do mesmo setor (sem diferenciar maiúsculas).
create unique index if not exists celulas_setor_nome_uniq
  on public.celulas (setor_id, lower(btrim(nome)));
create index if not exists celulas_setor_id_idx on public.celulas (setor_id);

-- Colaboradores de cada célula ------------------------------------------------
create table if not exists public.celula_colaboradores (
  celula_id uuid not null references public.celulas (id) on delete cascade,
  colaborador_id text not null references public.colaboradores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (celula_id, colaborador_id)
);

comment on table public.celula_colaboradores is 'Vínculo entre células e colaboradores (N:N).';
create index if not exists celula_colaboradores_colaborador_idx
  on public.celula_colaboradores (colaborador_id);

-- updated_at automático -------------------------------------------------------
drop trigger if exists celulas_set_updated_at on public.celulas;
create trigger celulas_set_updated_at
  before update on public.celulas
  for each row execute function public.org_set_updated_at();

-- Acesso ----------------------------------------------------------------------
do $$
declare
  tabela text;
begin
  foreach tabela in array array['celulas', 'celula_colaboradores'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "%s: leitura" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: leitura" on public.%I for select to anon, authenticated using (true)',
      tabela, tabela
    );
    execute format('drop policy if exists "%s: escrita" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: escrita" on public.%I for all to anon, authenticated using (true) with check (true)',
      tabela, tabela
    );
  end loop;
end
$$;
