-- ---------------------------------------------------------------------------
-- Políticas: quem aprovou e quem divulgou (histórico exibido no card)
-- ---------------------------------------------------------------------------
--   * Preenchido pelo app quando o status muda para "Aprovado" e para "Divulgado".
--   * Registros antigos ficam sem essas informações (aparecem como "—").
--
-- Como aplicar: cole no SQL editor do Lovable Cloud (ou Supabase). Idempotente.
-- ---------------------------------------------------------------------------

alter table public.politicas add column if not exists aprovado_por_nome text not null default '';
alter table public.politicas add column if not exists aprovado_em timestamptz;
alter table public.politicas add column if not exists divulgado_por_nome text not null default '';
alter table public.politicas add column if not exists divulgado_em timestamptz;
