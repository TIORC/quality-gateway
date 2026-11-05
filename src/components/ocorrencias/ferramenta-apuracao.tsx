/**
 * Ferramenta de apuração da etapa de Apuração: Análise direta, 5 Porquês e
 * Ishikawa (6M). A Qualidade (e o Desenvolvedor do Sistema) edita; os demais
 * veem somente leitura quando têm acesso aos detalhes internos.
 */
import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import {
  CAUSAS_ISHIKAWA_MAX,
  CHAVE_FERRAMENTA_APURACAO,
  FERRAMENTAS_APURACAO,
  FERRAMENTA_APURACAO_LABELS,
  ISHIKAWA_CATEGORIAS,
  LIMITE_TEXTO_OCORRENCIA,
  apuracaoFerramentasDe,
  causaRaizDaApuracao,
  type ApuracaoFerramentas,
  type FerramentaApuracao,
  type IshikawaApuracao,
  type Ocorrencia,
} from "@/lib/ocorrencias";
import { RESULTADOS_APURACAO_CHAVE } from "@/lib/ocorrencias-crud";

interface FerramentaApuracaoProps {
  ocorrencia: Ocorrencia;
  /** Quando false, a tela é somente leitura (sem salvar). */
  editavel: boolean;
  salvando: boolean;
  onSalvar: (apuracao: ApuracaoFerramentas) => Promise<void>;
}

const POR_QUE_LABELS = ["Por quê 1", "Por quê 2", "Por quê 3", "Por quê 4"];

