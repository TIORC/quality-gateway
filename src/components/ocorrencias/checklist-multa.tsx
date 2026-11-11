/**
 * Checklist da Apuração: "Gerou multa?". Com "Sim", abre uma nova ocorrência do
 * tipo Multas (com o seu próprio trilho) ligada a esta, com os dados da multa.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Paperclip, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampoSetores } from "@/components/ocorrencias/campo-renderer";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import type { UserSession } from "@/lib/auth";
import { traduzErro } from "@/lib/organizacao";
import type { Ocorrencia } from "@/lib/ocorrencias";
import {
  CHAVE_GEROU_MULTA,
  CHAVE_MULTA_OCORRENCIA_NUMERO,
  LIMITE_PDFS_MULTA,
  gerarOcorrenciaMulta,
  registrarSemMulta,
  type DadosMulta,
} from "@/lib/ocorrencias-crud";

const TAMANHO_MAX_PDF = 10 * 1024 * 1024;
const LIMITE_DESCRICAO = 6000;

const VAZIO: DadosMulta = {
  areas: [],
  responsavelProcesso: "",
  nomeEmpresa: "",
  declaracao: "",
  competencia: "",
  valor: "",
  descricao: "",
  pdfs: [],
};

interface Props {
  ocorrencia: Ocorrencia;
  session: UserSession | null;
  editavel: boolean;
  onSalvo: () => Promise<void>;
}

export function ChecklistMulta({ ocorrencia: o, session, editavel, onSalvo }: Props) {
  const { colaboradores } = useCatalogoOrganizacional();
  const numeroMulta = String(o.respostas[CHAVE_MULTA_OCORRENCIA_NUMERO] ?? "");
  const salvo = o.respostas[CHAVE_GEROU_MULTA];
  const [escolha, setEscolha] = useState<"sim" | "nao" | null>(
    salvo === true ? "sim" : salvo === false ? "nao" : null,
  );
  const [dados, setDados] = useState<DadosMulta>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const bloqueado = !editavel || !!numeroMulta;

  function atualizar(p: Partial<DadosMulta>) {
    setDados((d) => ({ ...d, ...p }));
  }

  function adicionarPdfs(lista: FileList | null) {
    if (!lista) return;
    const novos = Array.from(lista);
    const validos = novos.filter(
      (f) => (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) && f.size <= TAMANHO_MAX_PDF,
    );
    if (validos.length < novos.length) toast.error("Apenas PDFs de até 10 MB são aceitos.");
    const vagas = LIMITE_PDFS_MULTA - dados.pdfs.length;
    if (validos.length > vagas) toast.warning(`Limite de ${LIMITE_PDFS_MULTA} PDFs.`);
    atualizar({ pdfs: [...dados.pdfs, ...validos.slice(0, vagas)] });
  }

  async function confirmarNao() {
    setSalvando(true);
    try {
      await registrarSemMulta(o, session);
      toast.success("Checklist salvo: não gerou multa.");
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  async function gerar() {
    setSalvando(true);
    try {
      const criada = await gerarOcorrenciaMulta(o, dados, session);
      toast.success(`Multa ${criada.numero} aberta com o seu próprio trilho.`);
      await onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = [
    { valor: "sim", rotulo: "Sim", Icone: CheckCircle2, cor: "#E11D48" },
    { valor: "nao", rotulo: "Não", Icone: XCircle, cor: "#059669" },
  ] as const;

  return (
    <section className="rounded-xl border border-[#D9E0EA] bg-white p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Checklist da apuração
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-[13px] font-semibold text-[#1F2937]">Gerou multa?</p>
        <div
          role="radiogroup"
          aria-label="Gerou multa?"
          className="relative inline-flex rounded-lg border border-[#D9E0EA] bg-[#F1F5F9] p-0.5"
        >
          {opcoes.map(({ valor, rotulo, Icone, cor }) => {
            const ativo = escolha === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={bloqueado}
                onClick={() => setEscolha(valor)}
                className={`relative z-10 flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${
                  ativo ? "text-white" : "text-[#64748B] hover:text-[#334155]"
                }`}
              >
                {ativo && (
                  <motion.span
                    layoutId={`multa-toggle-${o.id}`}
                    className="absolute inset-0 -z-10 rounded-md shadow-sm"
                    style={{ backgroundColor: cor }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icone className="h-4 w-4" />
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {numeroMulta && (
        <p className="mt-3 rounded-lg bg-[#FDECEE] px-3 py-2 text-[13px] font-medium text-[#991A1A]">
          Multa aberta: {numeroMulta}. Acompanhe no trilho de Multas.
        </p>
      )}

      {escolha === "nao" && !bloqueado && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={salvando || salvo === false}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
            onClick={() => void confirmarNao()}
          >
            {salvando ? "Salvando…" : salvo === false ? "Salvo" : "Confirmar: não gerou multa"}
          </Button>
        </div>
      )}

      {escolha === "sim" && !numeroMulta && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 grid gap-4 border-t border-[#E9EEF5] pt-4 sm:grid-cols-2"
        >
          {!editavel ? (
            <p className="text-[13px] text-[#94A3B8] sm:col-span-2">
              Multa ainda não registrada. Só quem conduz a ocorrência pode preencher.
            </p>
          ) : (
            <>
              <div className="sm:col-span-2">
                <Label className="text-[13px] font-medium">
                  Área envolvida <span className="text-[#E11D48]">*</span>
                </Label>
                <div className="mt-1.5">
                  <CampoSetores
                    valor={dados.areas}
                    onChange={(v) => atualizar({ areas: Array.isArray(v) ? (v as string[]) : [] })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-[13px] font-medium">
                  Responsável pelo processo <span className="text-[#E11D48]">*</span>
                </Label>
                <Select
                  value={dados.responsavelProcesso}
                  onValueChange={(v) => atualizar({ responsavelProcesso: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecionar pessoa…" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.nome}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[13px] font-medium">
                  Nome da empresa <span className="text-[#E11D48]">*</span>
                </Label>
                <Input
                  className="mt-1.5"
                  value={dados.nomeEmpresa}
                  onChange={(e) => atualizar({ nomeEmpresa: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[13px] font-medium">
                  Declaração geradora da multa <span className="text-[#E11D48]">*</span>
                </Label>
                <Input
                  className="mt-1.5"
                  value={dados.declaracao}
                  onChange={(e) => atualizar({ declaracao: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-[13px] font-medium">
                  Competência da multa <span className="text-[#E11D48]">*</span>
                </Label>
                <Input
                  type="month"
                  className="mt-1.5"
                  value={dados.competencia}
                  onChange={(e) => atualizar({ competencia: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-[13px] font-medium">
                  Valor da multa <span className="text-[#E11D48]">*</span>
                </Label>
                <Input
                  className="mt-1.5"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={dados.valor}
                  onChange={(e) => atualizar({ valor: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[13px] font-medium">
                  Descrição do processo ocorrido <span className="text-[#E11D48]">*</span>
                </Label>
                <p className="text-[12px] text-[#64748B]">
                  Descreva tudo o que houve para gerar a multa.
                </p>
                <Textarea
                  className="mt-1.5 min-h-[140px]"
                  maxLength={LIMITE_DESCRICAO}
                  value={dados.descricao}
                  onChange={(e) => atualizar({ descricao: e.target.value })}
                />
                <p className="text-right text-[11px] text-[#94A3B8]">
                  {dados.descricao.length}/{LIMITE_DESCRICAO}
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-[13px] font-medium">
                  Multa — arquivos PDF (até {LIMITE_PDFS_MULTA}) <span className="text-[#E11D48]">*</span>
                </Label>
                <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#D9E0EA] px-4 py-3 text-[13px] font-semibold text-[#1E3A8A] hover:bg-[#F8FAFC]">
                  <Paperclip className="h-4 w-4" />
                  Anexar PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      adicionarPdfs(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {dados.pdfs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {dados.pdfs.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-1.5 text-[12px] text-[#334155]"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          aria-label="Remover PDF"
                          onClick={() => atualizar({ pdfs: dados.pdfs.filter((_, j) => j !== i) })}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={salvando}
                  className="bg-[#E11D48] text-white hover:bg-[#BE123C]"
                  onClick={() => void gerar()}
                >
                  {salvando ? "Gerando…" : "Gerar trilho de Multas"}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </section>
  );
}
