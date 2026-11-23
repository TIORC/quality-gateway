/**
 * Relatório de Planos de Ação em Excel (.xlsx) com cabeçalho azul e o nome do sistema.
 *
 * Opções: período (dia, semana, mês, ano ou intervalo livre), base de data (criação,
 * prazo ou conclusão), status, somente atrasadas, setor, origem, prioridade e
 * aba de resumo opcional. Gera "Planos de Ação" (uma linha por ação) e, se marcado, "Resumo".
 */
import type { WorkSheet } from "xlsx-js-style";
import { STATUS_ACAO_LABELS, planoAtrasado, type PlanoAcao, type StatusAcao } from "@/lib/planos";

export type PeriodoRelatorio = "dia" | "semana" | "mes" | "ano" | "personalizado";
export type CampoData = "criacao" | "prazo" | "conclusao";

export const PERIODOS_RELATORIO: { valor: PeriodoRelatorio; rotulo: string }[] = [
  { valor: "dia", rotulo: "Dia" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "ano", rotulo: "Ano" },
  { valor: "personalizado", rotulo: "Intervalo" },
];

export const CAMPOS_DATA: { valor: CampoData; rotulo: string; descricao: string }[] = [
  { valor: "criacao", rotulo: "Criação", descricao: "data em que a ação foi criada" },
  { valor: "prazo", rotulo: "Prazo", descricao: "data limite da ação" },
  { valor: "conclusao", rotulo: "Conclusão", descricao: "data em que a ação foi concluída" },
];

/** Grupos de status do filtro. "Aberto" reúne "aberta" e "nao_iniciado" (sugestão do líder). */
export const GRUPOS_STATUS: { valor: string; rotulo: string; status: StatusAcao[] }[] = [
  { valor: "aberto", rotulo: "Aberto", status: ["aberta", "nao_iniciado"] },
  { valor: "em_andamento", rotulo: "Em andamento", status: ["em_andamento"] },
  { valor: "impedido", rotulo: "Impedido", status: ["impedida"] },
  { valor: "concluido", rotulo: "Concluído", status: ["concluida"] },
  { valor: "desconsiderado", rotulo: "Desconsiderado", status: ["cancelado"] },
];

export interface OpcoesRelatorio {
  periodo: PeriodoRelatorio;
  /** Data de referência (YYYY-MM-DD) para dia, semana, mês e ano. */
  referencia: string;
  /** Início e fim (YYYY-MM-DD) do intervalo livre. */
  de: string;
  ate: string;
  campoData: CampoData;
  /** Valores de GRUPOS_STATUS incluídos. */
  grupos: string[];
  somenteAtrasadas: boolean;
  /** "todos" ou um setor exato. */
  setor: string;
  /** "todas" ou uma origem exata. */
  origem: string;
  /** "todas" ou uma prioridade exata. */
  prioridade: string;
  incluirResumo: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Opções iniciais: mês atual, base de criação e todos os status. */
export function opcoesIniciais(hoje: string = isoLocal(new Date())): OpcoesRelatorio {
  const [y, m] = hoje.split("-");
  return {
    periodo: "mes",
    referencia: hoje,
    de: `${y}-${m}-01`,
    ate: hoje,
    campoData: "criacao",
    grupos: GRUPOS_STATUS.map((g) => g.valor),
    somenteAtrasadas: false,
    setor: "todos",
    origem: "todas",
    prioridade: "todas",
    incluirResumo: true,
  };
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + dias)).toISOString().slice(0, 10);
}

function formatarBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Número de série do Excel para uma data YYYY-MM-DD (sem fuso horário). */
function serialExcel(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y!, m! - 1, d!) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export interface IntervaloRelatorio {
  /** Primeiro dia incluído (YYYY-MM-DD). */
  inicio: string;
  /** Último dia incluído (YYYY-MM-DD). */
  fim: string;
  /** Texto legível do período, ex.: "novembro de 2026". */
  rotulo: string;
  /** Trecho usado no nome do arquivo, ex.: "mes_2026-11". */
  nome: string;
}

