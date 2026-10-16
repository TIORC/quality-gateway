-- Colunas extras da planilha do Gestta (para exibir os detalhes iguais ao Excel).
-- Idempotente. Depois de aplicar, reimporte a planilha para preencher as tarefas já gravadas.

alter table public.tarefas_gestta add column if not exists cnpj_cpf text not null default '';
alter table public.tarefas_gestta add column if not exists data_legal date;
alter table public.tarefas_gestta add column if not exists feito_atrasado text not null default '';
alter table public.tarefas_gestta add column if not exists feito_com_multa text not null default '';
alter table public.tarefas_gestta add column if not exists baixado text not null default '';
