import { useState } from "react";
import {
  AlignLeft,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Hash,
  PenLine,
  Plus,
  Square,
  Trash2,
  Type,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  MAX_TELAS,
  TIPOS_CAMPO,
  TIPO_CAMPO_LABELS,
  idCurto,
  type CampoFormulario,
  type Respostas,
  type TipoCampo,
} from "@/lib/ocorrencias";

/** Ícone de cada tipo de pergunta no menu "Adicionar pergunta". */
const ICONE_TIPO_PERGUNTA: Record<TipoCampo, typeof Plus> = {
  texto: Type,
  textarea: AlignLeft,
  numero: Hash,
  data: CalendarDays,
  select: CircleDot,
  multi: CheckSquare,
  lista: ChevronDown,
  arquivo: Upload,
  assinatura: PenLine,
  responsavel: UserRound,
  checkbox: Check,
};

/** Tipos que têm lista de opções. */
const TIPOS_COM_OPCOES: TipoCampo[] = ["select", "multi", "lista"];

export interface FormBuilderProps {
  campos: CampoFormulario[];
  onChangeCampos: (campos: CampoFormulario[]) => void;
  onPublicar: () => Promise<void> | void;
  publicando?: boolean;
  /** Rótulo do botão principal (ex.: "Salvar campos da etapa" fora do contexto de publicação). */
  salvarLabel?: string;
  /** Texto de apoio sob o botão principal. */
  salvarDica?: string;
  /** Títulos das telas do formulário (ativa as telas quando informado). */
  telas?: string[];
  onChangeTelas?: (telas: string[]) => void;
}

function campoBase(tipo: TipoCampo, tela: number): CampoFormulario {
  return {
    id: idCurto(),
    tipo,
    label: TIPO_CAMPO_LABELS[tipo],
    placeholder: "",
    obrigatorio: false,
    opcoes: TIPOS_COM_OPCOES.includes(tipo) ? ["Opção 1"] : [],
    largura: "inteira",
    condicao: null,
    tela,
  };
}

