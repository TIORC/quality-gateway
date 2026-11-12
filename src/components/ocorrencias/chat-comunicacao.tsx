/**
 * Chat da etapa de Comunicação: quem está envolvido na ocorrência conversa ali
 * (ex.: avisar que ela está no estado final). Cada mensagem mostra o nome de
 * quem escreveu e o setor, como num grupo do WhatsApp.
 *
 * Marcar com @: ao digitar "@", aparece a lista de colaboradores; a pessoa
 * escolhida vira "@Nome" no texto, fica destacada e recebe um aviso.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserSession } from "@/lib/auth";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { traduzErro } from "@/lib/organizacao";
import { normalizarSetor } from "@/lib/niveis-acesso";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import type { EventoOcorrencia, Ocorrencia } from "@/lib/ocorrencias";
import { enviarMensagemComunicacao } from "@/lib/ocorrencias-crud";

interface ChatComunicacaoProps {
  ocorrencia: Ocorrencia;
  /** Setores envolvidos na ocorrência: as pessoas deles são avisadas de cada mensagem. */
  setoresEnvolvidos: string[];
  /** Mensagens do chat, em ordem cronológica. */
  mensagens: EventoOcorrencia[];
  session: UserSession | null;
  /** Só quem está envolvido (ou a Qualidade) escreve, e só enquanto estiver na Comunicação. */
  podeEnviar: boolean;
  onEnviada: () => void;
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function ChatComunicacao({
  ocorrencia,
  setoresEnvolvidos,
  mensagens,
  session,
  podeEnviar,
  onEnviada,
}: ChatComunicacaoProps) {
  const [rascunho, setRascunho] = useState("");
  const [caret, setCaret] = useState(0);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const emailSessao = (session?.email ?? "").toLowerCase();
  const { colaboradores } = useCatalogoOrganizacional();

  // Pessoas que podem ser marcadas: têm nome e e-mail (o aviso precisa do e-mail).
  const pessoas = useMemo(
    () =>
      colaboradores
        .filter((c) => c.nome && c.email)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [colaboradores],
  );

  // Envolvidos: colaboradores dos setores envolvidos + solicitante + responsável + dono da Qualidade.
  const envolvidos = useMemo(() => {
    const setores = new Set(setoresEnvolvidos.map((s) => normalizarSetor(s)));
    const lista: { email: string; nome: string }[] = [];
    for (const p of colaboradores) {
      if (p.email && p.setor && setores.has(normalizarSetor(p.setor))) {
        lista.push({ email: p.email, nome: p.nome });
      }
    }
    const diretos = [
      [ocorrencia.abertaPorEmail, ocorrencia.abertaPorNome],
      [ocorrencia.responsavelEmail, ocorrencia.responsavelNome],
      [ocorrencia.donoQualidadeEmail, ocorrencia.donoQualidadeNome],
    ];
    for (const [email, nome] of diretos) {
      if (email) lista.push({ email, nome: nome || email });
    }
    return lista;
  }, [colaboradores, setoresEnvolvidos, ocorrencia]);

  // Regex dos nomes marcados, para destacar "@Nome" nas mensagens (nomes longos primeiro).
  const regexMencoes = useMemo(() => {
    if (pessoas.length === 0) return null;
    const nomes = pessoas.map((p) => p.nome).sort((a, b) => b.length - a.length);
    return new RegExp(`(@(?:${nomes.map(escaparRegex).join("|")}))`, "g");
  }, [pessoas]);

  // Mantém a última mensagem visível sempre que o chat recebe novidades.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  // "@" seguido de letras logo antes do cursor: abre a lista de pessoas.
  const consulta = useMemo(() => {
    const antes = rascunho.slice(0, caret);
    const m = /@([^\s@]*)$/.exec(antes);
    if (!m) return null;
    return { termo: m[1] ?? "", inicio: antes.length - m[0].length };
  }, [rascunho, caret]);

  const termo = consulta?.termo ?? null;
  const sugestoes = useMemo(
    () =>
      termo === null
        ? []
        : pessoas
            .filter((p) => semAcento(p.nome).includes(semAcento(termo)))
            .slice(0, 6),
    [pessoas, termo],
  );

  useEffect(() => {
    setIndiceAtivo(0);
  }, [termo]);

  function escolherPessoa(nome: string) {
    if (!consulta) return;
    const novo = `${rascunho.slice(0, consulta.inicio)}@${nome} ${rascunho.slice(caret)}`;
    const novoCaret = consulta.inicio + nome.length + 2;
    setRascunho(novo);
    setCaret(novoCaret);
    requestAnimationFrame(() => {
      areaRef.current?.focus();
      areaRef.current?.setSelectionRange(novoCaret, novoCaret);
    });
  }

  async function enviar() {
    const texto = rascunho.trim();
    if (!texto || enviando) return;
    // Quem foi marcado: nomes que aparecem como "@Nome" no texto.
    const mencionados = pessoas
      .filter((p) => p.email && texto.includes(`@${p.nome}`))
      .map((p) => ({ email: p.email ?? "", nome: p.nome }));
    setEnviando(true);
    try {
      await enviarMensagemComunicacao(ocorrencia, texto, session, envolvidos, mencionados);
      setRascunho("");
      setCaret(0);
      onEnviada();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setEnviando(false);
    }
  }

  /** Texto da mensagem com as menções "@Nome" destacadas. */
  function textoComMencoes(texto: string) {
    if (!regexMencoes) return texto;
    return texto.split(regexMencoes).map((parte, i) =>
      i % 2 === 1 ? (
        <span key={i} className="rounded bg-[#FEF3C7] px-0.5 font-semibold text-[#92400E]">
          {parte}
        </span>
      ) : (
        <span key={i}>{parte}</span>
      ),
    );
  }

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Conversa com os envolvidos
      </h3>

      <div className="mt-2 flex max-h-72 min-h-[120px] flex-col gap-2 overflow-y-auto rounded-lg bg-[#F1F5F9] p-3">
        {mensagens.length === 0 ? (
          <p className="m-auto text-center text-[13px] text-[#94A3B8]">
            Nenhuma mensagem ainda. Avise os envolvidos sobre o andamento desta ocorrência.
          </p>
        ) : (
          mensagens.map((m) => {
            const minha = !!emailSessao && m.autorEmail.toLowerCase() === emailSessao;
            return (
              <div
                key={m.id}
                className={`flex w-full ${minha ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                    minha
                      ? "rounded-tr-none bg-[#DBEAFE] text-[#1E3A8A]"
                      : "rounded-tl-none bg-white text-[#1F2937]"
                  }`}
                >
                  <p className="text-[12px] font-semibold">
                    {m.autorNome || "—"}
                    {m.para && (
                      <span className="ml-1.5 font-normal text-[#64748B]">· {m.para}</span>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">
                    {textoComMencoes(m.comentario)}
                  </p>
                  <p className="mt-1 text-right text-[10px] text-[#94A3B8]">
                    {formatarDataHoraBrasilia(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {podeEnviar ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="relative flex-1">
            {sugestoes.length > 0 && (
              <ul
                role="listbox"
                aria-label="Marcar pessoa"
                className="absolute bottom-full left-0 z-10 mb-1 w-full max-w-sm overflow-hidden rounded-lg border border-[#D9E0EA] bg-white shadow-lg"
              >
                {sugestoes.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === indiceAtivo}>
                    <button
                      type="button"
                      // mousedown (e não click) para o campo não perder o foco.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        escolherPessoa(p.nome);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] ${
                        i === indiceAtivo ? "bg-[#EEF2FF]" : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span className="font-medium text-[#1F2937]">{p.nome}</span>
                      <span className="truncate text-[11px] text-[#64748B]">{p.setor}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Textarea
              ref={areaRef}
              className="min-h-[44px] w-full"
              placeholder="Escreva uma mensagem… use @ para marcar alguém"
              value={rascunho}
              onChange={(e) => {
                setRascunho(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onKeyDown={(e) => {
                if (sugestoes.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndiceAtivo((i) => (i + 1) % sugestoes.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndiceAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const escolhida = sugestoes[indiceAtivo];
                    if (escolhida) escolherPessoa(escolhida.nome);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={enviando || !rascunho.trim()}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            onClick={() => void enviar()}
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-[#94A3B8]">
          Ocorrência encerrada: o chat fica somente para leitura.
        </p>
      )}
    </section>
  );
}
