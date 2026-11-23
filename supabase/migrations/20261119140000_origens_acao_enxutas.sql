-- ---------------------------------------------------------------------------
-- Origens das ações: só Auditoria, Política/processo, Planejamento estratégico e Outros
-- ---------------------------------------------------------------------------
-- As demais origens ficam cadastradas, mas inativas (podem ser reativadas em
-- Configurações > Cadastros). Os planos antigos mantêm a origem gravada.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase).

insert into public.plano_origens (id, nome, ativa, ordem) values
  ('auditoria',               'Auditoria',               true, 1),
  ('politica-processo',       'Política/processo',       true, 2),
  ('planejamento-estrategico', 'Planejamento estratégico', true, 3),
  ('outros',                  'Outros',                  true, 4)
on conflict (id) do update
  set nome = excluded.nome,
      ativa = true,
      ordem = excluded.ordem;

update public.plano_origens
   set ativa = false
 where nome not in ('Auditoria', 'Política/processo', 'Planejamento estratégico', 'Outros');
