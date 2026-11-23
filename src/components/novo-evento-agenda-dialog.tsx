/**
 * "Alimentar Agenda" — cadastro de evento avulso, com pessoas marcadas por @.
 *
 * Ao digitar "@" na descrição, sugere colaboradores. Ao escolher um nome, o
 * texto recebe "@Nome" e a pessoa entra na lista de convidados.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserSession } from "@/lib/auth";
import type { UsuarioRef } from "@/lib/atas";
import { atualizarAgendaEvento, criarAgendaEvento, type AgendaEvento } from "@/lib/agenda-eventos";
import type { UsuarioAtaRow } from "@/lib/atas-base";
import { traduzErro } from "@/lib/organizacao";

const LIMITE_SUGESTOES = 6;

/** Minúsculas e sem acento, para casar "joao" com "João". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Acha o "@termo" logo antes do cursor, se o cursor estiver dentro de uma menção. */
function detectarMencao(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const antes = texto.slice(0, cursor);
  const achado = /(^|\s)@([^\s@]*)$/.exec(antes);
  if (!achado) return null;
  const termo = achado[2] ?? "";
  return { inicio: cursor - termo.length - 1, termo };
}

export interface NovoEventoAgendaDialogProps {
  aberto: boolean;
  /** Data sugerida no formulário (`AAAA-MM-DD`), normalmente o dia selecionado. */
  dataPadrao: string;
  pessoas: UsuarioAtaRow[];
  sessao: UserSession | null;
  /** Evento a editar. Sem ele, o formulário cria um evento novo. */
  evento?: AgendaEvento | null;
  onFechar: () => void;
  onSalvo: (evento: AgendaEvento) => void;
}

