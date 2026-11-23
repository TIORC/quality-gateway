-- ---------------------------------------------------------------------------
-- Agenda — eventos avulsos com convidados (estilo Google Agenda)
-- ---------------------------------------------------------------------------
-- Cada evento tem data e horário próprios e convida pessoas marcadas com @.
-- Regra de negócio:
--   * qualquer colaborador cadastrado em `usuarios` cria eventos;
--   * o evento aparece para quem o criou e para quem está entre os convidados;
--   * excluir: quem criou o evento ou Qualidade/Admin;
--   * escrita direta bloqueada pela RLS; somente as funções abaixo gravam.
--
-- Depende de `usuario_id_por_email` e `pode_gerenciar_tipos_reuniao`
-- (migrations de atas e de tipos de reunião).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  data_evento date not null,
  hora_inicio time,
  hora_fim time,
  descricao text not null default '',
  -- usuarios.id de quem criou o evento
  criado_por text not null,
  -- convidados: [{"id": "<usuarios.id>", "nome": "<nome>"}]
  convidados jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_eventos_horario_valido
    check (hora_inicio is null or hora_fim is null or hora_fim > hora_inicio)
);

create index if not exists agenda_eventos_data_idx on public.agenda_eventos (data_evento);

alter table public.agenda_eventos enable row level security;

-- Sem políticas para anon/authenticated: leitura e escrita só pelas funções abaixo.
revoke all on public.agenda_eventos from anon, authenticated;

-- Eventos visíveis para o usuário (criador ou convidado) -------------------------
create or replace function public.listar_agenda_eventos(email_caller text)
returns setof public.agenda_eventos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  usuario text := public.usuario_id_por_email(email_caller);
begin
  if usuario is null then
    return;
  end if;
  return query
    select e.*
    from public.agenda_eventos e
    where e.criado_por = usuario
       or e.convidados @> jsonb_build_array(jsonb_build_object('id', usuario))
    order by e.data_evento, e.hora_inicio nulls first, e.titulo;
end;
$$;

comment on function public.listar_agenda_eventos(text) is
  'Eventos da agenda em que o usuário é criador ou convidado.';

grant execute on function public.listar_agenda_eventos(text) to anon, authenticated;

-- Criação ------------------------------------------------------------------------
create or replace function public.criar_agenda_evento(
  email_caller text,
  titulo text,
  data_evento date,
  hora_inicio time default null,
  hora_fim time default null,
  descricao text default '',
  convidados jsonb default '[]'::jsonb
)
returns public.agenda_eventos
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario text := public.usuario_id_por_email(email_caller);
  nova public.agenda_eventos;
begin
  if usuario is null then
    raise exception 'Seu usuário não está cadastrado como colaborador. Procure a Qualidade.';
  end if;
  if length(trim(coalesce(titulo, ''))) = 0 then
    raise exception 'Informe o título do evento.';
  end if;
  if data_evento is null then
    raise exception 'Informe a data do evento.';
  end if;
  if hora_inicio is not null and hora_fim is not null and hora_fim <= hora_inicio then
    raise exception 'O horário de término deve ser depois do início.';
  end if;

  insert into public.agenda_eventos (
    titulo, data_evento, hora_inicio, hora_fim, descricao, criado_por, convidados
  )
  values (
    trim(titulo),
    data_evento,
    hora_inicio,
    hora_fim,
    coalesce(descricao, ''),
    usuario,
    coalesce(convidados, '[]'::jsonb)
  )
  returning * into nova;

  return nova;
end;
$$;

comment on function public.criar_agenda_evento(text, text, date, time, time, text, jsonb) is
  'Cria um evento da agenda com convidados marcados. Exige cadastro em usuarios.';

grant execute on function public.criar_agenda_evento(text, text, date, time, time, text, jsonb)
  to anon, authenticated;

-- Exclusão -----------------------------------------------------------------------
create or replace function public.excluir_agenda_evento(email_caller text, evento_id uuid)
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
    raise exception 'Apenas quem criou o evento ou a Qualidade pode excluí-lo.';
  end if;

  delete from public.agenda_eventos where id = evento_id;
end;
$$;

comment on function public.excluir_agenda_evento(text, uuid) is
  'Exclui um evento da agenda (criador ou Qualidade/Admin).';

grant execute on function public.excluir_agenda_evento(text, uuid) to anon, authenticated;
