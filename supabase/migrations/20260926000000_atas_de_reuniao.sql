-- ---------------------------------------------------------------------------
-- Atas de Reunião (Lovable Cloud / Supabase)
-- ---------------------------------------------------------------------------
-- Módulo "Atas de Reunião": tipos de reunião, atas, setores citados, ações
-- geradas, assinaturas e arquivos anexados.
--
-- Estruturas externas reutilizadas (nada de modelo novo aqui):
--   * `public.setores`       -> setor citado na ata e setor destino da ação;
--   * `public.usuarios`      -> participantes, signatários, criado_por,
--                               responsável, assinatura e envio de arquivo;
--   * `public.planos_de_acao`-> vínculo opcional da ação gerada pela ata.
--
-- Como aplicar:
--   1. Abra o projeto no Lovable -> aba Cloud -> SQL editor (ou o painel do
--      Supabase do projeto).
--   2. Cole este arquivo inteiro e execute. Ele é idempotente.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Tipos de reunião -------------------------------------------------------------
create table if not exists public.tipos_reuniao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  periodicidade text not null default 'avulsa'
    check (periodicidade in ('semanal', 'quinzenal', 'mensal', 'bimestral',
                             'trimestral', 'semestral', 'anual', 'avulsa')),
  -- Opcional. Dia do mês (1 a 31) ou, nas periodicidades semanais/quinzenais,
  -- dia da semana (1 = segunda ... 7 = domingo). NULL = não definido.
  dia_previsto integer check (dia_previsto between 1 and 31),
  -- Lista de usuários: [{id, nome}] — `id` de `public.usuarios`.
  participantes jsonb not null default '[]'::jsonb,
  -- Quem assina as atas deste tipo: [{id, nome}] — `id` de `public.usuarios`.
  signatarios jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tipos_reuniao is 'Tipos/pautas de reunião (comitê, reunião de setor, avulsa...).';
comment on column public.tipos_reuniao.periodicidade is
  'semanal | quinzenal | mensal | bimestral | trimestral | semestral | anual | avulsa.';
comment on column public.tipos_reuniao.dia_previsto is
  'Dia previsto do período: dia do mês (1-31) ou, em periodicidades semanais/quinzenais, dia da semana (1=segunda...7=domingo). NULL = não definido.';
comment on column public.tipos_reuniao.participantes is
  'Participantes fixos da reunião: [{id, nome}] com id de public.usuarios.';
comment on column public.tipos_reuniao.signatarios is
  'Signatários das atas deste tipo: [{id, nome}] com id de public.usuarios.';
comment on column public.tipos_reuniao.ativo is 'false = tipo desativado (não aparece para novas atas).';

create index if not exists tipos_reuniao_ativo_idx on public.tipos_reuniao (ativo);
create index if not exists tipos_reuniao_nome_idx on public.tipos_reuniao (nome);

