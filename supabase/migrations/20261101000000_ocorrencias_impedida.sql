-- Etapa impedida: o prazo fica parado enquanto a etapa depende de alguém ou de algo.
alter table public.ocorrencias
  add column if not exists impedida_em timestamptz,
  add column if not exists impedida_motivo text not null default '';

comment on column public.ocorrencias.impedida_em is 'Quando a etapa foi marcada como impedida (nulo = não impedida). O prazo fica parado.';
