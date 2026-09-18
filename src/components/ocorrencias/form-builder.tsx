import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormularioDinamico, validarCampos } from "@/components/ocorrencias/campo-renderer";
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_LABELS,
  idCurto,
  type CampoFormulario,
  type Respostas,
  type TipoCampo,
} from "@/lib/ocorrencias";

export interface FormBuilderProps {
  campos: CampoFormulario[];
  onChangeCampos: (campos: CampoFormulario[]) => void;
  onPublicar: () => Promise<void> | void;
  publicando?: boolean;
  /** Rótulo do botão principal (ex.: "Salvar campos da etapa" fora do contexto de publicação). */
  salvarLabel?: string;
  /** Texto de apoio sob o botão principal. */
  salvarDica?: string;
}

function campoBase(tipo: TipoCampo): CampoFormulario {
  return {
    id: idCurto(),
    tipo,
    label: TIPO_CAMPO_LABELS[tipo],
    placeholder: "",
    obrigatorio: false,
    opcoes: tipo === "select" || tipo === "multi" ? ["Opção A", "Opção B"] : [],
    largura: "inteira",
    condicao: null,
  };
}

interface PropriedadesCampoProps {
  campo: CampoFormulario;
  campos: CampoFormulario[];
  atualizar: (patch: Partial<CampoFormulario>) => void;
}