export function NovoEventoAgendaDialog({
  aberto,
  dataPadrao,
  pessoas,
  sessao,
  evento = null,
  onFechar,
  onSalvo,
}: NovoEventoAgendaDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(dataPadrao);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [descricao, setDescricao] = useState("");
  const [convidados, setConvidados] = useState<UsuarioRef[]>([]);
  const [mencao, setMencao] = useState<{ inicio: number; termo: string } | null>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Cada abertura começa com o formulário limpo (ou com os dados do evento a editar).
  useEffect(() => {
    if (!aberto) return;
    setTitulo(evento?.titulo ?? "");
    setData(evento?.dataEvento ?? dataPadrao);
    setHoraInicio(evento?.horaInicio ?? "");
    setHoraFim(evento?.horaFim ?? "");
    setDescricao(evento?.descricao ?? "");
    setConvidados(evento?.convidados ?? []);
    setMencao(null);
    setIndiceAtivo(0);
  }, [aberto, dataPadrao, evento]);

  const sugestoes = useMemo(() => {
    if (!mencao) return [];
    const termo = normalizar(mencao.termo);
    const jaConvidados = new Set(convidados.map((pessoa) => pessoa.id));
    return pessoas
      .filter(
        (pessoa) =>
          pessoa.id &&
          pessoa.nome.trim() &&
          !jaConvidados.has(pessoa.id) &&
          normalizar(pessoa.nome).includes(termo),
      )
      .slice(0, LIMITE_SUGESTOES);
  }, [mencao, pessoas, convidados]);

  function aoDigitarDescricao(valor: string, cursor: number) {
    setDescricao(valor);
    setMencao(detectarMencao(valor, cursor));
    setIndiceAtivo(0);
  }

  function escolherPessoa(pessoa: UsuarioAtaRow) {
    if (!mencao) return;
    const cursor = areaRef.current?.selectionStart ?? descricao.length;
    const trecho = `@${pessoa.nome} `;
    const novo = descricao.slice(0, mencao.inicio) + trecho + descricao.slice(cursor);
    const posicao = mencao.inicio + trecho.length;
    setDescricao(novo);
    setConvidados((lista) => [...lista, { id: pessoa.id, nome: pessoa.nome.trim() }]);
    setMencao(null);
    requestAnimationFrame(() => {
      areaRef.current?.focus();
      areaRef.current?.setSelectionRange(posicao, posicao);
    });
  }

  function removerConvidado(id: string) {
    setConvidados((lista) => lista.filter((pessoa) => pessoa.id !== id));
  }

  function aoTeclarNaDescricao(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mencao || sugestoes.length === 0) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((atual) => (atual + 1) % sugestoes.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((atual) => (atual - 1 + sugestoes.length) % sugestoes.length);
    } else if (evento.key === "Enter" || evento.key === "Tab") {
      evento.preventDefault();
      const escolhida = sugestoes[indiceAtivo] ?? sugestoes[0];
      if (escolhida) escolherPessoa(escolhida);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      setMencao(null);
    }
  }

  async function salvar() {
    if (salvando) return;
    if (horaFim && !horaInicio) {
      toast.error("Informe o horário de início para definir o término.");
      return;
    }
    setSalvando(true);
    try {
      const entrada = {
        titulo,
        dataEvento: data,
        horaInicio: horaInicio || null,
        horaFim: horaFim || null,
        descricao,
        convidados,
      };
      if (evento) {
        const atualizado = await atualizarAgendaEvento(evento.id, entrada, sessao);
        toast.success("Evento atualizado");
        onSalvo(atualizado);
      } else {
        const criado = await criarAgendaEvento(entrada, sessao);
        toast.success("Evento adicionado à agenda");
        onSalvo(criado);
      }
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Alimentar Agenda"}</DialogTitle>
          <DialogDescription>
            {evento
              ? "Altere os dados do evento. As pessoas marcadas com @ são os convidados."
              : "Cadastre um evento na agenda e marque as pessoas com @."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="evento-titulo" className="text-[12px] font-semibold text-[#334155]">
              Título
            </label>
            <Input
              id="evento-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisão do plano de ação"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="evento-data" className="text-[12px] font-semibold text-[#334155]">
                Data
              </label>
              <Input
                id="evento-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="evento-inicio" className="text-[12px] font-semibold text-[#334155]">
                Início
              </label>
              <Input
                id="evento-inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="evento-fim" className="text-[12px] font-semibold text-[#334155]">
                Término
              </label>
              <Input
                id="evento-fim"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-[#94A3B8]">
            Sem horário, o evento aparece como dia inteiro.
          </p>

          <div className="relative space-y-1.5">
            <label htmlFor="evento-descricao" className="text-[12px] font-semibold text-[#334155]">
              Descrição
            </label>
            <Textarea
              id="evento-descricao"
              ref={areaRef}
              value={descricao}
              onChange={(e) => aoDigitarDescricao(e.target.value, e.target.selectionStart ?? 0)}
              onKeyDown={aoTeclarNaDescricao}
              onClick={(e) => setMencao(detectarMencao(descricao, e.currentTarget.selectionStart))}
              placeholder="Pauta, local ou observações. Digite @ para marcar uma pessoa."
              className="min-h-[88px]"
            />

            {mencao && sugestoes.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-[#D9E0EA] bg-white py-1 shadow-lg">
                {sugestoes.map((pessoa, indice) => (
                  <li key={pessoa.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        escolherPessoa(pessoa);
                      }}
                      onMouseEnter={() => setIndiceAtivo(indice)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] ${
                        indice === indiceAtivo ? "bg-[#EFF6FF] text-[#1E3A8A]" : "text-[#334155]"
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[11px] font-semibold text-[#475569]">
                        {pessoa.nome.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate">{pessoa.nome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#334155]">Convidados</p>
            {convidados.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8]">Nenhuma pessoa marcada.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {convidados.map((pessoa) => (
                  <span
                    key={pessoa.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-[#1E3A8A]"
                  >
                    @{pessoa.nome}
                    <button
                      type="button"
                      onClick={() => removerConvidado(pessoa.id)}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[#1E3A8A] hover:bg-[#DBEAFE]"
                      aria-label={`Remover ${pessoa.nome}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : evento ? "Salvar alterações" : "Salvar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
