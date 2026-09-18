/**
 * Renderizador dinâmico de campos do formulário de ocorrências.
 *
 * Usado tanto no preview do Form Builder quanto na abertura da ocorrência e
 * nos formulários de etapa. A validação é derivada do schema (obrigatório,
 * regex, min/max) — um erro por campo, exibido sob o controle.
 */
import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CampoFormulario, Respostas } from "@/lib/ocorrencias";
import { TIPO_CAMPO_LABELS } from "@/lib/ocorrencias";

export interface CampoRenderProps {
  campo: CampoFormulario;
  respostas: Respostas;
  onChange: (campoId: string, valor: unknown) => void;
  /** Colaboradores/setores para o campo "responsavel" (do catálogo organizacional). */
  colaboradores?: { id: string; nome: string; email: string }[] | undefined;
  setores?: string[] | undefined;
  /** Upload direto (Storage) ou apenas seleção de arquivos. */
  onArquivos?: ((campoId: string, arquivos: FileList | null) => void) | undefined;
  desabilitado?: boolean | undefined;
}

/** O campo deve ser exibido? (regra condicional do schema) */
export function campoVisivel(campo: CampoFormulario, respostas: Respostas): boolean {
  if (!campo.condicao?.campoId) return true;
  const v = respostas[campo.condicao.campoId];
  const valor = campo.condicao.valor;
  if (typeof v === "boolean") return v === (valor === "true" || valor === "sim" || valor === "Sim");
  if (Array.isArray(v)) return v.includes(valor);
  return String(v ?? "") === valor;
}

/** Valida todos os campos visíveis; devolve mapa campoId → mensagem de erro. */
export function validarCampos(
  campos: CampoFormulario[], respostas: Respostas,
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const campo of campos) {
    if (!campoVisivel(campo, respostas)) continue;
    const v = respostas[campo.id];
    const vazio =
      v === undefined || v === null || v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (campo.obrigatorio && vazio) {
      erros[campo.id] = "Campo obrigatório.";
      continue;
    }
    if (vazio) continue;
    if (campo.tipo === "numero") {
      const n = Number(v);
      if (Number.isNaN(n)) { erros[campo.id] = "Informe um número."; continue; }
      if (campo.min !== null && campo.min !== undefined && n < campo.min) {
        erros[campo.id] = `Mínimo: ${campo.min}`;
        continue;
      }
      if (campo.max !== null && campo.max !== undefined && n > campo.max) {
        erros[campo.id] = `Máximo: ${campo.max}`;
        continue;
      }
    }
    if (campo.tipo === "texto" && campo.regex) {
      try {
        if (!new RegExp(campo.regex).test(String(v))) {
          erros[campo.id] = "Formato inválido.";
        }
      } catch { /* regex inválida no schema: ignora */ }
    }
  }
  return erros;
}

/* -------------------------------------------------------------------------- */
/* Assinatura (canvas simples de traço livre)                                  */
/* -------------------------------------------------------------------------- */

