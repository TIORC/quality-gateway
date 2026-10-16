create or replace function public.redefinir_senha_solicitar(p_email text, p_token_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_usuario public.usuarios%rowtype;
  v_colaborador public.colaboradores%rowtype;
begin
  select * into v_usuario from public.usuarios where lower(email) = v_email and ativo limit 1;
  if not found then return null; end if;
  select * into v_colaborador from public.colaboradores
   where id = v_usuario.colaborador_id or lower(email) = v_email
   order by (id = v_usuario.colaborador_id) desc limit 1;
  if not found then return null; end if;
  delete from public.convites_acesso where colaborador_id = v_colaborador.id and usado_em is null;
  insert into public.convites_acesso (colaborador_id, token_hash, expira_em)
  values (v_colaborador.id, p_token_hash, now() + interval '1 day');
  return v_colaborador.nome;
end; $$;
revoke all on function public.redefinir_senha_solicitar(text, text) from public, anon, authenticated;
grant execute on function public.redefinir_senha_solicitar(text, text) to service_role;