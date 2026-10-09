-- ---------------------------------------------------------------------------
-- Níveis de acesso — revisão das regras
-- ---------------------------------------------------------------------------
--   * "Administrador" é eliminado: quem tinha o nível passa a "Gestor da Qualidade".
--   * "Auxiliar da Qualidade": acesso total ao sistema, exceto aprovar documentos
--     (a aprovação é restrita no front por `podeAprovarDocumentos`).
--   * "Líder de setor": pode liderar mais de um setor (`colaboradores.setores_liderados`,
--     além do próprio `setor`), sem limite de quantidade.
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

-- 1) Administrador -> Gestor da Qualidade ----------------------------------------
update public.colaboradores
   set nivel_acesso = 'Gestor da Qualidade',
       updated_at = now()
 where nivel_acesso = 'Administrador';

-- Login de papel "admin" que não é Desenvolvedor do Sistema passa a "gestor".
update public.usuarios u
   set role = 'gestor'
 where u.role = 'admin'
   and not exists (
     select 1
     from public.colaboradores c
     where (c.id = u.colaborador_id or lower(c.email) = lower(u.email))
       and c.nivel_acesso = 'Desenvolvedor do Sistema'
   );

-- 2) Setores liderados pelo Líder de setor ---------------------------------------
alter table public.colaboradores
  add column if not exists setores_liderados text[] not null default '{}';

comment on column public.colaboradores.setores_liderados is
  'Setores extras que um Líder de setor lidera (nomes), além do próprio `setor`. Sem limite.';

-- 3) Gestão de tipos de reunião: Gestor e Auxiliar da Qualidade ------------------
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
        or c.nivel_acesso in ('Gestor da Qualidade', 'Auxiliar da Qualidade')
        or translate(lower(coalesce(c.cargo, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') = 'coordenador da qualidade'
      )
  );
$$;

comment on function public.pode_gerenciar_tipos_reuniao(text) is
  'Indica se o usuário pode criar/editar/desativar tipos de reunião (Qualidade, Gestor e Auxiliar).';

grant execute on function public.pode_gerenciar_tipos_reuniao(text) to anon, authenticated;
