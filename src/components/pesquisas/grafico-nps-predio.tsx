import { useId } from "react";
import { GRUPOS_NPS, type ApuracaoNps } from "@/lib/nps";

const LARGURA_PREDIO = 72;
const ALTURA_MAXIMA = 140;
const LINHA_DE_BASE = 180;
const ESPACO_ENTRE_PREDIOS = 114;
const CENTRO_PRIMEIRO_PREDIO = 56;

/** Um prédio por grupo do NPS. A altura de cada um é proporcional ao número de votos. */
export function GraficoNpsPredio({ apuracao }: { apuracao: ApuracaoNps }) {
  const idJanelas = useId();
  const maximo = Math.max(apuracao.detratores, apuracao.neutros, apuracao.promotores);

  return (
    <svg
      viewBox="0 0 340 230"
      className="mx-auto w-full max-w-sm"
      role="img"
      aria-label="Gráfico de prédios do NPS: detratores, neutros e promotores"
    >
      <defs>
        <pattern id={idJanelas} width="18" height="18" patternUnits="userSpaceOnUse">
          <rect x="4" y="4" width="8" height="8" rx="1" fill="#FFFFFF" fillOpacity="0.75" />
        </pattern>
      </defs>

      <line x1="10" x2="330" y1={LINHA_DE_BASE} y2={LINHA_DE_BASE} stroke="#CBD5E1" />

      {GRUPOS_NPS.map((grupo, indice) => {
        const votos = apuracao[grupo.chave];
        const altura = maximo ? (votos / maximo) * ALTURA_MAXIMA : 0;
        const centro = CENTRO_PRIMEIRO_PREDIO + indice * ESPACO_ENTRE_PREDIOS;
        const x = centro - LARGURA_PREDIO / 2;
        const topo = LINHA_DE_BASE - altura;

        return (
          <g key={grupo.chave}>
            <rect x={x} y={topo} width={LARGURA_PREDIO} height={altura} fill={grupo.cor} />
            <rect
              x={x}
              y={topo}
              width={LARGURA_PREDIO}
              height={altura}
              fill={`url(#${idJanelas})`}
            />
            {votos > 0 && (
              <rect
                x={x - 4}
                y={topo - 6}
                width={LARGURA_PREDIO + 8}
                height={6}
                rx="1"
                fill="#1E293B"
              />
            )}
            <text
              x={centro}
              y={topo - 12}
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#0F172A"
            >
              {votos}
            </text>
            <text
              x={centro}
              y={205}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#0F172A"
            >
              {grupo.rotulo}
            </text>
            <text x={centro} y={221} textAnchor="middle" fontSize="11" fill="#64748B">
              {grupo.faixa}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
