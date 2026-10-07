-- ---------------------------------------------------------------------------
-- Releitura obrigatoria por revisao — POPs e Politicas (parte 1/2)
-- ---------------------------------------------------------------------------
-- 1. `pop_leituras.revisao_lida` + `politica_leituras.revisao_lida`: qual
--    revisao o usuario leu. Leitura antiga NAO vale para revisao nova.
-- 2. `notificacoes.politica_id` + `notificacoes.revisao` para deep-link.
--
-- Como aplicar: cole este arquivo e a parte 2/2 no SQL editor do
-- Lovable Cloud e execute. E idempotente e nao apaga dados.
-- ---------------------------------------------------------------------------

alter table public.pop_leituras
  add column if not exists revisao_lida integer not null default 1;
alter table public.politica_leituras
  add column if not exists revisao_lida integer not null default 1;

comment on column public.pop_leituras.revisao_lida is
  'Revisao do POP que o usuario leu. Leitura so vale quando revisao_lida = pops.revisao.';
comment on column public.politica_leituras.revisao_lida is
  'Revisao da politica que o usuario leu. Leitura so vale quando revisao_lida = politicas.revisao.';

update public.pop_leituras l
set revisao_lida = p.revisao
from public.pops p
where l.pop_id = p.id and l.revisao_lida = 1;

update public.politica_leituras l
set revisao_lida = p.revisao
from public.politicas p
where l.politica_id = p.id and l.revisao_lida = 1;

alter table public.notificacoes
  add column if not exists politica_id uuid references public.politicas (id) on delete cascade;
alter table public.notificacoes
  add column if not exists revisao integer;

comment on column public.notificacoes.politica_id is
  'Politica relacionada (deep-link para /politicas?abrir=<id>).';
comment on column public.notificacoes.revisao is
  'Revisao do documento que exige (re)leitura.';
