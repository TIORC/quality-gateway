-- ---------------------------------------------------------------------------
-- CORREÇÃO do schema remoto — POPs (revisões, sugestões e acesso)
-- ---------------------------------------------------------------------------
-- PROBLEMA: o projeto gcijjgtgnpkrjwdbhkdl está sem a migration
-- `20260917000000_pop_revisoes_sugestoes_acesso.sql`. Por isso:
--   * `pops` não tem as colunas revisao / data_revisao / observacao_revisao
--     → criar/editar POP quebra com 400 (PGRST204: column 'revisao');
--   * as tabelas pop_revisoes e pop_sugestoes não existem → 404 ao listar.
--
-- Este arquivo é a versão consolidada e idempotente da migration ausente.
-- Como aplicar: abra o projeto no Lovable -> aba Cloud -> SQL editor, cole o
-- arquivo INTEIRO e execute. Pode rodar de novo sem efeito colateral.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 1. Campos da nova ficha do POP ----------------------------------------------
alter table public.pops add column if not exists revisao integer not null default 1;
alter table public.pops add column if not exists data_revisao date not null default current_date;
alter table public.pops add column if not exists observacao_revisao text not null default '';
alter table public.pops
  add column if not exists setores_responsaveis text[] not null default '{}';
alter table public.pops add column if not exists visualizadores text[] not null default '{}';

comment on column public.pops.revisao is
  'Revisão vigente do POP (1 = Revisão 01). Ao editar um POP vigente o código é mantido e a revisão avança.';
comment on column public.pops.data_revisao is 'Data da revisão vigente do POP.';
comment on column public.pops.observacao_revisao is
  'O que foi alterado na revisão vigente (aparece no histórico de modificações).';
comment on column public.pops.setores_responsaveis is
  'Setores responsáveis pelo processo (ids de public.pop_setores).';
comment on column public.pops.visualizadores is
  'Quem pode visualizar (ACESSO): ids de public.pop_setores autorizados. Vazio = sem restrição adicional.';

-- POPs já cadastrados continuam intactos: entram como Revisão 01.
update public.pops
set
  revisao = 1,
  data_revisao = coalesce(
    aprovado_qualidade_em::date,
    aprovado_processo_em::date,
    created_at::date,
    current_date
  ),
  observacao_revisao = case
    when observacao_revisao = '' then 'Versão inicial do procedimento.'
    else observacao_revisao
  end,
  setores_responsaveis = case
    when setores_responsaveis = '{}' and setor_id <> '' then array[setor_id]
    else setores_responsaveis
  end,
  visualizadores = case
    when visualizadores = '{}' and setor_id <> '' then array[setor_id]
    else visualizadores
  end
where revisao is null
   or observacao_revisao = ''
   or setores_responsaveis = '{}'
   or visualizadores = '{}'
   or data_revisao is null;

-- 2. Histórico de modificações (revisões anteriores) --------------------------
create table if not exists public.pop_revisoes (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  codigo text not null default '',
  revisao integer not null,
  data_revisao date not null default current_date,
  observacao text not null default '',
  conteudo jsonb not null default '{}'::jsonb,
  criado_por text not null default '',
  criado_por_nome text not null default '',
  created_at timestamptz not null default now(),
  unique (pop_id, revisao)
);

comment on table public.pop_revisoes is
  'Histórico de modificações do POP: cada revisão anterior fica arquivada com o snapshot do documento.';
comment on column public.pop_revisoes.revisao is 'Número da revisão arquivada (ex.: 1 = Revisão 01).';
comment on column public.pop_revisoes.data_revisao is 'Data em que a revisão esteve vigente.';
comment on column public.pop_revisoes.observacao is 'O que foi alterado naquela revisão.';
comment on column public.pop_revisoes.conteudo is
  'Snapshot completo do POP naquela revisão (JSON), consultável apenas pela gestão da Qualidade.';

create index if not exists pop_revisoes_pop_id_idx on public.pop_revisoes (pop_id, revisao desc);

