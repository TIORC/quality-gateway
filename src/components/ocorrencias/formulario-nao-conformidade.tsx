/**
 * Formulário fixo de abertura de Não Conformidade.
 *
 * Campos (independentes do Form Builder publicado):
 *  - Área envolvida (obrigatório): lista os setores cadastrados;
 *  - Descrição da Não Conformidade (obrigatório, até 6.000 caracteres);
 *  - Consequência (obrigatório, até 6.000): "Qual o impacto dessa NC?";
 *  - Sugestão de Solução (até 6.000);
 *  - Gerou multa? (Sim/Não);
 *  - Anexo: até 5 arquivos de no máximo 10 MB por item.
 */
import { toast } from "sonner";
import { ExternalLink, Paperclip, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const LIMITE_ANEXOS_NC = 5;
export const TAMANHO_MAX_ANEXO_NC = 10 * 1024 * 1024; // 10 MB
export const LIMITE_TEXTO_NC = 6000;
/** Formulário externo de assinatura do termo de multa (Gerou multa? = Sim). */
export const URL_TERMO_MULTA_NC = "https://forms.gle/ZVJKiZQbyCExrgcj9";

export interface EstadoNaoConformidade {
  /** Área/Setor envolvido (obrigatório). */
  area: string;
  /** Descrição da Não Conformidade (obrigatório). */
  descricao: string;
  /** Consequência/impacto da NC (obrigatório). */
  consequencia: string;
  /** Sugestão de Solução (opcional). */
  sugestao: string;
  /** Gerou multa? */
  multa: "sim" | "nao";
  /** Confirmou a assinatura do termo de multa no formulário externo. */
  assinouMulta: boolean;
  /** Arquivos anexados (máx. 5 de 10 MB). */
  arquivos: File[];
}

export const ESTADO_NC_VAZIO: EstadoNaoConformidade = {
  area: "",
  descricao: "",
  consequencia: "",
  sugestao: "",
  multa: "nao",
  assinouMulta: false,
  arquivos: [],
};

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface FormularioNaoConformidadeProps {
  /** Setores cadastrados (a área envolvida). */
  setores: string[];
  valor: EstadoNaoConformidade;
  onChange: (estado: EstadoNaoConformidade) => void;
  /** Erros de validação por campo (ids: area, descricao, consequencia, anexos). */
  erros?: Record<string, string>;
  desabilitado?: boolean;
}

const CONTADOR = (atual: number) =>
  `text-right text-[11px] ${atual > LIMITE_TEXTO_NC ? "font-semibold text-[#E11D48]" : "text-[#94A3B8]"}`;

export function FormularioNaoConformidade({
  setores,
  valor,
  onChange,
  erros,
  desabilitado = false,
}: FormularioNaoConformidadeProps) {
  function adicionarArquivos(lista: FileList | null) {
    if (!lista || desabilitado) return;
    const novos = Array.from(lista);
    const acimaLimite = novos.filter((f) => f.size > TAMANHO_MAX_ANEXO_NC);
    const aceitaveis = novos.filter((f) => f.size <= TAMANHO_MAX_ANEXO_NC);
    const vagas = LIMITE_ANEXOS_NC - valor.arquivos.length;
    const aceitos = aceitaveis.slice(0, vagas);
    if (novos.length > vagas) {
      toast.warning(`Lembre-se: o limite é de ${LIMITE_ANEXOS_NC} anexos por item.`);
    }
    if (acimaLimite.length > 0) {
      toast.error(`${acimaLimite.length} arquivo(s) acima de 10 MB foram ignorados.`);
    }
    if (aceitos.length > 0) {
      onChange({ ...valor, arquivos: [...valor.arquivos, ...aceitos] });
    }
  }

  function removerArquivo(indice: number) {
    onChange({
      ...valor,
      arquivos: valor.arquivos.filter((_, i) => i !== indice),
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">
          Área envolvida <span className="ml-1 text-[#E11D48]">*</span>
        </Label>
        {setores.length > 0 ? (
          <Select
            value={valor.area}
            onValueChange={(v) => onChange({ ...valor, area: v })}
            disabled={desabilitado}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecionar setor…" />
            </SelectTrigger>
            <SelectContent>
              {setores.map((setor) => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="mt-1.5"
            value={valor.area}
            onChange={(e) => onChange({ ...valor, area: e.target.value })}
            placeholder="Nome do setor envolvido…"
            disabled={desabilitado}
          />
        )}
        {erros?.area && <p className="text-[12px] font-medium text-[#E11D48]">{erros.area}</p>}
      </div>

      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">
          Descrição da Não Conformidade <span className="ml-1 text-[#E11D48]">*</span>
        </Label>
        <Textarea
          className="mt-1.5 min-h-[110px]"
          value={valor.descricao}
          onChange={(e) => onChange({ ...valor, descricao: e.target.value })}
          placeholder="Descreva a não conformidade encontrada…"
          maxLength={LIMITE_TEXTO_NC}
          disabled={desabilitado}
        />
        <p className={CONTADOR(valor.descricao.length)}>
          {valor.descricao.length}/{LIMITE_TEXTO_NC}
        </p>
        {erros?.descricao && (
          <p className="text-[12px] font-medium text-[#E11D48]">{erros.descricao}</p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">
          Consequência <span className="ml-1 text-[#E11D48]">*</span>
        </Label>
        <p className="text-[12px] text-[#64748B]">Qual o impacto dessa NC?</p>
        <Textarea
          className="mt-1.5 min-h-[110px]"
          value={valor.consequencia}
          onChange={(e) => onChange({ ...valor, consequencia: e.target.value })}
          placeholder="Ex.: risco à qualidade do produto, retrabalho, atraso de prazo…"
          maxLength={LIMITE_TEXTO_NC}
          disabled={desabilitado}
        />
        <p className={CONTADOR(valor.consequencia.length)}>
          {valor.consequencia.length}/{LIMITE_TEXTO_NC}
        </p>
        {erros?.consequencia && (
          <p className="text-[12px] font-medium text-[#E11D48]">{erros.consequencia}</p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">Sugestão de Solução</Label>
        <Textarea
          className="mt-1.5 min-h-[100px]"
          value={valor.sugestao}
          onChange={(e) => onChange({ ...valor, sugestao: e.target.value })}
          placeholder="O que pode ser feito para corrigir/evitar a não conformidade?…"
          maxLength={LIMITE_TEXTO_NC}
          disabled={desabilitado}
        />
        <p className={CONTADOR(valor.sugestao.length)}>
          {valor.sugestao.length}/{LIMITE_TEXTO_NC}
        </p>
      </div>

      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">Gerou multa?</Label>
        <div className="mt-1.5 flex gap-2">
          {(["sim", "nao"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              disabled={desabilitado}
              onClick={() =>
                onChange({
                  ...valor,
                  multa: opcao,
                  assinouMulta: opcao === "nao" ? false : valor.assinouMulta,
                })
              }
              className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                valor.multa === opcao
                  ? "border-[#1E3A8A] bg-[#EEF2FF] text-[#1E3A8A]"
                  : "border-[#D9E0EA] bg-white text-[#475569] hover:bg-[#F8FAFC]"
              } ${desabilitado ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
            >
              {opcao === "sim" ? "Sim" : "Não"}
            </button>
          ))}
        </div>

        {valor.multa === "sim" && (
          <div className="mt-3 rounded-lg border border-[#E6B800]/50 bg-[#FFFBEB] p-3 text-[13px] text-[#92400E]">
            <p className="font-semibold">Multa registrada — assinatura do termo obrigatória</p>
            <p className="mt-1">
              Para concluir a abertura, você precisa assinar o termo de multa no formulário oficial
              abaixo e marcar a confirmação.
            </p>
            <a
              href={URL_TERMO_MULTA_NC}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#92400E] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#78350F]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir termo de multa para assinar
            </a>
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <Checkbox
                checked={valor.assinouMulta}
                onCheckedChange={(v) => onChange({ ...valor, assinouMulta: v === true })}
                disabled={desabilitado}
                className="mt-0.5"
              />
              <span className="text-[12.5px] leading-snug">
                Assinei o termo de multa e repassei ao responsável da multa.
              </span>
            </label>
            {erros?.termoMulta && (
              <p className="mt-1 text-[12px] font-medium text-[#E11D48]">{erros.termoMulta}</p>
            )}
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <Label className="text-[13px] font-medium text-[#1F2937]">
          Anexo <span className="ml-1 text-[#94A3B8]">até 5 arquivos de 10 MB</span>
        </Label>
        <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#C7D2E0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#64748B] transition hover:bg-[#F1F5F9]">
          <Paperclip className="h-4 w-4" />
          {valor.arquivos.length > 0
            ? `${valor.arquivos.length} arquivo(s) selecionado(s)`
            : "Selecionar arquivos"}
          <input
            type="file"
            multiple
            className="hidden"
            disabled={desabilitado}
            onChange={(e) => adicionarArquivos(e.target.files)}
          />
        </label>
        {valor.arquivos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {valor.arquivos.map((arquivo, i) => (
              <li
                key={`${arquivo.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#475569]"
              >
                <span className="truncate">
                  {arquivo.name} · {formatarTamanho(arquivo.size)}
                </span>
                <button
                  type="button"
                  aria-label="Remover anexo"
                  className="text-[#94A3B8] hover:text-[#E11D48]"
                  disabled={desabilitado}
                  onClick={() => removerArquivo(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {erros?.anexos && (
          <p className="mt-1 text-[12px] font-medium text-[#E11D48]">{erros.anexos}</p>
        )}
      </div>
    </div>
  );
}