export function FerramentaApuracao({
  ocorrencia,
  editavel,
  salvando,
  onSalvar,
}: FerramentaApuracaoProps) {
  const [draft, setDraft] = useState<ApuracaoFerramentas>(() => {
    const salva = apuracaoFerramentasDe(ocorrencia);
    // Apurações feitas antes desta ferramenta: o texto antigo vira a análise direta.
    const legado = (ocorrencia.respostas[RESULTADOS_APURACAO_CHAVE] as { texto?: string } | undefined)
      ?.texto;
    const semSalvo = !ocorrencia.respostas[CHAVE_FERRAMENTA_APURACAO];
    if (semSalvo && legado) {
      return { ...salva, analiseDireta: { ...salva.analiseDireta, texto: legado } };
    }
    return salva;
  });

  const causa = causaRaizDaApuracao(draft);
  const podeSalvar = editavel && !salvando && causa.trim().length > 0;

  function setCausaRaiz(valor: string) {
    setDraft((d) => {
      if (d.metodo === "cinco_porques") return { ...d, cincoPorques: { ...d.cincoPorques, causaRaiz: valor } };
      if (d.metodo === "ishikawa") return { ...d, ishikawa: { ...d.ishikawa, causaRaiz: valor } };
      return { ...d, analiseDireta: { ...d.analiseDireta, causaRaiz: valor } };
    });
  }

  const campoLimite = (texto: string) => (
    <p className="mt-1 text-right text-[11px] text-[#64748B]">
      {texto.length}/{LIMITE_TEXTO_OCORRENCIA}
    </p>
  );

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ferramenta de apuração">
        {FERRAMENTAS_APURACAO.map((m: FerramentaApuracao) => {
          const ativa = draft.metodo === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setDraft((d) => ({ ...d, metodo: m }))}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                ativa
                  ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                  : "border-[#D9E0EA] bg-white text-[#475569] hover:bg-[#F1F5F9]"
              }`}
            >
              {FERRAMENTA_APURACAO_LABELS[m]}
            </button>
          );
        })}
      </div>

      {draft.metodo === "analise_direta" && (
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-[12px]">Análise</Label>
            <Textarea
              className="mt-1 min-h-[120px]"
              maxLength={LIMITE_TEXTO_OCORRENCIA}
              placeholder="Descreva a análise feita sobre a ocorrência…"
              value={draft.analiseDireta.texto}
              disabled={!editavel}
              onChange={(e) =>
                setDraft((d) => ({ ...d, analiseDireta: { ...d.analiseDireta, texto: e.target.value } }))
              }
            />
            {campoLimite(draft.analiseDireta.texto)}
          </div>
          <CausaRaizCampo valor={draft.analiseDireta.causaRaiz} editavel={editavel} onChange={setCausaRaiz} />
        </div>
      )}

      {draft.metodo === "cinco_porques" && (
        <div className="mt-4 space-y-2">
          {draft.cincoPorques.porques.map((valor, i) => (
            <LinhaPorque
              key={i}
              rotulo={POR_QUE_LABELS[i] ?? `Por quê ${i + 1}`}
              valor={valor}
              editavel={editavel}
              onChange={(v) =>
                setDraft((d) => {
                  const porques = [...d.cincoPorques.porques];
                  porques[i] = v;
                  return { ...d, cincoPorques: { ...d.cincoPorques, porques } };
                })
              }
            />
          ))}
          <LinhaPorque
            rotulo="Causa raiz"
            destaque
            valor={draft.cincoPorques.causaRaiz}
            editavel={editavel}
            onChange={setCausaRaiz}
          />
        </div>
      )}

      {draft.metodo === "ishikawa" && (
        <div className="mt-4 space-y-3">
          <p className="text-[12px] text-[#64748B]">
            Edite direto no diagrama: nomes das categorias, causas (até {CAUSAS_ISHIKAWA_MAX} por
            categoria) e o efeito.
          </p>
          <DiagramaIshikawa
            valor={draft.ishikawa}
            editavel={editavel}
            onChange={(ishikawa: IshikawaApuracao) => setDraft((d) => ({ ...d, ishikawa }))}
          />
          <CausaRaizCampo valor={draft.ishikawa.causaRaiz} editavel={editavel} onChange={setCausaRaiz} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#64748B]">
          {draft.salvoEm
            ? `Último salvamento: ${draft.salvoPorNome || "—"} · ${formatarDataHoraBrasilia(draft.salvoEm)}`
            : "Ainda não salvo."}
          {!editavel && " Somente a Qualidade pode editar."}
        </p>
        {editavel && (
          <Button
            type="button"
            size="sm"
            disabled={!podeSalvar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            onClick={() => void onSalvar(draft)}
          >
            {salvando ? "Salvando…" : "Salvar apuração"}
          </Button>
        )}
      </div>
    </div>
  );
}

function LinhaPorque({
  rotulo,
  valor,
  editavel,
  destaque,
  onChange,
}: {
  rotulo: string;
  valor: string;
  editavel: boolean;
  destaque?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]">
      <span className="text-[13px] font-semibold text-[#B45309]">
        {rotulo}
      </span>
      <Input
        maxLength={LIMITE_TEXTO_OCORRENCIA}
        value={valor}
        disabled={!editavel}
        className={destaque ? "border-[#B45309]/50" : undefined}
        placeholder={destaque ? "Qual é a causa raiz?" : "Por que isso aconteceu?"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Diagrama de Ishikawa (6M) editável                                          */
/* -------------------------------------------------------------------------- */

/** Coordenadas do desenho (viewBox). Caixas, causas e efeito são campos posicionados sobre o SVG. */
const VB_W = 720;
const VB_H = 420;
const Y_ESPINHA = 210;
/** Centro horizontal de cada coluna de categorias (três em cima, três embaixo). */
const COLUNAS_X = [220, 400, 575];
/** Posição de cada causa ao longo da espinha (0 = na categoria, 1 = na espinha). */
const POSICOES_CAUSA = [0.22, 0.42, 0.62, 0.82];
const COR = "#1E3A8A";

/** Textos longos do problema diminuem a fonte para continuar cabendo na cabeça do peixe. */
function tamanhoFonteProblema(texto: string): string {
  if (texto.length <= 20) return "12px";
  if (texto.length <= 36) return "10.5px";
  return "9px";
}

/*
 * Cores do diagrama vão inline: o tema escuro do app sobrescreve as classes
 * de fundo e de texto dos campos, e as causas ficavam invisíveis.
 */
const ESTILO_CAMPO_CAUSA: CSSProperties = {
  backgroundColor: "#FFFFFF",
  color: "#1E3A8A",
  borderColor: "#93C5FD",
};
const ESTILO_BOTAO_ADICIONAR: CSSProperties = {
  backgroundColor: "#FFFFFF",
  color: "#1E40AF",
  borderColor: "#1E40AF",
};

type Categoria = (typeof ISHIKAWA_CATEGORIAS)[number];

/** Posiciona um elemento em coordenadas do viewBox (em percentual do contêiner). */
function caixa(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    position: "absolute",
    left: `${(x / VB_W) * 100}%`,
    top: `${(y / VB_H) * 100}%`,
    width: `${(w / VB_W) * 100}%`,
    height: `${(h / VB_H) * 100}%`,
  };
}

function DiagramaIshikawa({
  valor,
  editavel,
  onChange,
}: {
  valor: IshikawaApuracao;
  editavel: boolean;
  onChange: (v: IshikawaApuracao) => void;
}) {
  const causasDe = (id: string) => valor.causas[id] ?? [];
  const setCausas = (id: string, lista: string[]) =>
    onChange({ ...valor, causas: { ...valor.causas, [id]: lista } });

  const topo = ISHIKAWA_CATEGORIAS.filter((c) => c.lado === "topo");
  const base = ISHIKAWA_CATEGORIAS.filter((c) => c.lado === "base");

  /** Linha da espinha que liga a categoria à espinha dorsal (desenho). */
  const espinhaSvg = (c: Categoria, cx: number) => {
    const yInicio = c.lado === "topo" ? 62 : 362;
    return (
      <line
        key={c.id}
        x1={cx - 30}
        y1={yInicio}
        x2={cx + 30}
        y2={Y_ESPINHA}
        stroke={COR}
        strokeWidth={2.5}
      />
    );
  };

  /** Campos sobre a espinha: nome da categoria e causas, com botão de adicionar. */
  const camposDoRamo = (c: Categoria, cx: number) => {
    const topoDoRamo = c.lado === "topo";
    const yCaixa = topoDoRamo ? 28 : 362;
    const yInicio = topoDoRamo ? 62 : 362;
    const ponto = (t: number) => ({
      x: cx - 30 + t * 60,
      y: yInicio + t * (Y_ESPINHA - yInicio),
    });
    const lista = causasDe(c.id);
    const podeAdicionar = editavel && lista.length < CAUSAS_ISHIKAWA_MAX;

    return (
      <div key={c.id}>
        <input
          aria-label={`Nome da categoria ${c.padrao}`}
          style={{ ...caixa(cx - 75, yCaixa, 150, 34), backgroundColor: COR, color: "#FFFFFF" }}
          className="rounded px-2 text-center text-[13px] font-semibold outline-none placeholder:text-white/60 focus:ring-2 focus:ring-[#93C5FD] disabled:opacity-100"
          value={valor.rotulos[c.id] ?? c.padrao}
          maxLength={40}
          disabled={!editavel}
          onChange={(e) => onChange({ ...valor, rotulos: { ...valor.rotulos, [c.id]: e.target.value } })}
        />

        {lista.map((texto, i) => {
          const { x, y } = ponto(POSICOES_CAUSA[i] ?? 0.5);
          return (
            <div key={i} style={caixa(x - 130, y - 11, 120, 22)} className="flex">
              <input
                aria-label={`Causa ${i + 1} de ${c.padrao}`}
                style={ESTILO_CAMPO_CAUSA}
                value={texto}
                placeholder="Causa"
                maxLength={160}
                disabled={!editavel}
                onChange={(e) =>
                  setCausas(
                    c.id,
                    lista.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
                className="min-w-0 flex-1 rounded-l border border-r-0 border-[#93C5FD] bg-white px-1 text-[11px] text-[#1E40AF] outline-none focus:ring-1 focus:ring-[#1E3A8A] disabled:bg-[#F8FAFC]"
              />
              {editavel && (
                <button
                  type="button"
                  aria-label="Remover causa"
                  style={{ backgroundColor: "#FFFFFF", color: "#64748B", borderColor: "#93C5FD" }}
                  onClick={() => setCausas(c.id, lista.filter((_, j) => j !== i))}
                  className="w-5 rounded-r border border-[#93C5FD] bg-white text-[12px] leading-none text-[#64748B] hover:text-[#E11D48]"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {podeAdicionar && (() => {
          const { x, y } = ponto(POSICOES_CAUSA[lista.length] ?? 0.5);
          return (
            <button
              type="button"
              onClick={() => setCausas(c.id, [...lista, ""])}
              style={{ ...caixa(x - 90, y - 11, 80, 22), ...ESTILO_BOTAO_ADICIONAR }}
              className="rounded border border-dashed border-[#1E40AF] text-[11px] text-[#1E40AF] hover:bg-[#EFF6FF]"
            >
              + Causa
            </button>
          );
        })()}
      </div>
    );
  };

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[#D9E0EA] p-2"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <div
        className="relative mx-auto w-full min-w-[640px]"
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {topo.map((c, i) => espinhaSvg(c, COLUNAS_X[i] ?? 0))}
          {base.map((c, i) => espinhaSvg(c, COLUNAS_X[i] ?? 0))}
          {/* Espinha dorsal, cauda e cabeça (efeito). */}
          <line x1={30} y1={Y_ESPINHA} x2={600} y2={Y_ESPINHA} stroke={COR} strokeWidth={6} />
          <polygon points="18,170 84,210 18,250" fill={COR} />
          <polygon
            points="596,70 712,210 596,350"
            fill={COR}
            stroke={COR}
            strokeWidth={16}
            strokeLinejoin="round"
          />
        </svg>

        {topo.map((c, i) => camposDoRamo(c, COLUNAS_X[i] ?? 0))}
        {base.map((c, i) => camposDoRamo(c, COLUNAS_X[i] ?? 0))}

        <textarea
          aria-label="Problema"
          style={{
            ...caixa(612, 180, 72, 60),
            backgroundColor: COR,
            color: "#FFFFFF",
            fontSize: tamanhoFonteProblema(valor.efeito),
            lineHeight: 1.15,
          }}
          className="resize-none overflow-hidden rounded-md p-1 text-center font-semibold outline-none placeholder:text-white/70 focus:ring-2 focus:ring-[#93C5FD] disabled:opacity-100"
          value={valor.efeito}
          placeholder="Problema"
          maxLength={50}
          rows={3}
          disabled={!editavel}
          onChange={(e) => onChange({ ...valor, efeito: e.target.value })}
        />
      </div>
    </div>
  );
}

function CausaRaizCampo({
  valor,
  editavel,
  onChange,
}: {
  valor: string;
  editavel: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-[12px]">Causa raiz</Label>
      <Input
        className="mt-1 border-[#B45309]/50"
        maxLength={LIMITE_TEXTO_OCORRENCIA}
        value={valor}
        disabled={!editavel}
        placeholder="Qual é a causa raiz?"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