/** Intervalo de datas do período escolhido, ou null se o intervalo livre estiver incompleto/invertido. */
export function intervaloRelatorio(opcoes: OpcoesRelatorio): IntervaloRelatorio | null {
  const { periodo, referencia } = opcoes;
  if (periodo === "personalizado") {
    if (!opcoes.de || !opcoes.ate || opcoes.de > opcoes.ate) return null;
    return {
      inicio: opcoes.de,
      fim: opcoes.ate,
      rotulo: `${formatarBR(opcoes.de)} a ${formatarBR(opcoes.ate)}`,
      nome: `${opcoes.de}_a_${opcoes.ate}`,
    };
  }
  if (!referencia) return null;
  const [y, m, d] = referencia.split("-").map(Number);
  if (periodo === "dia") {
    return { inicio: referencia, fim: referencia, rotulo: formatarBR(referencia), nome: `dia_${referencia}` };
  }
  if (periodo === "semana") {
    const diaSemana = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0 = domingo
    const inicio = somarDias(referencia, diaSemana === 0 ? -6 : 1 - diaSemana);
    const fim = somarDias(inicio, 6);
    return { inicio, fim, rotulo: `${formatarBR(inicio)} a ${formatarBR(fim)}`, nome: `semana_${inicio}` };
  }
  if (periodo === "mes") {
    const ultimoDia = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    return {
      inicio: `${y}-${pad(m!)}-01`,
      fim: `${y}-${pad(m!)}-${pad(ultimoDia)}`,
      rotulo: `${MESES[m! - 1]} de ${y}`,
      nome: `mes_${y}-${pad(m!)}`,
    };
  }
  return { inicio: `${y}-01-01`, fim: `${y}-12-31`, rotulo: `ano de ${y}`, nome: `ano_${y}` };
}

/** Data local (YYYY-MM-DD) de um instante ISO, ou null se ausente/inválido. */
function diaLocal(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : isoLocal(d);
}

/** Dia (YYYY-MM-DD) que a ação ocupa na base de data escolhida. */
function diaDoCampo(p: PlanoAcao, campo: CampoData): string | null {
  if (campo === "prazo") return p.prazo ? p.prazo.slice(0, 10) : null;
  if (campo === "conclusao") return diaLocal(p.concluidaEm);
  return diaLocal(p.createdAt);
}

/** Ações que atendem a todos os filtros, ordenadas pela data da base escolhida. */
export function planosDoRelatorio(planos: PlanoAcao[], opcoes: OpcoesRelatorio, intervalo: IntervaloRelatorio): PlanoAcao[] {
  const statusPermitidos = new Set<StatusAcao>(
    GRUPOS_STATUS.filter((g) => opcoes.grupos.includes(g.valor)).flatMap((g) => g.status),
  );
  return planos
    .map((p) => ({ p, dia: diaDoCampo(p, opcoes.campoData) }))
    .filter(({ p, dia }) => {
      if (!statusPermitidos.has(p.status)) return false;
      if (opcoes.somenteAtrasadas && !planoAtrasado(p)) return false;
      if (opcoes.setor !== "todos" && p.setor !== opcoes.setor) return false;
      if (opcoes.origem !== "todas" && p.origem !== opcoes.origem) return false;
      if (opcoes.prioridade !== "todas" && p.prioridade !== opcoes.prioridade) return false;
      return dia !== null && dia >= intervalo.inicio && dia <= intervalo.fim;
    })
    .sort((a, b) => ((a.dia ?? "") < (b.dia ?? "") ? -1 : (a.dia ?? "") > (b.dia ?? "") ? 1 : 0))
    .map(({ p }) => p);
}

/* ----------------------------------------------------------------------------
 * Montagem da planilha
 * -------------------------------------------------------------------------- */

type Planilha = typeof import("xlsx-js-style");

const NOME_SISTEMA = "Gestão da Qualidade";

const COR = {
  azulEscuro: "1F4E79",
  azul: "2F75B5",
  azulClaro: "DDEBF7",
  borda: "9DC3E6",
  branco: "FFFFFF",
  texto: "1F2937",
  vermelho: "C00000",
};

const BORDA = {
  top: { style: "thin", color: { rgb: COR.borda } },
  bottom: { style: "thin", color: { rgb: COR.borda } },
  left: { style: "thin", color: { rgb: COR.borda } },
  right: { style: "thin", color: { rgb: COR.borda } },
};

interface ColunaRelatorio {
  titulo: string;
  largura: number;
  centro?: boolean;
  /** Formato numérico do Excel, ex.: "dd/mm/yyyy" ou "0%". */
  formato?: string;
}

interface CelulaRelatorio {
  v: string | number;
  /** Destaca o texto em vermelho e negrito (ex.: "Sim" em atraso). */
  alerta?: boolean;
}

interface AbaRelatorio {
  subtitulo: string;
  info: string;
  colunas: ColunaRelatorio[];
  linhas: CelulaRelatorio[][];
}

const LINHA_CABECALHO = 4; // 0-based: a tabela começa na linha 5 da planilha.

