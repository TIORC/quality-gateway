-- ---------------------------------------------------------------------------
-- Indicadores: atendimentos realizados por colaborador (Indicadores > Importar)
-- ---------------------------------------------------------------------------
--   * Uma linha por mês (YYYY-MM), colaborador e departamento, vinda da aba
--     "Por Colaborador" do relatório "Indicador_Atendimento".
--   * Reimportar o mesmo mês substitui as linhas do mês.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.atendimentos_colaborador (
  mes text not null,
  colaborador text not null,
  departamento text not null default '',
  total integer not null default 0,
  importado_em timestamptz not null default now(),
  primary key (mes, colaborador, departamento)
);

alter table public.atendimentos_colaborador enable row level security;

drop policy if exists "atendimentos_colaborador: leitura" on public.atendimentos_colaborador;
create policy "atendimentos_colaborador: leitura"
  on public.atendimentos_colaborador for select
  to anon, authenticated
  using (true);

drop policy if exists "atendimentos_colaborador: inclusao" on public.atendimentos_colaborador;
create policy "atendimentos_colaborador: inclusao"
  on public.atendimentos_colaborador for insert
  to anon, authenticated
  with check (true);

drop policy if exists "atendimentos_colaborador: atualizacao" on public.atendimentos_colaborador;
create policy "atendimentos_colaborador: atualizacao"
  on public.atendimentos_colaborador for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "atendimentos_colaborador: exclusao" on public.atendimentos_colaborador;
create policy "atendimentos_colaborador: exclusao"
  on public.atendimentos_colaborador for delete
  to anon, authenticated
  using (true);
