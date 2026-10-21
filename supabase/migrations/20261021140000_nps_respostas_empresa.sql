-- ---------------------------------------------------------------------------
-- Razão social nas notas NPS, para filtrar o NPS geral por empresa
-- ---------------------------------------------------------------------------
--   * `nps_respostas.empresa` guarda a razão social de quem respondeu (a resposta
--     à pergunta cujo texto traz "nome da empresa" ou "razão social"). Fica vazia
--     quando a pesquisa não tem essa pergunta.
--   * O trigger passa a gravar a empresa em cada nota nova.
--   * A carga abaixo preenche as notas que já existem.
--   * Idempotente: pode rodar mais de uma vez.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).
-- ---------------------------------------------------------------------------

alter table public.nps_respostas add column if not exists empresa text not null default '';

create index if not exists nps_respostas_empresa_idx on public.nps_respostas (empresa);

-- Trigger atualizado: igual ao anterior, mais a empresa da resposta.
create or replace function public.registrar_nps_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nps_respostas (created_at, modelo_id, resposta_id, pergunta_id, pergunta_texto, nota, grupo, empresa)
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
    end,
    n.empresa
  from (
    select
      p->>'id' as pergunta_id,
      coalesce(p->>'texto', '') as texto,
      case
        when jsonb_typeof(new.respostas->(p->>'id')) = 'number'
          then (new.respostas->>(p->>'id'))::numeric
      end as valor,
      coalesce((
        select trim(coalesce(new.respostas->>(q->>'id'), ''))
        from jsonb_array_elements(m.perguntas) as q
        where q->>'texto' ~* 'nome da empresa|raz[aã]o social'
        limit 1
      ), '') as empresa
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

-- Preenche a empresa das notas que já existem (inclusive as de pesquisas excluídas,
-- enquanto a resposta ainda existir).
update public.nps_respostas n
set empresa = coalesce((
  select trim(coalesce(r.respostas->>(q->>'id'), ''))
  from public.pesquisas_respostas r
  join public.pesquisas_modelos m on m.id = r.modelo_id
  cross join lateral jsonb_array_elements(m.perguntas) as q
  where r.id = n.resposta_id
    and q->>'texto' ~* 'nome da empresa|raz[aã]o social'
  limit 1
), '')
where n.empresa = '';
