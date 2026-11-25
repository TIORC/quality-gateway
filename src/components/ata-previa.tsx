/**
 * Prévia da ata ao lado do formulário "Nova Ata de Reunião". Reproduz o modelo
 * "ATA DE REUNIÃO - BASE.docx" (mesma ordem de blocos, tabelas com bordas e
 * faixas cinza), preenchido com o que foi digitado. O papel é sempre branco e
 * preto, independente do tema do sistema, como no Word.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  NOME_DOCUMENTO_PADRAO,
  type ParticipanteDocumento,
  type PautaDocumento,
  type PlanoDocumento,
} from "@/lib/atas";

export type { ParticipanteDocumento, PautaDocumento, PlanoDocumento } from "@/lib/atas";

export interface AtaPreviaProps {
  /** Nome do documento no cabeçalho; vazio usa o padrão da ORCOMA. */
  nomeDocumento: string;
  titulo: string;
  /** Data da reunião no formato `AAAA-MM-DD`. */
  dataReuniao: string;
  areas: string;
  horario: string;
  pauta: PautaDocumento[];
  plano: PlanoDocumento[];
  participantes: ParticipanteDocumento[];
  /** Texto livre da ata, mostrado em "Observações" quando preenchido. */
  texto: string;
  elaboradoPor: string;
  aprovadoPor: string;
  revisao: string;
  /** Data da revisão no formato `AAAA-MM-DD`. */
  dataRevisao: string;
}

const FONTE = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const BORDA = "1px solid #000";
const CINZA = "#D9D9D9";

const celula: CSSProperties = {
  border: BORDA,
  padding: "3px 6px",
  verticalAlign: "top",
  textAlign: "left",
  overflowWrap: "anywhere",
  lineHeight: 1.25,
};

const cabecalho: CSSProperties = {
  ...celula,
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const numero: CSSProperties = { ...celula, textAlign: "center", whiteSpace: "nowrap" };

/** `AAAA-MM-DD` → `DD/MM/AAAA`; vazio quando não houver data válida. */
function dataBrasil(valor: string): string {
  const achado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  return achado ? `${achado[3]}/${achado[2]}/${achado[1]}` : "";
}

/** Tabela com as larguras do modelo, em proporção, com mínimo por coluna. */
function Tabela({ larguras, children }: { larguras: number[]; children: ReactNode }) {
  const soma = larguras.reduce((a, b) => a + b, 0);
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        fontFamily: FONTE,
        fontSize: 12.5,
        color: "#000",
      }}
    >
      <colgroup>
        {larguras.map((w, i) => (
          <col key={i} style={{ width: `max(${((w / soma) * 100).toFixed(2)}%, 44px)` }} />
        ))}
      </colgroup>
      {children}
    </table>
  );
}

function Faixa({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ ...celula, background: CINZA, fontWeight: 700 }}>
        {children}
      </td>
    </tr>
  );
}

