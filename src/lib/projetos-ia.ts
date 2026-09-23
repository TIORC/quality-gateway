/**
 * Projetos e Estratégias — geração de ações por IA (Fase 1).
 *
 * Não há chave de LLM configurada no projeto, então a Fase 1 gera sugestões
 * de forma determinística (offline) a partir da SWOT + objetivo + frentes.
 * A interface (`SugestaoAcao`) já está pronta para, no futuro, trocar o corpo
 * de `gerarSugestoesDeAcoes` por uma chamada server-side a OpenAI/Anthropic
 * sem mudar nenhum consumidor.
 */

import type { FrenteTrabalho, PrioridadeProjeto, ProjetoEstrategico, Swot } from "@/lib/projetos";

export interface SugestaoAcao {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: PrioridadeProjeto;
  frenteId: string;
  frenteNome: string;
  origemSwot: "fraquezas" | "ameacas" | "oportunidades" | "forcas" | "objetivo";
  origemTexto: string;
}

export interface EntradaGeracao {
  objetivo: string;
  swot: Swot;
  frentes: FrenteTrabalho[];
}

function slug(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24) || "acao";
}

function frentePara(item: string, frentes: FrenteTrabalho[]): { id: string; nome: string } {
  const texto = item.toLowerCase();
  const dicaFinanceira = /(custo|financeir|orç|orc|receita|despesa|margem|caixa|preço|preco)/.test(texto);
  const dicaPessoas = /(equipe|pessoa|treina|capacita|clima|turnover|lider|colaborador|contrata)/.test(texto);
  const dicaProcesso = /(processo|fluxo|procedimento|padron|qualidade|auditor|indicador|prazo|entrega)/.test(texto);
  const porNome = frentes.find((f) => {
    const n = f.nome.toLowerCase();
    if (dicaFinanceira && /financ|orc|custo/.test(n)) return true;
    if (dicaPessoas && /pessoa|gente|rh|equipe|talento/.test(n)) return true;
    if (dicaProcesso && /process|opera|qualidade/.test(n)) return true;
    return false;
  });
  const frente = porNome ?? frentes[0];
  return frente ? { id: frente.id, nome: frente.nome } : { id: "", nome: "" };
}

function prioridadePara(origem: SugestaoAcao["origemSwot"]): PrioridadeProjeto {
  if (origem === "ameacas" || origem === "fraquezas") return "Alta";
  if (origem === "oportunidades") return "Média";
  return "Média";
}

const MODELOS_ACAO: { origem: SugestaoAcao["origemSwot"]; verbo: string }[] = [
  { origem: "fraquezas", verbo: "Elaborar plano de correção para" },
  { origem: "ameacas", verbo: "Criar plano de contingência contra" },
  { origem: "oportunidades", verbo: "Aproveitar a oportunidade:" },
  { origem: "forcas", verbo: "Potencializar o ponto forte:" },
];

/** Gera sugestões editáveis/descartáveis a partir da SWOT e do objetivo. */
export function gerarSugestoesDeAcoes(entrada: EntradaGeracao): SugestaoAcao[] {
  const sugestoes: SugestaoAcao[] = [];
  for (const modelo of MODELOS_ACAO) {
    const chave = modelo.origem as keyof Swot;
    const itens = entrada.swot[chave] ?? [];
    for (const item of itens.slice(0, 6)) {
      const frente = frentePara(item, entrada.frentes);
      sugestoes.push({
        id: `${modelo.origem}-${slug(item)}`,
        titulo: `${modelo.verbo} ${item}`.slice(0, 140),
        descricao: `Ação sugerida a partir da SWOT (${modelo.origem}): ${item}. Objetivo do projeto: ${entrada.objetivo || "—"}`,
        prioridade: prioridadePara(modelo.origem),
        frenteId: frente.id,
        frenteNome: frente.nome,
        origemSwot: modelo.origem,
        origemTexto: item,
      });
    }
  }
  if (entrada.objetivo.trim() && sugestoes.length === 0) {
    sugestoes.push({
      id: `objetivo-${slug(entrada.objetivo)}`,
      titulo: `Desdobrar o objetivo: ${entrada.objetivo}`.slice(0, 140),
      descricao: "Quebre o objetivo em entregas mensuráveis com responsável e prazo.",
      prioridade: "Média",
      frenteId: entrada.frentes[0]?.id ?? "",
      frenteNome: entrada.frentes[0]?.nome ?? "",
      origemSwot: "objetivo",
      origemTexto: entrada.objetivo,
    });
  }
  return sugestoes.slice(0, 20);
}

/** Texto do prompt pronto para uso futuro com LLM (OpenAI/Anthropic). */
export function promptGeracao(projeto: Pick<ProjetoEstrategico, "nome" | "objetivo" | "swot" | "frentes">): string {
  const lista = (arr: string[]) => (arr.length ? arr.map((s) => `- ${s}`).join("\n") : "- (não informado)");
  const frentes = projeto.frentes.length ? projeto.frentes.map((f) => `- ${f.nome}`).join("\n") : "- (não informado)";
  return [
    `Você é um consultor de planejamento estratégico. Projeto "${projeto.nome}".`,
    `Objetivo: ${projeto.objetivo || "(não informado)"}`,
    `Forças:\n${lista(projeto.swot.forcas)}`,
    `Fraquezas:\n${lista(projeto.swot.fraquezas)}`,
    `Oportunidades:\n${lista(projeto.swot.oportunidades)}`,
    `Ameaças:\n${lista(projeto.swot.ameacas)}`,
    `Frentes:\n${frentes}`,
    `Sugira até 10 ações no formato JSON [{titulo, descricao, prioridade, frente}].`,
  ].join("\n");
}
