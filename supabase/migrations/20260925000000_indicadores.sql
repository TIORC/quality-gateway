-- ---------------------------------------------------------------------------
-- Indicadores e apurações mensais (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Indicadores -----------------------------------------------------------------
create table if not exists public.indicadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  setor text not null default '',
  responsavel_id text not null default '',
  responsavel_nome text not null default '',
  unidade text not null default 'percentual'
    check (unidade in ('percentual', 'numero', 'moeda', 'dias', 'horas')),
  formula_descricao text not null default '',
  -- Meta vigente. Fica NULL nos modelos da biblioteca: a Qualidade define ao ativar.
  meta numeric,
  sentido text not null default 'maior_melhor'
    check (sentido in ('maior_melhor', 'menor_melhor')),
  periodicidade text not null default 'mensal'
    check (periodicidade in ('mensal')),
  fonte text not null default 'manual'
    check (fonte in ('manual', 'planilha', 'sistema')),
  automatico boolean not null default false,
  -- Regra de cálculo automático (vazio = lançamento manual).
  -- Valores: ocorrencias_encerradas | planos_no_prazo | auditorias_realizadas
  regra_automatica text not null default '',
  ativo boolean not null default true,
  criado_de_modelo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.indicadores is 'Indicadores de desempenho por setor (apuração mensal).';
comment on column public.indicadores.meta is 'Meta vigente do indicador (NULL nos modelos da biblioteca até a Qualidade definir).';
comment on column public.indicadores.sentido is 'maior_melhor | menor_melhor (define como o status é calculado).';
comment on column public.indicadores.automatico is 'true quando o valor pode ser calculado a partir de outro módulo do portal.';
comment on column public.indicadores.regra_automatica is 'Regra de cálculo automático: ocorrencias_encerradas | planos_no_prazo | auditorias_realizadas.';
comment on column public.indicadores.ativo is 'false = arquivado: não aparece na visão geral e não gera apuração (histórico preservado).';
comment on column public.indicadores.criado_de_modelo is 'true = linha da biblioteca de modelos prontos (inativa até ser ativada).';

create index if not exists indicadores_setor_idx on public.indicadores (setor);
create index if not exists indicadores_ativo_idx on public.indicadores (ativo);
-- Evita duplicar o seed da biblioteca (só vale para linhas de modelo).
create unique index if not exists indicadores_modelo_nome_uidx
  on public.indicadores (nome) where criado_de_modelo;

-- Apurações ------------------------------------------------------------------
create table if not exists public.apuracoes (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.indicadores(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_realizado numeric,
  -- Cópia da meta vigente no momento do lançamento: o histórico não muda
  -- quando a meta do indicador é alterada depois.
  meta_no_mes numeric,
  status text not null default 'pendente'
    check (status in ('pendente', 'dentro_da_meta', 'abaixo_da_meta')),
  plano_acao_id uuid references public.planos_de_acao(id) on delete set null,
  lancado_por text not null default '',
  lancado_em timestamptz,
  fechado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (indicador_id, mes_referencia)
);

comment on table public.apuracoes is 'Apuração mensal do indicador: um registro por indicador + mês.';
comment on column public.apuracoes.meta_no_mes is 'Meta vigente no lançamento (histórico imutável).';
comment on column public.apuracoes.plano_acao_id is 'Plano de ação obrigatório quando o mês fecha abaixo da meta.';
comment on column public.apuracoes.fechado is 'Fechamento do mês: só com plano de ação vinculado quando o status é abaixo_da_meta.';

create index if not exists apuracoes_indicador_idx on public.apuracoes (indicador_id);
create index if not exists apuracoes_mes_idx on public.apuracoes (mes_referencia);
create index if not exists apuracoes_plano_idx on public.apuracoes (plano_acao_id);

-- updated_at automático ------------------------------------------------------
create or replace function public.indicadores_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists indicadores_set_updated_at on public.indicadores;
create trigger indicadores_set_updated_at
  before update on public.indicadores
  for each row
  execute function public.indicadores_set_updated_at();

drop trigger if exists apuracoes_set_updated_at on public.apuracoes;
create trigger apuracoes_set_updated_at
  before update on public.apuracoes
  for each row
  execute function public.indicadores_set_updated_at();

-- Acesso ---------------------------------------------------------------------
alter table public.indicadores enable row level security;
alter table public.apuracoes enable row level security;

drop policy if exists "indicadores: leitura" on public.indicadores;
create policy "indicadores: leitura"
  on public.indicadores for select
  to anon, authenticated
  using (true);

drop policy if exists "indicadores: escrita" on public.indicadores;
create policy "indicadores: escrita"
  on public.indicadores for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "apuracoes: leitura" on public.apuracoes;
create policy "apuracoes: leitura"
  on public.apuracoes for select
  to anon, authenticated
  using (true);

drop policy if exists "apuracoes: escrita" on public.apuracoes;
create policy "apuracoes: escrita"
  on public.apuracoes for all
  to anon, authenticated
  using (true)
  with check (true);

-- Biblioteca de modelos prontos ----------------------------------------------
-- Inativos por padrão (ativo = false) e sem meta: a Qualidade ativa com um
-- clique e ajusta meta, responsável e setor.
insert into public.indicadores
  (nome, descricao, setor, unidade, formula_descricao, meta, sentido,
   periodicidade, fonte, automatico, regra_automatica, ativo, criado_de_modelo)
values
  ('% de obrigações entregues no prazo',
   'Percentual de obrigações fiscais entregues dentro do prazo legal no mês.',
   'Fiscal', 'percentual',
   'Obrigações entregues no prazo ÷ total de obrigações do mês × 100.',
   null, 'maior_melhor', 'mensal', 'manual', false, '', false, true),

  ('Multas por atraso',
   'Valor total de multas recebidas no mês por atraso ou erro na entrega.',
   'Fiscal', 'moeda',
   'Soma das multas (R$) recebidas no mês por atraso ou erro de apuração.',
   null, 'menor_melhor', 'mensal', 'manual', false, '', false, true),

  ('% de fechamentos contábeis concluídos no prazo',
   'Percentual de fechamentos contábeis concluídos até a data combinada.',
   'Contábil', 'percentual',
   'Fechamentos concluídos no prazo ÷ total de fechamentos do mês × 100.',
   null, 'maior_melhor', 'mensal', 'manual', false, '', false, true),

  ('% de folhas entregues no prazo',
   'Percentual de folhas de pagamento processadas e entregues no prazo.',
   'Departamento Pessoal', 'percentual',
   'Folhas entregues no prazo ÷ total de folhas do mês × 100.',
   null, 'maior_melhor', 'mensal', 'manual', false, '', false, true),

  ('Erros de folha por mês',
   'Quantidade de erros de folha identificados no mês (retrabalho e ajustes).',
   'Departamento Pessoal', 'numero',
   'Contagem de ajustes e retrabalhos de folha abertos no mês.',
   null, 'menor_melhor', 'mensal', 'manual', false, '', false, true),

  ('Tempo médio de resposta ao cliente',
   'Tempo médio gasto para responder a solicitações de clientes.',
   'Atendimento', 'horas',
   'Soma do tempo de resposta (horas) ÷ quantidade de solicitações respondidas no mês.',
   null, 'menor_melhor', 'mensal', 'manual', false, '', false, true),

  ('Satisfação do cliente',
   'Nota média da pesquisa de satisfação respondida pelos clientes no mês.',
   'Atendimento', 'numero',
   'Média das notas (0 a 10) das pesquisas respondidas no mês.',
   null, 'maior_melhor', 'mensal', 'manual', false, '', false, true),

  ('Tempo médio de abertura de empresa',
   'Tempo médio para concluir a abertura de uma empresa.',
   'Societário', 'dias',
   'Soma dos dias corridos entre a abertura do processo e o CNPJ emitido ÷ processos concluídos no mês.',
   null, 'menor_melhor', 'mensal', 'manual', false, '', false, true),

  ('% de ocorrências encerradas',
   'Percentual de ocorrências abertas até o mês que foram encerradas.',
   'Qualidade', 'percentual',
   'Ocorrências encerradas até o fim do mês ÷ ocorrências abertas até o fim do mês × 100.',
   null, 'maior_melhor', 'mensal', 'sistema', true, 'ocorrencias_encerradas', false, true),

  ('% de planos de ação concluídos no prazo',
   'Percentual de planos de ação concluídos no mês dentro do prazo.',
   'Qualidade', 'percentual',
   'Planos concluídos no prazo ÷ planos concluídos no mês × 100.',
   null, 'maior_melhor', 'mensal', 'sistema', true, 'planos_no_prazo', false, true),

  ('% de auditorias realizadas vs. planejadas',
   'Percentual de auditorias planejadas para o mês que foram concluídas.',
   'Qualidade', 'percentual',
   'Auditorias concluídas no mês ÷ auditorias planejadas para o mês × 100.',
   null, 'maior_melhor', 'mensal', 'sistema', true, 'auditorias_realizadas', false, true),

  ('% de treinamentos realizados vs. planejados',
   'Percentual de treinamentos do plano anual realizados no mês.',
   'RH', 'percentual',
   'Treinamentos realizados no mês ÷ treinamentos planejados para o mês × 100.',
   null, 'maior_melhor', 'mensal', 'manual', false, '', false, true),

  ('Rotatividade de funcionários',
   'Percentual de desligamentos em relação ao quadro do mês.',
   'RH', 'percentual',
   'Desligamentos no mês ÷ efetivo médio do mês × 100.',
   null, 'menor_melhor', 'mensal', 'manual', false, '', false, true)
on conflict do nothing;

