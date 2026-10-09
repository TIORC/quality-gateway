-- Primeiro acesso por convite.
-- O administrador gera um link por colaborador; a pessoa abre o link e cria a
-- própria senha. Só o hash SHA-256 do token é guardado. A tabela não tem
-- policies, então `anon` não lê nem altera convites diretamente: tudo passa
-- pelas funções abaixo (security definer).

create table if not exists public.convites_acesso (
  id uuid primary key default gen_random_uuid(),
  colaborador_id text not null references public.colaboradores (id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.convites_acesso enable row level security;

-- Cria um novo convite e invalida os anteriores ainda não usados do colaborador.
create or replace function public.convite_criar(
  p_colaborador_id text,
  p_token_hash text,
  p_dias int default 1
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expira timestamptz := now() + make_interval(days => greatest(p_dias, 1));
begin
  if not exists (select 1 from public.colaboradores where id = p_colaborador_id) then
    raise exception 'Colaborador não encontrado.';
  end if;

  delete from public.convites_acesso
   where colaborador_id = p_colaborador_id and usado_em is null;

  insert into public.convites_acesso (colaborador_id, token_hash, expira_em)
  values (p_colaborador_id, p_token_hash, v_expira);

  return v_expira;
end;
$$;

-- Confere se o token está válido e devolve quem vai criar a senha.
create or replace function public.convite_validar(p_token_hash text)
returns table (nome text, email text, expira_em timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.nome, c.email, cv.expira_em
    from public.convites_acesso cv
    join public.colaboradores c on c.id = cv.colaborador_id
   where cv.token_hash = p_token_hash
     and cv.usado_em is null
     and cv.expira_em > now()
     -- Depois de qualquer login do colaborador, o convite deixa de valer.
     and (c.ultimo_acesso is null or c.ultimo_acesso < cv.criado_em)
   limit 1;
$$;

-- Cria (ou substitui) o login do colaborador com a senha escolhida pela pessoa.
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
      id, nome, email, senha_salt, senha_hash, role, cargo, setor, ativo, colaborador_id
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
      v_colaborador.id
    );
  else
    update public.usuarios
       set senha_salt = p_salt,
           senha_hash = p_hash,
           email = lower(v_colaborador.email),
           colaborador_id = v_colaborador.id,
           ativo = true
     where id = v_usuario_id;
  end if;

  update public.convites_acesso set usado_em = now() where id = v_convite.id;
  return true;
end;
$$;

revoke all on function public.convite_criar(text, text, int) from public;
revoke all on function public.convite_validar(text) from public;
revoke all on function public.convite_resgatar(text, text, text) from public;

grant execute on function public.convite_criar(text, text, int) to anon, authenticated;
grant execute on function public.convite_validar(text) to anon, authenticated;
grant execute on function public.convite_resgatar(text, text, text) to anon, authenticated;
