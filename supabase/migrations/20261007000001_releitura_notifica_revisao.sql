-- Parte 2/2: triggers que notificam nova revisao com o texto do que mudou.

create or replace function public.pops_notificar_nova_revisao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mudanca text;
  v_titulo text;
begin
  if new.revisao is distinct from old.revisao and new.revisao > coalesce(old.revisao, 0) then
    v_mudanca := nullif(trim(coalesce(new.observacao_revisao, '')), '');
    if v_mudanca is null then
      v_mudanca := 'O documento foi atualizado. Abra para ler a nova versao.';
    end if;
    v_titulo := 'Nova revisao para reler: ' || new.codigo || ' — Revisao ' ||
      lpad(new.revisao::text, 2, '0');
    insert into public.notificacoes (
      destinatario_email, destinatario_nome, titulo, mensagem,
      tipo, pop_id, revisao, autor_nome, autor_email
    )
    select
      lower(c.email), c.nome, v_titulo,
      'O que mudou na Revisao ' || lpad(new.revisao::text, 2, '0') || ': ' || v_mudanca,
      'revisao', new.id, new.revisao,
      coalesce(new.aprovado_qualidade_nome, new.aprovado_processo_nome, 'Qualidade'), ''
    from public.colaboradores c
    where c.status = 'Ativo'
      and c.email <> ''
      and (
        new.visualizadores = '{}'
        or c.nivel_acesso in ('Administrador', 'Gestor da Qualidade', 'Auxiliar da Qualidade', 'Diretoria', 'Desenvolvedor')
        or lower(c.setor) = 'qualidade'
      )
      and not exists (
        select 1 from public.notificacoes n
        where n.destinatario_email = lower(c.email)
          and n.pop_id = new.id
          and n.tipo = 'revisao'
          and n.revisao = new.revisao
      );
  end if;
  return new;
end;
$$;

drop trigger if exists pops_nova_revisao_trigger on public.pops;
create trigger pops_nova_revisao_trigger
  after update of revisao on public.pops
  for each row
  execute function public.pops_notificar_nova_revisao();

create or replace function public.politicas_notificar_nova_revisao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mudanca text;
  v_titulo text;
begin
  if new.revisao is distinct from old.revisao and new.revisao > coalesce(old.revisao, 0) then
    v_mudanca := nullif(trim(coalesce(new.observacao_revisao, '')), '');
    if v_mudanca is null then
      select h.observacao into v_mudanca
      from jsonb_to_recordset(coalesce(to_jsonb(new.historico), '[]'::jsonb))
        as h(numero int, observacao text)
      where h.numero = new.revisao
      limit 1;
    end if;
    if nullif(trim(coalesce(v_mudanca, '')), '') is null then
      v_mudanca := 'O documento foi atualizado. Abra para ler a nova versao.';
    end if;
    v_titulo := 'Nova revisao para reler: ' || new.codigo || ' — Revisao ' ||
      lpad(new.revisao::text, 2, '0');
    insert into public.notificacoes (
      destinatario_email, destinatario_nome, titulo, mensagem,
      tipo, politica_id, revisao, autor_nome, autor_email
    )
    select
      lower(c.email), c.nome, v_titulo,
      'O que mudou na Revisao ' || lpad(new.revisao::text, 2, '0') || ': ' || v_mudanca,
      'revisao', new.id, new.revisao,
      coalesce(new.criado_por_nome, 'Qualidade'), ''
    from public.colaboradores c
    where c.status = 'Ativo'
      and c.email <> ''
      and (
        c.nivel_acesso in ('Administrador', 'Gestor da Qualidade', 'Auxiliar da Qualidade', 'Diretoria', 'Desenvolvedor')
        or lower(c.setor) = 'qualidade'
        or exists (
          select 1 from unnest(coalesce(new.setores, array[]::text[])) s(nome)
          where lower(s.nome) in ('todos', 'todas', 'geral', 'gerais')
            or lower(s.nome) = lower(c.setor)
        )
      )
      and not exists (
        select 1 from public.notificacoes n
        where n.destinatario_email = lower(c.email)
          and n.politica_id = new.id
          and n.tipo = 'revisao'
          and n.revisao = new.revisao
      );
  end if;
  return new;
end;
$$;

drop trigger if exists politicas_nova_revisao_trigger on public.politicas;
create trigger politicas_nova_revisao_trigger
  after update of revisao on public.politicas
  for each row
  execute function public.politicas_notificar_nova_revisao();

alter table public.notificacoes replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
