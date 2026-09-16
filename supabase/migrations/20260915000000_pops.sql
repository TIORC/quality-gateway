-- ---------------------------------------------------------------------------
-- POPs — Procedimentos Operacionais Padrão (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente: pode rodar de
--      novo sem duplicar tabelas, políticas ou os registros de exemplo.
--   3. Garanta que `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
--      (ou `VITE_SUPABASE_ANON_KEY`) estão disponíveis no front-end. O Lovable
--      Cloud injeta as duas automaticamente; localmente, crie um `.env.local`.
--
-- Enquanto as variáveis não existirem, a tela de POPs usa dados de demonstração
-- em memória (ver `src/lib/pops.ts`) e mostra um aviso no topo da grade.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Setores exibidos na grade de POPs -----------------------------------------
create table if not exists public.pop_setores (
  id text primary key,
  nome text not null,
  prefixo text not null,
  categoria text not null,
  icone text not null default 'folder',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.pop_setores is 'Setores/carteiras usados na grade de POPs.';
comment on column public.pop_setores.prefixo is 'Prefixo do código do POP (ex.: FIS de FIS-01).';
comment on column public.pop_setores.categoria is 'Tag de categoria exibida nos cartões (ex.: FISCAL).';
comment on column public.pop_setores.icone is 'Chave do ícone no front (ver ICONES_SETOR em src/lib/pops.ts).';

-- POPs ----------------------------------------------------------------------
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

comment on column public.pops.dia_inicio is 'Dia do mês em que o prazo de execução começa.';
comment on column public.pops.meta_dia is 'Dia ideal (meta) de conclusão do POP.';
comment on column public.pops.prazo_legal is 'Data limite legal para conclusão.';
comment on column public.pops.favoritos is 'Quantidade de usuários que favoritaram o POP.';
comment on column public.pops.anotacoes is 'Quantidade de anotações registradas no POP.';
create index if not exists pops_setor_id_idx on public.pops (setor_id);
create index if not exists pops_codigo_idx on public.pops (codigo);

-- updated_at automático -----------------------------------------------------
create or replace function public.pops_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pops_set_updated_at on public.pops;
create trigger pops_set_updated_at
  before update on public.pops
  for each row
  execute function public.pops_set_updated_at();

-- Acesso --------------------------------------------------------------------
-- O portal autentica os usuários em memória (ainda sem Supabase Auth), então a
-- chave anônima precisa de acesso às duas tabelas para a tela funcionar.
-- Ao plugar o Supabase Auth, troque estas políticas por regras baseadas em
-- `auth.uid()` + tabela de perfis (ex.: só admin/gestor escreve).
alter table public.pop_setores enable row level security;
alter table public.pops enable row level security;

drop policy if exists "pop_setores: leitura" on public.pop_setores;
create policy "pop_setores: leitura"
  on public.pop_setores for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_setores: escrita" on public.pop_setores;
create policy "pop_setores: escrita"
  on public.pop_setores for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "pops: leitura" on public.pops;
create policy "pops: leitura"
  on public.pops for select
  to anon, authenticated
  using (true);

drop policy if exists "pops: escrita" on public.pops;
create policy "pops: escrita"
  on public.pops for all
  to anon, authenticated
  using (true)
  with check (true);
-- Setores de exemplo --------------------------------------------------------
-- Setores sem POP cadastrado aparecem na grade com a contagem (0).
insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem) values
  ('fiscal',      'Fiscal',                   'FIS', 'FISCAL',      'receipt',    1),
  ('contabil',    'Contábil',                 'CTB', 'CONTABIL',    'calculator', 2),
  ('pessoal',     'Pessoal',                  'RH',  'PESSOAL',     'users',      3),
  ('financeiro',  'Financeiro',               'FIN', 'FINANCEIRO',  'wallet',     4),
  ('legalizacao', 'Legalização',              'LEG', 'LEGALIZACAO', 'scale',      5),
  ('qualidade',   'Qualidade',                'QUA', 'QUALIDADE',   'shield',     6),
  ('ti',          'TI',                       'TI',  'TI',          'monitor',    7),
  ('direcao',     'Direção',                  'DIR', 'DIRECAO',     'building',   8)
on conflict (id) do nothing;

-- POPs de exemplo -----------------------------------------------------------
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

