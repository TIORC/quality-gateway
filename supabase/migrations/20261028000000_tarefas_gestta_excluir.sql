-- Indicadores: permite apagar tarefas importadas pelo botão "Zerar Mês" / "Zerar Tudo".
-- Sem esta policy, o DELETE do app seria bloqueado pelo RLS sem erro (0 linhas apagadas).
-- Segue o mesmo padrão de inclusão/atualização da tabela (anon + authenticated).

drop policy if exists "tarefas_gestta: exclusao" on public.tarefas_gestta;
create policy "tarefas_gestta: exclusao"
  on public.tarefas_gestta for delete
  to anon, authenticated
  using (true);
