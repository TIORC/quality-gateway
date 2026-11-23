-- ---------------------------------------------------------------------------
-- Agenda — editar evento avulso
-- ---------------------------------------------------------------------------
-- Atualiza título, data, horários, descrição e convidados de um evento.
-- Regra: quem criou o evento ou a Qualidade/Admin pode editar.
-- A marcação de realizado (`realizada`) não é alterada aqui.
-- Depende de `usuario_id_por_email` e `pode_gerenciar_tipos_reuniao`.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create or replace function public.atualizar_agenda_evento(
  email_caller text,
  evento_id uuid,
  p_titulo text,
  p_data_evento date,
  p_hora_inicio time default null,
  p_hora_fim time default null,
  p_descricao text default '',
  p_convidados jsonb default '[]'::jsonb
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
    raise exception 'Apenas quem criou o evento ou a Qualidade pode editá-lo.';
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then
    raise exception 'Informe o título do evento.';
  end if;
  if p_data_evento is null then
    raise exception 'Informe a data do evento.';
  end if;
  if p_hora_inicio is not null and p_hora_fim is not null and p_hora_fim <= p_hora_inicio then
    raise exception 'O horário de término deve ser depois do início.';
  end if;

  update public.agenda_eventos e
  set titulo = trim(p_titulo),
      data_evento = p_data_evento,
      hora_inicio = p_hora_inicio,
      hora_fim = p_hora_fim,
      descricao = coalesce(p_descricao, ''),
      convidados = coalesce(p_convidados, '[]'::jsonb),
      updated_at = now()
  where e.id = evento_id
  returning * into atualizado;

  return atualizado;
end;
$$;

comment on function public.atualizar_agenda_evento(text, uuid, text, date, time, time, text, jsonb) is
  'Atualiza um evento da agenda (criador ou Qualidade/Admin).';

grant execute on function public.atualizar_agenda_evento(text, uuid, text, date, time, time, text, jsonb)
  to anon, authenticated;
