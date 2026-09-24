-- ---------------------------------------------------------------------------
-- Atas de Reunião — criação e edição de atas (permissão validada no banco)
-- ---------------------------------------------------------------------------
-- Complementa `20260926000000_atas_de_reuniao.sql` (tabela `atas`).
--
-- Regra de negócio: quem participa cria/edita rascunho; demais só consultam.
--   * Ata do sistema: participante do tipo de reunião (participantes OU
--     signatários em `tipos_reuniao`) ou Qualidade/Admin;
--   * Ata simples: somente Qualidade/Admin (mesmo teste de
--     `pode_gerenciar_tipos_reuniao`);
--   * Edição: apenas em status `rascunho`, por Qualidade/Admin, pelo criador
--     ou por participante do tipo vinculado;
--   * Escrita direta bloqueada pela RLS; somente as funções abaixo gravam.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

-- Usuário do portal pelo e-mail -------------------------------------------------
create or replace function public.usuario_id_por_email(email text)
returns text
language sql
stable
set search_path = public
as $$
  select u.id
  from public.usuarios u
  where lower(u.email) = lower(trim(coalesce(email, '')))
  limit 1;
$$;

comment on function public.usuario_id_por_email(text) is
  'Devolve o id do usuário (public.usuarios.id) a partir do e-mail do colaborador logado.';

grant execute on function public.usuario_id_por_email(text) to anon, authenticated;

-- Participação no tipo de reunião ------------------------------------------------
create or replace function public.eh_participante_do_tipo(tipo_id uuid, usuario_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tipos_reuniao t
    where t.id = tipo_id
      and (
        exists (
          select 1
          from jsonb_array_elements(t.participantes) p
          where p ->> 'id' = usuario_id
        )
        or exists (
          select 1
          from jsonb_array_elements(t.signatarios) p
          where p ->> 'id' = usuario_id
        )
      )
  );
$$;

comment on function public.eh_participante_do_tipo(uuid, text) is
  'True quando o usuário consta como participante ou signatário do tipo de reunião.';

grant execute on function public.eh_participante_do_tipo(uuid, text) to anon, authenticated;

