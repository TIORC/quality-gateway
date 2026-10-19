-- ---------------------------------------------------------------------------
-- Importa as respostas da planilha de pesquisa de satisfação (abril/2026)
-- ---------------------------------------------------------------------------
--   * Acrescenta `sugestao` (resposta da última pergunta, de texto livre).
--   * Insere as 4 respostas da planilha em `pesquisas_satisfacao`. Idempotente:
--     cada linha só entra se ainda não existir uma com o mesmo horário e empresa.
--   * Ordem das notas: atendimento, qualidade dos serviços, orientações técnicas,
--     prazos, recomendação.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.pesquisas_satisfacao
  add column if not exists sugestao text not null default '';

insert into public.pesquisas_satisfacao
  (created_at, empresa, nome_pessoa, unidade, nota_atendimento, nota_qualidade,
   nota_orientacoes, nota_prazos, nota_recomendacao, sugestao)
select v.criado_em, v.empresa, v.nome_pessoa, v.unidade, v.n1, v.n2, v.n3, v.n4, v.n5, v.sugestao
from (values
  (timestamptz '2026-04-28 11:37:52-03', 'A FERRAGISTA PRESTADORA DE SERVICOS LTDA', 'NATHALIA VAZ COSTA', 'Maracás', 8, 8, 8, 8, 8, ''),
  (timestamptz '2026-04-30 16:11:17-03', 'ELCIDES BATISTA MATOS', 'ELCIDES BATISTA MATOS', 'Maracás', 7, 7, 7, 7, 8, ''),
  (timestamptz '2026-04-30 14:25:33-03', 'MELO CESTAS BASICAS LTDA', 'CARLOS ALBERTO OLIVEIRA DE MELO', 'Maracás', 8, 8, 8, 8, 8, ''),
  (timestamptz '2026-04-10 16:45:46-03', 'Trukofer Requalificadora', 'Valdair Pereira Junior', '', 7, 7, 9, 7, 8,
   $txt$Atendimento claro e mais preciso em datas e informações, principalmente em prazos, acompanhamentos de impostos junto a equipe. Retorno mais rapido das duvidas e acompanhamento ate soluçao final, o que sinto é que se nao ficarmos em cima relembrando cai no esquecimento alguns pontos, e na nossa correria tambem acaba passando. Entao uma dedicação maior ou um responsável direto pela nossas empresas seria bem interessante.$txt$)
) as v(criado_em, empresa, nome_pessoa, unidade, n1, n2, n3, n4, n5, sugestao)
where not exists (
  select 1 from public.pesquisas_satisfacao p
  where p.created_at = v.criado_em and p.empresa = v.empresa
);
