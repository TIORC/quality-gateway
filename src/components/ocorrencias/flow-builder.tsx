/**
 * Flow Builder — canvas de subetapas dentro das macro-etapas fixas.
 */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, TextCursorInput, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBuilder } from "@/components/ocorrencias/form-builder";
import {
  ACOES_ETAPA,
  ACOES_ETAPA_LABELS,
  MACRO_ETAPAS,
  MACRO_ETAPA_LABELS,
  MACRO_ETAPA_DESCRICAO,
  type AcaoEtapa,
  type CampoFormulario,
  type MacroEtapa,
  type MacroFluxo,
  type ResponsavelEtapa,
  type SubetapaFluxo,
  idCurto,
} from "@/lib/ocorrencias";

export interface FlowBuilderProps {
  etapas: MacroFluxo[];
  onChange: (etapas: MacroFluxo[]) => void;
  onPublicar: () => Promise<void> | void;
  publicando?: boolean;
  colaboradores?: { id: string; nome: string; email: string }[];
  setores?: string[];
  cargos?: string[];
}

function subetapaVazia(): SubetapaFluxo {
  return {
    id: idCurto(),
    nome: "Nova subetapa",
    // Regra do portal: toda ocorrência é do setor Qualidade.
    responsavel: { tipo: "setor", id: "", nome: "Qualidade" },
    prazoDias: 5,
    acoes: ["aprovar", "reprovar", "solicitar_info"] as AcaoEtapa[],
    campos: [],
    notificar: true,
    reprovarPara: "voltar",
  };
}