/** Monta uma aba com faixa de título, cabeçalho azul e linhas com faixas alternadas. */
function construirAba(XLSX: Planilha, cfg: AbaRelatorio): WorkSheet {
  const n = cfg.colunas.length;
  const vazio = (k: number) => Array.from({ length: k }, () => "" as string);
  const aoa: (string | number)[][] = [
    [NOME_SISTEMA, ...vazio(n - 1)],
    [cfg.subtitulo, ...vazio(n - 1)],
    [cfg.info, ...vazio(n - 1)],
    vazio(n),
    cfg.colunas.map((c) => c.titulo),
    ...cfg.linhas.map((linha) => linha.map((c) => c.v)),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const ultimaLinha = LINHA_CABECALHO + cfg.linhas.length;

  for (let r = 0; r <= ultimaLinha; r++) {
    for (let c = 0; c < n; c++) {
      const endereco = XLSX.utils.encode_cell({ r, c });
      const celula = ws[endereco] ?? { t: "s", v: "" };
      const col = cfg.colunas[c]!;
      const dado = r > LINHA_CABECALHO ? cfg.linhas[r - LINHA_CABECALHO - 1]?.[c] : undefined;

      if (r === 0) {
        celula.s = {
          font: { name: "Calibri", sz: 18, bold: true, color: { rgb: COR.branco } },
          fill: { patternType: "solid", fgColor: { rgb: COR.azulEscuro } },
          alignment: { horizontal: "left", vertical: "center", indent: 1 },
        };
      } else if (r === 1) {
        celula.s = {
          font: { name: "Calibri", sz: 12, bold: true, color: { rgb: COR.azulEscuro } },
          fill: { patternType: "solid", fgColor: { rgb: COR.azulClaro } },
          alignment: { horizontal: "left", vertical: "center", indent: 1 },
        };
      } else if (r === 2) {
        celula.s = {
          font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "595959" } },
          alignment: { horizontal: "left", vertical: "center", indent: 1, wrapText: true },
        };
      } else if (r === LINHA_CABECALHO) {
        celula.s = {
          font: { name: "Calibri", sz: 11, bold: true, color: { rgb: COR.branco } },
          fill: { patternType: "solid", fgColor: { rgb: COR.azul } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: BORDA,
        };
      } else if (r > LINHA_CABECALHO) {
        const faixa = (r - LINHA_CABECALHO) % 2 === 0 ? COR.azulClaro : COR.branco;
        const alerta = typeof dado === "object" && dado !== null && "alerta" in dado && Boolean(dado.alerta);
        celula.s = {
          font: { name: "Calibri", sz: 10, color: { rgb: alerta ? COR.vermelho : COR.texto }, bold: alerta },
          fill: { patternType: "solid", fgColor: { rgb: faixa } },
          alignment: { horizontal: col.centro ? "center" : "left", vertical: "top", wrapText: true },
          border: BORDA,
        };
        if (col.formato) celula.z = col.formato;
      }
      ws[endereco] = celula;
    }
  }

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: n - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: n - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: n - 1 } },
  ];
  ws["!cols"] = cfg.colunas.map((c) => ({ wch: c.largura }));
  ws["!rows"] = [{ hpt: 32 }, { hpt: 22 }, { hpt: 30 }, { hpt: 8 }, { hpt: 30 }];
  ws["!autofilter"] = { ref: `A${LINHA_CABECALHO + 1}:${XLSX.utils.encode_col(n - 1)}${ultimaLinha + 1}` };
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(ultimaLinha, LINHA_CABECALHO), c: n - 1 } });
  return ws;
}

const COLUNAS_PLANOS: ColunaRelatorio[] = [
  { titulo: "Código", largura: 12 },
  { titulo: "Título", largura: 44 },
  { titulo: "Setor", largura: 20 },
  { titulo: "Origem", largura: 22 },
  { titulo: "Prioridade", largura: 12, centro: true },
  { titulo: "Responsável", largura: 24 },
  { titulo: "Suporte", largura: 26 },
  { titulo: "Status", largura: 28 },
  { titulo: "Progresso", largura: 11, centro: true, formato: "0%" },
  { titulo: "Prazo", largura: 13, centro: true, formato: "dd/mm/yyyy" },
  { titulo: "Criado em", largura: 13, centro: true, formato: "dd/mm/yyyy" },
  { titulo: "Concluído em", largura: 14, centro: true, formato: "dd/mm/yyyy" },
  { titulo: "Atrasado", largura: 11, centro: true },
  { titulo: "Justificativa", largura: 44 },
];

function linhaDoPlano(p: PlanoAcao): CelulaRelatorio[] {
  const atrasado = planoAtrasado(p);
  const criado = diaLocal(p.createdAt);
  const concluido = diaLocal(p.concluidaEm);
  return [
    { v: p.codigo || "" },
    { v: p.titulo },
    { v: p.setor || "" },
    { v: p.origem || "" },
    { v: p.prioridade || "" },
    { v: p.responsavelNome || "" },
    { v: (p.suporte ?? []).join(", ") },
    { v: STATUS_ACAO_LABELS[p.status as StatusAcao] ?? p.status },
    { v: (p.progresso ?? 0) / 100 },
    { v: p.prazo ? serialExcel(p.prazo.slice(0, 10)) : "" },
    { v: criado ? serialExcel(criado) : "" },
    { v: concluido ? serialExcel(concluido) : "" },
    { v: atrasado ? "Sim" : "Não", alerta: atrasado },
    { v: p.justificativa || "" },
  ];
}

