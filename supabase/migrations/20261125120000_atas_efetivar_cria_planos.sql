-- ---------------------------------------------------------------------------
-- Atas de Reunião — efetivar a ata cria os planos de ação do documento
-- ---------------------------------------------------------------------------
-- Ao efetivar a ata (rascunho -> aguardando assinatura), cada linha do "Plano
-- de ação" do documento (`atas.documento.plano`) que tiver o "O que?" preenchido
-- vira um registro em `public.planos_de_acao`, com:
--   * origem "Ata de Reunião" e vínculo com a ata (`vinculo_tipo`/`vinculo_id`),
--     o que mostra no Plano de Ação de onde ele veio;
--   * título = "O que?", descrição = "Como", prazo = "Quando" quando for data;
--   * responsável = quem a ata indica, se for um usuário cadastrado (pelo nome);
--     senão, quem efetivou a ata, com a indicação original no detalhamento.
-- O documento fica travado depois (a edição exige rascunho).
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

create or replace function public.efetivar_ata(email_caller text, ata_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ata public.atas%rowtype;
  linha jsonb;
  criados integer := 0;
  ano_atual text := to_char(now(), 'YYYY');
  numero_seq integer;
  codigo_novo text;
  caller_id text;
  caller_nome text;
  caller_email text;
  caller_setor text;
  quem_txt text;
  quem_id text;
  quem_nome text;
  quem_email text;
  quem_setor text;
  como_txt text;
  quando_txt text;
  prazo_data date;
  nota_responsavel text;
  detalhamento_txt text;
  plano_novo_id uuid;
begin
  if not public.pode_gerenciar_tipos_reuniao(email_caller) then
    raise exception 'Sem permissão para efetivar esta ata.';
  end if;

  select * into ata from public.atas a where a.id = ata_id;
  if ata.id is null then
    raise exception 'Ata não encontrada.';
  end if;
  if ata.status <> 'rascunho' then
    raise exception 'Somente atas em rascunho podem ser efetivadas.';
  end if;

  select u.id, u.nome, coalesce(lower(trim(u.email)), ''), coalesce(u.setor, '')
    into caller_id, caller_nome, caller_email, caller_setor
    from public.usuarios u
   where lower(trim(u.email)) = lower(trim(email_caller))
   limit 1;
  if caller_id is null then
    raise exception 'Usuário não encontrado.';
  end if;

  for linha in
    select value from jsonb_array_elements(coalesce(ata.documento -> 'plano', '[]'::jsonb))
  loop
    -- Só linhas com o "O que?" preenchido viram plano.
    if btrim(coalesce(linha ->> 'oQue', '')) = '' then
      continue;
    end if;

    como_txt := btrim(coalesce(linha ->> 'como', ''));
    quem_txt := btrim(coalesce(linha ->> 'quem', ''));
    quando_txt := btrim(coalesce(linha ->> 'quando', ''));

    -- Responsável: usuário cadastrado com o mesmo nome; senão, quem efetivou.
    quem_id := null;
    if quem_txt <> '' then
      select u.id, u.nome, coalesce(lower(trim(u.email)), ''), coalesce(u.setor, '')
        into quem_id, quem_nome, quem_email, quem_setor
        from public.usuarios u
       where u.ativo
         and lower(trim(u.nome)) = lower(trim(quem_txt))
       limit 1;
    end if;

    nota_responsavel := '';
    if quem_id is null then
      quem_id := caller_id;
      quem_nome := caller_nome;
      quem_email := caller_email;
      quem_setor := caller_setor;
      if quem_txt <> '' then
        nota_responsavel := chr(10) || 'Responsável indicado na ata: ' || quem_txt
          || ' (não localizado no cadastro; atribuído a quem efetivou a ata).';
      end if;
    end if;

    -- Prazo: só entra como data quando "Quando" for dd/mm/aaaa ou aaaa-mm-dd.
    prazo_data := null;
    if quando_txt ~ '^\d{2}/\d{2}/\d{4}$' then
      prazo_data := to_date(quando_txt, 'DD/MM/YYYY');
    elsif quando_txt ~ '^\d{4}-\d{2}-\d{2}$' then
      prazo_data := quando_txt::date;
    end if;

    detalhamento_txt := 'Gerado pela ata "' || coalesce(ata.titulo, '') || '"'
      || case when btrim(coalesce(linha ->> 'numero', '')) <> ''
              then ' (item ' || btrim(linha ->> 'numero') || ')' else '' end
      || '.'
      || case when como_txt <> '' then chr(10) || 'Como: ' || como_txt else '' end
      || case when quando_txt <> '' and prazo_data is null
              then chr(10) || 'Quando (na ata): ' || quando_txt else '' end
      || nota_responsavel;

    -- Próximo código sequencial do ano (PA-AAAA-NNN), recalculado a cada plano.
    select coalesce(max((regexp_match(p.codigo, '^PA-' || ano_atual || '-([0-9]+)$'))[1]::int), 0) + 1
      into numero_seq
      from public.planos_de_acao p
     where p.codigo ~ ('^PA-' || ano_atual || '-[0-9]+$');
    codigo_novo := 'PA-' || ano_atual || '-' || lpad(numero_seq::text, 3, '0');

    insert into public.planos_de_acao (
      codigo, titulo, descricao, detalhamento, status, origem, setor, prioridade,
      responsavel_id, responsavel_nome, responsavel_email,
      seguidores, seguidores_ids, prazo, progresso, vinculo_tipo, vinculo_id
    ) values (
      codigo_novo,
      btrim(linha ->> 'oQue'),
      coalesce(nullif(como_txt, ''), btrim(linha ->> 'oQue')),
      detalhamento_txt,
      'nao_iniciado',
      'Ata de Reunião',
      coalesce(quem_setor, ''),
      'Média',
      coalesce(quem_id, ''),
      coalesce(quem_nome, ''),
      coalesce(quem_email, ''),
      '{}',
      '{}',
      prazo_data,
      0,
      'Ata de Reunião',
      ata.id::text
    )
    returning id into plano_novo_id;

    insert into public.plano_historico (
      plano_id, autor_id, autor_nome, autor_email, campo, de, para
    ) values (
      plano_novo_id, caller_id, caller_nome, caller_email,
      'Criação', '', 'Criada ' || codigo_novo || ' pela ata "' || coalesce(ata.titulo, '') || '"'
    );

    criados := criados + 1;
  end loop;

  update public.atas a
     set status = 'aguardando_assinatura'
   where a.id = ata_id;

  return criados;
end;
$$;

comment on function public.efetivar_ata(text, uuid) is
  'Efetiva a ata (rascunho -> aguardando assinatura) e cria um plano de ação em public.planos_de_acao para cada item do plano da ata (origem "Ata de Reunião", vinculado à ata). Retorna a quantidade de planos criados.';

grant execute on function public.efetivar_ata(text, uuid) to anon, authenticated;
