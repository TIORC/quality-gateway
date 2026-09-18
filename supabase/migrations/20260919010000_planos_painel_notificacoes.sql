-- Planos de Ação completos + Painel/Notificações (Fase 1) — parte 1/2
-- Idempotente: pode executar várias vezes no SQL editor do Supabase.

create table if not exists public.plano_origens (
  id text primary key,
  nome text not null unique,
  ativa boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plano_origens (id, nome, ativa, ordem) values
  ('auditoria-interna',      'Auditoria Interna',        true,  1),
  ('auditoria-externa',      'Auditoria Externa',        true,  2),
  ('nao-conformidade',       'Não Conformidade',         true,  3),
  ('reclamacao-cliente',     'Reclamação de Cliente',    true,  4),
  ('analise-critica',        'Análise Crítica',          true,  5),
  ('indicador-desempenho',   'Indicador de Desempenho',  true,  6),
  ('risco-oportunidade',     'Risco / Oportunidade',     false, 7),
  ('melhoria-continua',      'Melhoria Contínua',        true,  8),
  ('solicitacao-cliente',    'Solicitação de Cliente',   false, 9)
on conflict (id) do update set nome = excluded.nome, ativa = excluded.ativa, ordem = excluded.ordem;

alter table public.planos_de_acao add column if not exists codigo text;
alter table public.planos_de_acao add column if not exists responsavel_id text not null default '';
alter table public.planos_de_acao add column if not exists seguidores_ids text[] not null default '{}';
alter table public.planos_de_acao add column if not exists progresso integer not null default 0;
alter table public.planos_de_acao add column if not exists origem_outros text not null default '';
alter table public.planos_de_acao add column if not exists vinculo_tipo text not null default '';
alter table public.planos_de_acao add column if not exists vinculo_id text not null default '';
alter table public.planos_de_acao add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.planos_de_acao add column if not exists concluida_em timestamptz;

alter table public.planos_de_acao drop constraint if exists planos_de_acao_status_check;
alter table public.planos_de_acao drop constraint if exists planos_de_acao_status_check2;
alter table public.planos_de_acao add constraint planos_de_acao_status_check2
  check (status in ('aberta','nao_iniciado','em_andamento','concluida','atrasada','cancelado'));
alter table public.planos_de_acao drop constraint if exists planos_de_acao_progresso_check;
alter table public.planos_de_acao add constraint planos_de_acao_progresso_check
  check (progresso >= 0 and progresso <= 100);

create unique index if not exists planos_de_acao_codigo_uidx on public.planos_de_acao (codigo) where codigo is not null and codigo <> '';
create index if not exists planos_de_acao_responsavel_idx on public.planos_de_acao (responsavel_email);
create index if not exists planos_de_acao_prazo_idx on public.planos_de_acao (prazo);
