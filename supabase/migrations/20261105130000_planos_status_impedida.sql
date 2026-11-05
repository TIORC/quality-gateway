-- Novo status "impedida" para ações de plano que estão travadas por algo externo.
alter table public.planos_de_acao drop constraint if exists planos_de_acao_status_check;
alter table public.planos_de_acao drop constraint if exists planos_de_acao_status_check2;
alter table public.planos_de_acao add constraint planos_de_acao_status_check3
  check (status in ('aberta','nao_iniciado','em_andamento','impedida','concluida','atrasada','cancelado'));
