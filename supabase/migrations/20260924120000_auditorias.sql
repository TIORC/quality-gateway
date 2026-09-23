-- ---------------------------------------------------------------------------
-- Auditorias da qualidade (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Idempotent: pode rodar de novo sem duplicar tabelas, políticas ou registros.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.auditorias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null default '',
  titulo text not null default '',
  tipo text not null default 'Interna'
    check (tipo in ('Interna', 'Externa')),
  norma text not null default 'ISO 9001:2015',
  unidade text not null default '',
  data_planejada date,
  setores_auditados jsonb not null default '[]'::jsonb,
  relatorio text not null default '',
  evidencias text not null default '',
  auditores jsonb not null default '[]'::jsonb,
  auditados jsonb not null default '[]'::jsonb,
  resultado text not null default 'nenhum'
    check (resultado in ('nenhum', 'nao_conformidade', 'ponto_atencao', 'oportunidade')),
  resultado_ref text not null default '',
  criada_por_nome text not null default '',
  criada_por_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.auditorias is 'Auditorias da qualidade programadas.';
comment on column public.auditorias.setores_auditados is 'Setores auditados (array de textos).';
comment on column public.auditorias.auditores is 'Auditores da auditoria: [{id, nome}].';
comment on column public.auditorias.auditados is 'Auditados da auditoria: [{id, nome}].';
comment on column public.auditorias.resultado is 'Resultado: nenhum, nao_conformidade, ponto_atencao ou oportunidade.';
comment on column public.auditorias.resultado_ref is 'Referência gerada pelo resultado (Ex.: OCR-2026-001, PA-2026-003).';

create index if not exists auditorias_created_at_idx on public.auditorias (created_at desc);
create index if not exists auditorias_titulo_idx on public.auditorias (titulo);
create index if not exists auditorias_unidade_idx on public.auditorias (unidade);

-- updated_at automático ------------------------------------------------------
create or replace function public.auditorias_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists auditorias_set_updated_at on public.auditorias;
create trigger auditorias_set_updated_at
  before update on public.auditorias
  for each row
  execute function public.auditorias_set_updated_at();

-- Acesso ---------------------------------------------------------------------
alter table public.auditorias enable row level security;

drop policy if exists "auditorias: leitura" on public.auditorias;
create policy "auditorias: leitura"
  on public.auditorias for select
  to anon, authenticated
  using (true);

drop policy if exists "auditorias: escrita" on public.auditorias;
create policy "auditorias: escrita"
  on public.auditorias for all
  to anon, authenticated
  using (true)
  with check (true);