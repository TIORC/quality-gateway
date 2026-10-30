/**
 * Indicadores: relatório completo para exportar em PDF (Exportar snapshot).
 * Gera HTML com as cores dos cards e das tabelas e chama a impressão do navegador,
 * que salva como PDF.
 */
import { abrirImpressao, esc, rodapeImpressao } from "@/lib/projetos-pdf";
import { pct, type MetricasTarefas } from "@/lib/tarefas-gestta";

export interface CartaoRelatorio {
  label: string;
  valor: string;
  cor: string;
  rodape: string;
}

export interface DadosRelatorioIndicadores {
  secao: string;
  competencia: string;
  filtro: string;
  cartoes: CartaoRelatorio[];
  colunaGrupo: string;
  grupos: { nome: string; metricas: MetricasTarefas }[];
  atendimentos: { total: number; coluna: string; linhas: { rotulo: string; total: number }[] } | null;
}

const ESTILO = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2937; margin: 28px; font-size: 12px; }
  .faixa { background: #1E3A8A; color: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 16px; }
  .faixa h1 { margin: 0; font-size: 20px; }
  .faixa p { margin: 4px 0 0; font-size: 12px; opacity: .9; }
  h2 { color: #1E3A8A; font-size: 14px; border-bottom: 2px solid #E9EEF5; padding-bottom: 4px; margin: 20px 0 10px; }
  .cartoes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .cartao { border-radius: 10px; padding: 10px 12px; color: #fff; }
  .cartao .rotulo { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; opacity: .9; }
  .cartao .valor { font-size: 22px; font-weight: bold; margin-top: 6px; }
  .cartao .rodape { font-size: 10px; opacity: .9; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #D9E0EA; padding: 6px 8px; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #1E3A8A; color: #fff; font-size: 10px; text-transform: uppercase; }
  tbody tr:nth-child(even) td { background: #F1F5F9; }
  .total td { font-weight: bold; background: #E0E7FF !important; }
  .obs { color: #475569; font-size: 11px; margin-top: 6px; }
`;

const COR_PCT = {
  concluidas: "#0F766E",
  noPrazo: "#059669",
  foraDoPrazo: "#D97706",
  impedimento: "#B45309",
  atraso: "#E11D48",
};

function linhaGrupo(nome: string, m: MetricasTarefas): string {
  return `<tr>
    <td>${esc(nome)}</td>
    <td><b>${m.total}</b></td>
    <td style="color:${COR_PCT.concluidas}">${pct(m.concluidas, m.total)}</td>
    <td style="color:${COR_PCT.noPrazo}">${pct(m.noPrazo, m.total)}</td>
    <td style="color:${COR_PCT.foraDoPrazo}">${pct(m.foraDoPrazo, m.total)}</td>
    <td style="color:${COR_PCT.impedimento}">${pct(m.impedimento, m.total)}</td>
    <td style="color:${COR_PCT.atraso}">${pct(m.abertasEmAtraso, m.total)}</td>
    <td>${m.concluidasNoMes}</td>
    <td>${m.acumuladasAnteriores}</td>
  </tr>`;
}

/** Monta o relatório e abre a janela de impressão (salvar como PDF). */
export function imprimirRelatorioIndicadores(d: DadosRelatorioIndicadores) {
  const totais = d.grupos.reduce<MetricasTarefas>(
    (soma, g) => ({
      total: soma.total + g.metricas.total,
      concluidas: soma.concluidas + g.metricas.concluidas,
      noPrazo: soma.noPrazo + g.metricas.noPrazo,
      foraDoPrazo: soma.foraDoPrazo + g.metricas.foraDoPrazo,
      impedimento: soma.impedimento + g.metricas.impedimento,
      abertasEmAtraso: soma.abertasEmAtraso + g.metricas.abertasEmAtraso,
      concluidasNoMes: soma.concluidasNoMes + g.metricas.concluidasNoMes,
      acumuladasAnteriores: soma.acumuladasAnteriores + g.metricas.acumuladasAnteriores,
    }),
    {
      total: 0,
      concluidas: 0,
      noPrazo: 0,
      foraDoPrazo: 0,
      impedimento: 0,
      abertasEmAtraso: 0,
      concluidasNoMes: 0,
      acumuladasAnteriores: 0,
    },
  );

  const cartoes = d.cartoes
    .map(
      (c) => `<div class="cartao" style="background:${esc(c.cor)}">
        <div class="rotulo">${esc(c.label)}</div>
        <div class="valor">${esc(c.valor)}</div>
        <div class="rodape">${esc(c.rodape)}</div>
      </div>`,
    )
    .join("");

  const atendimentos = d.atendimentos
    ? `<h2>Atendimentos realizados</h2>
      <p class="obs">Total no mês: <b>${d.atendimentos.total}</b></p>
      <table>
        <thead><tr><th>${esc(d.atendimentos.coluna)}</th><th>Total</th></tr></thead>
        <tbody>${d.atendimentos.linhas
          .map((l) => `<tr><td>${esc(l.rotulo)}</td><td>${l.total}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : "";

  const corpo = `<style>${ESTILO}</style>
    <div class="faixa">
      <h1>Relatório de indicadores · ${esc(d.secao)}</h1>
      <p>Competência: ${esc(d.competencia)} · Filtro: ${esc(d.filtro)}</p>
    </div>
    <h2>Resumo</h2>
    <div class="cartoes">${cartoes}</div>
    <h2>Desempenho por ${esc(d.colunaGrupo.toLowerCase())}</h2>
    ${
      d.grupos.length === 0
        ? `<p class="obs">Nenhuma tarefa importada para esta competência.</p>`
        : `<table>
        <thead><tr>
          <th>${esc(d.colunaGrupo)}</th><th>Total</th><th>% concl.</th><th>% no prazo</th>
          <th>% fora</th><th>% imped.</th><th>% atraso</th><th>Concl. no mês</th><th>Acum. ant.</th>
        </tr></thead>
        <tbody>
          ${d.grupos.map((g) => linhaGrupo(g.nome, g.metricas)).join("")}
          ${linhaGrupo("Total geral", totais).replace("<tr>", '<tr class="total">')}
        </tbody>
      </table>`
    }
    ${atendimentos}
    <p class="obs">Percentuais calculados sobre o total de tarefas de cada linha.</p>
    ${rodapeImpressao}`;

  abrirImpressao(`Indicadores · ${d.secao} · ${d.competencia}`, corpo);
}
