-- ---------------------------------------------------------------------------
-- Ocorrências: RLS por papel (identidade vem do JWT emitido pela função
-- `emitir-token-ocorrencias`, com as claims email, sgq_nivel e sgq_setor).
-- Sem token (anon) não há acesso a nenhuma tabela do módulo.
--
-- Leitura da aplicação:
--   - Qualidade, Desenvolvedor e responsável pela etapa: tabelas-base;
--   - solicitante: views `ocorrencias_visiveis` e `ocorrencia_historico_visivel`,
--     que removem as respostas internas de etapa (`__etapa_*`) e os eventos de
--     apuração/julgamento interno.
-- Idempotente.
-- ---------------------------------------------------------------------------

create or replace function public.sgq_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.sgq_nivel() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'sgq_nivel', '')
$$;

-- Gestor da Qualidade ou setor Qualidade: opera as ocorrências.
create or replace function public.sgq_operador() returns boolean
language sql stable as $$
  select public.sgq_nivel() = 'Gestor da Qualidade'
      or lower(trim(coalesce(auth.jwt() ->> 'sgq_setor', ''))) = 'qualidade'
$$;

-- Desenvolvedor do Sistema: acompanha tudo.
create or replace function public.sgq_desenvolvedor() returns boolean
language sql stable as $$
  select public.sgq_nivel() = 'Desenvolvedor do Sistema'
$$;

-- Configura tipos, formulários e fluxos.
create or replace function public.sgq_configurador() returns boolean
language sql stable as $$
  select public.sgq_nivel() in ('Gestor da Qualidade', 'Desenvolvedor do Sistema')
$$;

create or replace function public.sgq_ve_internos(responsavel text) returns boolean
language sql stable as $$
  select public.sgq_operador()
      or public.sgq_desenvolvedor()
      or (coalesce(responsavel, '') <> '' and lower(responsavel) = public.sgq_email())
$$;

-- Remove políticas abertas anteriores --------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ocorrencia_tipos','ocorrencia_formularios','ocorrencia_fluxos','ocorrencias','ocorrencia_historico'] loop
    execute format('drop policy if exists %I on public.%I', t || ': leitura', t);
    execute format('drop policy if exists %I on public.%I', t || ': escrita', t);
    execute format('drop policy if exists %I on public.%I', t || ': insert', t);
  end loop;
end $$;

-- Configuração: leitura para qualquer autenticado, escrita só de configuradores
do $$
declare
  t text;
begin
  foreach t in array array['ocorrencia_tipos','ocorrencia_formularios','ocorrencia_fluxos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || ': leitura', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.sgq_configurador()) with check (public.sgq_configurador())',
      t || ': escrita', t);
  end loop;
end $$;

-- Ocorrências ----------------------------------------------------------------
create policy "ocorrencias: leitura" on public.ocorrencias
  for select to authenticated
  using (public.sgq_ve_internos(responsavel_email));

create policy "ocorrencias: insert" on public.ocorrencias
  for insert to authenticated
  with check (
    public.sgq_operador() or lower(aberta_por_email) = public.sgq_email()
  );

create policy "ocorrencias: update" on public.ocorrencias
  for update to authenticated
  using (
    public.sgq_operador()
    or (coalesce(responsavel_email, '') <> '' and lower(responsavel_email) = public.sgq_email())
    or (lower(aberta_por_email) = public.sgq_email() and macro_atual = 'abertura')
  )
  with check (true);

create policy "ocorrencias: delete" on public.ocorrencias
  for delete to authenticated
  using (public.sgq_operador() or public.sgq_desenvolvedor());

-- Histórico: imutável; autor precisa ser quem chama ---------------------------
create policy "ocorrencia_historico: leitura" on public.ocorrencia_historico
  for select to authenticated
  using (
    exists (
      select 1 from public.ocorrencias o
      where o.id = ocorrencia_historico.ocorrencia_id
        and public.sgq_ve_internos(o.responsavel_email)
    )
  );

create policy "ocorrencia_historico: insert" on public.ocorrencia_historico
  for insert to authenticated
  with check (public.sgq_operador() or lower(autor_email) = public.sgq_email());

-- Views para o solicitante (rodam com os privilégios do dono e se filtram sozinhas)
create or replace view public.ocorrencias_visiveis as
select
  o.id, o.numero, o.titulo, o.tipo_id, o.tipo_nome, o.tipo_cor,
  o.formulario_versao, o.fluxo_versao,
  case
    when public.sgq_ve_internos(o.responsavel_email) then o.respostas
    else coalesce(
      (select jsonb_object_agg(k, v) from jsonb_each(o.respostas) as e(k, v) where k not like '\_\_etapa\_%'),
      '{}'::jsonb)
  end as respostas,
  o.macro_atual, o.subetapa_atual_id, o.subetapa_atual_nome, o.status, o.procedencia,
  o.aberta_por_id, o.aberta_por_nome, o.aberta_por_email, o.aberta_por_setor,
  o.responsavel_id, o.responsavel_nome, o.responsavel_email,
  o.prazo_etapa, o.etapa_entrou_em,
  case when public.sgq_ve_internos(o.responsavel_email) then o.avaliacao else null end as avaliacao,
  o.reaberturas, o.encerrada_em, o.created_at, o.updated_at
from public.ocorrencias o
where public.sgq_ve_internos(o.responsavel_email)
   or lower(o.aberta_por_email) = public.sgq_email();

create or replace view public.ocorrencia_historico_visivel as
select h.*
from public.ocorrencia_historico h
join public.ocorrencias o on o.id = h.ocorrencia_id
where public.sgq_ve_internos(o.responsavel_email)
   or (
     lower(o.aberta_por_email) = public.sgq_email()
     and lower(h.acao) similar to '%(criação|encerramento|atraso|reabert|escalad|julgamento)%'
   );

revoke all on public.ocorrencias_visiveis from anon, public;
revoke all on public.ocorrencia_historico_visivel from anon, public;
grant select on public.ocorrencias_visiveis to authenticated;
grant select on public.ocorrencia_historico_visivel to authenticated;

-- Numeração: precisa enxergar todos os números, não só os do usuário --------
create or replace function public.ocorrencia_numeros() returns setof text
language sql stable security definer set search_path = public as $$
  select numero from public.ocorrencias
$$;
revoke all on function public.ocorrencia_numeros() from anon, public;
grant execute on function public.ocorrencia_numeros() to authenticated;
