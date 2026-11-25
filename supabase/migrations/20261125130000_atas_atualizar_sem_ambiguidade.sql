-- ---------------------------------------------------------------------------
-- Atas de Reunião — corrige "column reference \"titulo\" is ambiguous" ao salvar
-- ---------------------------------------------------------------------------
-- Em `atualizar_ata`, os parâmetros (titulo, data_reuniao, texto, documento) têm
-- o mesmo nome das colunas de `public.atas`. Dentro do UPDATE, a referência sem
-- prefixo fica ambígua e o Postgres recusa a gravação. A função passa a usar o
-- parâmetro (`#variable_conflict use_variable`); a assinatura e os nomes dos
-- parâmetros continuam os mesmos, então o front não muda.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

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
#variable_conflict use_variable
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

  -- Colunas do SET não podem ter prefixo de tabela; à direita, os nomes são os parâmetros.
  update public.atas set
    titulo = trim(titulo),
    data_reuniao = data_reuniao,
    texto = coalesce(texto, ''),
    documento = coalesce(documento, '{}'::jsonb)
  where public.atas.id = ata_id
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
