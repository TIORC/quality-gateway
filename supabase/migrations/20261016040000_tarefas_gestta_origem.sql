-- Origem da tarefa: 'gestta' (planilha Tarefas - Gestta) ou 'relatorio' (complementares/atrasadas).
ALTER TABLE public.tarefas_gestta
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'gestta';
