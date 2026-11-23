-- ---------------------------------------------------------------------------
-- Agenda — marcar evento avulso como realizado
-- ---------------------------------------------------------------------------
-- Adiciona `realizada` aos eventos da agenda e uma função para marcar/desmarcar.
-- Regra: quem criou o evento ou a Qualidade/Admin pode marcar.
-- Depende de `usuario_id_por_email` e `pode_gerenciar_tipos_reuniao`.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.agenda_eventos
  add column if not exists realizada boolean not null default false;

create or replace function public.marcar_agenda_evento_realizada(
  email_caller text,
  evento_id uuid,
  marcar boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario text := public.usuario_id_por_email(email_caller);
  dono text;
begin
  select e.criado_por into dono
  from public.agenda_eventos e
  where e.id = evento_id;

  if dono is null then
    raise exception 'Evento não encontrado.';
  end if;
  if dono is distinct from usuario and not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Apenas quem criou o evento ou a Qualidade pode marcá-lo como realizado.';
  end if;

  update public.agenda_eventos
  set realizada = coalesce(marcar, false),
      updated_at = now()
  where id = evento_id;
end;
$$;

comment on function public.marcar_agenda_evento_realizada(text, uuid, boolean) is
  'Marca ou desmarca um evento da agenda como realizado (criador ou Qualidade/Admin).';

grant execute on function public.marcar_agenda_evento_realizada(text, uuid, boolean)
  to anon, authenticated;
