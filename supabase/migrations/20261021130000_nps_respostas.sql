-- ---------------------------------------------------------------------------
-- Guarda cada nota de NPS separadamente, para o NPS geral não se perder
-- ---------------------------------------------------------------------------
--   * `nps_respostas` tem uma linha por nota de pergunta do tipo NPS: a nota
--     (0 a 10), o grupo (detratores, neutros ou promotores) e o texto da pergunta
--     no momento da resposta.
--   * Excluir uma pesquisa NÃO apaga estas linhas (modelo_id vira null), então
--     o NPS geral continua com as notas que já foram dadas.
--   * Um trigger grava a linha sempre que uma resposta entra em `pesquisas_respostas`,
--     inclusive as que vierem de fora da interface.
--   * A carga abaixo preenche as respostas que já existem.
--   * Idempotente: pode rodar mais de uma vez.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).
-- ---------------------------------------------------------------------------

create table if not exists public.nps_respostas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  modelo_id uuid references public.pesquisas_modelos (id) on delete set null,
  resposta_id uuid references public.pesquisas_respostas (id) on delete set null,
  pergunta_id text not null,
  pergunta_texto text not null default '',
  nota smallint not null check (nota between 0 and 10),
  grupo text not null check (grupo in ('detratores', 'neutros', 'promotores')),
  unique (resposta_id, pergunta_id)
);

create index if not exists nps_respostas_modelo_idx on public.nps_respostas (modelo_id);

alter table public.nps_respostas enable row level security;

drop policy if exists "nps_respostas: leitura" on public.nps_respostas;
create policy "nps_respostas: leitura"
  on public.nps_respostas for select
  to anon, authenticated
  using (true);

-- Grava as notas NPS de uma resposta. Roda como dono da função, então não depende
-- das permissões de quem enviou a resposta. O CASE garante que só valores numéricos
-- são convertidos, antes de qualquer comparação.
create or replace function public.registrar_nps_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nps_respostas (created_at, modelo_id, resposta_id, pergunta_id, pergunta_texto, nota, grupo)
  select
    new.created_at,
    new.modelo_id,
    new.id,
    n.pergunta_id,
    n.texto,
    n.valor::smallint,
    case
      when n.valor <= 6 then 'detratores'
      when n.valor <= 8 then 'neutros'
      else 'promotores'
    end
  from (
    select
      p->>'id' as pergunta_id,
      coalesce(p->>'texto', '') as texto,
      case
        when jsonb_typeof(new.respostas->(p->>'id')) = 'number'
          then (new.respostas->>(p->>'id'))::numeric
      end as valor
    from public.pesquisas_modelos m
    cross join lateral jsonb_array_elements(m.perguntas) as p
    where m.id = new.modelo_id
      and p->>'tipo' = 'nps'
  ) n
  where n.valor between 0 and 10
    and n.valor = trunc(n.valor)
  on conflict (resposta_id, pergunta_id) do nothing;
  return new;
end;
$$;

drop trigger if exists pesquisas_respostas_registrar_nps on public.pesquisas_respostas;
create trigger pesquisas_respostas_registrar_nps
  after insert on public.pesquisas_respostas
  for each row execute function public.registrar_nps_resposta();

-- Carga das respostas que já existem, com a mesma regra do trigger.
insert into public.nps_respostas (created_at, modelo_id, resposta_id, pergunta_id, pergunta_texto, nota, grupo)
select
  n.created_at,
  n.modelo_id,
  n.resposta_id,
  n.pergunta_id,
  n.texto,
  n.valor::smallint,
  case
    when n.valor <= 6 then 'detratores'
    when n.valor <= 8 then 'neutros'
    else 'promotores'
  end
from (
  select
    r.created_at,
    r.modelo_id,
    r.id as resposta_id,
    p->>'id' as pergunta_id,
    coalesce(p->>'texto', '') as texto,
    case
      when jsonb_typeof(r.respostas->(p->>'id')) = 'number'
        then (r.respostas->>(p->>'id'))::numeric
    end as valor
  from public.pesquisas_respostas r
  join public.pesquisas_modelos m on m.id = r.modelo_id
  cross join lateral jsonb_array_elements(m.perguntas) as p
  where p->>'tipo' = 'nps'
) n
where n.valor between 0 and 10
  and n.valor = trunc(n.valor)
on conflict (resposta_id, pergunta_id) do nothing;
