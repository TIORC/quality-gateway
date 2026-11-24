-- ---------------------------------------------------------------------------
-- Atas de Reunião — documento completo (áreas, horário, pauta, plano de ação,
-- participantes, responsáveis e revisão) guardado em jsonb.
-- ---------------------------------------------------------------------------
-- Os campos ficam em `atas.documento`, no formato:
--   { areas, horario, pauta: [{area, pauta, descricao}],
--     plano: [{numero, oQue, como, quem, quando, status}],
--     participantes: [{nome, cargo}],
--     elaboradoPor, aprovadoPor, revisao, dataRevisao }
-- As funções `criar_ata` e `atualizar_ata` ganham o parâmetro `documento`. As
-- assinaturas antigas são removidas antes, para não haver duas versões.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.atas
  add column if not exists documento jsonb not null default '{}'::jsonb;

-- Criação -----------------------------------------------------------------------
drop function if exists public.criar_ata(text, text, uuid, text, date, text);

create or replace function public.criar_ata(
  email_caller text,
  origem text,
  tipo_reuniao uuid,
  titulo text,
  data_reuniao date,
  texto text default '',
  documento jsonb default '{}'::jsonb
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
    tipo_reuniao, origem, titulo, data_reuniao, texto, status, criado_por, documento
  ) values (
    case when origem = 'sistema' then tipo_reuniao else null end,
    origem,
    trim(titulo),
    data_reuniao,
    coalesce(texto, ''),
    'rascunho',
    usuario_id,
    coalesce(documento, '{}'::jsonb)
  )
  returning * into nova;

  return nova;
end;
$$;

comment on function public.criar_ata(text, text, uuid, text, date, text, jsonb) is
  'Cria uma ata (simples ou do sistema) como rascunho, com o documento completo, validando a permissão no backend.';

grant execute on function public.criar_ata(text, text, uuid, text, date, text, jsonb)
  to anon, authenticated;

-- Edição ------------------------------------------------------------------------
drop function if exists public.atualizar_ata(text, uuid, text, date, text);

create or replace function public.atualizar_ata(
  email_caller text,
  ata_id uuid,
  titulo text,
  data_reuniao date,
  texto text default '',
  documento jsonb default '{}'::jsonb
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
    atas.texto = coalesce(texto, ''),
    atas.documento = coalesce(documento, '{}'::jsonb)
  where atas.id = ata_id
  returning * into atualizada;

  if atualizada.id is null then
    raise exception 'Ata não encontrada.';
  end if;
  return atualizada;
end;
$$;

comment on function public.atualizar_ata(text, uuid, text, date, text, jsonb) is
  'Edita uma ata ainda em rascunho, incluindo o documento completo, validando a permissão no backend.';

grant execute on function public.atualizar_ata(text, uuid, text, date, text, jsonb)
  to anon, authenticated;
