-- Fechamento com parecer final e avaliação de eficácia por prazo do tipo.
-- Tipo: prazo (dias) para avaliar a eficácia depois do fechamento (30/60/90).
-- Ocorrência: guarda o prazo do tipo no momento da abertura, o parecer final
-- do fechamento e a data prevista da avaliação de eficácia.
-- Idempotente.
alter table public.ocorrencia_tipos
  add column if not exists eficacia_dias integer not null default 30;

alter table public.ocorrencias
  add column if not exists eficacia_dias integer not null default 30,
  add column if not exists parecer_final text not null default '',
  add column if not exists parecer_em timestamptz,
  add column if not exists eficacia_prevista_em timestamptz;

comment on column public.ocorrencia_tipos.eficacia_dias is
  'Dias após o fechamento para avaliar a eficácia (30, 60 ou 90).';
comment on column public.ocorrencias.parecer_final is
  'Parecer final registrado no fechamento (enviado ao solicitante).';
comment on column public.ocorrencias.eficacia_prevista_em is
  'Data prevista da avaliação de eficácia (fechamento + eficacia_dias).';