-- Pode criar ata ------------------------------------------------------------------
create or replace function public.pode_criar_ata(email_caller text, origem text, tipo_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  usuario_id text;
begin
  if public.pode_gerenciar_tipos_reuniao(email_caller) then
    return true;
  end if;
  -- Ata simples e importações: somente Qualidade/Admin (linha acima).
  if origem <> 'sistema' or tipo_id is null then
    return false;
  end if;
  usuario_id := public.usuario_id_por_email(email_caller);
  if usuario_id is null then
    return false;
  end if;
  return public.eh_participante_do_tipo(tipo_id, usuario_id);
end;
$$;

comment on function public.pode_criar_ata(text, text, uuid) is
  'Permissão para criar ata: Qualidade/Admin, ou participante/signatário do tipo (ata do sistema).';

grant execute on function public.pode_criar_ata(text, text, uuid) to anon, authenticated;

-- Pode editar ata (rascunho) ---------------------------------------------------------
create or replace function public.pode_editar_ata(email_caller text, ata_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  criador text;
  tipo_id uuid;
  usuario_id text;
begin
  if public.pode_gerenciar_tipos_reuniao(email_caller) then
    return true;
  end if;
  usuario_id := public.usuario_id_por_email(email_caller);
  if usuario_id is null then
    return false;
  end if;
  select a.criado_por, a.tipo_reuniao into criador, tipo_id
  from public.atas a
  where a.id = ata_id;
  if criador = usuario_id then
    return true;
  end if;
  if tipo_id is not null and public.eh_participante_do_tipo(tipo_id, usuario_id) then
    return true;
  end if;
  return false;
end;
$$;

comment on function public.pode_editar_ata(text, uuid) is
  'Permissão para editar ata rascunho: Qualidade/Admin, o criador ou participante/signatário do tipo.';

grant execute on function public.pode_editar_ata(text, uuid) to anon, authenticated;

-- Criação de ata ------------------------------------------------------------------
create or replace function public.criar_ata(
  email_caller text,
  origem text,
  tipo_reuniao uuid,
  titulo text,
  data_reuniao date,
  texto text default ''
)
returns public.atas
language plpgsql
security definer
set search_path = public
as $$
declare
  nova public.atas;
  usuario_id text := public.usuario_id_por_email(email_caller);
begin
  if not public.pode_criar_ata(email_caller, origem, tipo_reuniao) then
    raise exception 'Sem permissão para criar esta ata.';
  end if;
  if usuario_id is null then
    raise exception 'Usuário não encontrado.';
  end if;
  if trim(coalesce(titulo, '')) = '' then
    raise exception 'Informe o título da ata.';
  end if;
  if data_reuniao is null then
    raise exception 'Informe a data da reunião.';
  end if;
  if origem = 'sistema' then
    if not exists (select 1 from public.tipos_reuniao t where t.id = tipo_reuniao and t.ativo) then
      raise exception 'Selecione um tipo de reunião ativo.';
    end if;
  elsif origem <> 'simples' then
    raise exception 'Origem de ata inválida.';
  end if;

  insert into public.atas (
    tipo_reuniao, origem, titulo, data_reuniao, texto, status, criado_por
  ) values (
    case when origem = 'sistema' then tipo_reuniao else null end,
    origem,
    trim(titulo),
    data_reuniao,
    coalesce(texto, ''),
    'rascunho',
    usuario_id
  )
  returning * into nova;

  return nova;
end;
$$;

comment on function public.criar_ata(text, text, uuid, text, date, text) is
  'Cria uma ata (simples ou do sistema) como rascunho, validando a permissão no backend.';

grant execute on function public.criar_ata(text, text, uuid, text, date, text) to anon, authenticated;

-- Edição de ata ---------------------------------------------------------------------
create or replace function public.atualizar_ata(
  email_caller text,
  ata_id uuid,
  titulo text,
  data_reuniao date,
  texto text default ''
)
returns public.atas
language plpgsql
security definer
set search_path = public
as $$
declare
  atualizada public.atas;
begin
  if not public.pode_editar_ata(email_caller, ata_id) then
    raise exception 'Sem permissão para editar esta ata.';
  end if;
  if (select a.status from public.atas a where a.id = ata_id) <> 'rascunho' then
    raise exception 'Somente atas em rascunho podem ser editadas.';
  end if;
  if trim(coalesce(titulo, '')) = '' then
    raise exception 'Informe o título da ata.';
  end if;
  if data_reuniao is null then
    raise exception 'Informe a data da reunião.';
  end if;

  update public.atas set
    atas.titulo = trim(titulo),
    atas.data_reuniao = data_reuniao,
    atas.texto = coalesce(texto, '')
  where atas.id = ata_id
  returning * into atualizada;

  if atualizada.id is null then
    raise exception 'Ata não encontrada.';
  end if;
  return atualizada;
end;
$$;

comment on function public.atualizar_ata(text, uuid, text, date, text) is
  'Edita título, data e texto de uma ata ainda em rascunho, validando a permissão no backend.';

grant execute on function public.atualizar_ata(text, uuid, text, date, text) to anon, authenticated;

-- RLS: leitura para todos; escrita somente pelas funções (security definer) -------
do $$
begin
  alter table public.atas enable row level security;
  execute 'drop policy if exists "atas: leitura" on public.atas';
  execute
    'create policy "atas: leitura" on public.atas for select to anon, authenticated using (true)';
  -- Remove a política aberta de escrita criada na migração original.
  execute 'drop policy if exists "atas: escrita" on public.atas';
  execute 'drop policy if exists "atas: sem escrita direta" on public.atas';
  execute
    'create policy "atas: sem escrita direta" on public.atas for all to anon, authenticated using (false) with check (false)';
end;
$$;