export function AtaPrevia({
  nomeDocumento,
  titulo,
  dataReuniao,
  areas,
  horario,
  pauta,
  plano,
  participantes,
  texto,
  elaboradoPor,
  aprovadoPor,
  revisao,
  dataRevisao,
}: AtaPreviaProps) {
  // A prévia mostra exatamente as linhas do formulário: o que for removido some do documento.
  const pautaLinhas = pauta;
  const planoLinhas = plano;
  const participanteLinhas = participantes;
  const observacoes = texto.trim();

  return (
    <article
      aria-label="Prévia do documento da ata"
      style={{
        background: "#FFF",
        color: "#000",
        fontFamily: FONTE,
        width: "100%",
        margin: "0 auto",
        padding: "34px 44px 38px",
        boxShadow: "0 1px 2px rgba(15,23,42,0.10), 0 10px 28px rgba(15,23,42,0.12)",
        boxSizing: "border-box",
      }}
    >
      {/* Cabeçalho: logo + título + página */}
      <Tabela larguras={[2640, 6600, 1320]}>
        <tbody>
          <tr>
            <td style={{ ...celula, border: "none", verticalAlign: "middle" }}>
              <img
                src="/logo-orcoma.png"
                alt="ORCOMA"
                style={{ maxWidth: "100%", height: "auto", display: "block" }}
              />
            </td>
            <td
              style={{
                ...celula,
                border: "none",
                textAlign: "center",
                verticalAlign: "middle",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {nomeDocumento.trim() || NOME_DOCUMENTO_PADRAO}
            </td>
            <td style={{ ...celula, border: "none", textAlign: "right", fontSize: 11 }}>
              Página 1
            </td>
          </tr>
        </tbody>
      </Tabela>

      <div style={{ height: 12 }} />

      {/* Dados da reunião */}
      <Tabela larguras={[4420, 2260, 3980]}>
        <tbody>
          <tr>
            <td colSpan={3} style={{ ...cabecalho }}>
              DADOS DA REUNIÃO
            </td>
          </tr>
          <tr>
            <td style={{ ...celula, fontWeight: 700 }}>
              ÁREAS: <span style={{ fontWeight: 400 }}>{areas.trim()}</span>
            </td>
            <td style={{ ...celula, fontWeight: 700 }}>
              DATA: <span style={{ fontWeight: 400 }}>{dataBrasil(dataReuniao)}</span>
            </td>
            <td style={{ ...celula, fontWeight: 700 }}>
              HORÁRIO: <span style={{ fontWeight: 400 }}>{horario.trim()}</span>
            </td>
          </tr>
          {titulo.trim() ? (
            <tr>
              <td colSpan={3} style={{ ...celula, fontWeight: 700 }}>
                TÍTULO: <span style={{ fontWeight: 400 }}>{titulo.trim()}</span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </Tabela>

      <div style={{ height: 12 }} />

      {/* Pauta */}
      <Tabela larguras={[443, 1100, 1600, 7540]}>
        <tbody>
          <Faixa colSpan={4}>PAUTA DA REUNIÃO</Faixa>
          <tr>
            <td style={cabecalho}>Nº</td>
            <td style={cabecalho}>ÁREA</td>
            <td style={cabecalho}>PAUTA</td>
            <td style={cabecalho}>DESCRIÇÃO</td>
          </tr>
          {pautaLinhas.map((linha, i) => (
            <tr key={i}>
              <td style={{ ...numero, height: 28 }}>{i + 1}</td>
              <td style={celula}>{linha.area}</td>
              <td style={celula}>{linha.pauta}</td>
              <td style={{ ...celula, whiteSpace: "pre-wrap" }}>{linha.descricao}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <div style={{ height: 12 }} />

      {/* Plano de ação */}
      <Tabela larguras={[543, 2100, 4760, 1180, 1160, 940]}>
        <tbody>
          <Faixa colSpan={6}>PLANO DE AÇÃO</Faixa>
          <tr>
            <td style={cabecalho}>Nº</td>
            <td style={cabecalho}>O QUE?</td>
            <td style={cabecalho}>COMO</td>
            <td style={cabecalho}>QUEM</td>
            <td style={cabecalho}>QUANDO</td>
            <td style={cabecalho}>STATUS</td>
          </tr>
          {planoLinhas.map((linha, i) => (
            <tr key={i}>
              <td style={{ ...numero, height: 30 }}>{linha.numero}</td>
              <td style={celula}>{linha.oQue}</td>
              <td style={{ ...celula, whiteSpace: "pre-wrap" }}>{linha.como}</td>
              <td style={celula}>{linha.quem}</td>
              <td style={celula}>{linha.quando}</td>
              <td style={celula}>{linha.status}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>

      <div style={{ height: 12 }} />

      {/* Participantes: nome e cargo; a assinatura fica em branco para assinar no papel */}
      <Tabela larguras={[3980, 1900, 4700]}>
        <tbody>
          <tr>
            <td style={cabecalho}>PARTICIPANTE</td>
            <td style={cabecalho}>CARGO/FUNÇÃO</td>
            <td style={cabecalho}>ASSINATURA</td>
          </tr>
          {participanteLinhas.map((linha, i) => (
            <tr key={i}>
              <td style={{ ...celula, height: 26 }}>{linha.nome}</td>
              <td style={celula}>{linha.cargo}</td>
              <td style={celula} />
            </tr>
          ))}
        </tbody>
      </Tabela>

      {observacoes ? (
        <>
          <div style={{ height: 12 }} />
          <Tabela larguras={[1]}>
            <tbody>
              <Faixa colSpan={1}>OBSERVAÇÕES</Faixa>
              <tr>
                <td style={{ ...celula, whiteSpace: "pre-wrap" }}>{observacoes}</td>
              </tr>
            </tbody>
          </Tabela>
        </>
      ) : null}

      <div style={{ height: 16 }} />

      {/* Rodapé: responsáveis e revisão. Na impressão, fica fixo no pé de cada página. */}
      <div className="ata-rodape">
        <Tabela larguras={[3480, 3480, 3700]}>
          <tbody>
            <tr>
              <td style={{ ...celula, border: "none" }}>
                <b>Elaborado por:</b> {elaboradoPor.trim()}
              </td>
              <td style={{ ...celula, border: "none" }}>
                <b>Aprovado por:</b> {aprovadoPor.trim()}
              </td>
              <td style={{ ...celula, border: "none" }}>
                <b>Revisão:</b> {revisao.trim() || "1"} &nbsp; <b>Data:</b>{" "}
                {dataBrasil(dataRevisao)}
              </td>
            </tr>
          </tbody>
        </Tabela>
      </div>
    </article>
  );
}
