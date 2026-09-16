-- ---------------------------------------------------------------------------
-- POPs — visualizações reais por usuário
-- ---------------------------------------------------------------------------
-- Contexto: `public.colaboradores.processos_visualizados` e
-- `public.colaboradores.processos_lidos` nasceram com valores de exemplo
-- (38, 24, 12, ...) gravados na seed e nunca eram atualizados. A partir deste
-- arquivo:
--
--   1. cria `public.pop_visualizacoes` — quem visualizou (abriu) cada POP,
--      1 linha por usuário (chave pop_id + usuario_email);
--   2. zera os contadores de exemplo em `colaboradores` (os números passam a
--      ser calculados em tempo real a partir de `pop_leituras` e
--      `pop_visualizacoes`);
--   3. segue o mesmo padrão de RLS aberta das demais tabelas do projeto.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud. É
-- idempotente — pode rodar novamente sem duplicar tabela, índice ou política.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 1. Visualizações por usuário --------------------------------------------------

create table if not exists public.pop_visualizacoes (
  pop_id uuid not null references public.pops (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pop_id, usuario_email)
);

comment on table public.pop_visualizacoes is
  'Quem visualizou (abriu) cada POP — um registro por usuário. Chave: pop_id + usuario_email.';
comment on column public.pop_visualizacoes.usuario_email is
  'E-mail do usuário que visualizou o POP (mesmo e-mail de public.usuarios).';

create index if not exists pop_visualizacoes_pop_id_idx on public.pop_visualizacoes (pop_id);
create index if not exists pop_visualizacoes_usuario_email_idx on public.pop_visualizacoes (usuario_email);

-- 2. Acesso ----------------------------------------------------------------------

grant select, insert, update, delete on public.pop_visualizacoes to anon, authenticated;
grant all on public.pop_visualizacoes to service_role;

alter table public.pop_visualizacoes enable row level security;

drop policy if exists "pop_visualizacoes: leitura" on public.pop_visualizacoes;
create policy "pop_visualizacoes: leitura"
  on public.pop_visualizacoes for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_visualizacoes: escrita" on public.pop_visualizacoes;
create policy "pop_visualizacoes: escrita"
  on public.pop_visualizacoes for all
  to anon, authenticated
  using (true)
  with check (true);

-- 3. Remove os contadores de exemplo ---------------------------------------------
-- A partir daqui os números exibidos são a contagem real de `pop_leituras`
-- (lidos) e `pop_visualizacoes` (visualizados), calculada na aplicação.

update public.colaboradores
   set processos_visualizados = 0,
       processos_lidos = 0;