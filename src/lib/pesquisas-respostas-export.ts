/**
 * Respostas de uma pesquisa de satisfação exportadas em Excel (.xlsx) ou PDF.
 *
 * Visual: azul com detalhes amarelos, logo da Orcoma e o nome do sistema abaixo da logo.
 * O PDF usa a caixa de impressão do navegador ("Salvar como PDF"); o Excel é gerado
 * com ExcelJS, que mantém as cores e a imagem.
 */

import type { ModeloPesquisa, RespostaModelo } from "@/lib/pesquisas-modelos";
import { esc } from "@/lib/projetos-pdf";

const NOME_SISTEMA = "Gestão da Qualidade";
const LOGO_PATH = "/logo-orcoma-branca.png";

// Paleta: azul com detalhes amarelos.
const AZUL_ESCURO = "FF1E3A8A";
const AZUL = "FF2563EB";
const AZUL_CLARO = "FFEFF6FF";
const AZUL_BORDA = "FFBFDBFE";
const AMARELO = "FFFACC15";

type Celula = string | number;

function formatarValor(valor: number | string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor.join(", ") : valor === undefined ? "" : String(valor);
  return texto || "—";
}

/** Cabeçalhos: carimbo e cada pergunta numerada, como na tela. */
function cabecalhos(modelo: ModeloPesquisa): string[] {
  return [
    "Carimbo de data/hora",
    ...modelo.perguntas.map((pergunta, indice) => `${indice + 1} - ${pergunta.texto}`),
  ];
}

/** Linhas da planilha. Notas numéricas ficam como número, para o Excel calcular. */
function linhas(modelo: ModeloPesquisa, respostas: RespostaModelo[]): Celula[][] {
  return respostas.map((resposta) => [
    new Date(resposta.criadoEm).toLocaleString("pt-BR"),
    ...modelo.perguntas.map((pergunta): Celula => {
      const valor = resposta.respostas[pergunta.id];
      return typeof valor === "number" ? valor : formatarValor(valor);
    }),
  ]);
}

function nomeDoArquivo(modelo: ModeloPesquisa, extensao: string): string {
  const base = modelo.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const data = new Date().toISOString().slice(0, 10);
  return `respostas-${base || "pesquisa"}-${data}.${extensao}`;
}

function geradoEm(): string {
  return new Date().toLocaleString("pt-BR");
}

/* ----------------------------------------------------------------------------- */
/* PDF                                                                            */
/* ----------------------------------------------------------------------------- */

