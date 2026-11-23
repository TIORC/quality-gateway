-- ---------------------------------------------------------------------------
-- Suporte das ações de plano: uma ou mais pessoas que apoiam o responsável
-- ---------------------------------------------------------------------------
-- Mesmo padrão dos seguidores: `suporte_ids` (ids de colaboradores) e
-- `suporte` (e-mails, para notificação). Idempotente.
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).

alter table public.planos_de_acao
  add column if not exists suporte_ids text[] not null default '{}',
  add column if not exists suporte text[] not null default '{}';

comment on column public.planos_de_acao.suporte_ids is 'Colaboradores que apoiam a ação (ids), marcados com @.';
comment on column public.planos_de_acao.suporte is 'E-mails dos colaboradores que apoiam a ação (notificação).';
