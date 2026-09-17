-- ---------------------------------------------------------------------------
-- Permissões de documentos (POPs e políticas) por colaborador
-- ---------------------------------------------------------------------------
-- Cria colunas booleanas em public.colaboradores para o Coordenador da
-- Qualidade conceder/revogar, individualmente, o direito de adicionar,
-- modificar e excluir documentos de qualidade (POPs e políticas).
--
-- O acesso só é concedido a profissionais do setor Qualidade; a liderança da
-- Qualidade e os administradores não dependem destas permissões.
--
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------------------------

alter table public.colaboradores
  add column if not exists perm_adicionar_documentos boolean not null default false;

alter table public.colaboradores
  add column if not exists perm_modificar_documentos boolean not null default false;

alter table public.colaboradores
  add column if not exists perm_excluir_documentos boolean not null default false;

comment on column public.colaboradores.perm_adicionar_documentos is
  'Autoriza o colaborador (setor Qualidade) a adicionar/criar documentos: POPs e políticas.';

comment on column public.colaboradores.perm_modificar_documentos is
  'Autoriza o colaborador (setor Qualidade) a modificar/editar documentos: POPs e políticas.';

comment on column public.colaboradores.perm_excluir_documentos is
  'Autoriza o colaborador (setor Qualidade) a excluir documentos: POPs e políticas.';