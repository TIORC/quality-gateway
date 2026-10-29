-- Etapas da linha do metrô configuráveis por tipo de ocorrência (nome, SLA e
-- etapas extras). Tipos existentes ficam com `[]`: a aplicação usa então as
-- etapas padrão e o SLA da coluna `sla_dias`, sem perda de dados.
alter table public.ocorrencia_tipos
  add column if not exists etapas jsonb not null default '[]'::jsonb;

comment on column public.ocorrencia_tipos.etapas is
  'Etapas do tipo, na ordem da linha do metrô: [{"id","nome","slaDias"}]';
