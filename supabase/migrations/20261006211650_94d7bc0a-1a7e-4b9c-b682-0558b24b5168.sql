CREATE OR REPLACE FUNCTION public.travar_desenvolvedor_sistema()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.nivel_acesso = 'Desenvolvedor do Sistema' THEN
      RAISE EXCEPTION 'O Desenvolvedor do Sistema não pode ser excluído.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.nivel_acesso = 'Desenvolvedor do Sistema'
     AND lower(trim(NEW.email)) <> 'timaracas@orcoma.com.br' THEN
    RAISE EXCEPTION 'O nível Desenvolvedor do Sistema é exclusivo da TI Maracas.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.nivel_acesso = 'Desenvolvedor do Sistema'
     AND (NEW.nivel_acesso IS DISTINCT FROM OLD.nivel_acesso
          OR lower(trim(NEW.email)) <> lower(trim(OLD.email))
          OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'O Desenvolvedor do Sistema é imutável.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS colaboradores_travar_dev ON public.colaboradores;
CREATE TRIGGER colaboradores_travar_dev BEFORE INSERT OR UPDATE OR DELETE ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.travar_desenvolvedor_sistema();