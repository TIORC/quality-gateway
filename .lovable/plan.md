# Total de tarefas igual à planilha (Orientação ao Cliente à parte)

## O que muda
Em Indicadores > Por Setor, com um setor escolhido (ex.: Contábil):
- **Total de tarefas** passa a contar só as tarefas do próprio departamento: no Contábil de outubro, 2.899, o mesmo número da planilha.
- Os outros cards que usam esse total como base (% concluídas, no prazo, fora do prazo, impedimento, abertas em atraso) seguem a mesma conta, para os percentuais baterem com a planilha.
- As tarefas de **Orientação ao Cliente** feitas pelas pessoas do setor **continuam aparecendo** na lista de tarefas e no detalhe do setor, como hoje. Elas só não entram nos números acima.
- Com "Todos" os setores, nada muda.

## Detalhes técnicos
- `src/routes/indicadores.tsx`: o filtro por setor continua devolvendo departamento + orientações (para a lista). Antes de chamar `calcularMetricas`, os cards passam a usar só as tarefas com `t.departamento === setorFiltro`.
- Conferir que o detalhe/lista ao clicar nos cards continua incluindo as orientações.
- Validar abrindo Indicadores com Contábil em outubro/2026 e conferir que o total mostra 2.899.
