-- ---------------------------------------------------------------------------
-- Políticas — documentos para download (planilhas, Word, Excel, PDF...)
-- ---------------------------------------------------------------------------
-- Além do documento principal da política (`politicas.anexo`), cada política
-- pode ter vários documentos para baixar. Os arquivos ficam no bucket privado
-- `pop-anexos` (já existente), em `documentos/<id da política>/...`.
--
-- Regras (as mesmas dos documentos de POPs):
--   * ver e baixar: quem já consegue abrir a política;
--   * adicionar e remover: setor da Qualidade e liderança da Qualidade.
-- A gravação passa só por funções (security definer) que checam a permissão
-- no servidor. Não altera tabelas nem funções existentes.
--
-- Depende de `pode_gerenciar_documentos_pop` (migration 20261124130000_pop_documentos.sql).
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.politica_documentos (
  id uuid primary key default gen_random_uuid(),
  politica_id uuid not null references public.politicas (id) on delete cascade,
  nome text not null,
  caminho text not null unique,
  tipo text,
  tamanho integer,
  enviado_por_email text not null default '',
  enviado_por_nome text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.politica_documentos is
  'Documentos para download de uma política (planilhas, Word, Excel, PDF). Arquivo no bucket pop-anexos.';
comment on column public.politica_documentos.caminho is
  'Caminho do arquivo dentro do bucket privado pop-anexos (documentos/<politica_id>/...).';

create index if not exists politica_documentos_politica_id_idx
  on public.politica_documentos (politica_id, created_at);

-- Leitura liberada (a política já é filtrada pelo app); escrita só pelas funções abaixo.
grant select on public.politica_documentos to anon, authenticated;
grant all on public.politica_documentos to service_role;

alter table public.politica_documentos enable row level security;

drop policy if exists "politica_documentos: leitura" on public.politica_documentos;
create policy "politica_documentos: leitura"
  on public.politica_documentos for select
  to anon, authenticated
  using (true);

-- Registrar um documento já enviado ao Storage ----------------------------------
create or replace function public.adicionar_documento_politica(
  email_caller text,
  p_politica_id uuid,
  p_documento jsonb
)
returns public.politica_documentos
language plpgsql
security definer
set search_path = public
as $$
declare
  caminho text := coalesce(p_documento->>'caminho', '');
  linha public.politica_documentos;
begin
  if not public.pode_gerenciar_documentos_pop(email_caller) then
    raise exception 'Apenas o setor da Qualidade pode adicionar documentos às políticas.';
  end if;

  if not exists (select 1 from public.politicas p where p.id = p_politica_id) then
    raise exception 'Política não encontrada.';
  end if;

  if length(trim(coalesce(p_documento->>'nome', ''))) = 0 then
    raise exception 'Documento sem nome.';
  end if;

  if caminho not like 'documentos/' || p_politica_id::text || '/%' then
    raise exception 'Caminho do documento inválido.';
  end if;

  insert into public.politica_documentos (
    politica_id, nome, caminho, tipo, tamanho, enviado_por_email, enviado_por_nome
  )
  values (
    p_politica_id,
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

comment on function public.adicionar_documento_politica(text, uuid, jsonb) is
  'Registra um documento para download em uma política (arquivo já enviado ao Storage).';

grant execute on function public.adicionar_documento_politica(text, uuid, jsonb) to anon, authenticated;

-- Remover um documento (só o registro; o arquivo é apagado pelo app) -------------
create or replace function public.remover_documento_politica(
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
    raise exception 'Apenas o setor da Qualidade pode remover documentos das políticas.';
  end if;

  delete from public.politica_documentos d
  where d.id = p_documento_id
  returning d.caminho into caminho_removido;

  if caminho_removido is null then
    raise exception 'Documento não encontrado.';
  end if;

  return caminho_removido;
end;
$$;

comment on function public.remover_documento_politica(text, uuid) is
  'Remove o registro de um documento de política e devolve o caminho do arquivo no Storage.';

grant execute on function public.remover_documento_politica(text, uuid) to anon, authenticated;
