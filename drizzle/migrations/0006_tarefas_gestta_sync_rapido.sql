CREATE INDEX IF NOT EXISTS tarefas_gestta_importado_em_idx ON public.tarefas_gestta (importado_em, id);

CREATE OR REPLACE FUNCTION public.tarefas_gestta_resumo()
RETURNS TABLE(total bigint, ultima timestamptz)
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT count(*), max(importado_em) FROM public.tarefas_gestta $$;

CREATE OR REPLACE FUNCTION public.tarefas_gestta_faixas(partes int)
RETURNS TABLE(id_inicio text)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT min(id) FROM (
    SELECT id, ntile(greatest(1, least(partes, 16))) OVER (ORDER BY id) AS g FROM public.tarefas_gestta
  ) s GROUP BY g ORDER BY 1
$$;

GRANT EXECUTE ON FUNCTION public.tarefas_gestta_resumo() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tarefas_gestta_faixas(int) TO anon, authenticated;