-- ---------------------------------------------------------------------------
-- POPs — ciclo de vida com aprovação em duas etapas
-- ---------------------------------------------------------------------------
-- Status: PENDENTE_APROVACAO_LIDER_PROCESSO → PENDENTE_APROVACAO_LIDER_QUALIDADE
--         → VIGENTE. Na revisão de um POP vigente: REVISANDO → REVISADO → VIGENTE.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud. É
-- idempotente — pode rodar novamente sem efeito colateral.
-- ---------------------------------------------------------------------------

-- 1) Colunas de status e auditoria de aprovação ------------------------------
alter table public.pops add column if not exists status text not null default 'PENDENTE_APROVACAO_LIDER_PROCESSO';
alter table public.pops add column if not exists criado_por text not null default '';
alter table public.pops add column if not exists criado_por_nome text not null default '';
alter table public.pops add column if not exists aprovado_processo_por text not null default '';
alter table public.pops add column if not exists aprovado_processo_nome text not null default '';
alter table public.pops add column if not exists aprovado_processo_em timestamptz;
alter table public.pops add column if not exists aprovado_qualidade_por text not null default '';
alter table public.pops add column if not exists aprovado_qualidade_nome text not null default '';
alter table public.pops add column if not exists aprovado_qualidade_em timestamptz;

-- 2) POPs já existentes entram como VIGENTE ----------------------------------
-- Só toca nas linhas ainda intocadas (autor vazio = criadas antes deste fluxo);
-- assim, reaplicar o script não joga POPs pendentes de volta para VIGENTE.
update public.pops set status = 'VIGENTE' where criado_por = '' and status <> 'VIGENTE';

-- 3) Valores válidos de status -----------------------------------------------
alter table public.pops drop constraint if exists pops_status_valido;
alter table public.pops
  add constraint pops_status_valido
  check (status in (
    'PENDENTE_APROVACAO_LIDER_PROCESSO',
    'PENDENTE_APROVACAO_LIDER_QUALIDADE',
    'VIGENTE',
    'REVISANDO',
    'REVISADO'
  ));

-- 4) Setor "Geral" para POPs institucionais (visíveis para todos) ------------
insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem) values
  ('geral', 'Geral', 'GER', 'GERAL', 'layers', 0)
  on conflict (id) do nothing;