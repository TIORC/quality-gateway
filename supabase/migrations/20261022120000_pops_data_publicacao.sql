-- Data de publicação do POP, editável pelo Gestor da Qualidade e pelo Desenvolvedor.
-- Sem valor, o sistema usa a data de criação do registro.
alter table public.pops add column if not exists data_publicacao date;

comment on column public.pops.data_publicacao is 'Data de publicação do POP (editável pela liderança da Qualidade).';
