-- Configuração extra do tipo de ocorrência (sigla, julgamento, anexos, link externo e dono padrão).
alter table public.ocorrencia_tipos
  add column if not exists sigla text not null default '',
  add column if not exists tem_julgamento boolean,
  add column if not exists permite_anexos boolean not null default true,
  add column if not exists link_externo text not null default '',
  add column if not exists dono_padrao_id text not null default '',
  add column if not exists dono_padrao_nome text not null default '',
  add column if not exists dono_padrao_email text not null default '';
