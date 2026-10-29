-- ---------------------------------------------------------------------------
-- Indicadores: atendimentos realizados por departamento (Indicadores > Importar)
-- ---------------------------------------------------------------------------
--   * Uma linha por mês (YYYY-MM) e departamento, vinda da aba "Por Departamento"
--     do relatório "Indicador_Atendimento".
--   * Reimportar o mesmo mês substitui as linhas do mês.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.atendimentos_departamento (
  mes text not null,
  departamento text not null,
  total integer not null default 0,
  importado_em timestamptz not null default now(),
  primary key (mes, departamento)
);

alter table public.atendimentos_departamento enable row level security;

drop policy if exists "atendimentos_departamento: leitura" on public.atendimentos_departamento;
create policy "atendimentos_departamento: leitura"
  on public.atendimentos_departamento for select
  to anon, authenticated
  using (true);

drop policy if exists "atendimentos_departamento: inclusao" on public.atendimentos_departamento;
create policy "atendimentos_departamento: inclusao"
  on public.atendimentos_departamento for insert
  to anon, authenticated
  with check (true);

drop policy if exists "atendimentos_departamento: atualizacao" on public.atendimentos_departamento;
create policy "atendimentos_departamento: atualizacao"
  on public.atendimentos_departamento for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "atendimentos_departamento: exclusao" on public.atendimentos_departamento;
create policy "atendimentos_departamento: exclusao"
  on public.atendimentos_departamento for delete
  to anon, authenticated
  using (true);
