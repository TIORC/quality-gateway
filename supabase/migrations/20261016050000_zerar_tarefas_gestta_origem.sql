-- Indicadores: zera de novo as tarefas importadas (para reimportar com a coluna `origem`).
-- ATENÇÃO: apaga TODAS as linhas de `public.tarefas_gestta`. Não mexe em `indicadores` nem `apuracoes`.
-- Roda uma única vez, depois da migration 20261016040000 (coluna origem).

delete from public.tarefas_gestta;
