-- ---------------------------------------------------------------------------
-- Setores adicionais: uma pessoa pode contar nos indicadores de mais de um setor
-- ---------------------------------------------------------------------------
-- `colaboradores.setor` continua sendo o setor principal (define acesso e
-- permissões). `setores_adicionais` guarda outros setores em que a pessoa conta
-- nos indicadores (ex.: quem é do Contábil e também faz análise do Administrativo).
--
-- Idempotente: pode rodar de novo sem efeito colateral.

alter table public.colaboradores
  add column if not exists setores_adicionais text[] not null default '{}';

-- Renomear um setor também atualiza os setores adicionais dos colaboradores.
-- (Mesma função da migration de fonte única; só acrescenta o bloco de setores_adicionais.)
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
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'setores_adicionais') then
    update public.colaboradores
       set setores_adicionais = array_replace(setores_adicionais, p_antigo, p_novo)
     where p_antigo = any (setores_adicionais);
  end if;

  -- Grade do /pops
  if to_regclass('public.pop_setores') is not null then
    update public.pop_setores
       set nome = p_novo
     where lower(btrim(nome)) = lower(btrim(p_antigo));
  end if;
end;
$$;