-- 3. Sugestões de melhoria ----------------------------------------------------
create table if not exists public.pop_sugestoes (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  sugestao text not null,
  status text not null default 'aberta'
    check (status in ('aberta', 'em_analise', 'aplicada', 'recusada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pop_sugestoes is
  'Sugestões de melhoria enviadas pelos colaboradores em cada POP (botão "Sugerir melhoria").';
comment on column public.pop_sugestoes.status is
  'aberta = aguardando análise; em_analise = em avaliação; aplicada = virou revisão; recusada = descartada.';

create index if not exists pop_sugestoes_pop_id_idx on public.pop_sugestoes (pop_id, created_at desc);

-- 4. Botão "Lido" (soma às decisões antigas) ----------------------------------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'pop_leituras'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%decisao%'
  loop
    execute format('alter table public.pop_leituras drop constraint %I', v_nome);
  end loop;
end $$;

alter table public.pop_leituras
  add constraint pop_leituras_decisao_check
  check (decisao in ('concordo', 'discordo', 'lido'));

comment on column public.pop_leituras.decisao is
  'lido = ciência do POP; concordo/discordo = registros antigos mantidos no histórico.';

-- 5. Aviso à Qualidade a cada sugestão ----------------------------------------
create or replace function public.pop_sugestoes_notificar_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pop public.pops%rowtype;
  v_mensagem text;
begin
  select * into v_pop from public.pops where id = new.pop_id;
  v_mensagem := new.usuario_nome || ' sugeriu uma melhoria no POP ' || v_pop.codigo ||
    ': ' || nullif(trim(new.sugestao), '.');

  insert into public.notificacoes (
    destinatario_email, destinatario_nome, titulo, mensagem,
    tipo, pop_id, autor_nome, autor_email
  )
  select
    lower(c.email), c.nome,
    'Sugestão de melhoria em POP: ' || v_pop.codigo || ' - ' || v_pop.titulo,
    v_mensagem,
    'sugestao', v_pop.id, new.usuario_nome, new.usuario_email
  from public.colaboradores c
  where c.status = 'Ativo'
    and c.email <> ''
    and lower(c.email) <> lower(new.usuario_email)
    and (c.nivel_acesso = 'Gestor da Qualidade' or lower(c.setor) = 'qualidade')
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario_email = lower(c.email)
        and n.pop_id = v_pop.id
        and n.autor_email = new.usuario_email
        and n.tipo = 'sugestao'
        and n.mensagem = v_mensagem
    );

  return new;
end;
$$;

drop trigger if exists pop_sugestoes_notificar_trigger on public.pop_sugestoes;
create trigger pop_sugestoes_notificar_trigger
  after insert on public.pop_sugestoes
  for each row
  execute function public.pop_sugestoes_notificar_qualidade();

-- 6. Acesso -------------------------------------------------------------------
grant select, insert, update, delete on public.pop_revisoes to anon, authenticated;
grant select, insert, update, delete on public.pop_sugestoes to anon, authenticated;
grant all on public.pop_revisoes to service_role;
grant all on public.pop_sugestoes to service_role;

alter table public.pop_revisoes enable row level security;
alter table public.pop_sugestoes enable row level security;

drop policy if exists "pop_revisoes: leitura" on public.pop_revisoes;
create policy "pop_revisoes: leitura"
  on public.pop_revisoes for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_revisoes: escrita" on public.pop_revisoes;
create policy "pop_revisoes: escrita"
  on public.pop_revisoes for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "pop_sugestoes: leitura" on public.pop_sugestoes;
create policy "pop_sugestoes: leitura"
  on public.pop_sugestoes for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_sugestoes: escrita" on public.pop_sugestoes;
create policy "pop_sugestoes: escrita"
  on public.pop_sugestoes for all
  to anon, authenticated
  using (true)
  with check (true);

-- 7. Realtime ------------------------------------------------------------------
alter table public.pop_revisoes replica identity full;
alter table public.pop_sugestoes replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pop_revisoes'
  ) then
    alter publication supabase_realtime add table public.pop_revisoes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pop_sugestoes'
  ) then
    alter publication supabase_realtime add table public.pop_sugestoes;
  end if;
end $$;