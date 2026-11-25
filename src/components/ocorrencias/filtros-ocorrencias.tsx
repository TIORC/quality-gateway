/**
 * Filtros das telas de ocorrências (Todas, Que eu abri, Que me mencionaram, Minha
 * equipe e Dashboard): tipo de ocorrência, pessoa e setor.
 *
 * Quem pode ver os filtros de pessoa e setor depende do escopo:
 * - completo (Qualidade e Desenvolvedor do Sistema): todas as pessoas e setores;
 * - líder de setor: só os setores que ele comanda e as pessoas desses setores;
 * - colaborador: pessoa e setor aparecem sempre com os dados dele, sem poder trocar.
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

/** Quais pessoas e setores o usuário pode escolher nos filtros. */
export type EscopoFiltros =
  | { modo: "completo" }
  | { modo: "lider"; setores: string[]; pessoas: string[] }
  | { modo: "colaborador"; pessoa: string; setor: string };

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
  escopo?: EscopoFiltros;
}

const rotulo = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]";

export function FiltrosOcorrencias({
  ocorrencias,
  tipos,
  valor,
  onChange,
  escopo = { modo: "completo" },
}: FiltrosOcorrenciasProps) {
  const colaborador = escopo.modo === "colaborador";
  // Opções: do escopo para líder (setores e pessoas que comanda); das próprias ocorrências
  // para quem vê tudo, para só oferecer o que existe de fato.
  const pessoas = useMemo(() => {
    if (escopo.modo === "lider") return [...new Set(escopo.pessoas)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (escopo.modo === "colaborador") return [escopo.pessoa];
    return [...new Set(ocorrencias.flatMap(pessoasDe))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [escopo, ocorrencias]);
  const setores = useMemo(() => {
    if (escopo.modo === "lider") return [...new Set(escopo.setores)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (escopo.modo === "colaborador") return [escopo.setor];
    return [...new Set(ocorrencias.flatMap(setoresDe))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [escopo, ocorrencias]);
  const tiposOpcoes = useMemo(
    () => tipos.map((t) => ({ id: t.id, nome: t.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [tipos],
  );
  const algumFiltro = valor.tipoId || valor.pessoa || valor.setor;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <p className={rotulo}>Tipo de ocorrência</p>
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
        <p className={rotulo}>Pessoa</p>
        {colaborador ? (
          <Select value={escopo.pessoa} disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={escopo.pessoa}>{escopo.pessoa}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
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
        )}
      </div>

      <div className="space-y-1">
        <p className={rotulo}>Setor</p>
        {colaborador ? (
          <Select value={escopo.setor} disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={escopo.setor}>{escopo.setor}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
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
        )}
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