function PropriedadesCampo({ campo, campos, atualizar }: PropriedadesCampoProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[12px]">Rótulo</Label>
        <Input value={campo.label} onChange={(e) => atualizar({ label: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px]">Placeholder / texto auxiliar</Label>
        <Input
          value={campo.placeholder ?? ""}
          onChange={(e) => atualizar({ placeholder: e.target.value })}
        />
      </div>

      {(campo.tipo === "select" || campo.tipo === "multi") && (
        <div className="space-y-1.5">
          <Label className="text-[12px]">Opções (uma por linha)</Label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-[13px]"
            value={(campo.opcoes ?? []).join("\n")}
            onChange={(e) =>
              atualizar({ opcoes: e.target.value.split("\n").filter((l) => l.trim()) })
            }
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-[13px] text-[#334155]">
        <input
          type="checkbox"
          checked={campo.obrigatorio}
          onChange={(e) => atualizar({ obrigatorio: e.target.checked })}
          className="h-3.5 w-3.5 accent-[#1E3A8A]"
        />
        Obrigatório
      </label>

      <div className="space-y-1.5">
        <Label className="text-[12px]">Largura</Label>
        <Select
          value={campo.largura ?? "inteira"}
          onValueChange={(v) => atualizar({ largura: v as "inteira" | "metade" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inteira">Largura inteira</SelectItem>
            <SelectItem value="metade">Meia largura</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(campo.tipo === "texto" || campo.tipo === "numero") && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Mín</Label>
            <Input
              type="number"
              value={campo.min ?? ""}
              onChange={(e) =>
                atualizar({ min: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Máx</Label>
            <Input
              type="number"
              value={campo.max ?? ""}
              onChange={(e) =>
                atualizar({ max: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[12px]">Validação (regex)</Label>
            <Input
              value={campo.regex ?? ""}
              placeholder="Ex.: ^[0-9]{4,6}$"
              onChange={(e) => atualizar({ regex: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Campo condicional */}
      <div className="space-y-1.5 rounded-lg border border-[#E9EEF5] p-2.5">
        <Label className="text-[12px]">Mostrar somente se…</Label>
        <Select
          value={campo.condicao?.campoId ?? ""}
          onValueChange={(v) =>
            atualizar({
              condicao: v ? { campoId: v, valor: campo.condicao?.valor ?? "" } : null,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sempre visível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={""}>Sempre visível</SelectItem>
            {campos
              .filter((c) => c.id !== campo.id && (c.tipo === "select" || c.tipo === "checkbox"))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {campo.condicao?.campoId && (
          <Input
            placeholder="Valor que exibe o campo"
            value={campo.condicao.valor}
            onChange={(e) =>
              atualizar({
                condicao: { campoId: campo.condicao!.campoId, valor: e.target.value },
              })
            }
          />
        )}
      </div>
    </div>
  );
}

export function FormBuilder({
  campos,
  onChangeCampos,
  onPublicar,
  publicando,
  salvarLabel,
  salvarDica,
}: FormBuilderProps) {
  const [selecionadoId, setSelected] = useState<string | null>(campos[0]?.id ?? null);
  const [preview, setPreview] = useState(false);
  const [respostasPreview, setRespostasPreview] = useState<Respostas>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const selecionado = campos.find((c) => c.id === selecionadoId) ?? null;

  function atualizar(patch: Partial<CampoFormulario>) {
    if (!selecionado) return;
    onChangeCampos(campos.map((c) => (c.id === selecionado.id ? { ...c, ...patch } : c)));
  }

  function adicionar(tipo: TipoCampo) {
    const novo = campoBase(tipo);
    onChangeCampos([...campos, novo]);
    setSelected(novo.id);
  }

  function duplicar(id: string) {
    const origem = campos.find((c) => c.id === id);
    if (!origem) return;
    const novo = { ...origem, id: idCurto(), label: `${origem.label} (cópia)` };
    const idx = campos.findIndex((c) => c.id === id);
    const lista = [...campos];
    lista.splice(idx + 1, 0, novo);
    onChangeCampos(lista);
    setSelected(novo.id);
  }

  function remover(id: string) {
    onChangeCampos(campos.filter((c) => c.id !== id));
    if (selecionadoId === id) setSelected(null);
  }

  function mover(id: string, delta: -1 | 1) {
    const idx = campos.findIndex((c) => c.id === id);
    const alvo = idx + delta;
    if (idx < 0 || alvo < 0 || alvo >= campos.length) return;
    const lista = [...campos];
    const [item] = lista.splice(idx, 1);
    if (item) lista.splice(alvo, 0, item);
    onChangeCampos(lista);
  }

  function soltar(sobreId: string) {
    if (!dragId || dragId === sobreId) return;
    const de = campos.findIndex((c) => c.id === dragId);
    const para = campos.findIndex((c) => c.id === sobreId);
    if (de < 0 || para < 0) return;
    const lista = [...campos];
    const [item] = lista.splice(de, 1);
    if (item) lista.splice(para, 0, item);
    onChangeCampos(lista);
    setDragId(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      {/* Paleta */}
      <div className="rounded-xl border border-[#D9E0EA] bg-white p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
          Adicionar campo
        </p>
        <div className="space-y-1.5">
          {TIPOS_CAMPO.map((tipo) => (
            <Button
              key={tipo}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => adicionar(tipo)}
            >
              <Plus className="h-3.5 w-3.5" />
              {TIPO_CAMPO_LABELS[tipo]}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista ordenável / preview */}
      <div className="rounded-xl border border-[#D9E0EA] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            {preview ? "Preview do formulário" : "Campos (arraste para ordenar)"}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? "Voltar a editar" : "Preview"}
          </Button>
        </div>

        {preview ? (
          <FormularioDinamico
            campos={campos}
            respostas={{
              ...respostasPreview,
              __erros: validarCampos(campos, respostasPreview),
            }}
            onChange={(id, valor) => setRespostasPreview((r) => ({ ...r, [id]: valor }))}
          />
        ) : campos.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-[#94A3B8]">
            Nenhum campo. Escolha um tipo na paleta para começar.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {campos.map((c, i) => (
              <li
                key={c.id}
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltar(c.id)}
                onClick={() => setSelected(c.id)}
                className={`flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-2 text-[13px] transition ${
                  selecionadoId === c.id
                    ? "border-[#1E3A8A] bg-[#EEF2FF]"
                    : "border-[#E9EEF5] bg-white hover:bg-[#F8FAFC]"
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-[#CBD5E1]" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-[#1F2937]">{c.label}</span>
                  <span className="ml-2 text-[11px] text-[#94A3B8]">
                    {TIPO_CAMPO_LABELS[c.tipo]}
                    {c.obrigatorio ? " · obrigatório" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Subir"
                  className="text-[#94A3B8] hover:text-[#1E3A8A]"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(c.id, -1);
                  }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Descer"
                  className="text-[#94A3B8] hover:text-[#1E3A8A]"
                  onClick={(e) => {
                    e.stopPropagation();
                    mover(c.id, 1);
                  }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Duplicar"
                  className="text-[#94A3B8] hover:text-[#1E3A8A]"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicar(c.id);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Excluir"
                  className="text-[#94A3B8] hover:text-[#E11D48]"
                  onClick={(e) => {
                    e.stopPropagation();
                    remover(c.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] text-[#CBD5E1]">{i + 1}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Propriedades */}
      <div className="rounded-xl border border-[#D9E0EA] bg-white p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
          Propriedades
        </p>
        {!selecionado ? (
          <p className="py-6 text-center text-[12px] text-[#94A3B8]">
            Selecione um campo na lista.
          </p>
        ) : (
          <PropriedadesCampo campo={selecionado} campos={campos} atualizar={atualizar} />
        )}

        <Button
          type="button"
          className="mt-4 w-full bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          disabled={publicando}
          onClick={() => void onPublicar()}
        >
          {publicando ? "Salvando…" : (salvarLabel ?? "Publicar nova versão")}
        </Button>
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          {salvarDica ??
            "Publicar cria uma nova versão — ocorrências já abertas continuam no formulário original."}
        </p>
      </div>
    </div>
  );
}