export function FormBuilder({
  campos,
  onChangeCampos,
  onPublicar,
  publicando,
  salvarLabel,
  salvarDica,
  telas,
  onChangeTelas,
}: FormBuilderProps) {
  const usaTelas = Boolean(telas && onChangeTelas);
  const [telaEdicao, setTelaEdicao] = useState(0);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [respostasPreview, setRespostasPreview] = useState<Respostas>({});

  const listaVisivel = usaTelas ? campos.filter((c) => (c.tela ?? 0) === telaEdicao) : campos;

  function atualizar(id: string, patch: Partial<CampoFormulario>) {
    onChangeCampos(campos.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function adicionar(tipo: TipoCampo) {
    const novo = campoBase(tipo, usaTelas ? telaEdicao : 0);
    onChangeCampos([...campos, novo]);
    setSelecionadoId(novo.id);
  }

  function duplicar(id: string) {
    const origem = campos.find((c) => c.id === id);
    if (!origem) return;
    const novo = { ...origem, id: idCurto() };
    const idx = campos.findIndex((c) => c.id === id);
    const lista = [...campos];
    lista.splice(idx + 1, 0, novo);
    onChangeCampos(lista);
    setSelecionadoId(novo.id);
  }

  function remover(id: string) {
    onChangeCampos(campos.filter((c) => c.id !== id));
    if (selecionadoId === id) setSelecionadoId(null);
  }

  /** Troca a pergunta de posição com a vizinha da mesma tela. */
  function mover(id: string, delta: -1 | 1) {
    const idx = listaVisivel.findIndex((c) => c.id === id);
    const alvo = listaVisivel[idx + delta];
    if (idx < 0 || !alvo) return;
    const a = campos.findIndex((c) => c.id === id);
    const b = campos.findIndex((c) => c.id === alvo.id);
    const lista = [...campos];
    [lista[a], lista[b]] = [lista[b]!, lista[a]!];
    onChangeCampos(lista);
  }

  /* Opções de múltipla escolha, caixas e lista suspensa. */
  function atualizarOpcao(campo: CampoFormulario, indice: number, texto: string) {
    const opcoes = [...(campo.opcoes ?? [])];
    opcoes[indice] = texto;
    atualizar(campo.id, { opcoes });
  }

  function removerOpcao(campo: CampoFormulario, indice: number) {
    atualizar(campo.id, { opcoes: (campo.opcoes ?? []).filter((_, i) => i !== indice) });
  }

  function adicionarOpcao(campo: CampoFormulario) {
    const n = (campo.opcoes ?? []).length + 1;
    atualizar(campo.id, { opcoes: [...(campo.opcoes ?? []), `Opção ${n}`] });
  }

  /* Telas do formulário (até MAX_TELAS). */
  function adicionarTela() {
    if (!telas || !onChangeTelas || telas.length >= MAX_TELAS) return;
    onChangeTelas([...telas, `Tela ${telas.length + 1}`]);
    setTelaEdicao(telas.length);
  }

  function renomearTela(indice: number, titulo: string) {
    if (!telas || !onChangeTelas) return;
    onChangeTelas(telas.map((t, i) => (i === indice ? titulo : t)));
  }

  /** Remove a tela: as perguntas dela passam para a tela anterior. */
  function removerTela(indice: number) {
    if (!telas || !onChangeTelas || telas.length <= 1) return;
    onChangeTelas(telas.filter((_, i) => i !== indice));
    onChangeCampos(
      campos.map((c) => {
        const tela = c.tela ?? 0;
        if (tela === indice) return { ...c, tela: Math.max(0, indice - 1) };
        if (tela > indice) return { ...c, tela: tela - 1 };
        return c;
      }),
    );
    setTelaEdicao(Math.max(0, Math.min(indice, telas.length - 2)));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Barra de telas */}
      {usaTelas && telas ? (
        <div className="flex flex-wrap items-center gap-2">
          {telas.map((titulo, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] ${
                i === telaEdicao
                  ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                  : "border-[#D9E0EA] bg-white text-[#475569]"
              }`}
            >
              <button type="button" onClick={() => setTelaEdicao(i)} className="flex items-center gap-1">
                <input
                  value={titulo}
                  onChange={(e) => renomearTela(i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={40}
                  className="w-24 bg-transparent font-semibold outline-none"
                  aria-label={`Nome da tela ${i + 1}`}
                />
              </button>
              {telas.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerTela(i)}
                  className="opacity-70 hover:opacity-100"
                  aria-label={`Remover tela ${i + 1}`}
                  title="Remover tela (as perguntas vão para a tela anterior)"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarTela}
            disabled={telas.length >= MAX_TELAS}
          >
            <Plus className="h-3.5 w-3.5" />
            Tela{telas.length >= MAX_TELAS ? ` (máx. ${MAX_TELAS})` : ""}
          </Button>
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? "Voltar a editar" : "Visualizar"}
        </Button>
      </div>

      {preview ? (
        <div className="rounded-xl border border-[#D9E0EA] bg-white p-5">
          <FormularioDinamico
            campos={campos}
            telaAtual={usaTelas ? telaEdicao : undefined}
            respostas={{ ...respostasPreview, __erros: validarCampos(campos, respostasPreview) }}
            onChange={(id, valor) => setRespostasPreview((r) => ({ ...r, [id]: valor }))}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-[#D9E0EA] bg-white p-4 shadow-sm">
          {listaVisivel.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#D9E0EA] bg-white px-4 py-10 text-center text-[13px] text-[#94A3B8]">
              Esta tela ainda não tem perguntas. Clique em “Adicionar pergunta” abaixo.
            </p>
          )}

          {listaVisivel.map((campo, indice) => {
            const aberto = selecionadoId === campo.id;
            const anteriores = campos.filter(
              (c) =>
                c.id !== campo.id &&
                (c.tipo === "select" || c.tipo === "lista" || c.tipo === "multi" || c.tipo === "checkbox"),
            );
            return (
              <div
                key={campo.id}
                onClick={() => setSelecionadoId(campo.id)}
                className={`rounded-xl border bg-white p-4 transition ${
                  aberto
                    ? "border-[#1E3A8A] ring-1 ring-[#1E3A8A]/30"
                    : "border-[#D9E0EA] hover:border-[#94A3B8]"
                }`}
              >
                {!aberto ? (
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[#1F2937]">
                      {indice + 1}. {campo.label || "Pergunta sem título"}
                    </p>
                    <p className="text-[12px] text-[#94A3B8]">
                      {TIPO_CAMPO_LABELS[campo.tipo]}
                      {campo.obrigatorio ? " · obrigatória" : ""}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        value={campo.label}
                        onChange={(e) => atualizar(campo.id, { label: e.target.value })}
                        placeholder="Pergunta"
                        className="flex-1 rounded-md border border-[#D9E0EA] px-3 py-2 text-[14px] outline-none focus:border-[#1E3A8A]"
                      />
                      <select
                        value={campo.tipo}
                        onChange={(e) => {
                          const tipo = e.target.value as TipoCampo;
                          atualizar(campo.id, {
                            tipo,
                            opcoes: TIPOS_COM_OPCOES.includes(tipo)
                              ? campo.opcoes?.length
                                ? campo.opcoes
                                : ["Opção 1"]
                              : [],
                          });
                        }}
                        className="rounded-md border border-[#D9E0EA] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1E3A8A] sm:w-64"
                      >
                        {TIPOS_CAMPO.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {TIPO_CAMPO_LABELS[tipo]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {TIPOS_COM_OPCOES.includes(campo.tipo) ? (
                      <div className="space-y-2">
                        {(campo.opcoes ?? []).map((op, i) => {
                          const Icone = campo.tipo === "multi" ? Square : Circle;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <Icone className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                              <input
                                value={op}
                                onChange={(e) => atualizarOpcao(campo, i, e.target.value)}
                                className="flex-1 border-b border-[#E2E8F0] px-1 py-1 text-[13px] outline-none focus:border-[#1E3A8A]"
                              />
                              <button
                                type="button"
                                onClick={() => removerOpcao(campo, i)}
                                className="text-[#94A3B8] hover:text-[#E11D48]"
                                aria-label="Remover opção"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => adicionarOpcao(campo)}
                          className="text-[13px] font-medium text-[#1E3A8A] hover:underline"
                        >
                          + Adicionar opção
                        </button>
                      </div>
                    ) : (
                      <input
                        value={campo.placeholder ?? ""}
                        onChange={(e) => atualizar(campo.id, { placeholder: e.target.value })}
                        placeholder="Texto de ajuda (opcional)"
                        className="w-full border-b border-[#E2E8F0] px-1 py-1 text-[13px] text-[#64748B] outline-none focus:border-[#1E3A8A]"
                      />
                    )}

                    {campo.tipo === "numero" && (
                      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                        <label className="text-[12px] text-[#64748B]">
                          Mínimo
                          <input
                            type="number"
                            value={campo.min ?? ""}
                            onChange={(e) =>
                              atualizar(campo.id, {
                                min: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-md border border-[#D9E0EA] px-2 py-1.5 text-[13px]"
                          />
                        </label>
                        <label className="text-[12px] text-[#64748B]">
                          Máximo
                          <input
                            type="number"
                            value={campo.max ?? ""}
                            onChange={(e) =>
                              atualizar(campo.id, {
                                max: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-md border border-[#D9E0EA] px-2 py-1.5 text-[13px]"
                          />
                        </label>
                      </div>
                    )}

                    {anteriores.length > 0 && (
                      <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
                        <label className="text-[12px] text-[#64748B]">
                          Mostrar só se a pergunta
                          <select
                            value={campo.condicao?.campoId ?? ""}
                            onChange={(e) =>
                              atualizar(campo.id, {
                                condicao: e.target.value
                                  ? { campoId: e.target.value, valor: campo.condicao?.valor ?? "" }
                                  : null,
                              })
                            }
                            className="mt-1 w-full rounded-md border border-[#D9E0EA] bg-white px-2 py-1.5 text-[13px]"
                          >
                            <option value="">Sempre visível</option>
                            {anteriores.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label || "Pergunta sem título"}
                              </option>
                            ))}
                          </select>
                        </label>
                        {campo.condicao?.campoId ? (
                          <label className="text-[12px] text-[#64748B]">
                            for respondida como
                            <input
                              value={campo.condicao.valor}
                              onChange={(e) =>
                                atualizar(campo.id, {
                                  condicao: {
                                    campoId: campo.condicao!.campoId,
                                    valor: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 w-full rounded-md border border-[#D9E0EA] px-2 py-1.5 text-[13px]"
                            />
                          </label>
                        ) : null}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EEF5] pt-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => mover(campo.id, -1)}
                          disabled={indice === 0}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30"
                          aria-label="Subir pergunta"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mover(campo.id, 1)}
                          disabled={indice === listaVisivel.length - 1}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-30"
                          aria-label="Descer pergunta"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicar(campo.id)}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
                          aria-label="Duplicar pergunta"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remover(campo.id)}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#FDECEE] hover:text-[#E11D48]"
                          aria-label="Excluir pergunta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <label className="flex items-center gap-2 text-[13px] text-[#334155]">
                        <input
                          type="checkbox"
                          checked={campo.obrigatorio}
                          onChange={(e) => atualizar(campo.id, { obrigatorio: e.target.checked })}
                          className="h-4 w-4 accent-[#1E3A8A]"
                        />
                        Obrigatória
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Adicionar pergunta */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed border-[#1E3A8A] text-[#1E3A8A]"
              >
                <Plus className="h-4 w-4" />
                Adicionar pergunta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              {TIPOS_CAMPO.map((tipo) => {
                const Icone = ICONE_TIPO_PERGUNTA[tipo];
                return (
                  <DropdownMenuItem key={tipo} onSelect={() => adicionar(tipo)}>
                    <Icone className="mr-2 h-4 w-4 text-[#64748B]" />
                    {TIPO_CAMPO_LABELS[tipo]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex flex-col items-end gap-1.5 pt-2">
        <Button
          type="button"
          onClick={() => void onPublicar()}
          disabled={publicando}
          className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
        >
          {salvarLabel ?? "Publicar nova versão"}
        </Button>
        <p className="text-right text-xs text-[#94A3B8]">
          {salvarDica ??
            "Publicar cria uma nova versão — ocorrências já abertas continuam no formulário original."}
        </p>
      </div>
    </div>
  );
}
