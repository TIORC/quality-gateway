-- ---------------------------------------------------------------------------
-- Logs de atividade dos documentos (POPs e políticas)
-- ---------------------------------------------------------------------------
--   * Registra adições, edições, movimentações (aprovações/mudanças de status) e
--     exclusões. A exclusão guarda o conteúdo que foi apagado em `dados`.
--   * Não há política de UPDATE nem DELETE: os registros não podem ser alterados
--     nem apagados pela API.
--   * A página de logs fica restrita ao Desenvolvedor do Sistema e ao Gestor da
--     Qualidade (ver `podeVerLogs` em src/lib/permissoes.ts).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.logs_atividade (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  acao text not null check (acao in ('adicionado', 'editado', 'movimentado', 'excluido')),
  entidade text not null check (entidade in ('pop', 'politica')),
  entidade_id text not null default '',
  codigo text not null default '',
  titulo text not null default '',
  detalhe text not null default '',
  dados jsonb not null default '{}'::jsonb,
  ator_id text not null default '',
  ator_nome text not null default '',
  ator_email text not null default ''
);

create index if not exists logs_atividade_created_idx on public.logs_atividade (created_at desc);

alter table public.logs_atividade enable row level security;

drop policy if exists "logs_atividade: leitura" on public.logs_atividade;
create policy "logs_atividade: leitura"
  on public.logs_atividade for select
  to anon, authenticated
  using (true);

drop policy if exists "logs_atividade: registro" on public.logs_atividade;
create policy "logs_atividade: registro"
  on public.logs_atividade for insert
  to anon, authenticated
  with check (true);
