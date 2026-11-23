-- Justificativa em texto para ações com status "Impedimento" (impedida)
-- e "Desconsiderado" (cancelado). Os status já estão permitidos pela
-- constraint planos_de_acao_status_check3; "atrasada" segue no banco, mas o
-- app passa a tratá-la como "em_andamento" (o atraso vem do prazo).
alter table public.planos_de_acao
  add column if not exists justificativa text not null default '';

comment on column public.planos_de_acao.justificativa is
  'Motivo do impedimento (impedida) ou da desconsideração (cancelado). Obrigatório nesses status.';
