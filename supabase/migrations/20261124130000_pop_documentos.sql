-- ---------------------------------------------------------------------------
-- POPs — documentos para download (planilhas, Word, Excel, PDF...)
-- ---------------------------------------------------------------------------
-- Além do anexo principal do POP (`pops.arquivo_*`), cada POP pode ter vários
-- documentos para baixar. Os arquivos ficam no bucket privado `pop-anexos`
-- (já existente), em `documentos/<id do POP>/...`. Aqui ficam só os metadados.
--
-- Regras:
--   * ver e baixar: quem já consegue abrir o POP;
--   * adicionar e remover: setor da Qualidade e liderança da Qualidade
--     (mesma regra de `ehUsuarioDaQualidade` no app).
-- A gravação passa só por funções (security definer) que checam a permissão
-- no servidor; não há INSERT/UPDATE/DELETE direto na tabela.
-- Não mexe nas tabelas, funções nem políticas já existentes.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- Depende do bucket `pop-anexos` (migration 20261119130000).
-- ---------------------------------------------------------------------------

create table if not exists public.pop_documentos (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  nome text not null,
  caminho text not null unique,
  tipo text,
  tamanho integer,
  enviado_por_email text not null default '',
  enviado_por_nome text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.pop_documentos is
  'Documentos para download de um POP (planilhas, Word, Excel, PDF). Arquivo no bucket pop-anexos.';
comment on column public.pop_documentos.caminho is
  'Caminho do arquivo dentro do bucket privado pop-anexos (documentos/<pop_id>/...).';

create index if not exists pop_documentos_pop_id_idx
  on public.pop_documentos (pop_id, created_at);

-- Leitura liberada (o POP já é filtrado pelo app); escrita só pelas funções abaixo.
grant select on public.pop_documentos to anon, authenticated;
grant all on public.pop_documentos to service_role;

alter table public.pop_documentos enable row level security;

drop policy if exists "pop_documentos: leitura" on public.pop_documentos;
create policy "pop_documentos: leitura"
  on public.pop_documentos for select
  to anon, authenticated
  using (true);

-- Quem pode gerenciar os documentos: mesma regra de "Qualidade" do app --------
create or replace function public.pode_gerenciar_documentos_pop(email_caller text)
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
        or c.nivel_acesso in ('Gestor da Qualidade', 'Auxiliar da Qualidade', 'Desenvolvedor do Sistema')
        or translate(lower(coalesce(c.cargo, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'coordenador da qualidade'
      )
  );
$$;

comment on function public.pode_gerenciar_documentos_pop(text) is
  'Indica se o usuário pode adicionar/remover documentos para download nos POPs (setor da Qualidade e liderança).';

grant execute on function public.pode_gerenciar_documentos_pop(text) to anon, authenticated;

-- Registrar um documento já enviado ao Storage ----------------------------------
create or replace function public.adicionar_documento_pop(
  email_caller text,
  p_pop_id uuid,
  p_documento jsonb
)
returns public.pop_documentos
language plpgsql
security definer
set search_path = public
as $$
declare
  caminho text := coalesce(p_documento->>'caminho', '');
  linha public.pop_documentos;
begin
  if not public.pode_gerenciar_documentos_pop(email_caller) then
    raise exception 'Apenas o setor da Qualidade pode adicionar documentos aos POPs.';
  end if;

  if not exists (select 1 from public.pops p where p.id = p_pop_id) then
    raise exception 'POP não encontrado.';
  end if;

  if length(trim(coalesce(p_documento->>'nome', ''))) = 0 then
    raise exception 'Documento sem nome.';
  end if;

  if caminho not like 'documentos/' || p_pop_id::text || '/%' then
    raise exception 'Caminho do documento inválido.';
  end if;

  insert into public.pop_documentos (
    pop_id, nome, caminho, tipo, tamanho, enviado_por_email, enviado_por_nome
  )
  values (
    p_pop_id,
    trim(p_documento->>'nome'),
    caminho,
    nullif(p_documento->>'tipo', ''),
    nullif(p_documento->>'tamanho', '')::integer,
    lower(trim(coalesce(email_caller, ''))),
    coalesce(p_documento->>'enviado_por_nome', '')
  )
  returning * into linha;

  return linha;
end;
$$;

comment on function public.adicionar_documento_pop(text, uuid, jsonb) is
  'Registra um documento para download em um POP (arquivo já enviado ao Storage).';

grant execute on function public.adicionar_documento_pop(text, uuid, jsonb) to anon, authenticated;

-- Remover um documento (só o registro; o arquivo é apagado pelo app) -------------
create or replace function public.remover_documento_pop(
  email_caller text,
  p_documento_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caminho_removido text;
begin
  if not public.pode_gerenciar_documentos_pop(email_caller) then
    raise exception 'Apenas o setor da Qualidade pode remover documentos dos POPs.';
  end if;

  delete from public.pop_documentos d
  where d.id = p_documento_id
  returning d.caminho into caminho_removido;

  if caminho_removido is null then
    raise exception 'Documento não encontrado.';
  end if;

  return caminho_removido;
end;
$$;

comment on function public.remover_documento_pop(text, uuid) is
  'Remove o registro de um documento de POP e devolve o caminho do arquivo no Storage.';

grant execute on function public.remover_documento_pop(text, uuid) to anon, authenticated;
