-- ---------------------------------------------------------------------------
-- Ocorrências (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente.
-- ---------------------------------------------------------------------------

-- Tipos de ocorrência -------------------------------------------------------
create table if not exists public.ocorrencia_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  cor text not null default '#1E3A8A',
  icone text not null default 'AlertTriangle',
  setor_padrao text not null default 'Qualidade',
  sla_dias jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ocorrencia_tipos is 'Tipos de ocorrência (Reclamação, NC, Desvio, Acidente…).';
comment on column public.ocorrencia_tipos.sla_dias is 'SLA em dias por macro-etapa: {"apuracao":10,…}';

create index if not exists ocorrencia_tipos_ordem_idx on public.ocorrencia_tipos (ordem);

-- Formulários de abertura (schema versionado por tipo) ----------------------
create table if not exists public.ocorrencia_formularios (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.ocorrencia_tipos(id) on delete cascade,
  versao integer not null default 1,
  campos jsonb not null default '[]'::jsonb,
  publicada boolean not null default true,
  criado_por_nome text not null default '',
  criado_por_email text not null default '',
  created_at timestamptz not null default now(),
  unique (tipo_id, versao)
);
comment on table public.ocorrencia_formularios is 'Versões do formulário de abertura (campos em jsonb).';

-- Fluxos (versionados por tipo; subetapas dentro das macro-etapas fixas) ----
create table if not exists public.ocorrencia_fluxos (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references public.ocorrencia_tipos(id) on delete cascade,
  versao integer not null default 1,
  etapas jsonb not null default '[]'::jsonb,
  publicada boolean not null default true,
  criado_por_nome text not null default '',
  criado_por_email text not null default '',
  created_at timestamptz not null default now(),
  unique (tipo_id, versao)
);
comment on table public.ocorrencia_fluxos is 'Versões do fluxo: subetapas por macro-etapa, responsáveis, prazos e regras.';
comment on column public.ocorrencia_fluxos.etapas is 'Array [{macro, subetapas:[{id,nome,responsavel,prazoDias,acoes,campos,notificar,reprovarPara}]}]';

-- Ocorrências ---------------------------------------------------------------
create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  numero text not null default '',
  titulo text not null,
  tipo_id uuid not null,
  tipo_nome text not null default '',
  tipo_cor text not null default '#1E3A8A',
  formulario_versao integer not null default 1,
  fluxo_versao integer not null default 1,
  respostas jsonb not null default '{}'::jsonb,
  macro_atual text not null default 'abertura',
  subetapa_atual_id text not null default '',
  subetapa_atual_nome text not null default '',
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'encerrada', 'reaberta')),
  procedencia text not null default 'pendente'
    check (procedencia in ('pendente', 'procedente', 'nao_procedente')),
  aberta_por_id text not null default '',
  aberta_por_nome text not null default '',
  aberta_por_email text not null default '',
  aberta_por_setor text not null default '',
  responsavel_id text not null default '',
  responsavel_nome text not null default '',
  responsavel_email text not null default '',
  prazo_etapa date,
  etapa_entrou_em timestamptz not null default now(),
  avaliacao jsonb,
  reaberturas integer not null default 0,
  encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ocorrencias is 'Ocorrências: tratativa com fluxo em macro-etapas (linha do metrô).';
comment on column public.ocorrencias.respostas is 'Respostas do formulário de abertura na versão usada.';
comment on column public.ocorrencias.avaliacao is 'Avaliação de eficácia: {prazoDias, verificacaoEm, eficaz, observacao}';
comment on column public.ocorrencias.macro_atual is 'abertura|apuracao|julgamento|comunicacao|fechamento|avaliacao_eficacia';
comment on column public.ocorrencias.procedencia is 'Resultado do julgamento: pendente|procedente|nao_procedente (visível ao solicitante).';

create index if not exists ocorrencias_status_idx on public.ocorrencias (status);
create index if not exists ocorrencias_tipo_idx on public.ocorrencias (tipo_id);
create index if not exists ocorrencias_aberta_por_idx on public.ocorrencias (aberta_por_email);

