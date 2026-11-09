# Indicadores mais rápidos + total igual à planilha

## 1. Carregamento mais rápido
Hoje, a tela baixa **todas as ~423 mil tarefas já importadas**, de todos os meses, a cada abertura ou "Atualizar". O mês escolhido usa só uma pequena parte disso: em outubro, umas 25 mil.

O que muda:
- A tela passa a buscar só as tarefas do mês escolhido. Ao trocar o mês, busca de novo.
- Cada origem continua com a regra de mês que já usa:
  - Gestta: pelo vencimento (sem vencimento, pela competência).
  - Complementar: pela data de conclusão.
  - Acumuladas: pela competência.
- Os números não mudam. Só deixa de chegar o que não seria usado.
- Um índice no banco por vencimento, data de conclusão e competência deixa essa busca rápida.
- As ações que precisam de tudo continuam lendo a base inteira: importação (para evitar repetidas) e "Zerar Mês". Elas não são usadas para abrir a tela.

## 2. Total de tarefas igual à planilha
Com um setor escolhido (ex.: Contábil), **Total de tarefas** e os percentuais que dependem dele contam só o próprio departamento. No Contábil de outubro, o total fica em 2.899.

As tarefas de **Orientação ao Cliente** feitas pelas pessoas do setor continuam aparecendo na lista e no detalhe do setor. Com "Todos os setores", nada muda.

## Detalhes técnicos
- `src/lib/tarefas-gestta.ts`: criar `carregarTarefasDoMes(mes)`, com filtro no servidor via `.or(...)`: `vencimento` no intervalo do mês; ou `data_conclusao` no mês; ou `competencia` igual a `YYYY-MM`, ao nome do mês ("outubro/2026") ou vazia. O resultado passa depois pelas regras atuais no cliente. A paginação paralela e o cache passam a ser por mês.
- `src/routes/indicadores.tsx`: as cargas de tela (linhas ~663, 714, 747) passam a usar `carregarTarefasDoMes(mesSelecionado)` e recarregam quando o mês muda. A importação (2004) continua como está.
- Migration: índices em `tarefas_gestta(vencimento)`, `(data_conclusao)` e `(competencia)`.
- Métricas do setor: `calcularMetricas` recebe só as tarefas com `departamento === setorFiltro`, e a lista mantém as orientações.
- Validação: medir o tempo de carga antes e depois, e conferir que o Contábil de outubro mostra 2.899 e que os demais cards mantêm os mesmos valores.
