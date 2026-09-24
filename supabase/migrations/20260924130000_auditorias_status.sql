-- ---------------------------------------------------------------------------
-- Auditorias: status explícito (planejada / em_execucao / concluida)
-- ---------------------------------------------------------------------------
-- Idempotent: pode rodar de novo sem duplicar coluna ou constraint.
-- ---------------------------------------------------------------------------

alter table public.auditorias
  add column if not exists status text not null default 'planejada';

alter table public.auditorias drop constraint if exists auditorias_status_check;
alter table public.auditorias
  add constraint auditorias_status_check
  check (status in ('planejada', 'em_execucao', 'concluida'));

comment on column public.auditorias.status is
  'Situação da auditoria: planejada, em_execucao ou concluida.';

-- Backfill: auditorias já concluídas ou com data planejada vencida viram
-- "concluida"/"em_execucao"; o restante permanece "planejada".
update public.auditorias
set status = case
  when resultado <> 'nenhum' then 'concluida'
  when data_planejada is not null and data_planejada < current_date then 'em_execucao'
  else 'planejada'
end
where status = 'planejada';
