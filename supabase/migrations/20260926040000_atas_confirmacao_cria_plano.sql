-- ---------------------------------------------------------------------------
-- Atas de Reunião — confirmação gera Plano de Ação e guarda o vínculo
-- ---------------------------------------------------------------------------
-- Complementa `20260926030000_atas_leitura_assistida.sql`: ao confirmar uma
-- ação da ata (status `confirmada`), cria o registro no módulo Planos de Ação
-- existente (`public.planos_de_acao`) e grava o vínculo em
-- `ata_acoes.plano_acao`. O vínculo aparece na ata (badge do plano) e no Plano
-- de Ação (`vinculo_tipo = 'Ata de Reunião'`, `vinculo_id = ata.id`, com o
-- trecho de origem preservado no detalhamento).
--
-- Também cadastra a origem "Ata de Reunião" em `plano_origens` para o
-- formulário do módulo Planos de Ação oferecer a mesma opção.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

-- Origem "Ata de Reunião" no módulo Planos de Ação --------------------------------
insert into public.plano_origens (id, nome, ativa, ordem) values
  ('ata-reuniao', 'Ata de Reunião', true, 10)
on conflict (id) do update set nome = excluded.nome, ativa = excluded.ativa, ordem = excluded.ordem;

-- Confirmar ação -> criar plano de ação e vincular -----------------------------------
create or replace function public.mudar_status_acao(
  email_caller text,
  acao_id uuid,
  novo_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acao public.ata_acoes%rowtype;
  ata_titulo text;
  setor_nome text;
  responsavel_nome text;
  responsavel_email text;
  detalhamento_txt text;
  codigo_novo text;
  ano_atual text;
  numero_seq integer;
  plano_novo_id uuid;
  autor_id_ text;
  autor_nome_ text;
  autor_email_ text;
begin
  if novo_status not in ('sugerida', 'confirmada', 'descartada') then
    raise exception 'Situação de ação inválida.';
  end if;

  select * into acao from public.ata_acoes ac where ac.id = acao_id;
  if acao.id is null then
    raise exception 'Ação não encontrada.';
  end if;

  if not public.pode_editar_ata(email_caller, acao.ata) then
    raise exception 'Sem permissão para alterar esta ação.';
  end if;
  if (select a.status from public.atas a where a.id = acao.ata) <> 'rascunho' then
    raise exception 'Somente atas em rascunho aceitam alteração de ações.';
  end if;

  -- Ao confirmar sem plano vinculado: cria o plano no módulo existente.
  if novo_status = 'confirmada' and acao.plano_acao is null then
    select s.nome into setor_nome from public.setores s where s.id = acao.setor_destino;
    if setor_nome is null then
      raise exception 'Setor de destino da ação não encontrado.';
    end if;

    responsavel_nome := '';
    responsavel_email := '';
    if acao.responsavel is not null then
      select u.nome, coalesce(lower(trim(u.email)), '')
        into responsavel_nome, responsavel_email
        from public.usuarios u
       where u.id = acao.responsavel;
      responsavel_nome := coalesce(responsavel_nome, '');
      responsavel_email := coalesce(responsavel_email, '');
    end if;

    ano_atual := to_char(now(), 'YYYY');
    select coalesce(max((regexp_match(p.codigo, '^PA-' || ano_atual || '-([0-9]+)$'))[1]::int), 0) + 1
      into numero_seq
      from public.planos_de_acao p
     where p.codigo ~ ('^PA-' || ano_atual || '-[0-9]+$');
    codigo_novo := 'PA-' || ano_atual || '-' || lpad(numero_seq::text, 3, '0');

    select a.titulo into ata_titulo from public.atas a where a.id = acao.ata;

    detalhamento_txt := 'Gerada pela leitura assistida da ata "' || coalesce(ata_titulo, '') || '".'
      || case when acao.trecho_origem <> '' then chr(10) || 'Trecho da ata: "' || acao.trecho_origem || '"' else '' end;

    insert into public.planos_de_acao (
      codigo, titulo, descricao, detalhamento, status, origem, setor, prioridade,
      responsavel_id, responsavel_nome, responsavel_email,
      seguidores, seguidores_ids, prazo, progresso, vinculo_tipo, vinculo_id
    ) values (
      codigo_novo,
      acao.descricao,
      acao.descricao,
      detalhamento_txt,
      'nao_iniciado',
      'Ata de Reunião',
      setor_nome,
      'Média',
      coalesce(acao.responsavel, ''),
      responsavel_nome,
      responsavel_email,
      '{}',
      '{}',
      acao.prazo,
      0,
      'Ata de Reunião',
      acao.ata::text
    )
    returning id into plano_novo_id;

    select u.id, u.nome, coalesce(lower(trim(u.email)), '')
      into autor_id_, autor_nome_, autor_email_
      from public.usuarios u
     where lower(trim(u.email)) = lower(trim(email_caller));

    insert into public.plano_historico (
      plano_id, autor_id, autor_nome, autor_email, campo, de, para
    ) values (
      plano_novo_id,
      coalesce(autor_id_, ''),
      coalesce(autor_nome_, ''),
      coalesce(autor_email_, ''),
      'Criação', '', 'Criada ' || codigo_novo
    );
  end if;

  update public.ata_acoes
     set status_sugestao = novo_status,
         plano_acao = coalesce(plano_novo_id, plano_acao)
   where id = acao_id;
end;
$$;

comment on function public.mudar_status_acao(text, uuid, text) is
  'Muda a situação (sugerida/confirmada/descartada) de uma ação gerada pela ata, validando a permissão no backend. Ao confirmar sem plano vinculado, cria o registro em public.planos_de_acao (origem "Ata de Reunião", trecho preservado) e guarda o vínculo em ata_acoes.plano_acao.';

grant execute on function public.mudar_status_acao(text, uuid, text) to anon, authenticated;