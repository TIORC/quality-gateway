-- Julgamento por partes: o resultado geral pode ser "parcialmente_procedente"
-- quando há partes procedentes e não-procedentes ao mesmo tempo.

alter table public.ocorrencias drop constraint if exists ocorrencias_procedencia_check;

alter table public.ocorrencias
  add constraint ocorrencias_procedencia_check
  check (procedencia in ('pendente', 'procedente', 'parcialmente_procedente', 'nao_procedente'));

comment on column public.ocorrencias.procedencia is
  'Resultado do julgamento: pendente|procedente|parcialmente_procedente|nao_procedente (visível ao solicitante).';