export function FlowBuilder({
  etapas,
  onChange,
  onPublicar,
  publicando,
  colaboradores,
  setores,
  cargos,
}: FlowBuilderProps) {
  const [camposDialogo, setCamposDialogo] = useState<{ macro: MacroEtapa; idx: number } | null>(
    null,
  );

  function atualizarSubetapa(macro: MacroEtapa, idx: number, patch: Partial<SubetapaFluxo>) {
    onChange(
      etapas.map((e) =>
        e.macro === macro
          ? { ...e, subetapas: e.subetapas.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }
          : e,
      ),
    );
  }

  function adicionarSubetapa(macro: MacroEtapa) {
    // Regra do portal: nova subetapa já nasce com a Qualidade responsável.
    const nova = {
      ...subetapaVazia(),
      responsavel: { tipo: "setor" as const, id: "", nome: "Qualidade" },
    };
    onChange(
      etapas.map((e) => (e.macro === macro ? { ...e, subetapas: [...e.subetapas, nova] } : e)),
    );
  }

  function removerSubetapa(macro: MacroEtapa, idx: number) {
    onChange(
      etapas.map((e) =>
        e.macro === macro ? { ...e, subetapas: e.subetapas.filter((_, i) => i !== idx) } : e,
      ),
    );
  }

  function moverSubetapa(macro: MacroEtapa, idx: number, delta: -1 | 1) {
    const alvo = idx + delta;
    const e = etapas.find((x) => x.macro === macro);
    if (!e || alvo < 0 || alvo >= e.subetapas.length) return;
    const lista = [...e.subetapas];
    const [item] = lista.splice(idx, 1);
    if (item) lista.splice(alvo, 0, item);
    onChange(etapas.map((x) => (x.macro === macro ? { ...x, subetapas: lista } : x)));
  }

  return (
    <div className="space-y-5">
      {MACRO_ETAPAS.map((macro) => {
        const e = etapas.find((x) => x.macro === macro);
        const subs = e?.subetapas ?? [];
        return (
          <div key={macro} className="rounded-xl border border-[#D9E0EA] bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: "#1E3A8A" }}
                >
                  <span className="text-[13px] font-bold">{MACRO_ETAPAS.indexOf(macro) + 1}</span>
                </span>
                <p className="text-[13px] font-semibold text-[#1F2937]">
                  {MACRO_ETAPA_LABELS[macro]}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => adicionarSubetapa(macro)}
              >
                <Plus className="h-3.5 w-3.5" />
                Subetapa
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-[#94A3B8]">{MACRO_ETAPA_DESCRICAO[macro]}</p>
            {subs.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#CBD5E1]">
                Macro-etapa tratada como etapa única (fluxo mínimo).
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {subs.map((s, i) => (
                  <li key={s.id} className="rounded-lg border border-[#E9EEF5] p-3">
                    <SubetapaEditor
                      s={s}
                      macro={macro}
                      onPatch={(p) => atualizarSubetapa(macro, i, p)}
                    />
                    <div className="mt-3 flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mr-auto"
                        onClick={() => setCamposDialogo({ macro, idx: i })}
                      >
                        <TextCursorInput className="h-3.5 w-3.5" />
                        Formulário da etapa ({s.campos.length})
                      </Button>
                      <button
                        type="button"
                        aria-label="Subir"
                        className="text-[#94A3B8] hover:text-[#1E3A8A]"
                        onClick={() => moverSubetapa(macro, i, -1)}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Descer"
                        className="text-[#94A3B8] hover:text-[#1E3A8A]"
                        onClick={() => moverSubetapa(macro, i, 1)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Excluir subetapa"
                        className="text-[#94A3B8] hover:text-[#E11D48]"
                        onClick={() => removerSubetapa(macro, i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <div className="flex justify-end gap-2 border-t border-[#E9EEF5] pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(etapas.map((e) => ({ ...e, subetapas: [] })))}
        >
          Limpar subetapas
        </Button>
        <Button
          type="button"
          className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          disabled={publicando}
          onClick={() => void onPublicar()}
        >
          {publicando ? "Publicando…" : "Publicar novo fluxo"}
        </Button>
      </div>

      <SubetapaCamposDialog
        aberto={camposDialogo !== null}
        subetapa={
          camposDialogo
            ? (etapas.find((e) => e.macro === camposDialogo.macro)?.subetapas[camposDialogo.idx] ??
              null)
            : null
        }
        onFechar={() => setCamposDialogo(null)}
        onSalvar={(campos) => {
          if (camposDialogo) atualizarSubetapa(camposDialogo.macro, camposDialogo.idx, { campos });
        }}
      />
    </div>
  );
}

function SubetapaCamposDialog({
  aberto,
  subetapa,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  subetapa: SubetapaFluxo | null;
  onFechar: () => void;
  onSalvar: (campos: CampoFormulario[]) => void;
}) {
  const [campos, setCampos] = useState<CampoFormulario[]>([]);

  useEffect(() => {
    if (aberto && subetapa) setCampos(subetapa.campos);
  }, [aberto, subetapa]);

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Formulário da etapa</DialogTitle>
          <DialogDescription>
            Campos preenchidos pelo responsável ao agir nesta subetapa. Salvo junto com o fluxo ao
            publicar.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <FormBuilder
            campos={campos}
            onChangeCampos={setCampos}
            onPublicar={() => {
              onSalvar(campos);
              onFechar();
            }}
            salvarLabel="Salvar campos da etapa"
            salvarDica="Faz parte do fluxo ainda não publicado deste tipo de ocorrência."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SubetapaEditorProps {
  s: SubetapaFluxo;
  macro: MacroEtapa;
  onPatch: (p: Partial<SubetapaFluxo>) => void;
}

function SubetapaEditor({ s, onPatch }: SubetapaEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <GripVertical className="mt-5 h-4 w-4 text-[#CBD5E1]" />
        <div className="flex-1 space-y-1.5">
          <Label className="text-[12px]">Nome da subetapa</Label>
          <Input value={s.nome} onChange={(e) => onPatch({ nome: e.target.value })} />
        </div>
        <div className="grid w-32 items-end gap-1.5">
          <Label className="text-[12px]">SLA (dias)</Label>
          <Input
            type="number"
            min={1}
            value={s.prazoDias}
            onChange={(e) => onPatch({ prazoDias: Number(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-8 gap-2 items-end">
        <div className="col-span-3 space-y-1.5">
          <Label className="text-[12px]">Responsável</Label>
          <Select
            value={s.responsavel.tipo}
            onValueChange={(v) =>
              onPatch({
                responsavel: {
                  ...s.responsavel,
                  tipo: v as ResponsavelEtapa["tipo"],
                  id: "",
                  nome: "",
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pessoa">Pessoa (colaborador)</SelectItem>
              <SelectItem value="cargo">Cargo</SelectItem>
              <SelectItem value="setor">Setor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ResponsavelInput
          s={s}
          onPatch={onPatch}
          colaboradores={colaboradores}
          setores={setores}
          cargos={cargos}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span className="text-[#64748B]">Ações permitidas:</span>
        {ACOES_ETAPA.map((a) => (
          <label key={a} className="flex items-center gap-1 text-[#334155]">
            <Checkbox
              checked={s.acoes.includes(a)}
              onCheckedChange={(v) => {
                const acoes = s.acoes.includes(a)
                  ? s.acoes.filter((x) => x !== a)
                  : ([...s.acoes, a] as AcaoEtapa[]);
                onPatch({ acoes });
              }}
            />
            {ACOES_ETAPA_LABELS[a]}
          </label>
        ))}
      </div>

      <div className="grid w-48 items-end gap-1.5">
        <Label className="text-[12px]">Ao reprovar</Label>
        <Select
          value={s.reprovarPara}
          onValueChange={(v) => onPatch({ reprovarPara: v as SubetapaFluxo["reprovarPara"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voltar">Voltar para etapa anterior</SelectItem>
            <SelectItem value="encerrar">Encerrar ocorrência</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-[#334155]">
        <Checkbox
          checked={s.notificar}
          onCheckedChange={(v) => onPatch({ notificar: v === true })}
        />
        Notificar ao entrar nesta etapa
      </label>
    </div>
  );
}

interface ResponsavelInputProps {
  s: SubetapaFluxo;
  colaboradores?: { id: string; nome: string; email: string }[];
  setores?: string[];
  cargos?: string[];
  onPatch: (p: Partial<SubetapaFluxo>) => void;
}

function ResponsavelInput({ s, onPatch, colaboradores, setores, cargos }: ResponsavelInputProps) {
  const labelNome =
    s.responsavel.tipo === "pessoa"
      ? "Colaborador"
      : s.responsavel.tipo === "cargo"
        ? "Cargo"
        : "Setor";
  return (
    <div className="col-span-5 space-y-1.5">
      <Label className="text-[12px]">{labelNome}</Label>
      {s.responsavel.tipo === "pessoa" && (
        <Select
          value={s.responsavel.id ?? ""}
          onValueChange={(v) => {
            const col = (colaboradores ?? []).find((c) => c.id === v);
            onPatch({
              responsavel: {
                tipo: "pessoa",
                id: v,
                nome: col?.nome ?? "",
                email: col?.email ?? "",
              },
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar colaborador…" />
          </SelectTrigger>
          <SelectContent>
            {(colaboradores ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {s.responsavel.tipo === "setor" && (
        <Select
          value={s.responsavel.nome}
          onValueChange={(v) => onPatch({ responsavel: { tipo: "setor", id: "", nome: v } })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            {(setores ?? []).map((sg) => (
              <SelectItem key={sg} value={sg}>
                {sg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {s.responsavel.tipo === "cargo" && (
        <Select
          value={s.responsavel.nome}
          onValueChange={(v) => onPatch({ responsavel: { tipo: "cargo", id: "", nome: v } })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            {(cargos ?? []).map((cg) => (
              <SelectItem key={cg} value={cg}>
                {cg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
