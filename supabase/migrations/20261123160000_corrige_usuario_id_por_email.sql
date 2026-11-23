-- ---------------------------------------------------------------------------
-- Correção: usuario_id_por_email devolvia sempre o primeiro usuário da tabela.
-- ---------------------------------------------------------------------------
-- Na função original (migration 20260926020000) o parâmetro se chama `email` e
-- o SQL usa `coalesce(email, '')` sem prefixo. Como `usuarios` também tem a
-- coluna `email`, o banco resolve esse nome para a coluna, e o filtro vira
-- `lower(u.email) = lower(u.email)`: qualquer e-mail casa com o primeiro usuário.
-- Efeito: eventos da agenda e atas eram gravados com o criador errado.
--
-- Correção: mesma assinatura, mas o parâmetro é referenciado por posição ($1),
-- então não há mais ambiguidade. Idempotente.
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).
-- ---------------------------------------------------------------------------

create or replace function public.usuario_id_por_email(email text)
returns text
language sql
stable
set search_path = public
as $$
  select u.id
  from public.usuarios u
  where lower(u.email) = lower(trim(coalesce($1, '')))
  limit 1;
$$;

comment on function public.usuario_id_por_email(text) is
  'Devolve o id do usuário (public.usuarios.id) a partir do e-mail do colaborador logado.';

grant execute on function public.usuario_id_por_email(text) to anon, authenticated;
