import { useEffect, useState } from "react";
import logoWhite from "@/assets/logo-white.png.asset.json";

const MOTIVATIONAL_PHRASES = [
  "Beba bastante aguá!",
  "Juntos, vamos mais longe!",
  "Seu trabalho faz a diferença.",
  "Trabalhe com propósito, cresça com resultados.",
  "Juntos somos mais fortes.",
  "Honre seu trabalho e ele honrará o seu lar!",
  "Trabalhe com propósito, confie em Deus e siga em frente.",
] as const;

const LOADING_DURATION_MS = 15_000;
const PHRASE_DURATION_MS = 5_000;
const FADE_OUT_MS = 800;

interface LoadingScreenProps {
  /** Invocado quando a tela de loading termina e é removida. */
  onComplete?: () => void;
}

/**
 * Tela de loading exibida enquanto o portal carrega (15s no total).
 *
 * Usa a mesma identidade visual da página de login (gradiente da marca).
 * Frases motivacionais aleatórias são exibidas a cada 5s durante o carregamento.
 *
 * Este intervalo de 15s também pode ser aproveitado para pré-carregar dados da
 * página em segundo plano, por exemplo disparando prefetches do React Query
 * aqui (antes do timer de conclusão).
 */
export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  // Estados iniciais determinísticos (idênticos no servidor e no cliente)
  // para não gerar erro de hidratação. A aleatoriedade só acontece no useEffect.
  const [visible, setVisible] = useState(true);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Escolhe N frases distintas de forma aleatória (15s / 5s por frase = 3).
    const count = LOADING_DURATION_MS / PHRASE_DURATION_MS;
    const selected = [...MOTIVATIONAL_PHRASES];
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = selected[i]!;
      selected[i] = selected[j]!;
      selected[j] = tmp;
    }
    setPhrases(selected.slice(0, count));

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Troca a frase a cada 5s.
    for (let i = 1; i < selected.length; i++) {
      timers.push(
        setTimeout(() => setPhraseIndex(i), i * PHRASE_DURATION_MS),
      );
    }

    // Após 15s: fade-out e desmontagem.
    timers.push(
      setTimeout(() => setVisible(false), LOADING_DURATION_MS),
      setTimeout(() => {
        setDone(true);
        onComplete?.();
      }, LOADING_DURATION_MS + FADE_OUT_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (done) return null;

  const currentPhrase = phrases[phraseIndex];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-brand-gradient fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-brand-glow pointer-events-none absolute inset-0" />

      <div className="relative flex flex-col items-center text-center">
        <img
          src={logoWhite.url}
          alt="Logomarca da empresa"
          className="animate-brand-float h-20 w-20 object-contain"
        />

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-brand-foreground sm:text-2xl">
          Gestão da Qualidade
        </h1>
        <p className="mt-2 text-sm text-brand-muted">Carregando o portal…</p>

        <div className="mt-10 flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="animate-spin absolute inset-0 rounded-full border-2 border-transparent border-t-brand-foreground" />
          </div>
          <span className="text-xs uppercase tracking-[0.25em] text-brand-muted">
            Carregando
          </span>
        </div>

        <div className="mt-14 flex min-h-24 max-w-md items-center justify-center">
          {currentPhrase ? (
            <p
              key={phraseIndex}
              className="animate-brand-phrase text-lg font-medium italic leading-relaxed text-brand-foreground sm:text-xl"
            >
              “{currentPhrase}”
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {phrases.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                i <= phraseIndex ? "bg-brand-foreground" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 w-full bg-white/10">
        <div
          className="h-full w-full origin-left bg-brand-foreground/80"
          style={{
            animation: `brand-progress ${LOADING_DURATION_MS}ms linear both`,
          }}
        />
      </div>
    </div>
  );
}