/**
 * Indicadores — cálculo automático a partir dos módulos do portal.
 *
 * Só os indicadores cuja informação já existe em Ocorrências, Planos de Ação e
 * Auditorias ficam com `automatico = true` (regra `regra_automatica`). O cálculo
 * é feito na leitura e apenas sugere o valor no lançamento: quem apura confere e
 * confirma, e o valor confirmado é o que fica no histórico.
 *
 * Quando o mês não tem dados suficientes, devolve `null` e o lançamento volta a
 * ser manual.
 */
import { listarAuditorias } from "@/lib/auditorias-base";
import { rotuloMes } from "@/lib/indicadores";
import { listarOcorrencias } from "@/lib/ocorrencias-base";
import { listarPlanos } from "@/lib/planos-base";

export interface ValorAutomatico {
  valor: number;
  /** Como o número foi obtido (mostrado no diálogo de lançamento). */
  detalhe: string;
}

/** Mês de referência (`AAAA-MM`) de uma data ISO, ou vazio quando não há data. */
function mesDe(iso: string | null | undefined): string {
  return typeof iso === "string" && iso.length >= 7 ? iso.slice(0, 7) : "";
}

function dataDe(iso: string | null | undefined): string {
  return typeof iso === "string" ? iso.slice(0, 10) : "";
}

/** Percentual arredondado em 1 casa. */
function percentual(parte: number, total: number): number {
  return Number(((parte / total) * 100).toFixed(1));
}

/** Valor sugerido para a regra informada no mês informado (`null` = manual). */
export async function calcularValorAutomatico(
  regra: string,
  mes: string,
): Promise<ValorAutomatico | null> {
  if (regra === "ocorrencias_encerradas") {
    const ocorrencias = await listarOcorrencias();
    const abertas = ocorrencias.filter((o) => mesDe(o.createdAt) <= mes);
    if (abertas.length === 0) return null;
    const encerradas = abertas.filter(
      (o) => o.status === "encerrada" && (!o.encerradaEm || mesDe(o.encerradaEm) <= mes),
    );
    return {
      valor: percentual(encerradas.length, abertas.length),
      detalhe: `${encerradas.length} de ${abertas.length} ocorrências abertas até ${rotuloMes(mes)} estavam encerradas.`,
    };
  }

  if (regra === "planos_no_prazo") {
    const planos = await listarPlanos();
    const concluidos = planos.filter((p) => mesDe(p.concluidaEm) === mes);
    if (concluidos.length === 0) return null;
    const comPrazo = concluidos.filter((p) => !!p.prazo);
    if (comPrazo.length === 0) return null;
    const noPrazo = comPrazo.filter((p) => dataDe(p.concluidaEm) <= dataDe(p.prazo));
    return {
      valor: percentual(noPrazo.length, comPrazo.length),
      detalhe: `${noPrazo.length} de ${comPrazo.length} planos concluídos em ${rotuloMes(mes)} dentro do prazo (${concluidos.length - comPrazo.length} sem prazo ficaram fora do cálculo).`,
    };
  }

  if (regra === "auditorias_realizadas") {
    const auditorias = await listarAuditorias();
    const planejadas = auditorias.filter((a) => mesDe(a.dataPlanejada) === mes);
    if (planejadas.length === 0) return null;
    const realizadas = planejadas.filter((a) => a.status === "concluida" || a.resultado !== "nenhum");
    return {
      valor: percentual(realizadas.length, planejadas.length),
      detalhe: `${realizadas.length} de ${planejadas.length} auditorias planejadas para ${rotuloMes(mes)} foram concluídas.`,
    };
  }

  return null;
}