function linhasResumo(dados: PlanoAcao[]): CelulaRelatorio[][] {
  const contar = (status: StatusAcao[]) => dados.filter((p) => status.includes(p.status)).length;
  const indicadores: [string, number][] = [
    ["Total de ações", dados.length],
    ["Abertas", contar(["aberta", "nao_iniciado"])],
    ["Em andamento", contar(["em_andamento"])],
    ["Atrasadas (prazo vencido e não encerradas)", dados.filter(planoAtrasado).length],
    ["Concluídas", contar(["concluida"])],
    ["Impedidas", contar(["impedida"])],
    ["Desconsideradas", contar(["cancelado"])],
  ];
  return indicadores.map(([nome, valor]) => [{ v: nome }, { v: valor }]);
}

/** Texto com os filtros aplicados, para a linha de informações da planilha. */
export function descreverFiltros(opcoes: OpcoesRelatorio): string {
  const campo = CAMPOS_DATA.find((c) => c.valor === opcoes.campoData)?.rotulo ?? "";
  const grupos = GRUPOS_STATUS.filter((g) => opcoes.grupos.includes(g.valor)).map((g) => g.rotulo);
  const partes = [
    `Base de data: ${campo}`,
    `Status: ${grupos.length === GRUPOS_STATUS.length ? "todos" : grupos.join(", ") || "nenhum"}`,
  ];
  if (opcoes.somenteAtrasadas) partes.push("somente atrasadas");
  if (opcoes.setor !== "todos") partes.push(`Setor: ${opcoes.setor}`);
  if (opcoes.origem !== "todas") partes.push(`Origem: ${opcoes.origem}`);
  if (opcoes.prioridade !== "todas") partes.push(`Prioridade: ${opcoes.prioridade}`);
  return partes.join(" · ");
}

/**
 * Gera e baixa o arquivo Excel. Retorna o nome do arquivo e a quantidade de ações.
 * Lança erro se o intervalo livre estiver incompleto ou invertido.
 */
export async function exportarRelatorioPlanos(
  planos: PlanoAcao[],
  opcoes: OpcoesRelatorio,
): Promise<{ arquivo: string; total: number }> {
  const intervalo = intervaloRelatorio(opcoes);
  if (!intervalo) throw new Error("Confira o período: a data inicial deve ser anterior ou igual à final.");
  const XLSX = await import("xlsx-js-style");
  const dados = planosDoRelatorio(planos, opcoes, intervalo);
  const rotuloPeriodo = PERIODOS_RELATORIO.find((p) => p.valor === opcoes.periodo)?.rotulo ?? "";
  const geradoEm = new Date().toLocaleString("pt-BR");
  const info = `Gerado em ${geradoEm} · ${dados.length} ação(ões) · ${descreverFiltros(opcoes)}`;
  const campo = CAMPOS_DATA.find((c) => c.valor === opcoes.campoData)?.rotulo.toLowerCase() ?? "";

  const abaPlanos = construirAba(XLSX, {
    subtitulo: `Relatório de Planos de Ação · ${rotuloPeriodo}: ${intervalo.rotulo} (por ${campo})`,
    info,
    colunas: COLUNAS_PLANOS,
    linhas: dados.map(linhaDoPlano),
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, abaPlanos, "Planos de Ação");

  if (opcoes.incluirResumo) {
    const abaResumo = construirAba(XLSX, {
      subtitulo: `Resumo · ${rotuloPeriodo}: ${intervalo.rotulo}`,
      info,
      colunas: [{ titulo: "Indicador", largura: 44 }, { titulo: "Quantidade", largura: 14, centro: true }],
      linhas: linhasResumo(dados),
    });
    XLSX.utils.book_append_sheet(wb, abaResumo, "Resumo");
  }

  wb.Props = {
    Title: `${NOME_SISTEMA} – Planos de Ação`,
    Subject: `Relatório ${rotuloPeriodo.toLowerCase()}: ${intervalo.rotulo}`,
    Author: NOME_SISTEMA,
    Company: NOME_SISTEMA,
    CreatedDate: new Date(),
  };

  const arquivo = `Gestao-da-Qualidade_Planos-de-Acao_${intervalo.nome}.xlsx`;
  XLSX.writeFile(wb, arquivo, { cellStyles: true });
  return { arquivo, total: dados.length };
}
