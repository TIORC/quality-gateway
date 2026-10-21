import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ModeloPesquisa, RespostaModelo } from "@/lib/pesquisas-modelos";

/** Cabeçalho azul; no modo escuro, azul claro com texto escuro para manter a leitura. */
const CABECALHO =
  "bg-[#2563EB] font-semibold text-white hover:bg-[#2563EB] dark:bg-[#93C5FD] dark:text-[#0F172A] dark:hover:bg-[#93C5FD]";

interface RespostasPesquisaProps {
  modelo: ModeloPesquisa;
  /** Respostas já filtradas pela razão social escolhida na página. */
  respostas: RespostaModelo[];
}

/** Tabela com as respostas de uma pesquisa: uma coluna para cada pergunta dela. */
export function RespostasPesquisa({ modelo, respostas }: RespostasPesquisaProps) {
  if (respostas.length === 0) {
    return <p className="text-sm text-[#64748B]">Nenhuma resposta para esta pesquisa ainda.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[#D4D4D8]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={CABECALHO}>Carimbo de data/hora</TableHead>
            {modelo.perguntas.map((pergunta, indice) => (
              <TableHead key={pergunta.id} className={CABECALHO}>
                {`${indice + 1} - ${pergunta.texto}`}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {respostas.map((resposta) => (
            <TableRow key={resposta.id} className="border-[#E4E4E7]">
              <TableCell className="whitespace-nowrap">
                {new Date(resposta.criadoEm).toLocaleString("pt-BR")}
              </TableCell>
              {modelo.perguntas.map((pergunta) => (
                <TableCell key={pergunta.id} className="min-w-[10rem] whitespace-pre-wrap">
                  {formatarValor(resposta.respostas[pergunta.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatarValor(valor: number | string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor.join(", ") : valor === undefined ? "" : String(valor);
  return texto || "—";
}
