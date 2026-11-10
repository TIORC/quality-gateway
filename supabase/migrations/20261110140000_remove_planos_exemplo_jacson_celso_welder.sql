-- Remove os planos de ação de exemplo (seed das migrações 20260915010000 e
-- 20260915162800) cujos responsáveis são Jacson Mascarenhas, Celso Alcantara e
-- Welder Silva. Casa título + e-mail do responsável + prazo, que são os valores
-- gravados pelo seed. Os registros filhos caem junto (on delete cascade).

delete from public.planos_de_acao
where (titulo, responsavel_email, prazo) in (
  ('Padronização de instruções de trabalho', 'jacson@orcoma.com.br', '2026-09-01'),
  ('Plano de ação para reclamação do cliente X', 'jacson@orcoma.com.br', '2026-09-10'),
  ('Revisão do plano de comunicação interna', 'jacson@orcoma.com.br', '2026-11-05'),
  ('Plano de ação para não conformidade NC-2026-003', 'celso.alcantara@orcoma.com.br', '2026-10-25'),
  ('Revisão do plano de contingência', 'celso.alcantara@orcoma.com.br', '2026-11-20'),
  ('Atualização de procedimentos de TI', 'welder@orcoma.com.br', '2026-11-15')
);
