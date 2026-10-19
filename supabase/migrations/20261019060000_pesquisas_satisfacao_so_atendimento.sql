-- ---------------------------------------------------------------------------
-- Pesquisa de satisfação com a primeira pergunta ("Como você avalia o nosso
-- atendimento?"). As demais notas passam a ser opcionais, para que o formulário
-- público grave só `nota_atendimento`.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.pesquisas_satisfacao alter column nota_qualidade drop not null;
alter table public.pesquisas_satisfacao alter column nota_orientacoes drop not null;
alter table public.pesquisas_satisfacao alter column nota_prazos drop not null;
alter table public.pesquisas_satisfacao alter column nota_recomendacao drop not null;
