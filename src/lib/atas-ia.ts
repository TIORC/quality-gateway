/**
 * Atas de Reunião — leitura assistida (Fase 1).
 *
 * Não há chave de LLM configurada no projeto, então a Fase 1 lê o texto da ata
 * de forma determinística (offline), no mesmo padrão de `projetos-ia.ts`:
 * identifica os setores citados (com o trecho) e as frases de compromisso que
 * se tornam ações já endereçadas a um setor. A interface
 * (`LeituraAssistida`) está pronta para, no futuro, trocar o corpo de
 * `gerarLeituraAssistida` por uma chamada server-side a OpenAI/Anthropic sem
 * mudar nenhum consumidor.
 */

export interface SetorCitadoSugerido {
  /** Nome do setor (conforme `public.setores`). */
  setor: string;
  /** Trecho do texto em que o setor é citado. */
  trecho: string;
}

export interface AcaoSugeridaAta {
  /** Trecho da ata que deu origem à ação (preserva a origem). */
  trechoOrigem: string;
  descricao: string;
  /** Setor destino (`null`/vazio quando não foi possível identificar). */
  setorDestino?: string | undefined;
  /** E-mail do responsável, quando identificado. */
  responsavelEmail?: string | undefined;
  /** Prazo no formato `AAAA-MM-DD`, quando identificado. */
  prazo?: string | undefined;
}

export interface LeituraAssistida {
  setoresCitados: SetorCitadoSugerido[];
  acoesSugeridas: AcaoSugeridaAta[];
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Corta um texto respeitando limites de palavra. */
function cortar(s: string, max: number): string {
  const limpo = s.trim().replace(/\s+/g, " ");
  if (limpo.length <= max) return limpo;
  const recorte = limpo.slice(0, max);
  const ultimaEspaco = recorte.lastIndexOf(" ");
  return `${ultimaEspaco > 0 ? recorte.slice(0, ultimaEspaco) : recorte}…`;
}

/** Divide o texto em frases completas (com a pontuação de fechamento). */
function frasesDe(texto: string): string[] {
  const bruto = (texto.match(/[^.!?…]+[.!?…]*/g) ?? []).map((f) => f.trim()).filter(Boolean);
  return bruto.length > 0 ? bruto : [texto.trim()].filter(Boolean);
}

/**
 * Extrai prazos em português de uma frase e devolve `AAAA-MM-DD`:
 * "amanhã", "próxima sexta" (e demais dias), "dia 15"/"até dia 15" e
 * "até/antes de dd/mm(/aaaa)".
 */
function prazoDaFrase(frase: string): string {
  const t = norm(frase);
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (/\bamanha\b/.test(t)) return isoDaData(somarDias(inicioHoje, 1));

  const diaSemana = t.match(
    /proxima\s+(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)/,
  );
  const nomeDia = diaSemana ? diaSemana[1] : undefined;
  const alvo = nomeDia ? DIAS_SEMANA[nomeDia] : undefined;
  if (alvo !== undefined) {
    let diff = (alvo - hoje.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "próxima" nunca é hoje
    return isoDaData(somarDias(inicioHoje, diff));
  }

  const diaDoMes = t.match(/(?:ate\s+)?dia\s+(\d{1,2})/);
  if (diaDoMes) {
    const dia = Number(diaDoMes[1]);
    if (dia >= 1 && dia <= 31) return isoDaData(ocorrenciaDiaDoMes(dia));
  }

  const match = frase.match(
    /(?:até|antes de|vence[^a-z]*em)[^\d]*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i,
  );
  if (!match) return "";
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";
  const data = new Date(ano, mes - 1, dia);
  if (data.getMonth() + 1 !== mes || data.getDate() !== dia) return "";
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
}

function isoDaData(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
}

/** Soma dias a partir de uma data (seguro contra ajustes de horário). */
function somarDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

/**
 * Primeira ocorrência de um dia do mês (1–31) igual ou após hoje. Se o mês não
 * tiver o dia (ex.: 31 em mês de 30), usa o último dia desse mês.
 */
function ocorrenciaDiaDoMes(dia: number): Date {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let candidato = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (candidato.getDate() !== dia) candidato = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  if (candidato < inicioHoje) {
    let proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
    if (proximo.getDate() !== dia) proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
    return proximo;
  }
  return candidato;
}

/** Verbos e marcadores de compromisso que caracterizam uma ação na ata. */
const MARCADORES_ACAO =
  /(vamos|iremos|será feito|será realizada|será responsável|ficará responsável|deverá|deverão|deve ser|precisa ser|precisamos|providenciar|elaborar|enviar|entregar|levantar|implementar|implantar|definir|revisar|adequar|monitorar|treinar|padronizar|agendar|apresentar|encaminhar|planejar|corrigir|verificar|atualizar|cobrar|validar|garantir|avaliar|estabelecer|a ser definid|daremos andamento|dar andamento|amanh[aã]|pr[oó]xima\s+(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)|dia\s+\d{1,2}|até\s+\d{1,2}\/\d{1,2})/i;

/** Nome normalizado do dia da semana -> `getDay()` (0 = domingo). */
const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
};

/**
 * Lê o texto da ata e devolve setores citados (com trecho) e ações sugeridas,
 * determinístico e offline (sem chamada a LLM nesta fase).
 */
export function gerarLeituraAssistida(texto: string, setores: string[]): LeituraAssistida {
  const nomes = [...setores].map((s) => s.trim()).filter(Boolean);
  const ordenados = nomes.sort((a, b) => norm(b).length - norm(a).length);
  const frases = frasesDe(texto);

  const citados: SetorCitadoSugerido[] = [];
  const vistosSetor = new Set<string>();
  const vistosAcao = new Set<string>();
  const acoes: AcaoSugeridaAta[] = [];

  for (const frase of frases) {
    const normal = norm(frase);
    let setorDaFrase = "";
    for (const nome of ordenados) {
      if (vistosSetor.has(norm(nome))) continue;
      if (normal.includes(norm(nome))) {
        citados.push({ setor: nome, trecho: cortar(frase, 240) });
        vistosSetor.add(norm(nome));
        setorDaFrase = nome;
        break;
      }
    }
    if (!MARCADORES_ACAO.test(frase)) continue;
    const chave = norm(frase);
    if (vistosAcao.has(chave)) continue;
    vistosAcao.add(chave);
    const prazo = prazoDaFrase(frase);
    acoes.push({
      trechoOrigem: cortar(frase, 240),
      descricao: cortar(frase, 300),
      setorDestino: setorDaFrase,
      prazo: prazo || undefined,
    });
  }

  return { setoresCitados: citados.slice(0, 12), acoesSugeridas: acoes.slice(0, 12) };
}

/** Texto do prompt pronto para uso futuro com LLM (OpenAI/Anthropic). */
export function promptLeituraAssistida(
  ata: Pick<{ titulo: string; texto: string }, "titulo" | "texto">,
  setores: string[],
): string {
  const lista = setores.length ? setores.map((s) => `- ${s}`).join("\n") : "- (nenhum cadastrado)";
  return [
    `Você é um secretário de reuniões. Ata "${ata.titulo}".`,
    `Texto da ata:\n${ata.texto}`,
    `Setores cadastrados:\n${lista}`,
    `Extraia do texto: 1) os setores citados (com o trecho); 2) as ações/compromissos, cada um com trecho de origem, descrição, setor destino, responsável e prazo, quando existirem.`,
    `Responda em JSON: {setoresCitados: [{setor, trecho}], acoes: [{trechoOrigem, descricao, setorDestino, responsavel, prazo}], maximo 12 acoes}.`,
  ].join("\n");
}
