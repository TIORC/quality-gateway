-- ---------------------------------------------------------------------------
-- POPs — favoritos vinculados ao colaborador
-- ---------------------------------------------------------------------------
-- Contexto: a estrela do POP grava o favorito em `public.pop_favoritos`
-- identificado apenas pelo e-mail (`usuario_email`). Este arquivo vincula cada
-- favorito ao registro organizacional do colaborador (`public.colaboradores`),
-- para que a informação fique salva "no banco de dados do colaborador".
--
-- Este arquivo:
--   1. adiciona `colaborador_id` em `public.pop_favoritos` (FK para
--      `public.colaboradores (id)`, on delete cascade);
--   2. povoa o vínculo dos favoritos já gravados usando o e-mail cadastrado;
--   3. completa o nome dos favoritos antigos a partir do colaborador;
--   4. indexa a nova coluna para as consultas por colaborador.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud
-- (aba Cloud -> SQL editor) e execute. É idempotente — pode rodar novamente
-- sem duplicar coluna, índice ou comentários.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Vínculo do favorito com o registro do colaborador --------------------------
alter table public.pop_favoritos
  add column if not exists colaborador_id text
    references public.colaboradores (id) on delete cascade;

comment on column public.pop_favoritos.colaborador_id is
  'Registro do colaborador que favoritou o POP (public.colaboradores.id).';

-- Povoa o vínculo dos favoritos já gravados (antes desta migration só havia e-mail).
update public.pop_favoritos f
   set colaborador_id = c.id
  from public.colaboradores c
 where f.colaborador_id is null
   and lower(c.email) = lower(f.usuario_email);

-- Favoritos antigos sem nome ganham o nome do colaborador vinculado.
update public.pop_favoritos f
   set usuario_nome = c.nome
  from public.colaboradores c
 where c.id = f.colaborador_id
   and (f.usuario_nome = '' or f.usuario_nome is null);

create index if not exists pop_favoritos_colaborador_id_idx
  on public.pop_favoritos (colaborador_id);