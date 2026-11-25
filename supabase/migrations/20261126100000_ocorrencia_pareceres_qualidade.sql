-- ---------------------------------------------------------------------------
-- Ocorrências: Parecer de Julgamento (pareceres escritos no julgamento), em tabela própria.
-- ---------------------------------------------------------------------------
-- 1) `ocorrencia_pareceres_qualidade`: cada publicação é uma linha (conversa).
--    Não há edição; a exclusão só acontece pela função abaixo.
-- 2) `pode_configurar_ocorrencias(email)`: Gestor da Qualidade e Desenvolvedor do
--    Sistema (mesma regra do app).
-- 3) `excluir_parecer_qualidade(email, id)`: apaga a mensagem e grava no histórico.
-- 4) Os pareceres já salvos em `ocorrencias.respostas` são copiados para a tabela
--    e a chave antiga é removida de `respostas`.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create table if not exists public.ocorrencia_pareceres_qualidade (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 20000),
  autor_nome text not null default '',
  autor_email text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.ocorrencia_pareceres_qualidade is
  'Parecer de julgamento de uma ocorrência. Uma linha por publicação; sem edição direta, exclusão só pela função excluir_parecer_qualidade.';

create index if not exists ocorrencia_pareceres_qualidade_ocorrencia_idx
  on public.ocorrencia_pareceres_qualidade (ocorrencia_id, created_at);

alter table public.ocorrencia_pareceres_qualidade enable row level security;

drop policy if exists "ocorrencia_pareceres_qualidade: leitura" on public.ocorrencia_pareceres_qualidade;
create policy "ocorrencia_pareceres_qualidade: leitura"
  on public.ocorrencia_pareceres_qualidade for select
  to anon, authenticated
  using (true);

drop policy if exists "ocorrencia_pareceres_qualidade: insert" on public.ocorrencia_pareceres_qualidade;
create policy "ocorrencia_pareceres_qualidade: insert"
  on public.ocorrencia_pareceres_qualidade for insert
  to anon, authenticated
  with check (true);

-- Sem políticas de update/delete: a exclusão acontece só pela função abaixo.

-- Quem pode configurar ocorrências (Gestor da Qualidade e Desenvolvedor do Sistema) ----
create or replace function public.pode_configurar_ocorrencias(email_caller text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    left join public.colaboradores c
      on c.id = u.colaborador_id or lower(c.email) = lower(u.email)
    where lower(u.email) = lower(trim(coalesce(email_caller, '')))
      and u.ativo
      and (
        u.role in ('admin', 'gestor')
        or c.nivel_acesso in ('Gestor da Qualidade', 'Desenvolvedor do Sistema')
      )
  );
$$;

comment on function public.pode_configurar_ocorrencias(text) is
  'Gestor da Qualidade ou Desenvolvedor do Sistema (admin): pode excluir o parecer da Qualidade.';

grant execute on function public.pode_configurar_ocorrencias(text) to anon, authenticated;

-- Exclusão de uma mensagem do parecer (com registro no histórico) ------------------
create or replace function public.excluir_parecer_qualidade(email_caller text, parecer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.ocorrencia_pareceres_qualidade%rowtype;
  quem_id text := '';
  quem_nome text := '';
begin
  if not public.pode_configurar_ocorrencias(email_caller) then
    raise exception 'Só o Gestor da Qualidade e o Desenvolvedor do Sistema podem excluir o parecer.';
  end if;

  select * into p
    from public.ocorrencia_pareceres_qualidade e
   where e.id = parecer_id;
  if p.id is null then
    raise exception 'Parecer não encontrado.';
  end if;

  select u.id::text, coalesce(u.nome, '')
    into quem_id, quem_nome
    from public.usuarios u
   where lower(u.email) = lower(trim(coalesce(email_caller, '')))
   limit 1;

  delete from public.ocorrencia_pareceres_qualidade e
   where e.id = parecer_id;

  insert into public.ocorrencia_historico (
    ocorrencia_id, autor_id, autor_nome, autor_email, acao, macro, comentario
  ) values (
    p.ocorrencia_id,
    coalesce(quem_id, ''),
    coalesce(quem_nome, ''),
    lower(trim(coalesce(email_caller, ''))),
    'Parecer de julgamento excluído',
    'julgamento',
    ''
  );
end;
$$;

comment on function public.excluir_parecer_qualidade(text, uuid) is
  'Exclui uma mensagem do parecer da Qualidade (só Gestor da Qualidade e Desenvolvedor do Sistema) e registra no histórico.';

grant execute on function public.excluir_parecer_qualidade(text, uuid) to anon, authenticated;

-- Copia os pareceres já salvos em `ocorrencias.respostas` -------------------------
-- Formato antigo: um objeto por ocorrência. Formato intermediário: uma lista.
insert into public.ocorrencia_pareceres_qualidade (
  ocorrencia_id, texto, autor_nome, autor_email, created_at
)
select
  o.id,
  left(btrim(item ->> 'texto'), 20000),
  coalesce(item ->> 'salvoPorNome', ''),
  '',
  coalesce(nullif(item ->> 'salvoEm', '')::timestamptz, now())
from public.ocorrencias o
cross join lateral jsonb_array_elements(
  case jsonb_typeof(o.respostas -> '__parecer_qualidade_julgamento')
    when 'array' then o.respostas -> '__parecer_qualidade_julgamento'
    when 'object' then jsonb_build_array(o.respostas -> '__parecer_qualidade_julgamento')
    else '[]'::jsonb
  end
) as item
where btrim(coalesce(item ->> 'texto', '')) <> ''
  and not exists (
    select 1 from public.ocorrencia_pareceres_qualidade e where e.ocorrencia_id = o.id
  );

-- Remove a chave antiga, já copiada para a tabela.
update public.ocorrencias
   set respostas = respostas - '__parecer_qualidade_julgamento'
 where respostas -> '__parecer_qualidade_julgamento' is not null;
