/** Projetos — impressão/PDF (parte 2: portfólio + kanban). */
import type { PlanoAcao } from "@/lib/planos";
import type { ProjetoEstrategico } from "@/lib/projetos";
import { STATUS_PROJETO_LABELS, dataISOparaBR, progressoDoProjeto } from "@/lib/projetos";
import { abrirImpressao, acoesTabela, esc, rodapeImpressao } from "@/lib/projetos-pdf";

/** Visão consolidada do portfólio (status, andamento, prioridade). */
export function imprimirPortfolio(projetos: ProjetoEstrategico[], acoesPorProjeto: Map<string, PlanoAcao[]>) {
  const linhas = projetos.map((p) => {
    const acoes = acoesPorProjeto.get(p.id) ?? [];
    const concluidas = acoes.filter((a) => a.status === "concluida").length;
    return `<tr><td>${esc(p.codigo)}</td><td>${esc(p.nome)}</td><td>${esc(STATUS_PROJETO_LABELS[p.status])}</td><td>${esc(p.prioridade)}</td><td>${concluidas}/${acoes.length}</td><td>${progressoDoProjeto({ ...p, acoes })}%</td><td>${esc(dataISOparaBR(p.fimPrevisto))}</td></tr>`;
  }).join("");
  abrirImpressao("Portfólio de projetos", `
    <div class="faixa"><h1>Portfólio de projetos e planejamentos</h1><p>${projetos.length} projeto(s) · visão gerencial consolidada</p></div>
    <table><thead><tr><th>Código</th><th>Projeto</th><th>Status</th><th>Prioridade</th><th>Ações concluídas</th><th>Progresso</th><th>Fim previsto</th></tr></thead><tbody>${linhas || `<tr><td colspan="7">Nenhum projeto.</td></tr>`}</tbody></table>
    ${rodapeImpressao}`);
}

/** Kanban de um projeto (colunas x cartões). */
export function imprimirKanban(p: ProjetoEstrategico, acoes: PlanoAcao[]) {
  const porStatus = new Map<string, PlanoAcao[]>();
  for (const a of acoes) {
    const arr = porStatus.get(a.status) ?? [];
    arr.push(a);
    porStatus.set(a.status, arr);
  }
  const blocos = p.kanbanColunas.map((c) => {
    const cartoes = c.status.flatMap((s) => porStatus.get(s) ?? []);
    return `<h2>${esc(c.nome)} (${cartoes.length})</h2>${acoesTabela(cartoes)}`;
  }).join("");
  abrirImpressao(`Kanban ${p.codigo}`, `
    <div class="faixa"><h1>Kanban · ${esc(p.codigo)} ${esc(p.nome)}</h1><p>Fluxo de execução das ações</p></div>
    ${blocos || "<p>Nenhuma ação.</p>"}${rodapeImpressao}`);
}
