-- ---------------------------------------------------------------------------
-- Respostas das pesquisas criadas pelo administrador (gráficos por pergunta)
-- ---------------------------------------------------------------------------
--   * `respostas` guarda um objeto { id_da_pergunta: resposta }. A resposta é
--     um número (escala), texto, uma opção, ou uma lista de opções. Quando a
--     pessoa escreve em "Outro", o texto digitado fica no próprio valor.
--   * Apagar o modelo apaga as respostas dele (on delete cascade).
--   * Leitura e inserção liberadas para anon/authenticated, como nas demais tabelas.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.pesquisas_respostas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  modelo_id uuid not null references public.pesquisas_modelos (id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb
);

create index if not exists pesquisas_respostas_modelo_idx on public.pesquisas_respostas (modelo_id);

alter table public.pesquisas_respostas enable row level security;

drop policy if exists "pesquisas_respostas: leitura" on public.pesquisas_respostas;
create policy "pesquisas_respostas: leitura"
  on public.pesquisas_respostas for select
  to anon, authenticated
  using (true);

drop policy if exists "pesquisas_respostas: resposta" on public.pesquisas_respostas;
create policy "pesquisas_respostas: resposta"
  on public.pesquisas_respostas for insert
  to anon, authenticated
  with check (true);