-- Histórico imutável (auditoria, comentários e anexos por etapa) ------------
create table if not exists public.ocorrencia_historico (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  autor_id text not null default '',
  autor_nome text not null default '',
  autor_email text not null default '',
  acao text not null default '',
  macro text not null default '',
  subetapa text not null default '',
  de text not null default '',
  para text not null default '',
  comentario text not null default '',
  anexos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.ocorrencia_historico is 'Histórico imutável: quem fez o quê, quando, de/para qual etapa.';

create index if not exists ocorrencia_historico_ocorrencia_idx
  on public.ocorrencia_historico (ocorrencia_id, created_at);

-- updated_at automático -----------------------------------------------------
create or replace function public.ocorrencias_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ocorrencias_set_updated_at on public.ocorrencias;
create trigger ocorrencias_set_updated_at
  before update on public.ocorrencias
  for each row
  execute function public.ocorrencias_set_updated_at();

drop trigger if exists ocorrencia_tipos_set_updated_at on public.ocorrencia_tipos;
create trigger ocorrencia_tipos_set_updated_at
  before update on public.ocorrencia_tipos
  for each row
  execute function public.ocorrencias_set_updated_at();

-- Acesso (mesmo padrão das demais tabelas do portal) ------------------------
alter table public.ocorrencia_tipos enable row level security;
alter table public.ocorrencia_formularios enable row level security;
alter table public.ocorrencia_fluxos enable row level security;
alter table public.ocorrencias enable row level security;
alter table public.ocorrencia_historico enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ocorrencia_tipos','ocorrencia_formularios','ocorrencia_fluxos','ocorrencias'] loop
    execute format('drop policy if exists %I on public.%I', t || ': leitura', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || ': leitura', t);
    execute format('drop policy if exists %I on public.%I', t || ': escrita', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || ': escrita', t);
  end loop;
end $$;

-- Histórico: só insere e lê (imutável — sem update/delete) ------------------
drop policy if exists "ocorrencia_historico: leitura" on public.ocorrencia_historico;
create policy "ocorrencia_historico: leitura"
  on public.ocorrencia_historico for select
  to anon, authenticated
  using (true);

drop policy if exists "ocorrencia_historico: insert" on public.ocorrencia_historico;
create policy "ocorrencia_historico: insert"
  on public.ocorrencia_historico for insert
  to anon, authenticated
  with check (true);

-- Tipos de ocorrência padrão ------------------------------------------------
insert into public.ocorrencia_tipos (nome, descricao, cor, icone, setor_padrao, sla_dias, ordem)
values
  ('Reclamação de Cliente', 'Tratativa de reclamações recebidas de clientes.',
   '#B45309', 'MessageSquareWarning', 'Sucesso do Cliente',
   '{"abertura":1,"apuracao":5,"julgamento":3,"comunicacao":2,"fechamento":10,"avaliacao_eficacia":30}'::jsonb, 1),
  ('Não Conformidade', 'Registro e tratamento de não conformidades do SGQ.',
   '#B91C1C', 'OctagonAlert', 'Qualidade',
   '{"abertura":1,"apuracao":10,"julgamento":5,"comunicacao":3,"fechamento":15,"avaliacao_eficacia":60}'::jsonb, 2),
  ('Desvio de Processo', 'Desvios de execução em relação ao POP ou instrução de trabalho.',
   '#0369A1', 'GitBranch', 'Operações',
   '{"abertura":1,"apuracao":7,"julgamento":3,"comunicacao":2,"fechamento":10,"avaliacao_eficacia":60}'::jsonb, 3),
  ('Acidente de Trabalho', 'Registro e investigação de acidentes e quase-acidentes.',
   '#7C3AED', 'HardHat', 'Segurança do Trabalho',
   '{"abertura":1,"apuracao":5,"julgamento":3,"comunicacao":2,"fechamento":20,"avaliacao_eficacia":90}'::jsonb, 4)
on conflict do nothing;

-- Formulário e fluxo default (versão 1) para cada tipo sem versão 1 ---------
insert into public.ocorrencia_formularios (tipo_id, versao, campos, criado_por_nome, criado_por_email)
select t.id, 1,
  jsonb_build_array(
    jsonb_build_object('id','titulo','tipo','texto','label','Título curto da ocorrência',
      'placeholder','Ex.: Atraso na entrega do pedido 1234','obrigatorio',true,'largura','inteira'),
    jsonb_build_object('id','relato','tipo','textarea','label','Relato do ocorrido',
      'placeholder','Descreva o que aconteceu…','obrigatorio',true,'largura','inteira'),
    jsonb_build_object('id','anexos','tipo','arquivo','label','Fotos/evidências (opcional)',
      'obrigatorio',false,'largura','inteira')
  )::jsonb, 'Sistema', ''
from public.ocorrencia_tipos t
where not exists (
  select 1 from public.ocorrencia_formularios f where f.tipo_id = t.id and f.versao = 1
);

insert into public.ocorrencia_fluxos (tipo_id, versao, etapas, criado_por_nome, criado_por_email)
select t.id, 1,
  jsonb_build_array(
    jsonb_build_object('macro','abertura','subetapas','[]'::jsonb),
    jsonb_build_object('macro','apuracao','subetapas','[]'::jsonb),
    jsonb_build_object('macro','julgamento','subetapas','[]'::jsonb),
    jsonb_build_object('macro','comunicacao','subetapas','[]'::jsonb),
    jsonb_build_object('macro','fechamento','subetapas','[]'::jsonb),
    jsonb_build_object('macro','avaliacao_eficacia','subetapas','[]'::jsonb)
  ), 'Sistema', ''
from public.ocorrencia_tipos t
where not exists (
  select 1 from public.ocorrencia_fluxos f where f.tipo_id = t.id and f.versao = 1
);

