-- ---------------------------------------------------------------------------
-- Setores: Configurações > Unidades e setores é a fonte única dos nomes
-- ---------------------------------------------------------------------------
-- Os nomes de setor estavam espalhados e diferentes ("TI" em Configurações,
-- "TI / Desenvolvimento" em POPs). Este arquivo:
--   1. cria `setor_propagar_nome`: ao renomear um setor em `public.setores`, o
--      novo nome é gravado em todas as tabelas que guardam o setor como texto
--      (e em `pop_setores`, que alimenta a grade do /pops);
--   2. renomeia o setor TI para "TI / Desenvolvimento" e propaga o nome.
--
-- Idempotente: pode rodar de novo sem efeito colateral. Tabelas que ainda não
-- existem neste banco são ignoradas.

create or replace function public.setor_renomear_em_tudo(p_antigo text, p_novo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo record;
begin
  if p_antigo is null or p_novo is null or lower(btrim(p_antigo)) = lower(btrim(p_novo)) then
    return;
  end if;

  -- Colunas de texto simples: (tabela, coluna). Só atualiza as que existem.
  for alvo in
    select * from (values
      ('colaboradores', 'setor'),
      ('planos_de_acao', 'setor'),
      ('ocorrencia_tipos', 'setor_padrao'),
      ('ocorrencias', 'aberta_por_setor'),
      ('projetos_estrategicos', 'setor'),
      ('indicadores', 'setor')
    ) as t (tabela, coluna)
  loop
    if exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public'
         and c.table_name = alvo.tabela
         and c.column_name = alvo.coluna
    ) then
      execute format(
        'update public.%I set %I = $2 where lower(btrim(%I)) = lower(btrim($1))',
        alvo.tabela, alvo.coluna, alvo.coluna
      ) using p_antigo, p_novo;
    end if;
  end loop;

  -- Listas de setores (text[])
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'politicas' and column_name = 'setores') then
    update public.politicas
       set setores = array_replace(setores, p_antigo, p_novo)
     where p_antigo = any (setores);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'setores_liderados') then
    update public.colaboradores
       set setores_liderados = array_replace(setores_liderados, p_antigo, p_novo)
     where p_antigo = any (setores_liderados);
  end if;

  -- Grade do /pops
  if to_regclass('public.pop_setores') is not null then
    update public.pop_setores
       set nome = p_novo
     where lower(btrim(nome)) = lower(btrim(p_antigo));
  end if;
end;
$$;

create or replace function public.setor_propagar_nome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nome is distinct from old.nome then
    perform public.setor_renomear_em_tudo(old.nome, new.nome);
  end if;
  return new;
end;
$$;

drop trigger if exists setores_propagar_nome on public.setores;
create trigger setores_propagar_nome
  after update of nome on public.setores
  for each row execute function public.setor_propagar_nome();

-- TI -> TI / Desenvolvimento ----------------------------------------------------
-- Variantes antigas que ainda possam existir nos dados.
select public.setor_renomear_em_tudo('TI', 'TI / Desenvolvimento');
select public.setor_renomear_em_tudo('TI/Desenvolvimento', 'TI / Desenvolvimento');
select public.setor_renomear_em_tudo('TI - Desenvolvimento', 'TI / Desenvolvimento');

update public.setores
   set nome = 'TI / Desenvolvimento'
 where id = 'ti' and nome <> 'TI / Desenvolvimento';

update public.pop_setores
   set nome = 'TI / Desenvolvimento'
 where id = 'ti' and nome <> 'TI / Desenvolvimento';

-- Grafias erradas gravadas à mão em `pop_setores` (ex.: "TI / Desnvolvimento"):
-- qualquer setor de POP que comece com "TI" seguido de "/" ou "-" vira o nome oficial.
update public.pop_setores
   set nome = 'TI / Desenvolvimento'
 where nome ~* '^\s*ti\s*[/-]'
   and nome <> 'TI / Desenvolvimento';