const CSS_PDF = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0F172A; margin: 0; font-size: 9px; }
  .topo { background: #1E3A8A; color: #FFFFFF; padding: 12px 16px 0; }
  .topo img { height: 44px; display: block; }
  .sistema { color: #FACC15; font-weight: 700; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; padding: 8px 0 12px; }
  .faixa { height: 6px; background: #FACC15; }
  .titulo { color: #1E3A8A; font-size: 16px; font-weight: 700; margin: 12px 0 2px; }
  .meta { color: #475569; font-size: 10px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #2563EB; color: #FFFFFF; text-align: left; padding: 6px 5px; font-size: 9px; border-bottom: 3px solid #FACC15; vertical-align: bottom; }
  td { padding: 5px; border-bottom: 1px solid #BFDBFE; vertical-align: top; white-space: pre-wrap; }
  tbody tr:nth-child(even) td { background: #EFF6FF; }
  tr { page-break-inside: avoid; }
  .rodape { margin-top: 10px; font-size: 9px; color: #1E3A8A; border-top: 2px solid #FACC15; padding-top: 5px; }
`;

/** Escreve a planilha em PDF na janela já aberta e dispara a impressão. */
export function exportarRespostasPdf(
  janela: Window,
  modelo: ModeloPesquisa,
  respostas: RespostaModelo[],
): void {
  const logo = `${window.location.origin}${LOGO_PATH}`;
  const cabecalho = cabecalhos(modelo)
    .map((texto) => `<th>${esc(texto)}</th>`)
    .join("");
  const corpo = linhas(modelo, respostas)
    .map((linha) => `<tr>${linha.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${esc(modelo.titulo)}</title><style>${CSS_PDF}</style></head><body>
    <div class="topo">
      <img src="${esc(logo)}" alt="Orcoma" />
      <div class="sistema">${esc(NOME_SISTEMA)}</div>
    </div>
    <div class="faixa"></div>
    <h1 class="titulo">${esc(modelo.titulo)}</h1>
    <p class="meta">Respostas: ${respostas.length} · Gerado em ${esc(geradoEm())}</p>
    <table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>
    <div class="rodape">${esc(NOME_SISTEMA)} · Orcoma</div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}

/* ----------------------------------------------------------------------------- */
/* Excel                                                                          */
/* ----------------------------------------------------------------------------- */

function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gera e baixa a planilha .xlsx das respostas, com cores, logo e nome do sistema. */
export async function exportarRespostasExcel(
  modelo: ModeloPesquisa,
  respostas: RespostaModelo[],
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const cabecalho = cabecalhos(modelo);
  const dados = linhas(modelo, respostas);
  const totalColunas = cabecalho.length;
  const linhaCabecalho = 6;

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Respostas", {
    views: [{ state: "frozen", ySplit: linhaCabecalho }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = cabecalho.map((_, indice) => ({ width: indice === 0 ? 20 : 26 }));

  const preencherLinha = (numero: number, cor: string) => {
    for (let coluna = 1; coluna <= totalColunas; coluna++) {
      ws.getCell(numero, coluna).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cor },
      };
    }
  };

  // Faixa superior azul com a logo, o nome do sistema e a linha amarela.
  ws.getRow(1).height = 50;
  preencherLinha(1, AZUL_ESCURO);
  ws.getRow(2).height = 26;
  preencherLinha(2, AZUL_ESCURO);
  ws.mergeCells(2, 1, 2, totalColunas);
  const nomeCelula = ws.getCell(2, 1);
  nomeCelula.value = NOME_SISTEMA.toUpperCase();
  nomeCelula.font = { bold: true, size: 14, color: { argb: AMARELO } };
  nomeCelula.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(3).height = 5;
  preencherLinha(3, AMARELO);

  try {
    const resposta = await fetch(LOGO_PATH);
    const bytes = await resposta.arrayBuffer();
    const imagem = wb.addImage({ buffer: new Uint8Array(bytes) as never, extension: "png" });
    ws.addImage(imagem, { tl: { col: 0.15, row: 0.2 }, ext: { width: 170, height: 44 } });
  } catch {
    // Sem a logo, a planilha segue com o nome do sistema.
  }

  // Título e data da geração.
  ws.mergeCells(4, 1, 4, totalColunas);
  const tituloCelula = ws.getCell(4, 1);
  tituloCelula.value = modelo.titulo;
  tituloCelula.font = { bold: true, size: 15, color: { argb: AZUL_ESCURO } };
  tituloCelula.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(4).height = 28;

  ws.mergeCells(5, 1, 5, totalColunas);
  const metaCelula = ws.getCell(5, 1);
  metaCelula.value = `Respostas: ${respostas.length} · Gerado em ${geradoEm()}`;
  metaCelula.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  metaCelula.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(5).height = 18;

  // Cabeçalho da tabela: azul com texto branco e borda amarela embaixo.
  const linhaHead = ws.getRow(linhaCabecalho);
  linhaHead.values = cabecalho;
  linhaHead.height = 44;
  linhaHead.eachCell((celula) => {
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celula.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    celula.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    celula.border = { bottom: { style: "medium", color: { argb: AMARELO } } };
  });

  // Corpo: zebra azul claro, texto quebrando dentro da célula.
  dados.forEach((linha, indice) => {
    const linhaExcel = ws.getRow(linhaCabecalho + 1 + indice);
    linhaExcel.values = linha;
    linhaExcel.eachCell({ includeEmpty: true }, (celula) => {
      celula.font = { size: 10, color: { argb: "FF0F172A" } };
      celula.alignment = { vertical: "top", wrapText: true };
      celula.border = { bottom: { style: "thin", color: { argb: AZUL_BORDA } } };
      if (indice % 2 === 1) {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
      }
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nomeDoArquivo(modelo, "xlsx"),
  );
}
