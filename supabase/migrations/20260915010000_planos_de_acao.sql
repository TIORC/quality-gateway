-- ---------------------------------------------------------------------------
-- Planos de Ação (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente.
-- ---------------------------------------------------------------------------

-- Planos de ação ------------------------------------------------------------
create table if not exists public.planos_de_acao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null default '',
  detalhamento text not null default '',
  status text not null default 'aberta'
    check (status in ('aberta', 'em_andamento', 'concluida', 'atrasada')),
  origem text not null default 'Outros',
  setor text not null default 'Qualidade',
  prioridade text not null default 'Média'
    check (prioridade in ('Crítica', 'Alta', 'Média', 'Baixa')),
  responsavel_nome text not null default '',
  responsavel_email text not null default '',
  seguidores text[] not null default '{}',
  prazo date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.planos_de_acao is 'Planos de ação de tratativa e melhoria.';
comment on column public.planos_de_acao.status is 'aberta | em_andamento | concluida | atrasada';
comment on column public.planos_de_acao.origem is 'Origem que gerou a ação (Auditoria, Não Conformidade, etc.)';
comment on column public.planos_de_acao.setor is 'Setor responsável pela execução.';
comment on column public.planos_de_acao.prioridade is 'Nível de urgência da ação.';
comment on column public.planos_de_acao.seguidores is 'Lista de e-mails de seguidores mencionados.';

create index if not exists planos_de_acao_status_idx on public.planos_de_acao (status);
create index if not exists planos_de_acao_setor_idx on public.planos_de_acao (setor);
create index if not exists planos_de_acao_origem_idx on public.planos_de_acao (origem);

-- updated_at automático -----------------------------------------------------
create or replace function public.planos_de_acao_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planos_de_acao_set_updated_at on public.planos_de_acao;
create trigger planos_de_acao_set_updated_at
  before update on public.planos_de_acao
  for each row
  execute function public.planos_de_acao_set_updated_at();

-- Acesso --------------------------------------------------------------------
alter table public.planos_de_acao enable row level security;

drop policy if exists "planos_de_acao: leitura" on public.planos_de_acao;
create policy "planos_de_acao: leitura"
  on public.planos_de_acao for select
  to anon, authenticated
  using (true);

drop policy if exists "planos_de_acao: escrita" on public.planos_de_acao;
create policy "planos_de_acao: escrita"
  on public.planos_de_acao for all
  to anon, authenticated
  using (true)
  with check (true);

-- Registros de exemplo ------------------------------------------------------
insert into public.planos_de_acao
  (titulo, descricao, detalhamento, status, origem, setor, prioridade,
   responsavel_nome, responsavel_email, prazo)
values
  -- Concluídas
  ('Revisão do controle de documentos',
   'Atualizar a matriz de documentos do SGQ.',
   'Revisar todos os documentos controlados, atualizar versões e eliminar obsoletos.',
   'concluida', 'Auditoria Interna', 'Qualidade', 'Alta',
   'Kaylane Oliveira', 'kaylane.oliveira@orcoma.com.br', '2026-08-20'),

  ('Treinamento de abertura de ocorrências',
   'Capacitar colaboradores no uso do formulário de ocorrências.',
   'Ministrar treinamento para os setores Fiscal e Contábil sobre o novo fluxo de ocorrências.',
   'concluida', 'Não Conformidade', 'Qualidade', 'Média',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-08-25'),

  ('Padronização de instruções de trabalho',
   'Unificar o formato das instruções de trabalho entre setores.',
   'Criar modelo padrão e aplicar nas instruções do Fiscal, Contábil e RH.',
   'concluida', 'Reunião Estratégica', 'Direção', 'Alta',
   'Jacson Mascarenhas', 'jacson@orcoma.com.br', '2026-09-01'),

  -- Em andamento
  ('Implementação de indicador de retrabalho',
   'Criar indicador de retrabalho no setor de Operações.',
   'Definir fórmula, coleta mensal e meta. Acompanhar por 3 meses antes de fechar.',
   'em_andamento', 'Indicadores', 'Operações', 'Alta',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-10-15'),

  ('Mapeamento de processos do Fiscal',
   'Levantar os processos do setor Fiscal para atualização dos POPs.',
   'Entrevistar colaboradores, documentar fluxos e cruzar com POPs existentes.',
   'em_andamento', 'Auditoria Interna', 'Fiscal', 'Crítica',
   'Kaylane Oliveira', 'kaylane.oliveira@orcoma.com.br', '2026-10-01'),

  ('Automatização de relatório mensal',
   'Desenvolver script para gerar relatório de indicadores automaticamente.',
   'Criar automação com Python para consolidar dados e gerar PDF.',
   'em_andamento', 'Projetos', 'TI', 'Média',
   'Gabriel Anacleto', 'gabriel.anacleto@orcoma.com.br', '2026-10-10'),

  ('Atualização de política de qualidade',
   'Revisar a Política da Qualidade com base em novas exigências.',
   'Analisar ISO 9001:2015, propor alterações e submeter à aprovação da Direção.',
   'em_andamento', 'Planejamento Estratégico', 'Qualidade', 'Alta',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-10-20'),

  -- Abertas
  ('Plano de ação para não conformidade NC-2026-003',
   'Tratar a NC identificada na auditoria externa de setembro.',
   'Investigar causa raiz, propor ação corretiva e definir responsável.',
   'aberta', 'Não Conformidade', 'Técnico', 'Crítica',
   'Celso Alcantara', 'celso.alcantara@orcoma.com.br', '2026-10-25'),

  ('Revisão do plano de comunicação interna',
   'Melhorar o fluxo de comunicação entre setores.',
   'Levantar gargalos, propor canais e testar por 30 dias.',
   'aberta', 'Reunião Estratégica', 'RH', 'Média',
   'Jacson Mascarenhas', 'jacson@orcoma.com.br', '2026-11-05'),

  ('Capacitação em boas práticas de armazenamento',
   'Treinamento para o setor de Operações sobre armazenamento correto.',
   'Elaborar material, ministrar palestra e aplicar avaliação.',
   'aberta', 'Reclamação do Cliente', 'Operações', 'Média',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-11-10'),

  ('Atualização de procedimentos de TI',
   'Revisar os procedimentos de backup e segurança da informação.',
   'Auditoria dos procedimentos atuais, identificar falhas e atualizar documentação.',
   'aberta', 'Projetos', 'TI', 'Alta',
   'Welder Silva', 'welder@orcoma.com.br', '2026-11-15'),

  ('Ação corretiva para multa por falta fiscal',
   'Tratar multa recebida por erro na apuração do ICMS.',
   'Investigar causa, implementar controle adicional e documentar lição aprendida.',
   'aberta', 'Multas por Faltas', 'Fiscal', 'Crítica',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-10-18'),

  ('Revisão do plano de contingência',
   'Atualizar plano de contingência para emergências operacionais.',
   'Revisar cenários, contatos de emergência e simulados.',
   'aberta', 'Planejamento Estratégico', 'Operações', 'Alta',
   'Celso Alcantara', 'celso.alcantara@orcoma.com.br', '2026-11-20'),

  -- Atrasadas
  ('Ação corretiva NC-2026-001',
   'Tratar não conformidade identificada na auditoria de julho.',
   'Causa raiz já identificada. Faltava implementar ação corretiva.',
   'atrasada', 'Não Conformidade', 'Qualidade', 'Crítica',
   'Olandson de Jesus', 'olandson@orcoma.com.br', '2026-08-30'),

  ('Atualização de documentação fiscal',
   'Atualizar a documentação dos processos fiscais com novas regras.',
   'A atualização das retribuições estava pendente desde agosto.',
   'atrasada', 'Indicadores', 'Fiscal', 'Alta',
   'Kaylane Oliveira', 'kaylane.oliveira@orcoma.com.br', '2026-09-05'),

  ('Plano de ação para reclamação do cliente X',
   'Atender reclamação do cliente sobre atraso na entrega.',
   'Identificar gargalo, propor solução e comunicar ao cliente.',
   'atrasada', 'Reclamação do Cliente', 'Sucesso do Cliente', 'Crítica',
   'Jacson Mascarenhas', 'jacson@orcoma.com.br', '2026-09-10')
on conflict do nothing;
