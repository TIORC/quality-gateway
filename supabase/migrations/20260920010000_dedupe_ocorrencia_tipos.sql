-- Dedeuplica tipos de ocorrência e previne re-insert duplicado no seed.
-- Causa: o seed usa `on conflict do nothing` sem constraint UNIQUE em `nome`,
-- então cada re-execução da migração inseriu os 4 tipos de novo (3x hoje).

-- 1) Consolida cada nome mantendo o registro mais antigo; reponte ocorrências
do $$
declare
  r record;
begin
  for r in
    select nome, min(created_at) as mais_antigo
    from public.ocorrencia_tipos
    group by nome
    having count(*) > 1
  loop
    update public.ocorrencias o
      set tipo_id = t.manter
      from (
        select id as manter
        from public.ocorrencia_tipos
        where nome = r.nome
          and created_at = r.mais_antigo
        limit 1
      ) t
      where o.tipo_id in (
        select id from public.ocorrencia_tipos where nome = r.nome
      ) and o.tipo_id <> t.manter;

    delete from public.ocorrencia_tipos
      where nome = r.nome
        and id not in (
          select id from public.ocorrencia_tipos
          where nome = r.nome and created_at = r.mais_antigo
          limit 1
        );
  end loop;
end $$;

-- 2) Garante idempotência futura: `on conflict do nothing` passa a funcionar
create unique index if not exists ocorrencia_tipos_nome_uidx
  on public.ocorrencia_tipos (nome);