-- Atas --------------------------------------------------------------------------
create table if not exists public.atas (
  id uuid primary key default gen_random_uuid(),
  -- Opcional: ata avulsa pode não ter tipo cadastrado.
  tipo_reuniao uuid references public.tipos_reuniao (id) on delete set null,
  origem text not null default 'simples'
    check (origem in ('simples', 'sistema', 'arquivo')),
  titulo text not null,
  data_reuniao date not null,
  texto text not null default '',
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aguardando_assinatura', 'assinada')),
  -- id de public.usuarios.
  criado_por text not null references public.usuarios (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.atas is 'Atas de reunião (registro único da reunião e seu texto).';
comment on column public.atas.tipo_reuniao is 'Tipo de reunião vinculado (NULL para ata avulsa sem tipo).';
comment on column public.atas.origem is 'simples = digitada na tela | sistema = gerada pelo portal | arquivo = importada/anexada.';
comment on column public.atas.data_reuniao is 'Data em que a reunião aconteceu (ou vai acontecer).';
comment on column public.atas.status is 'rascunho | aguardando_assinatura | assinada.';
comment on column public.atas.criado_por is 'Usuário que criou a ata (id de public.usuarios).';

create index if not exists atas_data_reuniao_idx on public.atas (data_reuniao desc);
create index if not exists atas_status_idx on public.atas (status);
create index if not exists atas_tipo_reuniao_idx on public.atas (tipo_reuniao);
create index if not exists atas_criado_por_idx on public.atas (criado_por);

-- Setores citados na ata ---------------------------------------------------------
create table if not exists public.ata_setores_citados (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references public.atas (id) on delete cascade,
  -- Setor citado: id de public.setores (some junto se o setor sair do cadastro).
  setor text not null references public.setores (id) on delete cascade,
  trecho text not null default ''
);

comment on table public.ata_setores_citados is 'Setores mencionados no texto da ata, com o trecho citado.';
comment on column public.ata_setores_citados.ata is 'Ata à qual o setor foi citado.';
comment on column public.ata_setores_citados.setor is 'Setor citado (id de public.setores).';
comment on column public.ata_setores_citados.trecho is 'Trecho do texto da ata em que o setor é citado.';

create index if not exists ata_setores_citados_ata_idx on public.ata_setores_citados (ata);
create index if not exists ata_setores_citados_setor_idx on public.ata_setores_citados (setor);

-- Ações geradas pela ata ----------------------------------------------------------
create table if not exists public.ata_acoes (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references public.atas (id) on delete cascade,
  trecho_origem text not null default '',
  descricao text not null default '',
  -- Setor que vai executar: id de public.setores.
  setor_destino text not null references public.setores (id) on delete cascade,
  -- Opcional. id de public.usuarios.
  responsavel text references public.usuarios (id) on delete set null,
  prazo date,
  -- Opcional: vínculo com o módulo Planos de Ação existente.
  plano_acao uuid references public.planos_de_acao (id) on delete set null,
  status_sugestao text not null default 'sugerida'
    check (status_sugestao in ('sugerida', 'confirmada', 'descartada'))
);

comment on table public.ata_acoes is 'Ações/compromissos extraídos da ata, endereçados a um setor.';
comment on column public.ata_acoes.ata is 'Ata da qual a ação nasceu.';
comment on column public.ata_acoes.trecho_origem is 'Trecho da ata que deu origem à ação (preserva a origem).';
comment on column public.ata_acoes.descricao is 'Descrição da ação a ser executada.';
comment on column public.ata_acoes.setor_destino is 'Setor responsável pela execução (id de public.setores).';
comment on column public.ata_acoes.responsavel is 'Responsável opcional (id de public.usuarios).';
comment on column public.ata_acoes.prazo is 'Prazo opcional para conclusão da ação.';
comment on column public.ata_acoes.plano_acao is 'Plano de ação existente vinculado (public.planos_de_acao), quando houver.';
comment on column public.ata_acoes.status_sugestao is 'sugerida = proposta pela ata | confirmada = virou ação | descartada = rejeitada.';

create index if not exists ata_acoes_ata_idx on public.ata_acoes (ata);
create index if not exists ata_acoes_setor_destino_idx on public.ata_acoes (setor_destino);
create index if not exists ata_acoes_status_sugestao_idx on public.ata_acoes (status_sugestao);
create index if not exists ata_acoes_plano_acao_idx on public.ata_acoes (plano_acao);

-- Assinaturas ----------------------------------------------------------------------
create table if not exists public.ata_assinaturas (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references public.atas (id) on delete cascade,
  -- id de public.usuarios — uma assinatura por usuário por ata.
  usuario text not null references public.usuarios (id) on delete restrict,
  assinado_em timestamptz not null default now(),
  -- Hash do conteúdo da ata no momento da assinatura (integridade do texto).
  hash_conteudo text not null default '',
  unique (ata, usuario)
);

comment on table public.ata_assinaturas is 'Assinaturas da ata — cada usuário assina no máximo uma vez (unique ata+usuario).';
comment on column public.ata_assinaturas.usuario is 'Usuário assinante (id de public.usuarios).';
comment on column public.ata_assinaturas.assinado_em is 'Momento em que a assinatura foi registrada.';
comment on column public.ata_assinaturas.hash_conteudo is 'Hash do conteúdo da ata no instante da assinatura (detecta alteração posterior).';

create index if not exists ata_assinaturas_ata_idx on public.ata_assinaturas (ata);
create index if not exists ata_assinaturas_usuario_idx on public.ata_assinaturas (usuario);

-- Arquivos anexados -----------------------------------------------------------------
create table if not exists public.ata_arquivos (
  id uuid primary key default gen_random_uuid(),
  ata uuid not null references public.atas (id) on delete cascade,
  -- Caminho do upload dentro do bucket privado `atas-arquivos`.
  arquivo text not null default '',
  nome_original text not null default '',
  tamanho integer not null default 0,
  -- id de public.usuarios.
  enviado_por text not null references public.usuarios (id) on delete restrict,
  enviado_em timestamptz not null default now()
);

comment on table public.ata_arquivos is 'Arquivos enviados para a ata (upload no bucket privado atas-arquivos).';
comment on column public.ata_arquivos.arquivo is 'Caminho do arquivo dentro do bucket privado atas-arquivos.';
comment on column public.ata_arquivos.nome_original is 'Nome original do arquivo (exibido na tela).';
comment on column public.ata_arquivos.tamanho is 'Tamanho do arquivo em bytes.';
comment on column public.ata_arquivos.enviado_por is 'Usuário que enviou o arquivo (id de public.usuarios).';
comment on column public.ata_arquivos.enviado_em is 'Momento do envio.';

create index if not exists ata_arquivos_ata_idx on public.ata_arquivos (ata);

-- updated_at automático ------------------------------------------------------------
create or replace function public.atas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tipos_reuniao_set_updated_at on public.tipos_reuniao;
create trigger tipos_reuniao_set_updated_at
  before update on public.tipos_reuniao
  for each row
  execute function public.atas_set_updated_at();

drop trigger if exists atas_set_updated_at on public.atas;
create trigger atas_set_updated_at
  before update on public.atas
  for each row
  execute function public.atas_set_updated_at();

-- Acesso (RLS) ---------------------------------------------------------------------
do $$
declare
  tabela text;
begin
  foreach tabela in array array['tipos_reuniao', 'atas', 'ata_setores_citados',
                                'ata_acoes', 'ata_assinaturas', 'ata_arquivos'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "%s: leitura" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: leitura" on public.%I for select to anon, authenticated using (true)',
      tabela, tabela
    );
    execute format('drop policy if exists "%s: escrita" on public.%I', tabela, tabela);
    execute format(
      'create policy "%s: escrita" on public.%I for all to anon, authenticated using (true) with check (true)',
      tabela, tabela
    );
  end loop;
end;
$$;

-- Arquivos (upload) no bucket PRIVADO atas-arquivos ----------------------------------
-- Mesmo padrão do bucket `pop-anexos`: sem link público; a aplicação lê o
-- arquivo por URL assinada efêmera.
insert into storage.buckets (id, name, public)
values ('atas-arquivos', 'atas-arquivos', false)
on conflict (id) do update set public = false;

drop policy if exists "atas-arquivos: leitura" on storage.objects;
create policy "atas-arquivos: leitura"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'atas-arquivos');

drop policy if exists "atas-arquivos: envio" on storage.objects;
create policy "atas-arquivos: envio"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'atas-arquivos');

drop policy if exists "atas-arquivos: atualizacao" on storage.objects;
create policy "atas-arquivos: atualizacao"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'atas-arquivos')
  with check (bucket_id = 'atas-arquivos');

drop policy if exists "atas-arquivos: exclusao" on storage.objects;
create policy "atas-arquivos: exclusao"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'atas-arquivos');


