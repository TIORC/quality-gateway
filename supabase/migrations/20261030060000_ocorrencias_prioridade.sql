-- Prioridade da ocorrência: definida pela Qualidade após a abertura.
alter table public.ocorrencias
  add column if not exists prioridade text not null default 'a_definir'
    check (prioridade in ('a_definir', 'baixa', 'media', 'alta'));

comment on column public.ocorrencias.prioridade is 'Prioridade definida pela Qualidade: a_definir|baixa|media|alta.';
