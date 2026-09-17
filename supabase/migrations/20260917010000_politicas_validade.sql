-- ---------------------------------------------------------------------------
-- Políticas e validade dos documentos (próximos vencimentos)
-- ---------------------------------------------------------------------------
-- 1. Adiciona `data_vencimento` aos POPs (prazo de validade do documento).
-- 2. Cria a tabela `politicas`, usada pela aba Políticas (antes em memória).
--
-- Idempotente: pode rodar de novo sem duplicar tabelas, colunas, políticas ou
-- os registros de exemplo. As políticas RLS seguem o padrão aberto do projeto.
--
-- Como aplicar: cole o arquivo inteiro no SQL editor do Lovable Cloud/Supabase.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Validade dos POPs ----------------------------------------------------------
alter table public.pops add column if not exists data_vencimento date;

comment on column public.pops.data_vencimento is
  'Data de validade do documento (aaaa-mm-dd). Usada em "Próximos vencimentos" no painel.';

create index if not exists pops_data_vencimento_idx
  on public.pops (data_vencimento) where data_vencimento is not null;

-- Políticas ------------------------------------------------------------------
create table if not exists public.politicas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  objetivo text not null default '',
  setores text[] not null default '{}',
  aplicabilidade text not null default '',
  links text[] not null default '{}',
  data_postagem text not null default '',
  status text not null default 'Em aprovação',
  historico jsonb not null default '[]'::jsonb,
  data_revisao text not null default '',
  revisao integer not null default 1,
  observacao_revisao text not null default '',
  anexo jsonb,
  parecer jsonb,
  sugestoes jsonb not null default '[]'::jsonb,
  data_vencimento text not null default '',
  criado_por text not null default '',
  criado_por_nome text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.politicas is 'Políticas da organização (aba Políticas).';
comment on column public.politicas.setores is 'Setores/áreas aos quais a política se aplica (define o acesso).';
comment on column public.politicas.historico is 'Histórico de revisões: [{ id, numero, data, observacao }].';
comment on column public.politicas.anexo is 'Anexo da política: { path, nome, tipo } (bucket privado).';
comment on column public.politicas.parecer is 'Parecer do usuário logado: { tipo, clausula, motivo, data }.';
comment on column public.politicas.sugestoes is 'Sugestões de melhoria: [{ id, texto, data }].';
comment on column public.politicas.data_vencimento is 'Data de validade da política (dd/mm/aaaa).';

create index if not exists politicas_codigo_idx on public.politicas (codigo);

-- updated_at automático -----------------------------------------------------
create or replace function public.politicas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists politicas_set_updated_at on public.politicas;
create trigger politicas_set_updated_at
  before update on public.politicas
  for each row
  execute function public.politicas_set_updated_at();

-- Acesso (RLS aberto, mesmo padrão das demais tabelas) -----------------------
alter table public.politicas enable row level security;

drop policy if exists "politicas: leitura" on public.politicas;
create policy "politicas: leitura"
  on public.politicas for select
  to anon, authenticated
  using (true);

drop policy if exists "politicas: escrita" on public.politicas;
create policy "politicas: escrita"
  on public.politicas for all
  to anon, authenticated
  using (true)
  with check (true);

-- Política de exemplo --------------------------------------------------------
insert into public.politicas (
  codigo, titulo, objetivo, setores, aplicabilidade, links, data_postagem,
  status, historico, data_revisao, revisao, observacao_revisao, anexo, parecer,
  sugestoes, data_vencimento
) values (
  'POLITICA – ORC – 001',
  'Política da Qualidade Orcoma',
  'Estabelecer os princípios e diretrizes da qualidade para garantir a padronização dos processos e a satisfação dos clientes.',
  array['Todos'],
  'Aplica-se a todos os setores e unidades da Orcoma.',
  array['https://orcoma.com.br/qualidade'],
  to_char(current_date, 'DD/MM/YYYY'),
  'Divulgado',
  jsonb_build_array(jsonb_build_object(
    'id', 'rev_ex_001',
    'numero', 1,
    'data', to_char(current_date, 'DD/MM/YYYY'),
    'observacao', 'Publicação inicial da política.'
  )),
  to_char(current_date, 'DD/MM/YYYY'),
  1,
  'Publicação inicial da política.',
  null,
  null,
  '[]'::jsonb,
  to_char(current_date + interval '10 days', 'DD/MM/YYYY')
) on conflict (codigo) do nothing;