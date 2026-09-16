-- ---------------------------------------------------------------------------
-- POPs — conteúdo completo, anexos protegidos e "Li e Concordo / Discordo"
-- ---------------------------------------------------------------------------
-- Este arquivo:
--   1. acrescenta os campos do POP no formato de procedimento (objetivo,
--      materiais e sistemas, documentos gerados, links, observações e etapas);
--   2. guarda os anexos (WORD/PDF) em um bucket privado `pop-anexos`;
--   3. registra o "Li e Concordo" / "Li e DISCORDO!" de cada usuário
--      (`public.pop_leituras`) com a justificativa da discordância;
--   4. ao discordar, gera notificação para o Coordenador da Qualidade e para
--      todos os colaboradores com `setor = qualidade` (`public.notificacoes`);
--   5. publica leituras/notificações no Realtime.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud
-- (aba Cloud -> SQL editor) e execute. É idempotente.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 1. Conteúdo do POP no formato de procedimento -------------------------------

alter table public.pops add column if not exists objetivo text not null default '';
alter table public.pops add column if not exists materiais_sistemas text not null default '';
alter table public.pops add column if not exists documentos_gerados text not null default '';
alter table public.pops add column if not exists links_relacionados text[] not null default '{}';
alter table public.pops add column if not exists observacoes text not null default '';
alter table public.pops add column if not exists etapas jsonb not null default '[]'::jsonb;
-- Anexo guardado no bucket privado `pop-anexos` (nunca um link público).
alter table public.pops add column if not exists arquivo_path text;
alter table public.pops add column if not exists arquivo_nome text;
alter table public.pops add column if not exists arquivo_tipo text;
alter table public.pops add column if not exists arquivo_tamanho integer;

comment on column public.pops.objetivo is 'Objetivo do procedimento (texto de abertura do POP).';
comment on column public.pops.materiais_sistemas is 'Materiais e sistemas necessários para executar o POP.';
comment on column public.pops.documentos_gerados is 'Documentos/arquivos gerados ao final do POP.';
comment on column public.pops.links_relacionados is 'Links de apoio (vídeos, manuais, planilhas).';
comment on column public.pops.observacoes is 'Observações e boas práticas do procedimento.';
comment on column public.pops.etapas is
  'Passos do procedimento: [{"nivel": 0, "texto": "Receber o arquivo..."}, ...].';
comment on column public.pops.arquivo_path is 'Caminho do anexo dentro do bucket privado pop-anexos.';
comment on column public.pops.arquivo_nome is 'Nome original do anexo (exibido na tela).';
comment on column public.pops.arquivo_tipo is 'MIME type do anexo (application/pdf, docx, ...).';
comment on column public.pops.arquivo_tamanho is 'Tamanho do anexo em bytes.';

-- 2. "Li e Concordo" / "Li e DISCORDO!" ---------------------------------------

create table if not exists public.pop_leituras (
  id uuid primary key default gen_random_uuid(),
  pop_id uuid not null references public.pops (id) on delete cascade,
  usuario_email text not null,
  usuario_nome text not null default '',
  decisao text not null check (decisao in ('concordo', 'discordo')),
  justificativa text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pop_id, usuario_email)
);

comment on table public.pop_leituras is
  'Ciência de cada usuário sobre o POP: concordo (aceite) ou discordo (com justificativa).';
comment on column public.pop_leituras.decisao is 'concordo = aceite; discordo = revisão solicitada.';
comment on column public.pop_leituras.justificativa is 'Texto que explica a discordância.';

create index if not exists pop_leituras_pop_id_idx on public.pop_leituras (pop_id);
create index if not exists pop_leituras_decisao_idx on public.pop_leituras (decisao);

-- 3. Notificações (Coordenador da Qualidade + setor Qualidade) ----------------

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_email text not null,
  destinatario_nome text not null default '',
  titulo text not null,
  mensagem text not null default '',
  tipo text not null default 'discordancia',
  pop_id uuid references public.pops (id) on delete cascade,
  autor_nome text not null default '',
  autor_email text not null default '',
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notificacoes is
  'Avisos internos (ex.: discordância de POP enviada ao Coordenador da Qualidade e ao setor Qualidade).';

create index if not exists notificacoes_destinatario_idx
  on public.notificacoes (destinatario_email, lida, created_at desc);
create index if not exists notificacoes_pop_id_idx on public.notificacoes (pop_id);

