/**
 * Projetos — impressão/PDF (parte 1: base + relatório do projeto).
 * Gera HTML de impressão (identidade #1E3A8A) e chama window.print().
 */

import type { PlanoAcao } from "@/lib/planos";
import { STATUS_ACAO_LABELS, formatarPrazo } from "@/lib/planos";
import type { ProjetoEstrategico } from "@/lib/projetos";
import { STATUS_PROJETO_LABELS, SWOT_LABELS, SWOT_CHAVES, dataISOparaBR, progressoDoProjeto } from "@/lib/projetos";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const CSS_IMPRESSAO = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2937; margin: 32px; font-size: 12px; }
  .faixa { background: #1E3A8A; color: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 18px; }
  .faixa h1 { margin: 0; font-size: 20px; }
  .faixa p { margin: 4px 0 0; font-size: 12px; opacity: .9; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; color: #475569; }
  h2 { color: #1E3A8A; font-size: 14px; border-bottom: 2px solid #E9EEF5; padding-bottom: 4px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #D9E0EA; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #F1F5F9; font-size: 11px; text-transform: uppercase; color: #475569; }
  .swot { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .quad { border: 1px solid #D9E0EA; border-radius: 8px; padding: 8px 10px; }
  .quad b { display: block; margin-bottom: 4px; color: #1E3A8A; }
  .quad ul { margin: 0; padding-left: 16px; }
  .rodape { margin-top: 24px; color: #94A3B8; font-size: 11px; border-top: 1px solid #E9EEF5; padding-top: 8px; }
  @media print { body { margin: 0; } .faixa { border-radius: 0; } }
`;

export function swotHtml(p: ProjetoEstrategico): string {
  const quads = SWOT_CHAVES.map((ch) => {
    const itens = p.swot[ch];
    return `<div class="quad"><b>${esc(SWOT_LABELS[ch])}</b>${
      itens.length ? `<ul>${itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "<span>—</span>"
    }</div>`;
  }).join("");
  return `<div class="swot">${quads}</div>`;
}

export function acoesTabela(acoes: PlanoAcao[]): string {
  if (!acoes.length) return "<p>Nenhuma ação vinculada.</p>";
  const linhas = acoes.map((a) => `<tr><td>${esc(a.codigo)}</td><td>${esc(a.titulo)}</td><td>${esc(STATUS_ACAO_LABELS[a.status])}</td><td>${esc(a.prioridade)}</td><td>${esc(a.responsavelNome || "—")}</td><td>${esc(formatarPrazo(a.prazo))}</td><td>${a.progresso}%</td></tr>`).join("");
  return `<table><thead><tr><th>Código</th><th>Ação</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Progresso</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

export function abrirImpressao(titulo: string, corpo: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<html><head><title>${esc(titulo)}</title><style>${CSS_IMPRESSAO}</style></head><body>${corpo}<script>window.onload = () => window.print();<\/script></body></html>`);
  w.document.close();
}

export const rodapeImpressao = `<div class="rodape">Gestão da Qualidade · gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>`;

/** Relatório completo de um projeto: dados + SWOT + frentes + ações. */
export function imprimirProjeto(p: ProjetoEstrategico, acoes: PlanoAcao[]) {
  const frentes = p.frentes.length
    ? `<table><thead><tr><th>Frente</th><th>Descrição</th><th>Setores</th></tr></thead><tbody>${p.frentes.map((f) => `<tr><td>${esc(f.nome)}</td><td>${esc(f.descricao || "—")}</td><td>${esc(f.setores.join(", ") || "—")}</td></tr>`).join("")}</tbody></table>`
    : "<p>Nenhuma frente cadastrada.</p>";
  abrirImpressao(`Projeto ${p.codigo}`, `
    <div class="faixa"><h1>${esc(p.codigo)} · ${esc(p.nome)}</h1><p>${esc(p.tipo)} · ${esc(STATUS_PROJETO_LABELS[p.status])} · Prioridade ${esc(p.prioridade)} · Progresso ${progressoDoProjeto({ ...p, acoes })}%</p></div>
    <div class="meta"><span><b>Objetivo:</b> ${esc(p.objetivo || "—")}</span><span><b>Setor:</b> ${esc(p.setor || "—")}</span><span><b>Responsável:</b> ${esc(p.responsavelNome || "—")}</span><span><b>Início:</b> ${esc(dataISOparaBR(p.inicio))}</span><span><b>Fim previsto:</b> ${esc(dataISOparaBR(p.fimPrevisto))}</span></div>
    <h2>Matriz SWOT</h2>${swotHtml(p)}
    <h2>Frentes de trabalho</h2>${frentes}
    <h2>Plano de ação (${acoes.length})</h2>${acoesTabela(acoes)}
    ${rodapeImpressao}`);
}
