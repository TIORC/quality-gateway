-- ---------------------------------------------------------------------------
-- Atas de Reunião — leitura assistida e geração de ações endereçadas
-- ---------------------------------------------------------------------------
-- Complementa `20260926000000_atas_de_reuniao.sql` (tabelas
-- `ata_setores_citados` e `ata_acoes`) e `20260926020000_atas_criar_editar.sql`
-- (funções `usuario_id_por_email`, `pode_editar_ata`, ...).
--
-- O texto da ata é lido ("leitura assistida") e as ações saem dele já
-- endereçadas a um setor, preservando o trecho de origem. A extração é feita
-- no front de forma determinística (padrão do projeto, sem chave de LLM);
-- aqui estão somente o registro e a validação de permissão:
--   * Setores citados: `ata_setores_citados` (resolvido para id do setor);
--   * Ações sugeridas: `ata_acoes` (status `sugerida`), endereçadas a
--     `setor_destino`, com responsável (usuário do portal) e prazo opcionais;
--   * `salvar_leitura_assistida` substitui a extração — os setores citados por
--     completo; as ações apenas as que ainda estão `sugerida` (as
--     `confirmada`/`descartada` são preservadas);
--   * `mudar_status_acao` move uma ação entre sugerida/confirmada/descartada;
--   * Escrita direta bloqueada pela RLS; somente estas funções gravam.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

-- Setor pelo nome ------------------------------------------------------------------
create or replace function public.setor_id_por_nome(nome text)
returns text
language sql
stable
set search_path = public
as $$
  select s.id
  from public.setores s
  where lower(trim(s.nome)) = lower(trim(coalesce(nome, '')))
  limit 1;
$$;

comment on function public.setor_id_por_nome(text) is
  'Devolve o id do setor (public.setores.id) a partir do nome, para endereçar ações e citações.';

grant execute on function public.setor_id_por_nome(text) to anon, authenticated;

-- Salvar leitura assistida -----------------------------------------------------------
create or replace function public.salvar_leitura_assistida(
  email_caller text,
  ata_id uuid,
  setores jsonb default '[]'::jsonb,
  acoes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  nome_setor text;
  trecho text;
  setor_id text;
  descricao text;
  trecho_origem text;
  responsavel_email text;
  responsavel_id text;
  prazo_txt text;
begin
  if not public.pode_editar_ata(email_caller, ata_id) then
    raise exception 'Sem permissão para editar esta ata.';
  end if;
  if (select a.status from public.atas a where a.id = ata_id) <> 'rascunho' then
    raise exception 'Somente atas em rascunho podem ter a leitura assistida salva.';
  end if;

  if jsonb_typeof(setores) <> 'array' or jsonb_typeof(acoes) <> 'array' then
    raise exception 'Lista de setores e de ações inválida.';
  end if;

  -- Setores citados: substitui a extração inteira.
  delete from public.ata_setores_citados where ata_setores_citados.ata = ata_id;
  for item in select * from jsonb_array_elements(setores) loop
    nome_setor := trim(coalesce(item ->> 'setor', ''));
    trecho := coalesce(item ->> 'trecho', '');
    if nome_setor = '' then
      raise exception 'Informe o nome do setor citado.';
    end if;
    setor_id := public.setor_id_por_nome(nome_setor);
    if setor_id is null then
      raise exception 'Setor não cadastrado: %', nome_setor;
    end if;
    insert into public.ata_setores_citados (ata, setor, trecho)
    values (ata_id, setor_id, trecho);
  end loop;

  -- Ações: substitui somente as que ainda estão como sugestão (as
  -- confirmadas/descartadas já decididas são preservadas).
  delete from public.ata_acoes
  where ata_acoes.ata = ata_id and ata_acoes.status_sugestao = 'sugerida';

  for item in select * from jsonb_array_elements(acoes) loop
    descricao := trim(coalesce(item ->> 'descricao', ''));
    trecho_origem := coalesce(item ->> 'trechoOrigem', '');
    nome_setor := trim(coalesce(item ->> 'setorDestino', ''));
    if descricao = '' then
      raise exception 'Informe a descrição da ação.';
    end if;
    if nome_setor = '' then
      raise exception 'Selecione o setor destino de cada ação.';
    end if;
    setor_id := public.setor_id_por_nome(nome_setor);
    if setor_id is null then
      raise exception 'Setor não cadastrado: %', nome_setor;
    end if;

    responsavel_email := trim(coalesce(item ->> 'responsavelEmail', ''));
    responsavel_id := null;
    if responsavel_email <> '' then
      responsavel_id := public.usuario_id_por_email(responsavel_email);
      if responsavel_id is null then
        raise exception 'Responsável sem acesso ao portal: %', responsavel_email;
      end if;
    end if;

    prazo_txt := nullif(trim(coalesce(item ->> 'prazo', '')), '');
    if prazo_txt is not null and prazo_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Prazo inválido (use AAAA-MM-DD).';
    end if;

    insert into public.ata_acoes (
      ata, trecho_origem, descricao, setor_destino, responsavel, prazo, status_sugestao
    ) values (
      ata_id, trecho_origem, descricao, setor_id, responsavel_id,
      case when prazo_txt is null then null else prazo_txt::date end,
      'sugerida'
    );
  end loop;
end;
$$;

comment on function public.salvar_leitura_assistida(text, uuid, jsonb, jsonb) is
  'Grava os setores citados e as ações sugeridas da leitura assistida de uma ata em rascunho (substitui a extração), validando a permissão no backend.';

grant execute on function public.salvar_leitura_assistida(text, uuid, jsonb, jsonb) to anon, authenticated;

-- Mudar situação de uma ação ----------------------------------------------------------
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
  ata_id uuid;
begin
  if novo_status not in ('sugerida', 'confirmada', 'descartada') then
    raise exception 'Situação de ação inválida.';
  end if;
  select acao.ata into ata_id from public.ata_acoes acao where acao.id = acao_id;
  if ata_id is null then
    raise exception 'Ação não encontrada.';
  end if;
  if not public.pode_editar_ata(email_caller, ata_id) then
    raise exception 'Sem permissão para alterar esta ação.';
  end if;
  if (select a.status from public.atas a where a.id = ata_id) <> 'rascunho' then
    raise exception 'Somente atas em rascunho aceitam alteração de ações.';
  end if;
  update public.ata_acoes
  set status_sugestao = novo_status
  where ata_acoes.id = acao_id;
end;
$$;

comment on function public.mudar_status_acao(text, uuid, text) is
  'Muda a situação (sugerida/confirmada/descartada) de uma ação gerada pela ata, validando a permissão no backend.';

grant execute on function public.mudar_status_acao(text, uuid, text) to anon, authenticated;

-- RLS: leitura para todos; escrita somente pelas funções (security definer) -------
do $$
declare
  tabela text;
begin
  foreach tabela in array array['ata_setores_citados', 'ata_acoes'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "%s: leitura" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: leitura" on public.%I for select to anon, authenticated using (true)',
      tabela, tabela
    );
    execute format('drop policy if exists "%s: escrita" on public.%I', tabela, tabela);
    execute format('drop policy if exists "%s: sem escrita direta" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: sem escrita direta" on public.%I for all to anon, authenticated using (false) with check (false)',
      tabela, tabela
    );
  end loop;
end;
$$;