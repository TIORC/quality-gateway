-- Primeiro acesso pelo e-mail corporativo.
-- A pessoa informa o e-mail na tela de login; se a conta existir e a senha nunca
-- tiver sido definida pela própria pessoa, um convite é criado e a Edge Function
-- `enviar-primeiro-acesso` manda o link por e-mail. O convite reaproveita o fluxo
-- de `/primeiro-acesso`.

-- Marca quando a pessoa definiu a própria senha. NULL = senha nunca alterada.
alter table public.usuarios add column if not exists senha_alterada_em timestamptz;

-- Contas que já criaram a senha pelo convite antes desta migração.
update public.usuarios u
   set senha_alterada_em = cv.usado_em
  from public.convites_acesso cv
  join public.colaboradores c on c.id = cv.colaborador_id
 where cv.usado_em is not null
   and u.senha_alterada_em is null
   and (u.colaborador_id = c.id or lower(u.email) = lower(c.email));

-- Resgate do convite: passa a registrar quando a senha foi definida pela pessoa.
create or replace function public.convite_resgatar(
  p_token_hash text,
  p_salt text,
  p_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite public.convites_acesso%rowtype;
  v_colaborador public.colaboradores%rowtype;
  v_usuario_id text;
begin
  select * into v_convite
    from public.convites_acesso
   where token_hash = p_token_hash
     and usado_em is null
     and expira_em > now()
   for update;

  if not found then
    return false;
  end if;

  select * into v_colaborador from public.colaboradores where id = v_convite.colaborador_id;
  if not found or coalesce(v_colaborador.email, '') = '' then
    return false;
  end if;

  -- Se a pessoa já entrou depois da emissão do convite, ele não vale mais.
  if v_colaborador.ultimo_acesso is not null
     and v_colaborador.ultimo_acesso >= v_convite.criado_em then
    return false;
  end if;

  -- Reaproveita o login já existente do colaborador (mesmo vínculo ou mesmo e-mail).
  select id into v_usuario_id
    from public.usuarios
   where colaborador_id = v_colaborador.id
      or lower(email) = lower(v_colaborador.email)
   order by (colaborador_id = v_colaborador.id) desc
   limit 1;

  if v_usuario_id is null then
    insert into public.usuarios (
      id, nome, email, senha_salt, senha_hash, role, cargo, setor, ativo, colaborador_id, senha_alterada_em
    ) values (
      'usr_' || v_colaborador.id,
      v_colaborador.nome,
      lower(v_colaborador.email),
      p_salt,
      p_hash,
      'usuario',
      v_colaborador.cargo,
      v_colaborador.setor,
      true,
      v_colaborador.id,
      now()
    );
  else
    update public.usuarios
       set senha_salt = p_salt,
           senha_hash = p_hash,
           email = lower(v_colaborador.email),
           colaborador_id = v_colaborador.id,
           ativo = true,
           senha_alterada_em = now()
     where id = v_usuario_id;
  end if;

  update public.convites_acesso set usado_em = now() where id = v_convite.id;
  return true;
end;
$$;

-- Usado somente pela Edge Function (service role). Confere se a conta existe e se
-- a senha nunca foi alterada; se sim, cria o convite e devolve o nome do
-- colaborador. Devolve NULL quando não pode seguir.
create or replace function public.primeiro_acesso_solicitar(
  p_email text,
  p_token_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_usuario public.usuarios%rowtype;
  v_colaborador public.colaboradores%rowtype;
begin
  select * into v_usuario
    from public.usuarios
   where lower(email) = v_email
     and ativo
   limit 1;

  if not found or v_usuario.senha_alterada_em is not null then
    return null;
  end if;

  select * into v_colaborador
    from public.colaboradores
   where id = v_usuario.colaborador_id
      or lower(email) = v_email
   order by (id = v_usuario.colaborador_id) desc
   limit 1;

  if not found then
    return null;
  end if;

  delete from public.convites_acesso
   where colaborador_id = v_colaborador.id and usado_em is null;

  insert into public.convites_acesso (colaborador_id, token_hash, expira_em)
  values (v_colaborador.id, p_token_hash, now() + interval '1 day');

  return v_colaborador.nome;
end;
$$;

revoke all on function public.primeiro_acesso_solicitar(text, text) from public;
revoke all on function public.primeiro_acesso_solicitar(text, text) from anon, authenticated;
grant execute on function public.primeiro_acesso_solicitar(text, text) to service_role;
