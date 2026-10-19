-- ---------------------------------------------------------------------------
-- Modelos de pesquisa criados pelo administrador (botão "Criar Pesquisa")
-- ---------------------------------------------------------------------------
--   * `perguntas` guarda a lista de perguntas (texto, tipo de resposta e opções).
--   * Leitura e criação liberadas para anon/authenticated, como nas demais
--     tabelas do portal. A permissão de criar fica na interface (Gestão da Qualidade).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.pesquisas_modelos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titulo text not null default '',
  descricao text not null default '',
  perguntas jsonb not null default '[]'::jsonb,
  criado_por text not null default ''
);

alter table public.pesquisas_modelos enable row level security;

drop policy if exists "pesquisas_modelos: leitura" on public.pesquisas_modelos;
create policy "pesquisas_modelos: leitura"
  on public.pesquisas_modelos for select
  to anon, authenticated
  using (true);

drop policy if exists "pesquisas_modelos: criacao" on public.pesquisas_modelos;
create policy "pesquisas_modelos: criacao"
  on public.pesquisas_modelos for insert
  to anon, authenticated
  with check (true);

drop policy if exists "pesquisas_modelos: edicao" on public.pesquisas_modelos;
create policy "pesquisas_modelos: edicao"
  on public.pesquisas_modelos for update
  to anon, authenticated
  using (true)
  with check (true);
