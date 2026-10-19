-- ---------------------------------------------------------------------------
-- Liga as 4 respostas da planilha ao modelo "PESQUISA DE SATISFAÇÃO ORCOMA"
-- ---------------------------------------------------------------------------
--   * Os gráficos por pergunta leem `pesquisas_respostas`, que é ligada ao
--     modelo pelo id de cada pergunta. Esta migration grava as respostas
--     nesse formato, mapeando cada coluna da planilha pelo texto da pergunta.
--   * Rode depois de `20261019040000_importar_pesquisas_planilha.sql`
--     (ela cuida da tabela `pesquisas_satisfacao`, usada pelas médias).
--   * Idempotente: cada resposta só entra se ainda não existir uma com o mesmo horário.
--   * Se alguma pergunta não for encontrada pelo texto, a migration para com erro.
-- ---------------------------------------------------------------------------

with modelo as (
  select id, perguntas
  from public.pesquisas_modelos
  where titulo ilike '%satisfa%orcoma%'
  order by created_at desc
  limit 1
),
perguntas as (
  select p->>'id' as id, p->>'texto' as texto
  from modelo, jsonb_array_elements(modelo.perguntas) as p
),
mapa as (
  select
    (select id from perguntas where texto ilike '%Nome da Empresa%') as empresa,
    (select id from perguntas where texto ilike '%Respondido por%') as pessoa,
    (select id from perguntas where texto ilike '%unidade%') as unidade,
    (select id from perguntas where texto ilike '%atendimento%') as atendimento,
    (select id from perguntas where texto ilike '%qualidade%') as qualidade,
    (select id from perguntas where texto ilike '%orienta%') as orientacoes,
    (select id from perguntas where texto ilike '%prazo%') as prazos,
    (select id from perguntas where texto ilike '%probabilidade%') as recomendacao,
    (select id from perguntas where texto ilike '%sugest%') as sugestao
),
respostas_planilha as (
  select * from (values
    (timestamptz '2026-04-28 11:37:52-03', 'A FERRAGISTA PRESTADORA DE SERVICOS LTDA', 'NATHALIA VAZ COSTA', 'Maracás', 8, 8, 8, 8, 8, ''),
    (timestamptz '2026-04-30 16:11:17-03', 'ELCIDES BATISTA MATOS', 'ELCIDES BATISTA MATOS', 'Maracás', 7, 7, 7, 7, 8, ''),
    (timestamptz '2026-04-30 14:25:33-03', 'MELO CESTAS BASICAS LTDA', 'CARLOS ALBERTO OLIVEIRA DE MELO', 'Maracás', 8, 8, 8, 8, 8, ''),
    (timestamptz '2026-04-10 16:45:46-03', 'Trukofer Requalificadora', 'Valdair Pereira Junior', '', 7, 7, 9, 7, 8,
     $txt$Atendimento claro e mais preciso em datas e informações, principalmente em prazos, acompanhamentos de impostos junto a equipe. Retorno mais rapido das duvidas e acompanhamento ate soluçao final, o que sinto é que se nao ficarmos em cima relembrando cai no esquecimento alguns pontos, e na nossa correria tambem acaba passando. Entao uma dedicação maior ou um responsável direto pela nossas empresas seria bem interessante.$txt$)
  ) as v(criado_em, empresa, pessoa, unidade, n1, n2, n3, n4, n5, sugestao)
)
insert into public.pesquisas_respostas (created_at, modelo_id, respostas)
select
  v.criado_em,
  modelo.id,
  jsonb_strip_nulls(jsonb_build_object(
    mapa.empresa, v.empresa,
    mapa.pessoa, v.pessoa,
    mapa.unidade, nullif(v.unidade, ''),
    mapa.atendimento, v.n1,
    mapa.qualidade, v.n2,
    mapa.orientacoes, v.n3,
    mapa.prazos, v.n4,
    mapa.recomendacao, v.n5,
    mapa.sugestao, nullif(v.sugestao, '')
  ))
from respostas_planilha v
cross join modelo
cross join mapa
where not exists (
  select 1 from public.pesquisas_respostas r
  where r.modelo_id = modelo.id and r.created_at = v.criado_em
);
