/**
 * Filtros das telas de ocorrências (Todas, Que eu abri, Minha equipe e Dashboard):
 * tipo de ocorrência, pessoa (quem abriu, a tratativa ou o responsável) e setor
 * (quem abriu ou setor envolvido).
 */
import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SETOR_RESPONSAVEL_OCORRENCIAS,
  setoresEnvolvidosDe,
  type Ocorrencia,
  type TipoOcorrencia,
} from "@/lib/ocorrencias";

export interface FiltrosOcorrenciasValor {
  tipoId: string;
  pessoa: string;
  setor: string;
}

export const FILTROS_VAZIOS: FiltrosOcorrenciasValor = { tipoId: "", pessoa: "", setor: "" };

const TODOS = "__todos__";

/** Nomes de pessoas ligadas a uma ocorrência (sem o nome do setor responsável). */
function pessoasDe(o: Ocorrencia): string[] {
  return [o.abertaPorNome, o.donoQualidadeNome, o.responsavelNome].filter(
    (n): n is string => !!n && n !== SETOR_RESPONSAVEL_OCORRENCIAS,
  );
}

/** Setores ligados a uma ocorrência: quem abriu e os setores envolvidos. */
function setoresDe(o: Ocorrencia): string[] {
  return [o.abertaPorSetor, ...setoresEnvolvidosDe(o)].filter((s): s is string => !!s);
}

export function aplicarFiltrosOcorrencias(
  ocorrencias: Ocorrencia[],
  filtros: FiltrosOcorrenciasValor,
): Ocorrencia[] {
  return ocorrencias.filter((o) => {
    if (filtros.tipoId && o.tipoId !== filtros.tipoId) return false;
    if (filtros.pessoa && !pessoasDe(o).includes(filtros.pessoa)) return false;
    if (filtros.setor && !setoresDe(o).includes(filtros.setor)) return false;
    return true;
  });
}

interface FiltrosOcorrenciasProps {
  ocorrencias: Ocorrencia[];
  tipos: TipoOcorrencia[];
  valor: FiltrosOcorrenciasValor;
  onChange: (valor: FiltrosOcorrenciasValor) => void;
}

export function FiltrosOcorrencias({ ocorrencias, tipos, valor, onChange }: FiltrosOcorrenciasProps) {
  // Opções vêm das próprias ocorrências, para só oferecer o que existe de fato.
  const pessoas = useMemo(
    () => [...new Set(ocorrencias.flatMap(pessoasDe))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [ocorrencias],
  );
  const setores = useMemo(
    () => [...new Set(ocorrencias.flatMap(setoresDe))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [ocorrencias],
  );
  const tiposOpcoes = useMemo(
    () => tipos.map((t) => ({ id: t.id, nome: t.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [tipos],
  );
  const algumFiltro = valor.tipoId || valor.pessoa || valor.setor;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Tipo de ocorrência</p>
        <Select
          value={valor.tipoId || TODOS}
          onValueChange={(v) => onChange({ ...valor, tipoId: v === TODOS ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {tiposOpcoes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Pessoa</p>
        <Select
          value={valor.pessoa || TODOS}
          onValueChange={(v) => onChange({ ...valor, pessoa: v === TODOS ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as pessoas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as pessoas</SelectItem>
            {pessoas.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Setor</p>
        <Select
          value={valor.setor || TODOS}
          onValueChange={(v) => onChange({ ...valor, setor: v === TODOS ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os setores</SelectItem>
            {setores.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {algumFiltro && (
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="button"
            onClick={() => onChange(FILTROS_VAZIOS)}
            className="text-[12px] font-semibold text-[#1E3A8A] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
