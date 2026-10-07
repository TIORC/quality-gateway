-- ---------------------------------------------------------------------------
-- Desenvolvedor do Sistema — nível exclusivo, imutável e com acesso total
-- ---------------------------------------------------------------------------
-- Regra de negócio aplicada AQUI no banco (não só no navegador):
--   * somente `timaracas@orcoma.com.br` pode ter
--     `nivel_acesso = 'Desenvolvedor do Sistema'`;
--   * o registro do Desenvolvedor do Sistema é imutável: nível de acesso,
--     e-mail e status não podem ser alterados;
--   * o registro não pode ser excluído.
--
-- A porta de permissão validada no backend (`pode_gerenciar_tipos_reuniao`,
-- da qual dependem `pode_criar_ata` e `pode_editar_ata`) passa a reconhecer o
-- nível, liberando tudo o que a regra Qualidade/Admin restringe no servidor.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

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

COMMENT ON FUNCTION public.travar_desenvolvedor_sistema() IS
  'Impede excluir, alterar egressar o nível Desenvolvedor do Sistema (exclusivo de timaracas@orcoma.com.br).';

DROP TRIGGER IF EXISTS colaboradores_travar_dev ON public.colaboradores;
CREATE TRIGGER colaboradores_travar_dev BEFORE INSERT OR UPDATE OR DELETE ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.travar_desenvolvedor_sistema();

-- Porta de permissão do backend: reconhece o novo nível ------------------------
-- Usada por `pode_criar_ata`, `pode_editar_ata` e pelas funções de leitura
-- assistida/ações de ata — ou seja, vale como admin também no servidor.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_tipos_reuniao(email_caller text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  select exists (
    select 1
    from public.usuarios u
    left join public.colaboradores c
      on c.id = u.colaborador_id or lower(c.email) = lower(u.email)
    where lower(u.email) = lower(trim(coalesce(email_caller, '')))
      and u.ativo
      and (
        u.role in ('admin', 'gestor')
        or translate(lower(coalesce(c.setor, u.setor, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'qualidade'
        or c.nivel_acesso in ('Administrador', 'Gestor da Qualidade', 'Desenvolvedor do Sistema')
        or translate(lower(coalesce(c.cargo, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'coordenador da qualidade'
      )
  );
$$;

COMMENT ON FUNCTION public.pode_gerenciar_tipos_reuniao(text) IS
  'Indica se o usuário com o e-mail informado pode criar/editar/desativar tipos de reunião e gerir atas (Qualidade/Admin/Desenvolvedor do Sistema).';
