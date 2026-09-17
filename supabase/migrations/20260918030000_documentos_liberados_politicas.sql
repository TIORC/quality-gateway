-- ---------------------------------------------------------------------------
-- Liberação individual de políticas (documentos_liberados)
-- ---------------------------------------------------------------------------
-- Remove a FK que limitava documento_id apenas a public.pops, permitindo
-- gravar também IDs de public.politicas quando documento_tipo = 'politica'.
--
-- Idempotente: pode rodar de novo sem erro.
-- ---------------------------------------------------------------------------

alter table public.documentos_liberados
  drop constraint if exists documentos_liberados_documento_id_fkey;

comment on table public.documentos_liberados is
  'Documentos (POPs e políticas) liberados individualmente a um colaborador.';

comment on column public.documentos_liberados.documento_tipo is
  'Tipo do documento: pop ou politica.';

comment on column public.documentos_liberados.documento_id is
  'UUID do documento (POP ou política, conforme documento_tipo).';
