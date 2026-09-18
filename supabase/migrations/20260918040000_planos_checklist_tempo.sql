-- Checklist do plano de ação + controle de tempo (Iniciar/Pausar).
-- Idempotente: pode executar várias vezes no SQL editor do Supabase.

alter table public.planos_de_acao add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.planos_de_acao add column if not exists tempo_segundos integer not null default 0;
alter table public.planos_de_acao add column if not exists timer_inicio timestamptz;

comment on column public.planos_de_acao.checklist is 'Itens do plano de ação: [{id, texto, feito}]. O progresso é calculado automaticamente.';