function CampoAssinatura({
  valor, onChange, desabilitado,
}: { valor: unknown; onChange: (v: unknown) => void; desabilitado?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temTinta, setTemTinta] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 320;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1F2937";
    if (typeof valor === "string" && valor.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = valor;
      setTemTinta(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (desabilitado) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setDesenhando(true);
    const p = posicao(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando || desabilitado) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = posicao(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setTemTinta(true);
  }

  function finalizar() {
    if (!desenhando) return;
    setDesenhando(false);
    const canvas = canvasRef.current;
    if (canvas && temTinta) onChange(canvas.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTinta(false);
    onChange(null);
  }

  return (
    <div className="rounded-lg border border-[#D9E0EA] bg-white p-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full cursor-crosshair touch-none"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={finalizar}
        onPointerLeave={finalizar}
      />
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          className="text-xs font-medium text-[#64748B] hover:text-[#E11D48]"
          onClick={limpar}
        >
          Limpar assinatura
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Campo                                                                       */
/* -------------------------------------------------------------------------- */

export function CampoFormularioRender(props: CampoRenderProps) {
  const { campo, respostas, onChange, colaboradores = [], setores, onArquivos, desabilitado = false } = props;
  const valor = respostas[campo.id];
  const erros = respostas["__erros"] as Record<string, string> | undefined;
  const erro = erros?.[campo.id];

  function set(v: unknown) { onChange(campo.id, v); }

  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">
        {campo.label}
        {campo.obrigatorio && <span className="ml-1 text-[#E11D48]">*</span>}
      </Label>

      {campo.tipo === "texto" && (
        <Input
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => set(e.target.value)}
          placeholder={campo.placeholder}
          disabled={desabilitado}
        />
      )}

      {campo.tipo === "textarea" && (
        <Textarea
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => set(e.target.value)}
          placeholder={campo.placeholder}
          className="min-h-[100px]"
          disabled={desabilitado}
        />
      )}

      {campo.tipo === "numero" && (
        <Input
          type="number"
          value={valor === undefined || valor === null || valor === "" ? "" : String(valor)}
          onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={campo.placeholder}
          disabled={desabilitado}
        />
      )}

      {campo.tipo === "data" && (
        <Input
          type="date"
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => set(e.target.value)}
          disabled={desabilitado}
        />
      )}

      {campo.tipo === "select" && (
        <Select
          value={typeof valor === "string" ? valor : ""}
          onValueChange={(v) => set(v)}
          disabled={desabilitado}
        >
          <SelectTrigger>
            <SelectValue placeholder={campo.placeholder || "Selecionar…"} />
          </SelectTrigger>
          <SelectContent>
            {(campo.opcoes ?? []).map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {campo.tipo === "multi" && (
        <div className="flex flex-wrap gap-2">
          {(campo.opcoes ?? []).map((op) => {
            const selecionados = Array.isArray(valor) ? (valor as string[]) : [];
            const marcado = selecionados.includes(op);
            return (
              <label
                key={op}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
                  marcado
                    ? "border-[#1E3A8A] bg-[#EEF2FF] font-medium text-[#1E3A8A]"
                    : "border-[#D9E0EA] bg-white text-[#475569]"
                } ${desabilitado ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() =>
                    set(marcado
                      ? selecionados.filter((s) => s !== op)
                      : [...selecionados, op])
                  }
                  className="h-3.5 w-3.5 accent-[#1E3A8A]"
                />
                {op}
              </label>
            );
          })}
        </div>
      )}

      {campo.tipo === "checkbox" && (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#334155]">
          <Checkbox
            checked={valor === true}
            onCheckedChange={(v) => set(v === true)}
            disabled={desabilitado}
          />
          {campo.placeholder || "Marcar"}
        </label>
      )}

      {campo.tipo === "arquivo" && (
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#C7D2E0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#64748B] transition hover:bg-[#F1F5F9]">
            <Paperclip className="h-4 w-4" />
            {Array.isArray(valor) && valor.length
              ? `${(valor as unknown[]).length} arquivo(s) anexado(s)`
              : "Anexar arquivos ou fotos"}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={desabilitado}
              onChange={(e) => onArquivos?.(campo.id, e.target.files)}
            />
          </label>
          {Array.isArray(valor) && (valor as { nome: string; caminho?: string }[]).length > 0 && (
            <ul className="space-y-1">
              {(valor as { nome: string; caminho?: string }[]).map((a, i) => (
                <li key={`${a.nome}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#475569]">
                  <span className="truncate">{a.nome}</span>
                  {a.caminho && (
                    <button
                      type="button"
                      aria-label="Remover"
                      className="text-[#94A3B8] hover:text-[#E11D48]"
                      onClick={() => {
                        const lista = (valor as { nome: string; caminho?: string }[])
                          .filter((_, j) => j !== i);
                        set(lista);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {campo.tipo === "assinatura" && (
        <CampoAssinatura valor={valor} onChange={set} desabilitado={desabilitado} />
      )}

      {campo.tipo === "responsavel" && (
        <Select
          value={typeof valor === "string" ? valor : ""}
          onValueChange={(v) => set(v)}
          disabled={desabilitado}
        >
          <SelectTrigger>
            <SelectValue placeholder={campo.placeholder || "Selecionar responsável…"} />
          </SelectTrigger>
          <SelectContent>
            {(colaboradores ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {erro ? (
        <p className="text-[12px] font-medium text-[#E11D48]">{erro}</p>
      ) : (
        <p className="text-[11px] text-[#94A3B8]">{TIPO_CAMPO_LABELS[campo.tipo]}</p>
      )}
      {setores ? null : null}
    </div>
  );
}

/** Formulário dinâmico completo (grade de campos visíveis). */
export function FormularioDinamico({
  campos, respostas, onChange, colaboradores, onArquivos, desabilitado,
}: {
  campos: CampoFormulario[];
  respostas: Respostas;
  onChange: (campoId: string, valor: unknown) => void;
  colaboradores?: { id: string; nome: string; email: string }[];
  onArquivos?: (campoId: string, arquivos: FileList | null) => void;
  desabilitado?: boolean;
}) {
  const visiveis = campos.filter((c) => campoVisivel(c, respostas));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visiveis.map((campo) => (
        <div key={campo.id} className={campo.largura === "metade" ? "" : "sm:col-span-2"}>
          <CampoFormularioRender
            campo={campo}
            respostas={respostas}
            onChange={onChange}
            colaboradores={colaboradores}
            onArquivos={onArquivos}
            desabilitado={desabilitado}
          />
        </div>
      ))}
    </div>
  );
}
