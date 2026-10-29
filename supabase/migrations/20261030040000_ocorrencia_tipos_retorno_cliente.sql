-- Tipos que exigem a etapa obrigatória "Retorno ao cliente" (ex.: Reclamação de Cliente).
alter table public.ocorrencia_tipos
  add column if not exists exige_retorno_cliente boolean not null default false;
