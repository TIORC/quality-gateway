create extension if not exists "pgcrypto";

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

create index if not exists politica_leituras_politica_id_idx
  on public.politica_leituras (politica_id, created_at desc);
create index if not exists politica_leituras_usuario_email_idx
  on public.politica_leituras (usuario_email);

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

create index if not exists politica_sugestoes_politica_id_idx
  on public.politica_sugestoes (politica_id, created_at desc);

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