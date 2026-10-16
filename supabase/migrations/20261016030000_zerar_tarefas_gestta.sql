-- ---------------------------------------------------------------------------
-- Indicadores: zera as tarefas importadas do Gestta (para refazer a importação)
-- ---------------------------------------------------------------------------
-- ATENÇÃO: apaga TODAS as linhas de `public.tarefas_gestta`. Não dá para desfazer.
-- Não mexe em `indicadores` nem em `apuracoes`. Depois de rodar, importe de novo
-- pela aba Importar do /indicadores.
--
-- Use só uma vez: ao rodar de novo, apaga o que tiver sido importado depois.

delete from public.tarefas_gestta;
