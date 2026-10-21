/**
 * Pesquisas de satisfação: relatório em PDF.
 *
 * Gera HTML de impressão com cores e gráficos estáticos e abre a caixa de impressão
 * (mesmo padrão de `projetos-pdf.ts`). Em "Salvar como PDF", o navegador gera o arquivo.
 */

import {
  apurarNps,
  formatarNps,
  GRUPOS_NPS,
  grupoDaNota,
  ZONAS_NPS,
  zonaDoNps,
  type ApuracaoNps,
} from "@/lib/nps";
import {
  TIPOS_RESPOSTA,
  type ModeloPesquisa,
  type PerguntaModelo,
  type RespostaModelo,
} from "@/lib/pesquisas-modelos";
import {
  mediaGeral,
  mediaPorPergunta,
  PERGUNTAS_NOTA,
  type PesquisaSatisfacao,
} from "@/lib/pesquisas-satisfacao";
import { esc } from "@/lib/projetos-pdf";

type Valor = number | string | string[];

/** Uma pesquisa criada com todas as suas respostas. */
export interface PesquisaComRespostas {
  modelo: ModeloPesquisa;
  respostas: RespostaModelo[];
}

/** Filtros aplicados na tela. Aparecem na capa para dizer o que o relatório mostra. */
export interface FiltrosRelatorio {
  empresa?: string;
  busca?: string;
}

export interface DadosRelatorio extends FiltrosRelatorio {
  pesquisas: PesquisaSatisfacao[];
  notasNps: number[];
}

function linhasDosFiltros(filtros: FiltrosRelatorio): string {
  return [
    filtros.empresa ? `<p><b>Razão social:</b> ${esc(filtros.empresa)}</p>` : "",
    filtros.busca ? `<p><b>Pessoa:</b> ${esc(filtros.busca)}</p>` : "",
  ].join("");
}

export interface Relatorio {
  titulo: string;
  corpo: string;
}

const CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1E293B; font-size: 11px; margin: 0; }
  .capa { background: linear-gradient(135deg, #0B1F4B, #2563EB); color: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 14px; }
  .capa h1 { margin: 0; font-size: 22px; }
  .capa p { margin: 6px 0 0; opacity: .92; }
  .secao { margin-top: 18px; }
  .secao > h2 { color: #fff; background: #553F8C; border-radius: 8px; padding: 7px 12px; font-size: 13px; margin: 0 0 10px; }
  .cartao { border: 1px solid #CBD5E1; border-left: 6px solid #2563EB; border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
  .cartao h3 { margin: 0 0 4px; color: #1E3A8A; font-size: 15px; }
  .cartao h4 { margin: 14px 0 6px; color: #553F8C; font-size: 12px; }
  .desc, .muted { color: #64748B; }
  .chips { margin: 8px 0; }
  .chip, .tag { display: inline-block; color: #fff; border-radius: 999px; padding: 2px 9px; font-size: 10px; margin: 0 4px 4px 0; }
  .pergunta { border-top: 1px solid #E2E8F0; padding: 10px 0; page-break-inside: avoid; }
  .pergunta-topo { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .pergunta-topo b { font-size: 12px; color: #0F172A; }
  .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center; }
  .barra { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .barra .nome { width: 170px; }
  .barra .trilho { flex: 1; background: #E2E8F0; height: 12px; border-radius: 6px; overflow: hidden; }
  .barra .preench { display: block; height: 100%; border-radius: 6px; }
  .barra .valor { width: 70px; text-align: right; font-weight: 700; }
  .legenda { padding-left: 18px; margin: 6px 0; font-size: 10px; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
  th { background: #2563EB; color: #fff; text-align: left; padding: 5px 6px; }
  td { border-bottom: 1px solid #E2E8F0; padding: 5px 6px; vertical-align: top; }
  tr:nth-child(even) td { background: #F8FAFC; }
  ul.textos { margin: 4px 0; padding-left: 18px; }
  ul.textos li { margin-bottom: 4px; }
  .rodape { margin-top: 20px; color: #94A3B8; font-size: 10px; border-top: 1px solid #E2E8F0; padding-top: 6px; }
`;

let contadorSvg = 0;

function corDaNota(nota: number): string {
  if (nota <= 4) return "#DC2626";
  if (nota <= 7) return "#F59E0B";
  return "#16A34A";
}

function corDoGrupoNps(nota: number): string {
  const grupo = grupoDaNota(nota);
  return GRUPOS_NPS.find((g) => g.chave === grupo)?.cor ?? "#64748B";
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function rotuloTipo(tipo: PerguntaModelo["tipo"]): string {
  return TIPOS_RESPOSTA.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

/** Valores preenchidos de uma pergunta (ignora respostas em branco). */
function valoresDaPergunta(respostas: RespostaModelo[], perguntaId: string): Valor[] {
  return respostas
    .map((r) => r.respostas[perguntaId])
    .filter(
      (v): v is Valor => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
}

function textoDoValor(valor: Valor | undefined): string {
  if (valor === undefined) return "—";
  return Array.isArray(valor) ? valor.join(", ") : String(valor);
}

function barra(rotulo: string, valor: number, maximo: number, cor: string, texto: string): string {
  const largura = maximo ? Math.min(100, (valor / maximo) * 100) : 0;
  return `<div class="barra"><span class="nome">${esc(rotulo)}</span><span class="trilho"><span class="preench" style="width:${largura}%;background:${cor}"></span></span><span class="valor">${esc(texto)}</span></div>`;
}

/** Velocímetro estático do NPS (sem animação), com as zonas e a agulha no score. */
function gaugeSvg(score: number | null): string {
  const CX = 200;
  const CY = 180;
  const angulo = (valor: number) => 180 - ((valor + 100) / 200) * 180;
  const ponto = (raio: number, graus: number) => {
    const rad = (graus * Math.PI) / 180;
    return { x: CX + raio * Math.cos(rad), y: CY - raio * Math.sin(rad) };
  };
  const setor = (minimo: number, maximo: number) => {
    const inicio = angulo(minimo);
    const fim = angulo(maximo);
    const e0 = ponto(130, inicio);
    const e1 = ponto(130, fim);
    const i1 = ponto(80, fim);
    const i0 = ponto(80, inicio);
    return `M ${e0.x} ${e0.y} A 130 130 0 0 1 ${e1.x} ${e1.y} L ${i1.x} ${i1.y} A 80 80 0 0 0 ${i0.x} ${i0.y} Z`;
  };

  const zonas = ZONAS_NPS.map((z) => {
    const meio = ponto(160, (angulo(z.minimo) + angulo(z.maximo)) / 2);
    return `<path d="${setor(z.minimo, z.maximo)}" fill="${z.cor}"/><text x="${meio.x}" y="${meio.y}" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">${esc(z.rotulo)}</text>`;
  }).join("");

  const agulha =
    score === null
      ? ""
      : (() => {
          const ponta = ponto(112, angulo(score));
          return `<line x1="${CX}" y1="${CY}" x2="${ponta.x}" y2="${ponta.y}" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>`;
        })();

  const zona = zonaDoNps(score);
  const texto = score === null ? "Nenhuma informação cadastrada" : formatarNps(score);
  const tamanho = score === null ? 16 : 22;

  return `<svg viewBox="0 0 400 225" width="320" role="img" aria-label="Velocímetro do NPS">${zonas}${agulha}<circle cx="${CX}" cy="${CY}" r="12" fill="#1E293B"/><circle cx="${CX}" cy="${CY}" r="5" fill="#FFFFFF"/><text x="${CX}" y="214" text-anchor="middle" font-size="${tamanho}" font-weight="700" fill="${zona?.corTexto ?? "#0F172A"}">${esc(texto)}</text></svg>`;
}

/** Três prédios (detratores, neutros, promotores) com altura proporcional aos votos. */
function predioSvg(apuracao: ApuracaoNps): string {
  contadorSvg += 1;
  const idJanelas = `janelas-${contadorSvg}`;
  const maximo = Math.max(apuracao.detratores, apuracao.neutros, apuracao.promotores);
  const predios = GRUPOS_NPS.map((grupo, indice) => {
    const votos = apuracao[grupo.chave];
    const altura = maximo ? (votos / maximo) * 140 : 0;
    const centro = 56 + indice * 114;
    const x = centro - 36;
    const topo = 180 - altura;
    return `<rect x="${x}" y="${topo}" width="72" height="${altura}" fill="${grupo.cor}"/>
      <rect x="${x}" y="${topo}" width="72" height="${altura}" fill="url(#${idJanelas})"/>
      ${votos > 0 ? `<rect x="${x - 4}" y="${topo - 6}" width="80" height="6" rx="1" fill="#1E293B"/>` : ""}
      <text x="${centro}" y="${topo - 12}" text-anchor="middle" font-size="16" font-weight="700" fill="#0F172A">${votos}</text>
      <text x="${centro}" y="205" text-anchor="middle" font-size="13" font-weight="600" fill="#0F172A">${esc(grupo.rotulo)}</text>
      <text x="${centro}" y="221" text-anchor="middle" font-size="11" fill="#64748B">${esc(grupo.faixa)}</text>`;
  }).join("");

  return `<svg viewBox="0 0 340 230" width="300" role="img" aria-label="Prédios do NPS"><defs><pattern id="${idJanelas}" width="18" height="18" patternUnits="userSpaceOnUse"><rect x="4" y="4" width="8" height="8" rx="1" fill="#FFFFFF" fill-opacity="0.75"/></pattern></defs><line x1="10" x2="330" y1="180" y2="180" stroke="#CBD5E1"/>${predios}</svg>`;
}

function resumoNps(apuracao: ApuracaoNps): string {
  const zona = zonaDoNps(apuracao.score);
  return `<p><b style="color:${zona?.corTexto ?? "#0F172A"}">${esc(formatarNps(apuracao.score))}</b>${zona ? ` · ${esc(zona.nomeCompleto)}` : ""}</p>
    <p class="muted">${apuracao.total} ${apuracao.total === 1 ? "resposta" : "respostas"}: ${apuracao.promotores} promotor(es), ${apuracao.neutros} neutro(s) e ${apuracao.detratores} detrator(es).</p>
    <p class="muted">Cálculo: (promotores − detratores) ÷ total × 100</p>`;
}

function secaoSatisfacao(pesquisas: PesquisaSatisfacao[]): string {
  if (!pesquisas.length)
    return '<p class="muted">Nenhuma resposta do formulário de satisfação recebida ainda.</p>';

  const medias = mediaPorPergunta(pesquisas);
  const geral = mediaGeral(pesquisas);
  const barras = medias
    .map((m) => barra(m.rotulo, m.media, 10, corDaNota(m.media), m.media.toLocaleString("pt-BR")))
    .join("");

  const linhas = pesquisas
    .map((p) => {
      const notas = PERGUNTAS_NOTA.map((pergunta) => {
        const nota = p[pergunta.chave];
        return `<td>${nota === null ? "—" : `<b style="color:${corDaNota(nota)}">${nota}</b>`}</td>`;
      }).join("");
      return `<tr><td>${esc(formatarDataHora(p.criadoEm))}</td><td>${esc(p.empresa)}</td><td>${esc(p.nomePessoa)}</td><td>${esc(p.unidade || "—")}</td>${notas}<td>${esc(p.sugestao || "—")}</td></tr>`;
    })
    .join("");

  const cabecalhoNotas = PERGUNTAS_NOTA.map(
    (pergunta, indice) => `<th>${indice + 1}. ${esc(pergunta.rotulo)}</th>`,
  ).join("");

  return `<div class="cartao">
      <div class="chips"><span class="chip" style="background:#2563EB">${pesquisas.length} ${pesquisas.length === 1 ? "resposta" : "respostas"}</span><span class="chip" style="background:${corDaNota(geral)}">Média geral ${esc(geral.toLocaleString("pt-BR"))}</span></div>
      <h4>Média por pergunta</h4>${barras}
      <h4>Respostas recebidas</h4>
      <table><thead><tr><th>Data</th><th>Empresa</th><th>Respondido por</th><th>Unidade</th>${cabecalhoNotas}<th>Sugestão</th></tr></thead><tbody>${linhas}</tbody></table>
    </div>`;
}

function secaoNpsGeral(notas: number[]): string {
  const apuracao = apurarNps(notas);
  return `<div class="cartao"><div class="duas">
      <div>${gaugeSvg(apuracao.score)}</div>
      <div>${predioSvg(apuracao)}</div>
    </div>${resumoNps(apuracao)}</div>`;
}

/** Chave da pergunta que traz o nome da empresa (mesma regra da tela). */
function chaveEmpresaDo(modelo: ModeloPesquisa): string | undefined {
  return modelo.perguntas.find((p) => /nome da empresa|raz[aã]o social/i.test(p.texto))?.id;
}

function conteudoPergunta(
  pergunta: PerguntaModelo,
  respostas: RespostaModelo[],
  chaveEmpresa: string | undefined,
): string {
  const valores = valoresDaPergunta(respostas, pergunta.id);

  if (pergunta.tipo === "texto_curto" || pergunta.tipo === "texto_longo") {
    if (!valores.length) return '<p class="muted">Nenhuma resposta ainda.</p>';
    return `<ul class="textos">${valores.map((v) => `<li>${esc(textoDoValor(v))}</li>`).join("")}</ul>`;
  }

  if (pergunta.tipo === "escala") {
    const notas = valores.filter((v): v is number => typeof v === "number");
    if (!notas.length) return '<p class="muted">Sem notas ainda.</p>';
    const media = notas.reduce((total, nota) => total + nota, 0) / notas.length;
    const contagem = Array.from({ length: 10 }, (_, i) => notas.filter((n) => n === i + 1).length);
    const maximo = Math.max(1, ...contagem);
    const barras = contagem
      .map((total, i) => barra(`Nota ${i + 1}`, total, maximo, corDaNota(i + 1), String(total)))
      .join("");
    return `<p>Média <b style="color:${corDaNota(media)}">${esc(media.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))}</b></p>${barras}`;
  }

  if (pergunta.tipo === "nps") {
    const notas = valores.filter((v): v is number => typeof v === "number");
    const apuracao = apurarNps(notas);
    const empresas = new Map<string, string[]>(GRUPOS_NPS.map((g) => [g.chave, []]));
    if (chaveEmpresa) {
      for (const resposta of respostas) {
        const nota = resposta.respostas[pergunta.id];
        const empresa = resposta.respostas[chaveEmpresa];
        if (typeof nota !== "number") continue;
        const grupo = grupoDaNota(nota);
        if (grupo)
          empresas
            .get(grupo)
            ?.push(`${textoDoValor(empresa) || "Empresa não informada"} (nota ${nota})`);
      }
    }
    const listas = GRUPOS_NPS.filter((g) => (empresas.get(g.chave) ?? []).length > 0)
      .map(
        (g) =>
          `<li><b style="color:${g.cor}">${esc(g.rotulo)} (${esc(g.faixa)}):</b> ${esc((empresas.get(g.chave) ?? []).join(", "))}</li>`,
      )
      .join("");
    return `<div class="duas"><div>${predioSvg(apuracao)}</div><div>${resumoNps(apuracao)}${listas ? `<ul class="textos">${listas}</ul>` : ""}</div></div>`;
  }

  // Múltipla escolha, caixas de seleção e sim ou não: contagem por opção.
  const opcoes = pergunta.tipo === "sim_nao" ? ["Sim", "Não"] : pergunta.opcoes;
  const contagem = new Map<string, number>(opcoes.map((o) => [o, 0]));
  if (pergunta.permiteOutro) contagem.set("Outro", 0);
  for (const valor of valores) {
    for (const item of Array.isArray(valor) ? valor : [String(valor)]) {
      const chave = opcoes.includes(item) ? item : "Outro";
      if (contagem.has(chave)) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
  }
  const maximo = Math.max(1, ...contagem.values());
  const cores = ["#2563EB", "#553F8C", "#0EA5E9", "#16A34A", "#F59E0B", "#DC2626", "#64748B"];
  return [...contagem.entries()]
    .map(([rotulo, total], indice) =>
      barra(rotulo, total, maximo, cores[indice % cores.length] ?? "#2563EB", String(total)),
    )
    .join("");
}

function tabelaRespostas(perguntas: PerguntaModelo[], respostas: RespostaModelo[]): string {
  if (!respostas.length) return '<p class="muted">Nenhuma resposta ainda.</p>';
  const legenda = perguntas.map((p, i) => `<li><b>P${i + 1}</b> ${esc(p.texto)}</li>`).join("");
  const cabecalhos = perguntas.map((_, i) => `<th>P${i + 1}</th>`).join("");
  const linhas = respostas
    .map((r, indice) => {
      const celulas = perguntas
        .map((p) => {
          const valor = r.respostas[p.id];
          let cor = "";
          if (typeof valor === "number" && p.tipo === "escala") cor = corDaNota(valor);
          if (typeof valor === "number" && p.tipo === "nps") cor = corDoGrupoNps(valor);
          const texto = esc(textoDoValor(valor));
          return `<td>${cor ? `<b style="color:${cor}">${texto}</b>` : texto}</td>`;
        })
        .join("");
      return `<tr><td>${respostas.length - indice}</td><td>${esc(formatarDataHora(r.criadoEm))}</td>${celulas}</tr>`;
    })
    .join("");
  return `<ol class="legenda">${legenda}</ol>
    <table><thead><tr><th>#</th><th>Data</th>${cabecalhos}</tr></thead><tbody>${linhas}</tbody></table>`;
}

/** Seção de uma pesquisa criada: dados, NPS da pesquisa, cada pergunta e as respostas. */
function secaoPesquisa({ modelo, respostas }: PesquisaComRespostas): string {
  const chaveEmpresa = chaveEmpresaDo(modelo);
  const notasNps = modelo.perguntas
    .filter((p) => p.tipo === "nps")
    .flatMap((p) => valoresDaPergunta(respostas, p.id))
    .filter((v): v is number => typeof v === "number");
  const temNps = modelo.perguntas.some((p) => p.tipo === "nps");

  const perguntas = modelo.perguntas
    .map((pergunta, indice) => {
      const valores = valoresDaPergunta(respostas, pergunta.id);
      return `<div class="pergunta">
          <div class="pergunta-topo"><b>${indice + 1}. ${esc(pergunta.texto)}</b><span class="tag" style="background:#0EA5E9">${esc(rotuloTipo(pergunta.tipo))}</span></div>
          ${pergunta.subtitulo ? `<p class="muted">${esc(pergunta.subtitulo)}</p>` : ""}
          <p class="muted">${valores.length} ${valores.length === 1 ? "resposta" : "respostas"}</p>
          ${conteudoPergunta(pergunta, respostas, chaveEmpresa)}
        </div>`;
    })
    .join("");

  const npsDaPesquisa = temNps
    ? `<h4>NPS desta pesquisa</h4><div class="duas"><div>${gaugeSvg(apurarNps(notasNps).score)}</div><div>${resumoNps(apurarNps(notasNps))}</div></div>`
    : "";

  return `<div class="cartao">
      <h3>${esc(modelo.titulo)}</h3>
      ${modelo.descricao ? `<p class="desc">${esc(modelo.descricao)}</p>` : ""}
      <div class="chips">
        <span class="chip" style="background:#2563EB">Criada em ${esc(new Date(modelo.criadoEm).toLocaleDateString("pt-BR"))}</span>
        <span class="chip" style="background:#553F8C">${modelo.perguntas.length} ${modelo.perguntas.length === 1 ? "pergunta" : "perguntas"}</span>
        <span class="chip" style="background:#16A34A">${respostas.length} ${respostas.length === 1 ? "resposta" : "respostas"}</span>
      </div>
      ${npsDaPesquisa}
      <h4>Perguntas e resultados</h4>${perguntas}
      <h4>Respostas detalhadas</h4>${tabelaRespostas(modelo.perguntas, respostas)}
    </div>`;
}

function rodape(dataGeracao: string): string {
  return `<div class="rodape">Gestão da Qualidade · Pesquisas de Satisfação · gerado em ${esc(dataGeracao)}</div>`;
}

/** Relatório completo: formulário de satisfação, NPS geral e todas as pesquisas criadas. */
export function htmlRelatorioCompleto(
  dados: DadosRelatorio,
  criadas: PesquisaComRespostas[],
): Relatorio {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const corpo = `
    <div class="capa">
      <h1>Pesquisas de Satisfação</h1>
      <p>Relatório completo · gerado em ${esc(geradoEm)}</p>
      ${linhasDosFiltros(dados)}
      <p>${criadas.length} ${criadas.length === 1 ? "pesquisa criada" : "pesquisas criadas"} · ${dados.pesquisas.length} ${dados.pesquisas.length === 1 ? "resposta" : "respostas"} do formulário de satisfação · ${dados.notasNps.length} ${dados.notasNps.length === 1 ? "nota NPS" : "notas NPS"}</p>
    </div>
    <section class="secao"><h2>1. Formulário de satisfação</h2>${secaoSatisfacao(dados.pesquisas)}</section>
    <section class="secao"><h2>2. NPS geral (todas as perguntas NPS)</h2>${secaoNpsGeral(dados.notasNps)}</section>
    <section class="secao"><h2>3. Pesquisas criadas (${criadas.length})</h2>${
      criadas.length
        ? criadas.map((c) => secaoPesquisa(c)).join("")
        : '<p class="muted">Nenhuma pesquisa criada.</p>'
    }</section>
    ${rodape(geradoEm)}`;
  return { titulo: "Pesquisas de Satisfação", corpo };
}

/** Relatório de uma única pesquisa criada. */
export function htmlRelatorioPesquisa(
  pesquisa: PesquisaComRespostas,
  filtros: FiltrosRelatorio = {},
): Relatorio {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const corpo = `
    <div class="capa">
      <h1>${esc(pesquisa.modelo.titulo)}</h1>
      <p>Pesquisa de satisfação · gerado em ${esc(geradoEm)}</p>
      ${linhasDosFiltros(filtros)}
    </div>
    <section class="secao"><h2>Pesquisa</h2>${secaoPesquisa(pesquisa)}</section>
    ${rodape(geradoEm)}`;
  return { titulo: pesquisa.modelo.titulo, corpo };
}

/** Abre a janela de impressão. Chame direto no clique, antes de buscar os dados, para o navegador não bloquear. */
export function prepararJanelaRelatorio(): Window | null {
  return window.open("", "_blank", "width=1000,height=800");
}

/** Escreve o relatório na janela aberta e dispara a impressão (Salvar como PDF). */
export function escreverRelatorio(janela: Window, relatorio: Relatorio) {
  janela.document.open();
  janela.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(relatorio.titulo)}</title><style>${CSS}</style></head><body>${relatorio.corpo}<script>window.onload = () => window.print();</script></body></html>`,
  );
  janela.document.close();
}
