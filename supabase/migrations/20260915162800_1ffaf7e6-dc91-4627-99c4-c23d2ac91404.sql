create extension if not exists "pgcrypto";

create table if not exists public.pop_setores (
  id text primary key,
  nome text not null,
  prefixo text not null,
  categoria text not null,
  icone text not null default 'folder',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pops (
  id uuid primary key default gen_random_uuid(),
  setor_id text not null references public.pop_setores (id) on delete cascade,
  codigo text not null unique,
  titulo text not null,
  descricao text not null default '',
  departamento text not null default '',
  categoria text not null default 'GERAL',
  frequencia text not null default 'MENSAL',
  prazo_referencia text not null default 'MES_ANTERIOR',
  regime text not null default 'TODOS',
  dificuldade text not null default 'MEDIO',
  cargo_responsavel text not null default 'ASSISTENTE',
  dia_inicio integer,
  meta_dia integer,
  prazo_legal date,
  favoritos integer not null default 0,
  anotacoes integer not null default 0,
  arquivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pops_setor_id_idx on public.pops (setor_id);
create index if not exists pops_codigo_idx on public.pops (codigo);

create table if not exists public.pop_anotacoes (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  autor_nome text not null default '',
  autor_email text not null default '',
  mensagem text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists pop_anotacoes_pop_id_idx on public.pop_anotacoes (pop_id);
create index if not exists pop_anotacoes_created_at_idx on public.pop_anotacoes (pop_id, created_at);

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
create index if not exists planos_de_acao_status_idx on public.planos_de_acao (status);
create index if not exists planos_de_acao_setor_idx on public.planos_de_acao (setor);
create index if not exists planos_de_acao_origem_idx on public.planos_de_acao (origem);

create or replace function public.pops_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pops_set_updated_at on public.pops;
create trigger pops_set_updated_at
  before update on public.pops
  for each row execute function public.pops_set_updated_at();

drop trigger if exists planos_de_acao_set_updated_at on public.planos_de_acao;
create trigger planos_de_acao_set_updated_at
  before update on public.planos_de_acao
  for each row execute function public.pops_set_updated_at();

grant select, insert, update, delete on public.pop_setores to anon, authenticated;
grant select, insert, update, delete on public.pops to anon, authenticated;
grant select, insert, update, delete on public.pop_anotacoes to anon, authenticated;
grant select, insert, update, delete on public.planos_de_acao to anon, authenticated;
grant all on public.pop_setores to service_role;
grant all on public.pops to service_role;
grant all on public.pop_anotacoes to service_role;
grant all on public.planos_de_acao to service_role;

alter table public.pop_setores enable row level security;
alter table public.pops enable row level security;
alter table public.pop_anotacoes enable row level security;
alter table public.planos_de_acao enable row level security;

drop policy if exists "pop_setores: escrita" on public.pop_setores;
create policy "pop_setores: escrita" on public.pop_setores for all to anon, authenticated using (true) with check (true);
drop policy if exists "pops: escrita" on public.pops;
create policy "pops: escrita" on public.pops for all to anon, authenticated using (true) with check (true);
drop policy if exists "pop_anotacoes: escrita" on public.pop_anotacoes;
create policy "pop_anotacoes: escrita" on public.pop_anotacoes for all to anon, authenticated using (true) with check (true);
drop policy if exists "planos_de_acao: escrita" on public.planos_de_acao;
create policy "planos_de_acao: escrita" on public.planos_de_acao for all to anon, authenticated using (true) with check (true);

insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem) values
  ('fiscal',      'Processos Fiscais',        'FIS', 'FISCAL',      'receipt',    1),
  ('contabil',    'Processos Contábeis',      'CTB', 'CONTABIL',    'calculator', 2),
  ('pessoal',     'Processos de Pessoal',     'RH',  'PESSOAL',     'users',      3),
  ('financeiro',  'Processos Financeiros',    'FIN', 'FINANCEIRO',  'wallet',     4),
  ('legalizacao', 'Processos de Legalização', 'LEG', 'LEGALIZACAO', 'scale',      5),
  ('qualidade',   'Processos da Qualidade',   'QUA', 'QUALIDADE',   'shield',     6),
  ('ti',          'Processos de TI',          'TI',  'TI',          'monitor',    7),
  ('direcao',     'Processos de Direção',     'DIR', 'DIRECAO',     'building',   8)
on conflict (id) do nothing;

insert into public.pops (
  setor_id, codigo, titulo, descricao, departamento, categoria, frequencia,
  prazo_referencia, regime, dificuldade, cargo_responsavel,
  dia_inicio, meta_dia, prazo_legal, favoritos, anotacoes
) values
  ('fiscal', 'FIS-01', 'Apuração do ICMS',
   'Conferência das notas de entrada e saída, cálculo do imposto devido e geração da guia de recolhimento estadual.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'LUCRO_PRESUMIDO', 'MEDIO', 'ANALISTA',
   1, 5, '2026-09-15', 12, 4),
  ('fiscal', 'FIS-02', 'Apuração do PIS/COFINS',
   'Apuração das contribuições sobre o faturamento, conferência das retenções e envio das guias.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'LUCRO_PRESUMIDO', 'MEDIO', 'ANALISTA',
   1, 6, '2026-09-20', 8, 2),
  ('fiscal', 'FIS-03', 'Escrituração do ISS',
   'Levantamento dos serviços prestados, cálculo do ISS por município e emissão das guias.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'SIMPLES_NACIONAL', 'FACIL', 'AUXILIAR',
   1, 7, '2026-09-18', 5, 1),
  ('fiscal', 'FIS-04', 'Recolhimento do IRPJ/CSLL (estimativa)',
   'Cálculo da estimativa mensal com base no lucro real, controle das antecipações e diferenças a compensar.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'LUCRO_REAL', 'DIFICIL', 'ANALISTA',
   1, 10, '2026-09-25', 9, 6),
  ('fiscal', 'FIS-05', 'Geração da DCTFWeb',
   'Conferência dos débitos declarados, vinculação das retenções e transmissão da declaração de débitos.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'ASSISTENTE',
   5, 12, '2026-09-30', 14, 3),
  ('fiscal', 'FIS-06', 'Declaração do Simples Nacional (PGDAS-D)',
   'Importação das receitas, segregação por anexo, comparação da partilha e transmissão do PGDAS-D.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'SIMPLES_NACIONAL', 'FACIL', 'ASSISTENTE',
   1, 15, '2026-09-30', 21, 7),
  ('fiscal', 'FIS-07', 'EFD-Contribuições',
   'Escrituração fiscal digital das contribuições e conferência dos débitos apurados no mês.',
   'Fiscal', 'FISCAL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'AUXILIAR',
   1, 12, '2026-09-28', 6, 2),
  ('fiscal', 'FIS-08', 'ECD / ECF — escrituração fiscal',
   'Geração e assinatura digital da escrituração contábil e fiscal do exercício anterior.',
   'Fiscal', 'FISCAL', 'ANUAL', 'ANO_ANTERIOR', 'LUCRO_PRESUMIDO', 'DIFICIL', 'ANALISTA',
   1, 20, '2026-09-30', 4, 5),
  ('fiscal', 'FIS-09', 'Restituição e compensação de tributos',
   'Levantamento de valores pagos a maior, preparação do pedido e acompanhamento no sistema da Receita.',
   'Fiscal', 'FISCAL', 'EVENTUAL', 'MES_ATUAL', 'TODOS', 'DIFICIL', 'ANALISTA',
   null, null, '2026-10-10', 2, 3),
  ('contabil', 'CTB-01', 'Conciliação bancária mensal',
   'Confronto dos extratos com os lançamentos contábeis e baixa dos itens pendentes.',
   'Contábil', 'CONTABIL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'FACIL', 'AUXILIAR',
   1, 8, '2026-09-20', 7, 2),
  ('contabil', 'CTB-02', 'Balancete mensal e conferência de saldos',
   'Fechamento do balancete, análise das contas de resultado e ajustes de competência.',
   'Contábil', 'CONTABIL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'ASSISTENTE',
   3, 12, '2026-09-25', 10, 4),
  ('contabil', 'CTB-03', 'Fechamento contábil anual',
   'Consolidação das contas do exercício, provisões, depreciação e preparação das demonstrações.',
   'Contábil', 'CONTABIL', 'ANUAL', 'ANO_ANTERIOR', 'TODOS', 'DIFICIL', 'ANALISTA',
   1, 25, '2026-09-30', 3, 8),
  ('pessoal', 'RH-01', 'Folha de pagamento mensal',
   'Processamento das rubricas fixas e variáveis, cálculo dos encargos e geração dos recibos.',
   'Pessoal', 'PESSOAL', 'MENSAL', 'MES_ATUAL', 'TODOS', 'MEDIO', 'ANALISTA',
   20, 28, '2026-09-30', 16, 5),
  ('pessoal', 'RH-02', 'Envio do eSocial (S-1200 / S-1299)',
   'Conferência dos eventos periódicos, correção de inconsistentes e transmissão do fechamento.',
   'Pessoal', 'PESSOAL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'ASSISTENTE',
   1, 10, '2026-09-15', 11, 3),
  ('financeiro', 'FIN-01', 'Conciliação do fluxo de caixa',
   'Lançamento das movimentações diárias, conferência do saldo projetado e sinalização de desvios.',
   'Financeiro', 'FINANCEIRO', 'MENSAL', 'MES_ATUAL', 'TODOS', 'FACIL', 'AUXILIAR',
   1, 10, '2026-09-25', 6, 1),
  ('financeiro', 'FIN-02', 'Fechamento e repasse de honorários',
   'Apuração das horas e serviços do mês, emissão da nota e programação do repasse ao cliente.',
   'Financeiro', 'FINANCEIRO', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'ASSISTENTE',
   5, 15, '2026-09-28', 9, 2),
  ('qualidade', 'QUA-01', 'Controle de revisão dos POPs',
   'Revisão anual da carteira de POPs, atualização dos prazos e registro das evidências de aprovação.',
   'Qualidade', 'QUALIDADE', 'ANUAL', 'ANO_ANTERIOR', 'TODOS', 'FACIL', 'ANALISTA',
   1, 15, '2026-12-20', 5, 4)
on conflict (codigo) do nothing;

insert into public.planos_de_acao
  (titulo, descricao, detalhamento, status, origem, setor, prioridade,
   responsavel_nome, responsavel_email, prazo)
values
  ('Revisão do controle de documentos','Atualizar a matriz de documentos do SGQ.','Revisar todos os documentos controlados, atualizar versões e eliminar obsoletos.','concluida','Auditoria Interna','Qualidade','Alta','Kaylane Oliveira','kaylane.oliveira@orcoma.com.br','2026-08-20'),
  ('Treinamento de abertura de ocorrências','Capacitar colaboradores no uso do formulário de ocorrências.','Ministrar treinamento para os setores Fiscal e Contábil sobre o novo fluxo de ocorrências.','concluida','Não Conformidade','Qualidade','Média','Olandson de Jesus','olandson@orcoma.com.br','2026-08-25'),
  ('Padronização de instruções de trabalho','Unificar o formato das instruções de trabalho entre setores.','Criar modelo padrão e aplicar nas instruções do Fiscal, Contábil e RH.','concluida','Reunião Estratégica','Direção','Alta','Jacson Mascarenhas','jacson@orcoma.com.br','2026-09-01'),
  ('Implementação de indicador de retrabalho','Criar indicador de retrabalho no setor de Operações.','Definir fórmula, coleta mensal e meta. Acompanhar por 3 meses antes de fechar.','em_andamento','Indicadores','Operações','Alta','Olandson de Jesus','olandson@orcoma.com.br','2026-10-15'),
  ('Mapeamento de processos do Fiscal','Levantar os processos do setor Fiscal para atualização dos POPs.','Entrevistar colaboradores, documentar fluxos e cruzar com POPs existentes.','em_andamento','Auditoria Interna','Fiscal','Crítica','Kaylane Oliveira','kaylane.oliveira@orcoma.com.br','2026-10-01'),
  ('Automatização de relatório mensal','Desenvolver script para gerar relatório de indicadores automaticamente.','Criar automação com Python para consolidar dados e gerar PDF.','em_andamento','Projetos','TI','Média','Gabriel Anacleto','gabriel.anacleto@orcoma.com.br','2026-10-10'),
  ('Atualização de política de qualidade','Revisar a Política da Qualidade com base em novas exigências.','Analisar ISO 9001:2015, propor alterações e submeter à aprovação da Direção.','em_andamento','Planejamento Estratégico','Qualidade','Alta','Olandson de Jesus','olandson@orcoma.com.br','2026-10-20'),
  ('Plano de ação para não conformidade NC-2026-003','Tratar a NC identificada na auditoria externa de setembro.','Investigar causa raiz, propor ação corretiva e definir responsável.','aberta','Não Conformidade','Técnico','Crítica','Celso Alcantara','celso.alcantara@orcoma.com.br','2026-10-25'),
  ('Revisão do plano de comunicação interna','Melhorar o fluxo de comunicação entre setores.','Levantar gargalos, propor canais e testar por 30 dias.','aberta','Reunião Estratégica','RH','Média','Jacson Mascarenhas','jacson@orcoma.com.br','2026-11-05'),
  ('Capacitação em boas práticas de armazenamento','Treinamento para o setor de Operações sobre armazenamento correto.','Elaborar material, ministrar palestra e aplicar avaliação.','aberta','Reclamação do Cliente','Operações','Média','Olandson de Jesus','olandson@orcoma.com.br','2026-11-10'),
  ('Atualização de procedimentos de TI','Revisar os procedimentos de backup e segurança da informação.','Auditoria dos procedimentos atuais, identificar falhas e atualizar documentação.','aberta','Projetos','TI','Alta','Welder Silva','welder@orcoma.com.br','2026-11-15'),
  ('Ação corretiva para multa por falta fiscal','Tratar multa recebida por erro na apuração do ICMS.','Investigar causa, implementar controle adicional e documentar lição aprendida.','aberta','Multas por Faltas','Fiscal','Crítica','Olandson de Jesus','olandson@orcoma.com.br','2026-10-18'),
  ('Revisão do plano de contingência','Atualizar plano de contingência para emergências operacionais.','Revisar cenários, contatos de emergência e simulados.','aberta','Planejamento Estratégico','Operações','Alta','Celso Alcantara','celso.alcantara@orcoma.com.br','2026-11-20'),
  ('Ação corretiva NC-2026-001','Tratar não conformidade identificada na auditoria de julho.','Causa raiz já identificada. Faltava implementar ação corretiva.','atrasada','Não Conformidade','Qualidade','Crítica','Olandson de Jesus','olandson@orcoma.com.br','2026-08-30'),
  ('Atualização de documentação fiscal','Atualizar a documentação dos processos fiscais com novas regras.','A atualização das retribuições estava pendente desde agosto.','atrasada','Indicadores','Fiscal','Alta','Kaylane Oliveira','kaylane.oliveira@orcoma.com.br','2026-09-05'),
  ('Plano de ação para reclamação do cliente X','Atender reclamação do cliente sobre atraso na entrega.','Identificar gargalo, propor solução e comunicar ao cliente.','atrasada','Reclamação do Cliente','Sucesso do Cliente','Crítica','Jacson Mascarenhas','jacson@orcoma.com.br','2026-09-10')
on conflict do nothing;