-- Regra do portal: o setor responsável por TODA ocorrência (qualquer tipo) é
-- a Qualidade. Corrige dados existentes sem mexer em pessoa/cargo explícitos
-- (delegação feita pela própria Qualidade no fluxo).
-- 1) Tipos passam a ter setor_padrao = 'Qualidade'.
update public.ocorrencia_tipos set setor_padrao = 'Qualidade' where setor_padrao is distinct from 'Qualidade';

-- 2) Ocorrências em aberto sem responsável pessoa/cargo explícito passam para a Qualidade.
update public.ocorrencias
set responsavel_nome = 'Qualidade', responsavel_id = '', responsavel_email = '', updated_at = now()
where (responsavel_email is null or responsavel_email = '')
  and (responsavel_id is null or responsavel_id = '')
  and status <> 'encerrada';

-- 3) Fluxos publicados: subetapas de setor (ou sem nome) viram Qualidade.
update public.ocorrencia_fluxos f
set etapas = (
  select coalesce(jsonb_agg(
    case when (e->>'macro') is null then e
    else jsonb_set(e, '{subetapas}', coalesce((
      select jsonb_agg(
        case
          when ((s->'responsavel'->>'tipo') is null or (s->'responsavel'->>'tipo') = 'setor'
            or coalesce(s->'responsavel'->>'nome','') = '')
          then jsonb_set(s, '{responsavel}', '{"tipo":"setor","id":"","nome":"Qualidade"}'::jsonb)
          else s
        end
      ) from jsonb_array_elements(coalesce(e->'subetapas','[]'::jsonb)) s
    ), '[]'::jsonb))
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(f.etapas) e
);
