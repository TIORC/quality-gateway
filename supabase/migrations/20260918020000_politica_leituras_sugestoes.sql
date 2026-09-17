-- ---------------------------------------------------------------------------
-- Políticas — leituras (botão "Lido") e sugestões de melhoria no Cloud
-- ---------------------------------------------------------------------------
-- Este arquivo:
--   1. cria `public.politica_leituras` — ciência de cada usuário sobre a
--      política (botão "Lido"), registrada por e-mail, visível na tela para o
--      próprio colaborador e para a gestão da Qualidade;
--   2. cria `public.politica_sugestoes` — sugestões de melhoria enviadas pelos
--      colaboradores ("Sugerir melhoria"), com autor identificado;
--   3. avisa a Qualidade e o Gestor da Qualidade a cada nova sugestão
--      (`public.notificacoes`, mesmo padrão das sugestões de POP);
--   4. publica as novas tabelas no Realtime.
--
-- Os dados foram gravados até aqui em `public.politicas.parecer` e
-- `public.politicas.sugestoes` (JSON dentro da linha). Nada é apagado: as
-- colunas permanecem intactas e as novas telas passam a usar as tabelas
-- dedicadas, com autor identificado.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud
-- (aba Cloud -> SQL editor) e execute. É idempotente.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 1. Leituras ("Lido") -------------------------------------------------------

create table if not exists public.politica_leituras (
  id uuid primary key default gen_random_uuid(),
  politica_id uuid not null references public.politicas (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  decisao text not null default 'lido'
    check (decisao in ('lido', 'concordo', 'discordo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (politica_id, usuario_email)
);

comment on table public.politica_leituras is
  'Ciência de cada usuário sobre uma política (botão "Lido"), visível ao colaborador e à Qualidade.';
comment on column public.politica_leituras.decisao is
  'lido = ciência da política; concordo/discordo atendem a fluxos de parecer.';
comment on column public.politica_leituras.usuario_email is 'E-mail do colaborador que registrou a leitura.';

create index if not exists politica_leituras_politica_id_idx
  on public.politica_leituras (politica_id, created_at desc);
create index if not exists politica_leituras_usuario_email_idx
  on public.politica_leituras (usuario_email);

-- 2. Sugestões de melhoria ---------------------------------------------------

create table if not exists public.politica_sugestoes (
  id uuid primary key default gen_random_uuid(),
  politica_id uuid not null references public.politicas (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  sugestao text not null,
  status text not null default 'aberta'
    check (status in ('aberta', 'em_analise', 'aplicada', 'recusada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.politica_sugestoes is
  'Sugestões de melhoria enviadas pelos colaboradores em cada política (botão "Sugerir melhoria").';
comment on column public.politica_sugestoes.status is
  'aberta = aguardando análise; em_analise = em avaliação; aplicada = virou revisão; recusada = descartada.';

create index if not exists politica_sugestoes_politica_id_idx
  on public.politica_sugestoes (politica_id, created_at desc);

-- 3. Acesso (RLS aberto, mesmo padrão das demais tabelas) --------------------

grant select, insert, update, delete on public.politica_leituras to anon, authenticated;
grant select, insert, update, delete on public.politica_sugestoes to anon, authenticated;
grant all on public.politica_leituras to service_role;
grant all on public.politica_sugestoes to service_role;

alter table public.politica_leituras enable row level security;
alter table public.politica_sugestoes enable row level security;

drop policy if exists "politica_leituras: leitura" on public.politica_leituras;
create policy "politica_leituras: leitura"
  on public.politica_leituras for select
  to anon, authenticated
  using (true);

drop policy if exists "politica_leituras: escrita" on public.politica_leituras;
create policy "politica_leituras: escrita"
  on public.politica_leituras for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "politica_sugestoes: leitura" on public.politica_sugestoes;
create policy "politica_sugestoes: leitura"
  on public.politica_sugestoes for select
  to anon, authenticated
  using (true);

drop policy if exists "politica_sugestoes: escrita" on public.politica_sugestoes;
create policy "politica_sugestoes: escrita"
  on public.politica_sugestoes for all
  to anon, authenticated
  using (true)
  with check (true);

-- 4. Notificação automática à Qualidade a cada sugestão -----------------------

create or replace function public.politica_sugestoes_notificar_qualidade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_politica public.politicas%rowtype;
  v_mensagem text;
begin
  select * into v_politica from public.politicas where id = new.politica_id;
  v_mensagem := new.usuario_nome || ' sugeriu uma melhoria na política ' || v_politica.codigo ||
    ': ' || nullif(trim(new.sugestao), '.');

  insert into public.notificacoes (
    destinatario_email, destinatario_nome, titulo, mensagem,
    tipo, pop_id, autor_nome, autor_email
  )
  select
    lower(c.email), c.nome,
    'Sugestão de melhoria em política: ' || v_politica.codigo || ' — ' || v_politica.titulo,
    v_mensagem,
    'sugestao', null, new.usuario_nome, new.usuario_email
  from public.colaboradores c
  where c.status = 'Ativo'
    and c.email <> ''
    and lower(c.email) <> lower(new.usuario_email)
    and (c.nivel_acesso = 'Gestor da Qualidade' or lower(c.setor) = 'qualidade')
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario_email = lower(c.email)
        and n.autor_email = new.usuario_email
        and n.tipo = 'sugestao'
        and n.mensagem = v_mensagem
    );

  return new;
end;
$$;

drop trigger if exists politica_sugestoes_notificar_trigger on public.politica_sugestoes;
create trigger politica_sugestoes_notificar_trigger
  after insert on public.politica_sugestoes
  for each row
  execute function public.politica_sugestoes_notificar_qualidade();

-- 5. Realtime -----------------------------------------------------------------

alter table public.politica_leituras replica identity full;
alter table public.politica_sugestoes replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'politica_leituras'
  ) then
    alter publication supabase_realtime add table public.politica_leituras;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'politica_sugestoes'
  ) then
    alter publication supabase_realtime add table public.politica_sugestoes;
  end if;
end $$;