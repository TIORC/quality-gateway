-- ---------------------------------------------------------------------------
-- POPs: garante o card "Processos Gerais", visível para todos
-- ---------------------------------------------------------------------------
-- Cria o setor Geral em `pop_setores` quando ele não existe (nenhuma linha com
-- id 'geral' nem categoria 'GERAL'). Não renomeia um setor Geral já cadastrado.
-- Idempotente.
insert into public.pop_setores (id, nome, prefixo, categoria, icone, ordem)
select 'geral', 'Processos Gerais', 'GER', 'GERAL', 'layers', 0
 where not exists (
   select 1 from public.pop_setores where id = 'geral' or categoria = 'GERAL'
 );
