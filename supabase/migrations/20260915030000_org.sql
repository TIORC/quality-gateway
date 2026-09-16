-- ---------------------------------------------------------------------------
-- Estrutura organizacional e autenticação (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Remove os dados hardcoded do front-end (setores, cargos, unidades,
-- colaboradores e usuários de login) e passa a persistir tudo no banco.
--
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente: pode rodar de
--      novo sem duplicar tabelas, políticas ou os registros de exemplo.
--   3. Garanta que `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
--      (ou `VITE_SUPABASE_ANON_KEY`) estão disponíveis no front-end.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Setores da organização ------------------------------------------------------
create table if not exists public.setores (
  id text primary key,
  nome text not null unique,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.setores is 'Setores da organização (TI, Qualidade, Fiscal, etc.).';

-- Cargos, organizados por setor -------------------------------------------------
create table if not exists public.cargos (
  id text primary key,
  setor_id text not null references public.setores (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setor_id, nome)
);

comment on table public.cargos is 'Cargos de cada setor — alimenta o cadastro de colaboradores.';
create index if not exists cargos_setor_id_idx on public.cargos (setor_id);

-- Unidades da empresa -----------------------------------------------------------
create table if not exists public.unidades (
  id text primary key,
  nome text not null unique,
  cidade text not null default '',
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.unidades is 'Unidades da empresa (Matriz, Filial 1, Filial 2...).';

-- Colaboradores ------------------------------------------------------------------
create table if not exists public.colaboradores (
  id text primary key,
  nome text not null,
  email text not null default '',
  cargo text not null default 'Sem cargo',
  unidade text not null default 'Matriz',
  cidade text not null default '',
  setor text not null default '',
  nivel_acesso text not null default 'Colaborador',
  grupos text not null default '',
  exclusao text not null default 'Sem acesso',
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  ultimo_acesso timestamptz,
  processos_visualizados integer not null default 0,
  processos_lidos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.colaboradores is 'Cadastro de colaboradores do portal.';
create unique index if not exists colaboradores_email_idx on public.colaboradores (lower(email));

-- Usuários de login -------------------------------------------------------------
-- Senha guardada como hash (SHA-256) com salt por usuário — verifica-se no
-- cliente apenas a comparação do hash; nunca a senha em texto puro.
create table if not exists public.usuarios (
  id text primary key,
  nome text not null,
  email text not null,
  senha_salt text not null,
  senha_hash text not null,
  role text not null default 'usuario' check (role in ('admin', 'gestor', 'usuario')),
  cargo text not null default '',
  setor text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.usuarios is 'Credenciais de acesso ao portal.';
create unique index if not exists usuarios_email_idx on public.usuarios (lower(email));

-- updated_at automático ----------------------------------------------------------
create or replace function public.org_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['setores', 'cargos', 'unidades', 'colaboradores', 'usuarios'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', tabela, tabela);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.org_set_updated_at()',
      tabela, tabela
    );
  end loop;
end;
$$;

-- Acesso -------------------------------------------------------------------------
do $$
declare
  tabela text;
begin
  foreach tabela in array array['setores', 'cargos', 'unidades', 'colaboradores', 'usuarios'] loop
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
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados iniciais (migrados do mock de desenvolvimento)
-- ---------------------------------------------------------------------------

-- Setores
insert into public.setores (id, nome, ordem) values
  ('qualidade',     'Qualidade',     0),
  ('ti',            'TI',            1),
  ('fiscal',        'Fiscal',        2),
  ('contabil',      'Contábil',      3),
  ('sucesso-do-cliente', 'Sucesso do Cliente', 4),
  ('financeiro',    'Financeiro',    5),
  ('rh',            'RH',            6),
  ('operacoes',     'Operações',     7),
  ('direcao',       'Direção',       8),
  ('tecnico',       'Técnico',       9)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem;

-- Unidades
insert into public.unidades (id, nome, cidade, ordem) values
  ('matriz',   'Matriz',   'Maracás/BA', 0),
  ('filial-1', 'Filial 1', '',           1),
  ('filial-2', 'Filial 2', '',           2)
on conflict (id) do update set nome = excluded.nome, cidade = excluded.cidade, ordem = excluded.ordem;

-- Cargos
insert into public.cargos (id, setor_id, nome, ordem) values
  ('cargo_qualidade_0', 'qualidade', 'Coordenador da Qualidade', 0),
  ('cargo_qualidade_1', 'qualidade', 'Assistente de Qualidade',  1),
  ('cargo_qualidade_2', 'qualidade', 'Auxiliar de Qualidade',    2),
  ('cargo_ti_0', 'ti', 'Desenvolvedor Pleno',       0),
  ('cargo_ti_1', 'ti', 'Desenvolvedor Júnior',      1),
  ('cargo_ti_2', 'ti', 'Infraestrutura',            2),
  ('cargo_ti_3', 'ti', 'Analista de Suporte',       3),
  ('cargo_ti_4', 'ti', 'Administrador do Sistema',  4),
  ('cargo_fiscal_0', 'fiscal', 'Operador(a) Fiscal', 0),
  ('cargo_fiscal_1', 'fiscal', 'Assistente Fiscal',  1),
  ('cargo_contabil_0', 'contabil', 'Analista Contábil',   0),
  ('cargo_contabil_1', 'contabil', 'Assistente Contábil', 1),
  ('cargo_sucesso_0', 'sucesso-do-cliente', 'Analista de Sucesso do Cliente',   0),
  ('cargo_sucesso_1', 'sucesso-do-cliente', 'Assistente de Sucesso do Cliente', 1),
  ('cargo_financeiro_0', 'financeiro', 'Analista Financeiro',   0),
  ('cargo_financeiro_1', 'financeiro', 'Assistente Financeiro', 1),
  ('cargo_rh_0', 'rh', 'Analista de RH',   0),
  ('cargo_rh_1', 'rh', 'Assistente de RH', 1),
  ('cargo_operacoes_0', 'operacoes', 'Supervisor de Operações',     0),
  ('cargo_operacoes_1', 'operacoes', 'Assistente Administrativo',   1),
  ('cargo_direcao_0', 'direcao', 'CEO',          0),
  ('cargo_direcao_1', 'direcao', 'Diretor(a)',   1),
  ('cargo_tecnico_0', 'tecnico', 'Gerência Técnica', 0),
  ('cargo_tecnico_1', 'tecnico', 'Analista Técnico',  1)
on conflict (id) do update set setor_id = excluded.setor_id, nome = excluded.nome, ordem = excluded.ordem;

-- Colaboradores
insert into public.colaboradores (
  id, nome, email, cargo, unidade, cidade, setor, nivel_acesso, grupos, exclusao,
  status, ultimo_acesso, processos_visualizados, processos_lidos
) values
  ('col_welder',   'Welder Silva',       'welder@orcoma.com.br',       'Desenvolvedor Pleno',    'Matriz', 'Maracás/BA', 'TI',        'Líder de setor',      '', 'Sem acesso', 'Ativo',   '2026-09-14T17:42:00-03:00', 0, 0),
  ('col_jacson',   'Jacson Mascarenhas', 'jacson@orcoma.com.br',       'CEO',                    'Matriz', 'Maracás/BA', 'Direção',  'Diretoria',           '', 'Sem acesso', 'Ativo',   '2026-09-15T08:05:00-03:00', 0, 0),
  ('col_celso',    'Celso Alcantara',    'celso.alcantara@orcoma.com.br', 'Gerência Técnica',   'Matriz', 'Maracás/BA', 'Técnico',  'Diretoria',           '', 'Sem acesso', 'Ativo',   '2026-09-12T16:20:00-03:00', 0, 0),
  ('col_kaylane',  'Kaylane Oliveira',   'kaylane.oliveira@orcoma.com.br', 'Assistente de Qualidade', 'Matriz', 'Maracás/BA', 'Qualidade', 'Colaborador',     '', 'Sem acesso', 'Ativo',   '2026-09-15T07:58:00-03:00', 0, 0),
  ('col_gustavo',  'Gustavo Ronaldy',    'ronaldy.souza@orcoma.com.br','Auxiliar de Qualidade',  'Matriz', 'Maracás/BA', 'Qualidade', 'Colaborador',        '', 'Sem acesso', 'Inativo',  NULL, 0, 0),
  ('col_olandson', 'Olandson de Jesus',  'olandson@orcoma.com.br',     'Coordenador da Qualidade', 'Matriz', 'Maracás/BA', 'Qualidade', 'Gestor da Qualidade', '', 'Permitido', 'Ativo',  '2026-09-15T09:14:00-03:00', 0, 0),
  ('col_gabriel',  'Gabriel Anacleto',   'gabriel.anacleto@orcoma.com.br', 'Desenvolvedor Júnior', 'Matriz', 'Maracás/BA', 'TI',     'Desenvolvedor',       '', 'Sem acesso', 'Ativo',   '2026-09-15T08:47:00-03:00', 0, 0)
on conflict (id) do update set
  nome = excluded.nome,
  email = excluded.email,
  cargo = excluded.cargo,
  unidade = excluded.unidade,
  cidade = excluded.cidade,
  setor = excluded.setor,
  nivel_acesso = excluded.nivel_acesso,
  exclusao = excluded.exclusao,
  status = excluded.status,
  ultimo_acesso = excluded.ultimo_acesso,
  processos_visualizados = excluded.processos_visualizados,
  processos_lidos = excluded.processos_lidos;

-- Usuário administrador (login inicial)
-- senha: Orcoma@2026 — hash SHA-256 de "orcoma-salt-2026:Orcoma@2026"
insert into public.usuarios (id, nome, email, senha_salt, senha_hash, role, cargo, setor, ativo) values
  ('usr_admin_gabriel', 'Gabriel Anacleto', 'gabriel.anacleto@orcoma.com.br', 'orcoma-salt-2026', '07129c0d3179c72c0b8f1b995ca7bd2f0070c8b4fd835aece0cb64b5ff4e193d', 'admin', 'Administrador do Sistema', 'TI', true)
on conflict (id) do update set
  nome = excluded.nome,
  email = excluded.email,
  role = excluded.role,
  cargo = excluded.cargo,
  setor = excluded.setor,
  ativo = excluded.ativo;