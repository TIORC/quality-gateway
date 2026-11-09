create index if not exists tarefas_gestta_vencimento_idx on public.tarefas_gestta (vencimento);
create index if not exists tarefas_gestta_data_conclusao_idx on public.tarefas_gestta (data_conclusao);
create index if not exists tarefas_gestta_competencia_idx on public.tarefas_gestta (competencia text_pattern_ops);