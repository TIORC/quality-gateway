-- Grupos de acesso: só o Desenvolvedor do Sistema e o Gestor da Qualidade criam,
-- editam e excluem grupos. As gravações passam por funções (security definer) que
-- conferem quem está pedindo. A tabela fica somente leitura para anon/authenticated.
--
-- Limite: o app não usa login do Supabase Auth, então a identidade do chamador é o
-- e-mail enviado pelo app e conferido contra `usuarios`/`colaboradores`. Isso impede
-- gravações pela API direta sem o e-mail de um gestor, mas não impede quem souber
-- esse e-mail de se passar pela pessoa.

create or replace function public.grupo_acesso_pode_gerenciar(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(trim(p_email))
       and u.ativo
       and u.role in ('admin', 'gestor')
  )
  or exists (
    select 1 from public.colaboradores c
     where lower(c.email) = lower(trim(p_email))
       and c.nivel_acesso in ('Desenvolvedor do Sistema', 'Gestor da Qualidade')
  );
$$;

-- Troca o nome de um grupo (ou remove, com p_novo null) em `colaboradores.grupos`.
create or replace function public.grupo_acesso_ajustar_membros(p_antigo text, p_novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.colaboradores c
     set grupos = coalesce((
       select string_agg(t, ', ')
         from (
           select case
                    when lower(trim(x)) = lower(trim(p_antigo)) then p_novo
                    else trim(x)
                  end as t
             from unnest(regexp_split_to_array(replace(c.grupos, chr(59), ','), ',')) as x
         ) s
        where t is not null and t <> ''
     ), '')
   where strpos(lower(coalesce(c.grupos, '')), lower(trim(p_antigo))) > 0;
end;
$$;

-- Cria ou altera um grupo. Campos null, na alteração, mantêm o valor atual.
create or replace function public.grupo_acesso_salvar(
  p_email text,
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_modulos jsonb
)
returns public.grupos_acessos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos_acessos%rowtype;
  v_antigo text;
begin
  if not public.grupo_acesso_pode_gerenciar(p_email) then
    raise exception 'Somente o Gestor da Qualidade ou o Desenvolvedor do Sistema podem gerenciar grupos de acesso.';
  end if;

  if p_id is null then
    if coalesce(trim(p_nome), '') = '' then
      raise exception 'Informe o nome do grupo.';
    end if;
    insert into public.grupos_acessos (nome, descricao, modulos_perm)
    values (trim(p_nome), coalesce(p_descricao, ''), coalesce(p_modulos, '{}'::jsonb))
    returning * into v_grupo;
  else
    select nome into v_antigo from public.grupos_acessos where id = p_id;
    if not found then
      raise exception 'Grupo não encontrado.';
    end if;
    update public.grupos_acessos
       set nome = coalesce(nullif(trim(p_nome), ''), nome),
           descricao = coalesce(p_descricao, descricao),
           modulos_perm = coalesce(p_modulos, modulos_perm)
     where id = p_id
    returning * into v_grupo;
    if v_grupo.nome <> v_antigo then
      perform public.grupo_acesso_ajustar_membros(v_antigo, v_grupo.nome);
    end if;
  end if;

  return v_grupo;
end;
$$;

create or replace function public.grupo_acesso_excluir(p_email text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if not public.grupo_acesso_pode_gerenciar(p_email) then
    raise exception 'Somente o Gestor da Qualidade ou o Desenvolvedor do Sistema podem gerenciar grupos de acesso.';
  end if;

  select nome into v_nome from public.grupos_acessos where id = p_id;
  delete from public.grupos_acessos where id = p_id;
  if v_nome is not null then
    perform public.grupo_acesso_ajustar_membros(v_nome, null);
  end if;
end;
$$;

-- Escrita direta fechada: só as funções acima gravam.
drop policy if exists "grupos_acessos: escrita" on public.grupos_acessos;
revoke insert, update, delete on public.grupos_acessos from anon, authenticated;

revoke all on function public.grupo_acesso_pode_gerenciar(text) from public;
revoke all on function public.grupo_acesso_ajustar_membros(text, text) from public;
revoke all on function public.grupo_acesso_salvar(text, uuid, text, text, jsonb) from public;
revoke all on function public.grupo_acesso_excluir(text, uuid) from public;

grant execute on function public.grupo_acesso_salvar(text, uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.grupo_acesso_excluir(text, uuid) to anon, authenticated;
grant execute on function public.grupo_acesso_pode_gerenciar(text) to anon, authenticated;
