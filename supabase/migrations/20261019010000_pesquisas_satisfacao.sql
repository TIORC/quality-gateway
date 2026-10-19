-- ---------------------------------------------------------------------------
-- Pesquisas de satisfação (página Gestão > Pesquisas de Satisfação)
-- ---------------------------------------------------------------------------
--   * Cada linha é uma resposta de pesquisa: empresa, nome completo de quem
--     respondeu, unidade atendida e as cinco notas de 1 a 10.
--   * Leitura liberada para anon/authenticated (mesmo padrão de logs_atividade);
--     inserção também, para que o formulário de respostas consiga gravar.
--   * Não há UPDATE nem DELETE pela API.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.pesquisas_satisfacao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  empresa text not null default '',
  nome_pessoa text not null default '',
  unidade text not null default '',
  nota_atendimento smallint not null check (nota_atendimento between 1 and 10),
  nota_qualidade smallint not null check (nota_qualidade between 1 and 10),
  nota_orientacoes smallint not null check (nota_orientacoes between 1 and 10),
  nota_prazos smallint not null check (nota_prazos between 1 and 10),
  nota_recomendacao smallint not null check (nota_recomendacao between 1 and 10)
);

create index if not exists pesquisas_satisfacao_created_idx on public.pesquisas_satisfacao (created_at desc);

alter table public.pesquisas_satisfacao enable row level security;

drop policy if exists "pesquisas_satisfacao: leitura" on public.pesquisas_satisfacao;
create policy "pesquisas_satisfacao: leitura"
  on public.pesquisas_satisfacao for select
  to anon, authenticated
  using (true);

drop policy if exists "pesquisas_satisfacao: resposta" on public.pesquisas_satisfacao;
create policy "pesquisas_satisfacao: resposta"
  on public.pesquisas_satisfacao for insert
  to anon, authenticated
  with check (true);
