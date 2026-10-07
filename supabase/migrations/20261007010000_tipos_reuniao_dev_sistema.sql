-- ---------------------------------------------------------------------------
-- Tipos de Reunião — inclui o "Desenvolvedor do Sistema" entre quem gerencia
-- ---------------------------------------------------------------------------
-- Antes só passavam: role admin/gestor, setor Qualidade e os níveis
-- Administrador / Gestor da Qualidade. O nível "Desenvolvedor do Sistema"
-- (TI Maracas) tem acesso total ao portal e passa a ser aceito aqui também.
--
-- Idempotente: pode executar várias vezes no SQL editor do Lovable Cloud.
-- ---------------------------------------------------------------------------

create or replace function public.pode_gerenciar_tipos_reuniao(email_caller text)
returns boolean
language sql
stable
set search_path = public
as $$
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

comment on function public.pode_gerenciar_tipos_reuniao(text) is
  'Indica se o usuário com o e-mail informado pode criar/editar/desativar tipos de reunião (Qualidade, Administrador, Gestor da Qualidade e Desenvolvedor do Sistema).';

grant execute on function public.pode_gerenciar_tipos_reuniao(text) to anon, authenticated;