-- 4. Acesso -------------------------------------------------------------------

grant select, insert, update, delete on public.pop_leituras to anon, authenticated;
grant select, insert, update, delete on public.notificacoes to anon, authenticated;
grant all on public.pop_leituras to service_role;
grant all on public.notificacoes to service_role;

alter table public.pop_leituras enable row level security;
alter table public.notificacoes enable row level security;

drop policy if exists "pop_leituras: leitura" on public.pop_leituras;
create policy "pop_leituras: leitura"
  on public.pop_leituras for select
  to anon, authenticated
  using (true);

drop policy if exists "pop_leituras: escrita" on public.pop_leituras;
create policy "pop_leituras: escrita"
  on public.pop_leituras for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "notificacoes: leitura" on public.notificacoes;
create policy "notificacoes: leitura"
  on public.notificacoes for select
  to anon, authenticated
  using (true);

drop policy if exists "notificacoes: escrita" on public.notificacoes;
create policy "notificacoes: escrita"
  on public.notificacoes for all
  to anon, authenticated
  using (true)
with check (true);

-- 5. Anexos (WORD/PDF) no bucket PRIVADO pop-anexos ---------------------------
-- Sem link público: o arquivo só é lido pela aplicação, via URL assinada
-- efêmera, e a visualização acontece dentro do sistema (sem download).

insert into storage.buckets (id, name, public)
values ('pop-anexos', 'pop-anexos', false)
on conflict (id) do update set public = false;

drop policy if exists "pop-anexos: leitura" on storage.objects;
create policy "pop-anexos: leitura"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: envio" on storage.objects;
create policy "pop-anexos: envio"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: atualizacao" on storage.objects;
create policy "pop-anexos: atualizacao"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'pop-anexos')
  with check (bucket_id = 'pop-anexos');

drop policy if exists "pop-anexos: exclusao" on storage.objects;
create policy "pop-anexos: exclusao"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'pop-anexos');

-- 6. Notificação automática ao discordar --------------------------------------
-- Ao registrar (ou atualizar para) "discordo", avisa o Coordenador da
-- Qualidade (nivel_acesso = 'Gestor da Qualidade') e todos os colaboradores
-- ativos com setor = 'Qualidade'.

create or replace function public.pop_leituras_notificar_discordancia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pop public.pops%rowtype;
  v_mensagem text;
begin
  if new.decisao is distinct from 'discordo' then
    return new;
  end if;

  select * into v_pop from public.pops where id = new.pop_id;
  v_mensagem := new.usuario_nome || ' leu e discordou do POP ' || v_pop.codigo ||
    coalesce(': ' || nullif(trim(new.justificativa), ''), '.');

  insert into public.notificacoes (
    destinatario_email, destinatario_nome, titulo, mensagem,
    tipo, pop_id, autor_nome, autor_email
  )
  select
    lower(c.email), c.nome,
    'Discordância em POP: ' || v_pop.codigo || ' — ' || v_pop.titulo,
    v_mensagem,
    'discordancia', v_pop.id, new.usuario_nome, new.usuario_email
  from public.colaboradores c
  where c.status = 'Ativo'
    and c.email <> ''
    and lower(c.email) <> lower(new.usuario_email)
    and (c.nivel_acesso = 'Gestor da Qualidade' or lower(c.setor) = 'qualidade')
    and not exists (
      select 1 from public.notificacoes n
      where n.destinatario_email = lower(c.email)
        and n.pop_id = v_pop.id
        and n.autor_email = new.usuario_email
        and n.tipo = 'discordancia'
        and n.mensagem = v_mensagem
    );

  return new;
end;
$$;

drop trigger if exists pop_leituras_discordancia_trigger on public.pop_leituras;
create trigger pop_leituras_discordancia_trigger
  after insert or update of decisao, justificativa
  on public.pop_leituras
  for each row
  execute function public.pop_leituras_notificar_discordancia();

-- 7. Realtime (conteúdo do POP, leituras e notificações) ----------------------

alter table public.pop_leituras replica identity full;
alter table public.notificacoes replica identity full;
alter table public.pops replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.pop_leituras;
alter publication supabase_realtime add table public.notificacoes;
alter publication supabase_realtime add table public.pops;

-- 8. POP de exemplo com o conteúdo no formato de procedimento -----------------

insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem)
values ('contabil', 'Contábil', 'CTB', 'CONTABIL', 'calculator', 2)
on conflict (id) do nothing;

