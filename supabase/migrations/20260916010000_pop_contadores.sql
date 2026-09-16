-- ---------------------------------------------------------------------------
-- POPs — contadores reais (favoritos e comentários) + tempo real
-- ---------------------------------------------------------------------------
-- Contexto: `public.pops.favoritos` e `public.pops.anotacoes` nasceram com
-- valores de exemplo (12, 4, 7, 2, ...). A partir deste arquivo os números
-- passam a ser a contagem real do banco: 0 quando ninguém favoritou/comentou e
-- crescendo a cada favorito ou comentário novo.
--
-- Este arquivo:
--   1. cria `public.pop_favoritos` (quem favoritou cada POP, 1 linha/usuário);
--   2. cria a função/triggers que recalculam `pops.favoritos` e `pops.anotacoes`
--      a partir das tabelas de origem (nenhum contador é escrito "na mão");
--   3. reescreve os contadores de exemplo com a contagem real;
--   4. publica `pop_anotacoes` e `pop_favoritos` no Realtime (Supabase), para o
--      Lovable/front receber os novos comentários e favoritos em tempo real.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud. É
-- idempotente — pode rodar novamente sem duplicar tabela, trigger ou política.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 1. Favoritos por usuário ----------------------------------------------------

create table if not exists public.pop_favoritos (
  pop_id uuid not null references public.pops (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  created_at timestamptz not null default now(),
  primary key (pop_id, usuario_email)
);

comment on table public.pop_favoritos is
  'Quem favoritou cada POP (um registro por usuário). Chave: pop_id + usuario_email.';
comment on column public.pop_favoritos.usuario_email is
  'E-mail do usuário que favoritou o POP (mesmo e-mail de public.usuarios).';

create index if not exists pop_favoritos_pop_id_idx on public.pop_favoritos (pop_id);
create index if not exists pop_favoritos_usuario_email_idx on public.pop_favoritos (usuario_email);

-- 2. Acesso -------------------------------------------------------------------

grant select, insert, update, delete on public.pop_favoritos to anon, authenticated;
grant all on public.pop_favoritos to service_role;

alter table public.pop_favoritos enable row level security;

drop policy if exists "pop_favoritos: leitura" on public.pop_favoritos;
create policy "pop_favoritos: leitura"
  on public.pop_favoritos for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_favoritos: escrita" on public.pop_favoritos;
create policy "pop_favoritos: escrita"
  on public.pop_favoritos for all
  to anon, authenticated
  using (true)
  with check (true);

-- 3. Contadores calculados a partir dos dados reais ---------------------------

-- Recalcula, para um POP, os dois contadores direto das tabelas de origem.
create or replace function public.pop_recalcular_contadores(alvo uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pops p
     set favoritos = (select count(*) from public.pop_favoritos f where f.pop_id = alvo),
         anotacoes = (select count(*) from public.pop_anotacoes a where a.pop_id = alvo)
   where p.id = alvo;
$$;

comment on function public.pop_recalcular_contadores(uuid) is
  'Sincroniza pops.favoritos e pops.anotacoes com a contagem real das tabelas de origem.';

-- Mantém os contadores em dia a cada comentário ou favorito (insert/delete).
create or replace function public.pops_sincronizar_contadores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.pop_recalcular_contadores(new.pop_id);
  elsif tg_op = 'DELETE' then
    perform public.pop_recalcular_contadores(old.pop_id);
  else
    perform public.pop_recalcular_contadores(new.pop_id);
    -- Cobre a troca do pop_id (a linha "mudou de POP").
    if old.pop_id is distinct from new.pop_id then
      perform public.pop_recalcular_contadores(old.pop_id);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists pop_anotacoes_contadores on public.pop_anotacoes;
create trigger pop_anotacoes_contadores
  after insert or update or delete on public.pop_anotacoes
  for each row execute function public.pops_sincronizar_contadores();

drop trigger if exists pop_favoritos_contadores on public.pop_favoritos;
create trigger pop_favoritos_contadores
  after insert or update or delete on public.pop_favoritos
  for each row execute function public.pops_sincronizar_contadores();

-- Remove os contadores de exemplo: passa a valer a contagem real (0 quando o
-- POP ainda não recebeu nenhum comentário ou favorito).
update public.pops p
   set favoritos = (select count(*) from public.pop_favoritos f where f.pop_id = p.id),
       anotacoes = (select count(*) from public.pop_anotacoes a where a.pop_id = p.id);

-- 4. Tempo real ---------------------------------------------------------------

-- Payload completo nos eventos (inclusive DELETE), para o front saber qual POP
-- mudou mesmo quando o evento apaga uma linha.
alter table public.pop_anotacoes replica identity full;
alter table public.pop_favoritos replica identity full;

do $$
declare
  tabela text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach tabela in array array['public.pop_anotacoes', 'public.pop_favoritos'] loop
    begin
      execute format('alter publication supabase_realtime add table %s', tabela);
    exception
      when duplicate_object then null; -- tabela já publicada
    end;
  end loop;
end;
$$;