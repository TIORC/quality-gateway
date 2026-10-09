-- ---------------------------------------------------------------------------
-- Formulário de abertura de ocorrências em telas (até 5)
-- ---------------------------------------------------------------------------
-- `telas` guarda os títulos das telas da versão (vazio = formulário de uma tela).
-- Cada campo indica a sua tela pelo índice (campo.tela, começando em 0).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.ocorrencia_formularios
  add column if not exists telas jsonb not null default '[]'::jsonb;

comment on column public.ocorrencia_formularios.telas is
  'Títulos das telas do formulário de abertura (até 5). Vazio = uma tela só.';
