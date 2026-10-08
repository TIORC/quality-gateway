-- ---------------------------------------------------------------------------
-- Políticas — sugestões de melhoria passam a ser por revisão
-- ---------------------------------------------------------------------------
-- Cada sugestão guarda a revisão da política a que se refere. Ao publicar uma
-- nova revisão, a tela separa as sugestões da revisão vigente das de revisões
-- anteriores (histórico), sem apagar nada.
--
-- Sugestões criadas antes desta migration recebem revisão 1. Se alguma delas
-- for de uma revisão posterior, ajuste manualmente em `politica_sugestoes`.
--
-- Como aplicar: cole este arquivo no SQL editor do Lovable Cloud e execute.
-- É idempotente.
-- ---------------------------------------------------------------------------

alter table public.politica_sugestoes
  add column if not exists revisao integer not null default 1;

comment on column public.politica_sugestoes.revisao is
  'Revisão da política à qual a sugestão se refere (revisão vigente na data do envio).';

create index if not exists politica_sugestoes_revisao_idx
  on public.politica_sugestoes (politica_id, revisao);
