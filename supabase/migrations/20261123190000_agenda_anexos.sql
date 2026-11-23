-- ---------------------------------------------------------------------------
-- Agenda — anexos nos eventos avulsos
-- ---------------------------------------------------------------------------
-- Os arquivos ficam no bucket privado `pop-anexos` (já existente), em
-- `agenda/<id do evento>/...`. Aqui ficam só os metadados, numa coluna jsonb.
-- Regras:
--   * anexar: criador, convidados ou Qualidade/Admin;
--   * remover anexo: criador ou Qualidade/Admin.
-- Depende de `usuario_id_por_email` e `pode_gerenciar_tipos_reuniao`.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.agenda_eventos
  add column if not exists anexos jsonb not null default '[]'::jsonb;

-- Anexar um arquivo já enviado ao Storage ---------------------------------------
create or replace function public.adicionar_anexo_agenda_evento(
  email_caller text,
  evento_id uuid,
  p_anexo jsonb
)
returns public.agenda_eventos
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario text := public.usuario_id_por_email(email_caller);
  dono text;
  convidados_evento jsonb;
  caminho text;
  atualizado public.agenda_eventos;
begin
  if usuario is null then
    raise exception 'Seu usuário não está cadastrado como colaborador. Procure a Qualidade.';
  end if;

  select e.criado_por, e.convidados into dono, convidados_evento
  from public.agenda_eventos e
  where e.id = evento_id;

  if dono is null then
    raise exception 'Evento não encontrado.';
  end if;
  if dono is distinct from usuario
     and not (convidados_evento @> jsonb_build_array(jsonb_build_object('id', usuario)))
     and not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Apenas o criador, os convidados ou a Qualidade podem anexar arquivos.';
  end if;

  caminho := coalesce(p_anexo->>'caminho', '');
  if length(trim(coalesce(p_anexo->>'nome', ''))) = 0 then
    raise exception 'Anexo sem nome.';
  end if;
  if caminho not like 'agenda/' || evento_id::text || '/%' then
    raise exception 'Caminho do anexo inválido.';
  end if;

  update public.agenda_eventos e
  set anexos = e.anexos || jsonb_build_array(p_anexo),
      updated_at = now()
  where e.id = evento_id
  returning * into atualizado;

  return atualizado;
end;
$$;

comment on function public.adicionar_anexo_agenda_evento(text, uuid, jsonb) is
  'Registra um anexo (já enviado ao Storage) em um evento da agenda.';

grant execute on function public.adicionar_anexo_agenda_evento(text, uuid, jsonb)
  to anon, authenticated;

-- Remover um anexo (só metadados; o arquivo é apagado pelo app) -----------------
create or replace function public.remover_anexo_agenda_evento(
  email_caller text,
  evento_id uuid,
  p_caminho text
)
returns public.agenda_eventos
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario text := public.usuario_id_por_email(email_caller);
  dono text;
  atualizado public.agenda_eventos;
begin
  select e.criado_por into dono
  from public.agenda_eventos e
  where e.id = evento_id;

  if dono is null then
    raise exception 'Evento não encontrado.';
  end if;
  if dono is distinct from usuario and not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Apenas quem criou o evento ou a Qualidade pode remover anexos.';
  end if;

  update public.agenda_eventos e
  set anexos = coalesce((
        select jsonb_agg(a)
        from jsonb_array_elements(e.anexos) a
        where a->>'caminho' <> p_caminho
      ), '[]'::jsonb),
      updated_at = now()
  where e.id = evento_id
  returning * into atualizado;

  return atualizado;
end;
$$;

comment on function public.remover_anexo_agenda_evento(text, uuid, text) is
  'Remove o registro de um anexo de um evento da agenda (criador ou Qualidade/Admin).';

grant execute on function public.remover_anexo_agenda_evento(text, uuid, text)
  to anon, authenticated;
