-- Notificações de ocorrência guardam a ocorrência, para o clique abrir o detalhe.
alter table public.notificacoes
  add column if not exists ocorrencia_id text;

comment on column public.notificacoes.ocorrencia_id is
  'Ocorrência relacionada à notificação (deep-link: abre o detalhe ao clicar no sino).';
