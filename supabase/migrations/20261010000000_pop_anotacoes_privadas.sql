-- ---------------------------------------------------------------------------
-- Discussão do POP privada: conversa entre o autor e a Qualidade
-- ---------------------------------------------------------------------------
-- `destinatario_email` indica para quem a anotação foi dirigida (vazio = só à Qualidade).
-- Visibilidade no portal: o autor, o destinatário e quem é da Qualidade.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.pop_anotacoes
  add column if not exists destinatario_email text not null default '';

comment on column public.pop_anotacoes.destinatario_email is
  'E-mail do usuário a quem a anotação é dirigida (resposta da Qualidade). Vazio = só para a Qualidade.';
