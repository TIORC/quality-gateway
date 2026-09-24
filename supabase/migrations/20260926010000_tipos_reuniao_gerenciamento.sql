-- ---------------------------------------------------------------------------
-- Tipos de Reunião — gerenciamento com permissão validada no backend
-- ---------------------------------------------------------------------------
-- Complementa `20260926000000_atas_de_reuniao.sql` (tabela `tipos_reuniao`).
--
-- Regra de negócio: somente Qualidade/Admin pode criar, editar e desativar
-- tipos de reunião. A validação acontece AQUI no banco (não só no navegador),
-- espelhando `podeGerenciarConteudo` do portal (src/lib/permissoes.ts):
--   * role admin/gestor (public.usuarios);
--   * setor "Qualidade" (colaborador vinculado ou usuário);
--   * nível de acesso Administrador/Gestor da Qualidade;
--   * cargo "Coordenador da Qualidade".
--
-- Escrita na tabela fica restrita às funções (security definer): a RLS apenas
-- libera leitura; escrever direto com a chave pública é negado. Assim nem um
-- cliente comprometido consegue gravar tipo de reunião burlando a regra.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

-- Valida a permissão de gerenciamento pelo e-mail do usuário logado ---------
create or replace function public.pode_gerenciar_tipos_reuniao(email_caller text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    left join public.colaboradores c
      on c.id = u.colaborador_id or lower(c.email) = lower(u.email)
    where lower(u.email) = lower(trim(coalesce(email_caller, '')))
      and u.ativo
      and (
        u.role in ('admin', 'gestor')
        or translate(lower(coalesce(c.setor, u.setor, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'qualidade'
        or c.nivel_acesso in ('Administrador', 'Gestor da Qualidade')
        or translate(lower(coalesce(c.cargo, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'coordenador da qualidade'
      )
  );
$$;

comment on function public.pode_gerenciar_tipos_reuniao(text) is
  'Indica se o usuário com o e-mail informado pode criar/editar/desativar tipos de reunião (Qualidade/Admin).';

grant execute on function public.pode_gerenciar_tipos_reuniao(text) to anon, authenticated;

-- Criação -------------------------------------------------------------------
create or replace function public.criar_tipo_reuniao(
  email_caller text,
  nome text,
  periodicidade text,
  dia_previsto integer,
  participantes jsonb default '[]'::jsonb,
  signatarios jsonb default '[]'::jsonb
)
returns public.tipos_reuniao
language plpgsql
security definer
set search_path = public
as $$
declare
  novo public.tipos_reuniao;
begin
  if not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Sem permissão para gerenciar tipos de reunião.';
  end if;
  if trim(coalesce(nome, '')) = '' then
    raise exception 'Informe o nome do tipo de reunião.';
  end if;
  insert into public.tipos_reuniao (
    nome, periodicidade, dia_previsto, participantes, signatarios, ativo
  ) values (
    trim(nome),
    periodicidade,
    dia_previsto,
    coalesce(participantes, '[]'::jsonb),
    coalesce(signatarios, '[]'::jsonb),
    true
  )
  returning * into novo;
  return novo;
end;
$$;

comment on function public.criar_tipo_reuniao(text, text, text, integer, jsonb, jsonb) is
  'Cria um tipo de reunião validando no backend se o usuário é Qualidade/Admin.';

grant execute on function public.criar_tipo_reuniao(text, text, text, integer, jsonb, jsonb)
  to anon, authenticated;

-- Edição --------------------------------------------------------------------
create or replace function public.atualizar_tipo_reuniao(
  email_caller text,
  id uuid,
  nome text,
  periodicidade text,
  dia_previsto integer,
  participantes jsonb default '[]'::jsonb,
  signatarios jsonb default '[]'::jsonb
)
returns public.tipos_reuniao
language plpgsql
security definer
set search_path = public
as $$
declare
  novo public.tipos_reuniao;
begin
  if not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Sem permissão para gerenciar tipos de reunião.';
  end if;
  if trim(coalesce(nome, '')) = '' then
    raise exception 'Informe o nome do tipo de reunião.';
  end if;
  update public.tipos_reuniao set
    tipos_reuniao.nome = trim(nome),
    tipos_reuniao.periodicidade = periodicidade,
    tipos_reuniao.dia_previsto = dia_previsto,
    tipos_reuniao.participantes = coalesce(participantes, '[]'::jsonb),
    tipos_reuniao.signatarios = coalesce(signatarios, '[]'::jsonb)
  where tipos_reuniao.id = id
  returning * into novo;
  if novo.id is null then
    raise exception 'Tipo de reunião não encontrado.';
  end if;
  return novo;
end;
$$;

comment on function public.atualizar_tipo_reuniao(text, uuid, text, text, integer, jsonb, jsonb) is
  'Edita um tipo de reunião validando no backend se o usuário é Qualidade/Admin.';

grant execute on function public.atualizar_tipo_reuniao(text, uuid, text, text, integer, jsonb, jsonb)
  to anon, authenticated;

-- Desativar/reativar ---------------------------------------------------------
create or replace function public.mudar_ativo_tipo_reuniao(
  email_caller text,
  id uuid,
  ativo boolean default false
)
returns public.tipos_reuniao
language plpgsql
security definer
set search_path = public
as $$
declare
  novo public.tipos_reuniao;
begin
  if not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Sem permissão para gerenciar tipos de reunião.';
  end if;
  update public.tipos_reuniao set tipos_reuniao.ativo = ativo
  where tipos_reuniao.id = id
  returning * into novo;
  if novo.id is null then
    raise exception 'Tipo de reunião não encontrado.';
  end if;
  return novo;
end;
$$;

comment on function public.mudar_ativo_tipo_reuniao(text, uuid, boolean) is
  'Desativa/reativa um tipo de reunião validando no backend se o usuário é Qualidade/Admin.';

grant execute on function public.mudar_ativo_tipo_reuniao(text, uuid, boolean)
  to anon, authenticated;

-- RLS: leitura para todos; escrita somente pelas funções (security definer) --
do $$
begin
  alter table public.tipos_reuniao enable row level security;
  execute 'drop policy if exists "tipos_reuniao: leitura" on public.tipos_reuniao';
  execute
    'create policy "tipos_reuniao: leitura" on public.tipos_reuniao for select to anon, authenticated using (true)';
  -- Remove a política aberta de escrita criada na migração original.
  execute 'drop policy if exists "tipos_reuniao: escrita" on public.tipos_reuniao';
  execute 'drop policy if exists "tipos_reuniao: sem escrita direta" on public.tipos_reuniao';
  execute
    'create policy "tipos_reuniao: sem escrita direta" on public.tipos_reuniao for all to anon, authenticated using (false) with check (false)';
end;
$$;