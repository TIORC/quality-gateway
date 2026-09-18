-- Permissão dedicada: excluir planos de ação.
-- O Gestor da Qualidade concede individualmente em /configurações.

alter table public.colaboradores
  add column if not exists perm_excluir_planos boolean not null default false;

comment on column public.colaboradores.perm_excluir_planos is
  'Autoriza o colaborador a excluir planos de ação (além de admin/gestor).';
