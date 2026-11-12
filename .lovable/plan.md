# Indicadores mais rápidos + total igual à planilha

## Por que demora
Hoje a tela baixa **todas as tarefas já importadas**: são cerca de 423 mil, de todos os meses, em mais de 400 pacotes. Só depois disso ela filtra o mês escolhido. Por isso os números demoram a aparecer, e vão demorar cada vez mais a cada importação.

## O que muda
1. **Baixar só o mês escolhido.** Ao escolher a competência, a tela busca apenas as tarefas daquele mês (alguns milhares, em vez de 423 mil):
   - Gestta: vencimento dentro do mês, ou sem vencimento e com competência do mês;
   - Planilha complementar: concluídas no mês;
   - Relatório de acumuladas: competência do mês.
   Os números ficam iguais aos de hoje; só chegam muito mais rápido. Trocar de mês busca o novo mês, e os meses já abertos ficam guardados durante a sessão.
2. **Índices no banco** por vencimento, data de conclusão e competência, para essas buscas serem rápidas.
3. **Total igual à planilha:** com um setor escolhido, o Total e os percentuais contam só as tarefas do próprio departamento (Contábil em outubro = 2.899). As tarefas de Orientação ao Cliente das pessoas do setor continuam aparecendo na lista do setor.

## Detalhes técnicos
- `src/lib/gestta` (carregarTarefas): nova `carregarTarefasDoMes(mes)` com filtros `.or(...)` por origem e intervalo de datas, ainda paginada em paralelo; cache por mês. `zerarTarefas(mes)` e a importação passam a usá-la e limpam o cache.
- Migration: índices em `tarefas_gestta(vencimento)`, `(data_conclusao)`, `(origem, competencia)`.
- `src/routes/indicadores.tsx`: carregar por mês selecionado; métricas do setor calculadas com `t.departamento === setorFiltro`, enquanto a lista mantém as orientações.
- Verificar: tempo de carga antes/depois e total 2.899 para Contábil em outubro/2026.
