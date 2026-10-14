-- ---------------------------------------------------------------------------
-- Olandson (Gestor da Qualidade): líder de todos os setores de POP
-- ---------------------------------------------------------------------------
--   * Mantém o nível "Gestor da Qualidade" e passa a liderar todos os setores
--     cadastrados em `public.pop_setores` (exceto "geral", que já é aprovado pela
--     liderança da Qualidade). Com isso ele aprova a 1ª etapa (líder do processo)
--     de todos os POPs setoriais (ver `podeAprovarLiderProcesso` em src/lib/pops.ts).
--   * A 2ª etapa (liderança da Qualidade) já é permitida ao Gestor da Qualidade.
--   * Setores criados depois precisam ser incluídos aqui ou em Configurações.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

update public.colaboradores c
   set setores_liderados = (
         select coalesce(array_agg(s.nome order by s.ordem), '{}')
           from public.pop_setores s
          where s.id <> 'geral'
       ),
       updated_at = now()
 where c.id = 'col_olandson'
    or lower(c.email) = 'olandson@orcoma.com.br';
