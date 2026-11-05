-- Tipos que exigem o parecer final ao concluir a Apuração.
alter table public.ocorrencia_tipos
  add column if not exists exige_parecer_apuracao boolean not null default false;
