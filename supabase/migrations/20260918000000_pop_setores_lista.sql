-- ---------------------------------------------------------------------------
-- POPs — lista oficial de setores (13) + eliminação do Legalização
-- ---------------------------------------------------------------------------
-- Este arquivo:
--   1. grava os 13 setores oficiais em `public.pop_setores` (upsert por id,
--      idempotente — pode rodar de novo sem efeito colateral);
--   2. troca o prefixo do setor Pessoal para PES (o prefixo RH passa a ser
--      do setor de RH) e renomeia os códigos de exemplo RH-01/RH-02;
--   3. elimina o setor Legalização SEM apagar POPs: eventuais POPs vinculados
--      a ele são movidos para Direção (setor, responsáveis e visualizadores),
--      mantendo códigos, revisões e anexos intactos.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud
-- (aba Cloud -> SQL editor) e execute.
-- ---------------------------------------------------------------------------

-- 0. Blindagem: garante as colunas de acesso (caso a migration 20260917000000
-- ainda não tenha sido aplicada neste banco). Sem elas, o passo 3 falharia.
alter table public.pops
  add column if not exists setores_responsaveis text[] not null default '{}';
alter table public.pops add column if not exists visualizadores text[] not null default '{}';

-- 1. Lista oficial de setores (ordem da grade do /pops) -----------------------
insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem) values
  ('direcao',         'Direção',             'DIR', 'DIRECAO',   'building',        1),
  ('fiscal',          'Fiscal',              'FIS', 'FISCAL',    'receipt',         2),
  ('contabil',        'Contábil',            'CTB', 'CONTABIL',  'calculator',      3),
  ('qualidade',       'Qualidade',           'QUA', 'QUALIDADE', 'shield',          4),
  ('comercial',       'Comercial',           'COM', 'COMERCIAL', 'briefcase',       5),
  ('ti',              'TI/Desenvolvimento',  'TI',  'TI',        'monitor',         6),
  ('rh',              'RH',                  'RH',  'RH',        'user-round',      7),
  ('financeiro',      'Financeiro',          'FIN', 'FINANCEIRO','wallet',          8),
  ('bpo-financeiro',  'BPO Financeiro',      'BPO', 'BPO',       'layers',          9),
  ('marketing-m7',    'Marketing M7',        'MKT', 'MARKETING', 'megaphone',      10),
  ('sucesso-cliente', 'Sucesso do Cliente',  'SUC', 'SUCESSO',   'heart-handshake',11),
  ('tecnico',         'Técnico',             'TEC', 'TECNICO',   'wrench',         12),
  ('pessoal',         'Pessoal',             'PES', 'PESSOAL',   'users',          13)
on conflict (id) do update set
  nome = excluded.nome,
  prefixo = excluded.prefixo,
  categoria = excluded.categoria,
  icone = excluded.icone,
  ordem = excluded.ordem;

-- 2. Pessoal passa a usar o prefixo PES ---------------------------------------
-- O prefixo RH pertencia ao setor Pessoal nos dados de exemplo; agora ele é
-- do setor de RH. Renomeia só os códigos de exemplo do Pessoal (sem tocar em
-- nenhum outro POP e sem violar a unicidade de `pops.codigo`).
update public.pops
  set codigo = 'PES-01'
  where codigo = 'RH-01'
    and setor_id = 'pessoal'
    and not exists (select 1 from public.pops ped where ped.codigo = 'PES-01');

update public.pops
  set codigo = 'PES-02'
  where codigo = 'RH-02'
    and setor_id = 'pessoal'
    and not exists (select 1 from public.pops ped where ped.codigo = 'PES-02');

-- 3. Elimina o Legalização sem apagar POPs ------------------------------------
-- A FK `pops.setor_id -> pop_setores.id` é ON DELETE CASCADE: apagar o setor
-- apagaria os POPs junto. Por isso, antes de excluir, eventuais POPs da
-- Legalização são movidos para Direção (é possível reatribuí-los pela tela
-- de edição depois). Códigos, revisões, anexos e histórico são preservados.
update public.pops
  set
    setor_id = case when setor_id = 'legalizacao' then 'direcao' else setor_id end,
    setores_responsaveis = case
      when 'legalizacao' = any (setores_responsaveis)
        then array_replace(setores_responsaveis, 'legalizacao', 'direcao')
      else setores_responsaveis
    end,
    visualizadores = case
      when 'legalizacao' = any (visualizadores)
        then array_replace(visualizadores, 'legalizacao', 'direcao')
      else visualizadores
    end
  where setor_id = 'legalizacao'
    or 'legalizacao' = any (setores_responsaveis)
    or 'legalizacao' = any (visualizadores);

delete from public.pop_setores where id = 'legalizacao';