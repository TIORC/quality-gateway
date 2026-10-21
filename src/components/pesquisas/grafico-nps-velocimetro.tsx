import { motion } from "framer-motion";
import { formatarNps, ZONAS_NPS, zonaDoNps, type ApuracaoNps } from "@/lib/nps";

type TipoRosto = "triste" | "neutro" | "feliz" | "radiante";

/** Rosto de cada zona, na mesma ordem de `ZONAS_NPS`. */
const ROSTOS_DAS_ZONAS: TipoRosto[] = ["triste", "neutro", "feliz", "radiante"];

const ZONAS = ZONAS_NPS;

const CENTRO_X = 200;
const CENTRO_Y = 180;
const RAIO_EXTERNO = 130;
const RAIO_INTERNO = 80;
const RAIO_ROTULO = 160;
const RAIO_ROSTO = 105;
const COMPRIMENTO_AGULHA = 112;

/** NPS −100 fica à esquerda (180°) e NPS 100 à direita (0°). */
function angulo(valor: number) {
  return 180 - ((valor + 100) / 200) * 180;
}

function ponto(raio: number, graus: number) {
  const radianos = (graus * Math.PI) / 180;
  return { x: CENTRO_X + raio * Math.cos(radianos), y: CENTRO_Y - raio * Math.sin(radianos) };
}

/** Setor de uma zona. O raio externo é separado para o efeito de hover poder aumentá-lo. */
function caminhoDoSetor(minimo: number, maximo: number, raioExterno = RAIO_EXTERNO) {
  const inicio = angulo(minimo);
  const fim = angulo(maximo);
  const externoInicio = ponto(raioExterno, inicio);
  const externoFim = ponto(raioExterno, fim);
  const internoFim = ponto(RAIO_INTERNO, fim);
  const internoInicio = ponto(RAIO_INTERNO, inicio);
  return [
    `M ${externoInicio.x} ${externoInicio.y}`,
    `A ${raioExterno} ${raioExterno} 0 0 1 ${externoFim.x} ${externoFim.y}`,
    `L ${internoFim.x} ${internoFim.y}`,
    `A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 0 0 ${internoInicio.x} ${internoInicio.y}`,
    "Z",
  ].join(" ");
}

const CORES_ROSTO: Record<TipoRosto, string> = {
  triste: "#E5483B",
  neutro: "#F5B731",
  feliz: "#2FB47C",
  radiante: "#2FB47C",
};

const BOCAS_ROSTO: Record<TipoRosto, string> = {
  triste: "M -5 6 Q 0 2 5 6",
  neutro: "M -5 5 L 5 5",
  feliz: "M -5 3 Q 0 9 5 3",
  radiante: "M -6 3 Q 0 12 6 3 Z",
};

/** Rosto dentro de um círculo colorido. Um pulso suave, com atraso para não bater todos juntos. */
function Rosto({ tipo, x, y, atraso }: { tipo: TipoRosto; x: number; y: number; atraso: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: atraso }}
      >
        <circle r="13" fill={CORES_ROSTO[tipo]} stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="-4.5" cy="-3" r="1.8" fill="#1F2937" />
        <circle cx="4.5" cy="-3" r="1.8" fill="#1F2937" />
        <path
          d={BOCAS_ROSTO[tipo]}
          fill={tipo === "radiante" ? "#1F2937" : "none"}
          stroke="#1F2937"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </g>
  );
}

/** Velocímetro do NPS geral: a agulha aponta para o score de todas as respostas. */
export function GraficoNpsVelocimetro({ apuracao }: { apuracao: ApuracaoNps }) {
  const score = apuracao.score;
  // Sem dados, a agulha fica na extrema esquerda e invisível. Com dados, sobe até o score.
  const rotacaoAgulha = 90 - angulo(score ?? -100);
  const zona = zonaDoNps(score);

  return (
    <div className="grid gap-3">
      <svg
        viewBox="0 0 400 225"
        className="mx-auto w-full max-w-2xl"
        role="img"
        aria-label={`Velocímetro do NPS geral: ${formatarNps(score)}`}
      >
        {/* Ao passar o mouse, a zona cresce para fora e a borda aparece na cor dela. */}
        {ZONAS.map((z) => (
          <motion.path
            key={z.rotulo}
            d={caminhoDoSetor(z.minimo, z.maximo)}
            fill={z.cor}
            stroke={z.cor}
            strokeWidth={0}
            whileHover={{
              d: caminhoDoSetor(z.minimo, z.maximo, RAIO_EXTERNO + 10),
              strokeWidth: 2,
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        ))}

        {ZONAS.map((z) => {
          const meio = ponto(RAIO_ROTULO, (angulo(z.minimo) + angulo(z.maximo)) / 2);
          return (
            <text
              key={z.rotulo}
              x={meio.x}
              y={meio.y}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#334155"
            >
              {z.rotulo}
            </text>
          );
        })}

        {ZONAS.map((z, indice) => {
          const meio = ponto(RAIO_ROSTO, (angulo(z.minimo) + angulo(z.maximo)) / 2);
          return (
            <Rosto
              key={z.rotulo}
              tipo={ROSTOS_DAS_ZONAS[indice] ?? "neutro"}
              x={meio.x}
              y={meio.y}
              atraso={indice * 0.4}
            />
          );
        })}

        <g transform={`translate(${CENTRO_X} ${CENTRO_Y})`}>
          <motion.path
            d={`M -4 0 L 0 -${COMPRIMENTO_AGULHA} L 4 0 Z`}
            fill="#1E293B"
            style={{ originX: 0.5, originY: 1 }}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: rotacaoAgulha, opacity: score === null ? 0 : 1 }}
            transition={{
              rotate: { duration: 1.8, ease: "easeOut" },
              opacity: { duration: 0.4 },
            }}
          />
        </g>

        <circle cx={CENTRO_X} cy={CENTRO_Y} r="12" fill="#1E293B" />
        <circle cx={CENTRO_X} cy={CENTRO_Y} r="5" fill="#FFFFFF" />

        <text
          x={CENTRO_X}
          y="214"
          textAnchor="middle"
          fontSize={score === null ? 16 : 22}
          fontWeight="700"
          fill={zona?.corTexto ?? "#0F172A"}
        >
          {score === null ? "Nenhuma informação cadastrada" : formatarNps(score)}
        </text>
      </svg>

      <p className="text-center text-sm text-[#64748B]">
        {zona && <span className="font-semibold text-[#0F172A]">{zona.nomeCompleto} · </span>}
        {apuracao.total} {apuracao.total === 1 ? "resposta" : "respostas"}: {apuracao.promotores}{" "}
        {apuracao.promotores === 1 ? "promotor" : "promotores"}, {apuracao.neutros}{" "}
        {apuracao.neutros === 1 ? "neutro" : "neutros"} e {apuracao.detratores}{" "}
        {apuracao.detratores === 1 ? "detrator" : "detratores"}
      </p>
    </div>
  );
}
