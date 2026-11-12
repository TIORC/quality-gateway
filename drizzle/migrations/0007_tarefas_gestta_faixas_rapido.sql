CREATE OR REPLACE FUNCTION public.tarefas_gestta_faixas(partes integer)
RETURNS TABLE(id_inicio text) LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE n bigint; p int := greatest(1, least(partes, 16)); i int;
BEGIN
  SELECT count(*) INTO n FROM public.tarefas_gestta;
  FOR i IN 0..p-1 LOOP
    RETURN QUERY SELECT t.id FROM public.tarefas_gestta t ORDER BY t.id OFFSET (n * i / p) LIMIT 1;
  END LOOP;
END $$;