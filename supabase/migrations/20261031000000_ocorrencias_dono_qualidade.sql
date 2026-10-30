-- Dono da tratativa: a pessoa da Qualidade que "puxou" a ocorrência e responde
-- por ela até o encerramento. Vazio = ainda ninguém assumiu.
alter table public.ocorrencias
  add column if not exists dono_qualidade_id text not null default '',
  add column if not exists dono_qualidade_nome text not null default '',
  add column if not exists dono_qualidade_email text not null default '',
  add column if not exists dono_qualidade_em timestamptz;

comment on column public.ocorrencias.dono_qualidade_email is 'Pessoa da Qualidade que assumiu a tratativa (vazio = sem dono).';