insert into public.pops (
  setor_id, codigo, titulo, descricao, departamento, categoria, frequencia,
  prazo_referencia, regime, dificuldade, cargo_responsavel, dia_inicio, meta_dia,
  prazo_legal, objetivo, materiais_sistemas, documentos_gerados,
  links_relacionados, observacoes, etapas
) values (
  'contabil', 'CTB-04', 'Lançamento de provisões financeiras dos clientes',
  'Contabilização das provisões financeiras de cada cliente a partir dos arquivos financeiros recebidos.',
  'Contábil', 'CONTABIL', 'MENSAL', 'MES_ANTERIOR', 'TODOS', 'MEDIO', 'ASSISTENTE',
  10, 25, '2026-09-30',
  'Realizar o lançamento da movimentação de provisões financeiras dos clientes na contabilidade.',
  'Software Domínio, Software de Comunicação, Software de processos, Software Financeiro, Software de Conversão de Arquivos.',
  'Arquivo TXT.',
  array['https://www.youtube.com/watch?v=r85AN8uohtA&list=PL5AWEHNBTh'],
  'Atualmente é a etapa mais delicada da Contabilidade, pois depende exclusivamente dos arquivos dos clientes. Há uma dificuldade na obtenção desses arquivos, por isso, é recomendado que utilizem mecanismos automáticos para obtenção do financeiro do cliente. Cliente utilizar um software integrado com a Domínio: ContaAzul. Cliente utilizar um software que exporte arquivos financeiros e que a Domínio consiga importar: NIBO; Omie; outros softwares que geram arquivos. Cliente utilizar algum outro software que gere qualquer tipo de arquivos: utilizar um software de transformação de arquivos (Plick Soluções; Otimizza; Escritório Inteligente; Sobit). Cliente não utilizar sistema financeiro: verificar a utilização de alguma planilha de controle; utilizar software de conversão de arquivos para realizar a transformação; elaborar uma planilha no Google Planilhas para o cliente controlar o financeiro. Caso o cliente não utilize planilha, oferecer novos serviços de fazer o financeiro do cliente. Estruturação de BPO Financeiro. Como começar? Aquisição de um curso inicial; elencar uma pessoa da Contabilidade para realização do curso e início da operação financeira; testar com um cliente mais complicado por 3 meses de forma gratuita fazer o financeiro do mesmo; elaborar planejamento e valores do novo serviço e oferecer para a própria carteira.',
  '[{"nivel": 0, "texto": "Receber o arquivo financeiro da empresa através do Software de Comunicação ou através do acesso ao Software Financeiro do cliente;"},
    {"nivel": 1, "texto": "Caso o cliente tenha enviado: baixar os documentos;"},
    {"nivel": 1, "texto": "Salvar na pasta;"},
    {"nivel": 1, "texto": "Caso o cliente não tenha enviado: cobrar os documentos ao cliente através do Software de Comunicação;"},
    {"nivel": 0, "texto": "Analisar o tipo do arquivo;"},
    {"nivel": 1, "texto": "Se for arquivo físico ou não for um arquivo importável para o Software Domínio: fazer a importação de lançamentos contábeis por Planilha Excel no Software Domínio;"},
    {"nivel": 1, "texto": "Se for arquivo TXT importável para o Software Domínio: acessar o Software Domínio no Módulo Contabilidade;"},
    {"nivel": 2, "texto": "Utilitários > Importação > Importador > Importar;"},
    {"nivel": 2, "texto": "Selecionar o caminho onde foi salvo o arquivo;"},
    {"nivel": 2, "texto": "Verificar se o conjunto de dados está como \"Lançamentos contábeis em lote (Leiaute Domínio Sistemas)\";"},
    {"nivel": 2, "texto": "Clicar em \"Importar\";"},
    {"nivel": 2, "texto": "Verificar possíveis erros;"},
    {"nivel": 0, "texto": "Concluir a tarefa no Software de processos;"},
    {"nivel": 0, "texto": "Fim do processo."}]'::jsonb
)
on conflict (codigo) do update set
  objetivo = excluded.objetivo,
  materiais_sistemas = excluded.materiais_sistemas,
  documentos_gerados = excluded.documentos_gerados,
  links_relacionados = excluded.links_relacionados,
  observacoes = excluded.observacoes,
  etapas = excluded.etapas;