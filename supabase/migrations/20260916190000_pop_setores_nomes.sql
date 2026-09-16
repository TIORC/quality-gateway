-- ---------------------------------------------------------------------------
-- POPs — renomeia os setores para só o nome (sem o prefixo "Processos")
-- ---------------------------------------------------------------------------
-- A seed original gravava "Processos Fiscais", "Processos Contábeis", etc. em
-- `public.pop_setores` e usava `on conflict (id) do nothing` — então bancos já
-- populados continuam com os nomes antigos. Este arquivo atualiza os registros
-- que ainda tiverem o prefixo "Processos" para o nome curto do setor.
--
-- Como aplicar: cole este arquivo inteiro no SQL editor do Lovable Cloud. É
-- idempotente — pode rodar novamente sem efeito colateral.
-- ---------------------------------------------------------------------------

update public.pop_setores
   set nome = case id
     when 'fiscal'      then 'Fiscal'
     when 'contabil'    then 'Contábil'
     when 'pessoal'     then 'Pessoal'
     when 'financeiro'  then 'Financeiro'
     when 'legalizacao' then 'Legalização'
     when 'qualidade'   then 'Qualidade'
     when 'ti'          then 'TI'
     when 'direcao'     then 'Direção'
     else nome
   end
 where id in ('fiscal', 'contabil', 'pessoal', 'financeiro', 'legalizacao', 'qualidade', 'ti', 'direcao');