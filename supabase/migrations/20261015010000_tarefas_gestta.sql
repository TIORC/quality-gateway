-- ---------------------------------------------------------------------------
-- Tarefas importadas do Gestta (Indicadores > Importar)
-- ---------------------------------------------------------------------------
--   * `id` é o Id da planilha (sem aspas): chave única que impede tarefas
--     repetidas entre importações. Reimportar atualiza a linha existente
--     (ex.: tarefa que estava ABERTO e passou a CONCLUIDO).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.tarefas_gestta (
  id text primary key,
  nome text not null default '',
  tipo text not null default '',
  status text not null default '',
  cliente text not null default '',
  departamento text not null default '',
  responsavel text not null default '',
  vencimento date,
  data_conclusao date,
  competencia text not null default '',
  importado_em timestamptz not null default now()
);

create index if not exists tarefas_gestta_vencimento_idx on public.tarefas_gestta (vencimento);
create index if not exists tarefas_gestta_conclusao_idx on public.tarefas_gestta (data_conclusao);

alter table public.tarefas_gestta enable row level security;

drop policy if exists "tarefas_gestta: leitura" on public.tarefas_gestta;
create policy "tarefas_gestta: leitura"
  on public.tarefas_gestta for select
  to anon, authenticated
  using (true);

drop policy if exists "tarefas_gestta: inclusao" on public.tarefas_gestta;
create policy "tarefas_gestta: inclusao"
  on public.tarefas_gestta for insert
  to anon, authenticated
  with check (true);

drop policy if exists "tarefas_gestta: atualizacao" on public.tarefas_gestta;
create policy "tarefas_gestta: atualizacao"
  on public.tarefas_gestta for update
  to anon, authenticated
  using (true)
  with check (true);
