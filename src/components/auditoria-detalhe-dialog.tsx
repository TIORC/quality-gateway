import { useState, type ReactNode } from "react";
import { Building2, CalendarDays, ClipboardCheck, Play, Users } from "lucide-react";
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
import { atualizarStatusAuditoria } from "@/lib/auditorias-crud";
import { type Auditoria, type StatusAuditoria } from "@/lib/auditorias";
import { dataISOparaBR } from "@/lib/projetos";
import { traduzErro } from "@/lib/organizacao";
import { formatarDataHoraBrasilia } from "@/lib/utils";

const CORES_STATUS: Record<StatusAuditoria, string> = {
  planejada: "bg-[#EEF2FF] text-[#1E3A8A]",
  em_execucao: "bg-[#DCFCE7] text-[#15803D]",
  concluida: "bg-[#F1F5F9] text-[#64748B]",
};

const ROTULO_STATUS: Record<StatusAuditoria, string> = {
  planejada: "Planejada",
  em_execucao: "Em Execução",
  concluida: "Concluída",
};

export function StatusAuditoriaBadge({ status }: { status: StatusAuditoria }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CORES_STATUS[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROTULO_STATUS[status]}
    </span>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
        {rotulo}
      </p>
      <div className="mt-1 text-[13px] leading-relaxed text-[#334155]">{children}</div>
    </div>
  );
}

function BlocoTexto({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <Campo rotulo={rotulo}>
      {texto.trim() ? (
        <p className="whitespace-pre-wrap rounded-lg bg-[#F8FAFC] p-3 text-[#334155]">
          {texto.trim()}
        </p>
      ) : (
        <p className="italic text-[#94A3B8]">Não informado.</p>
      )}
    </Campo>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#475569]">
      {children}
    </span>
  );
}

interface AuditoriaDetalheDialogProps {
  aberto: boolean;
  auditoria: Auditoria | null;
  podeGerenciar: boolean;
  onFechar: () => void;
  onAlterada?: (auditoria: Auditoria) => void;
}

export function AuditoriaDetalheDialog({
  aberto,
  auditoria,
  podeGerenciar,
  onFechar,
  onAlterada,
}: AuditoriaDetalheDialogProps) {
  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      {aberto && auditoria ? (
        <DialogContent className="max-w-3xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-[18px] leading-snug text-[#1F2937]">
              {auditoria.titulo || "Sem título"}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-[#94A3B8]">
                {auditoria.codigo || "—"}
              </span>
              <StatusAuditoriaBadge status={auditoria.status} />
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip>{auditoria.tipo}</Chip>
              {auditoria.norma ? (
                <Chip>
                  <ClipboardCheck className="h-3 w-3" />
                  {auditoria.norma}
                </Chip>
              ) : null}
              {auditoria.unidade ? (
                <Chip>
                  <Building2 className="h-3 w-3" />
                  {auditoria.unidade}
                </Chip>
              ) : null}
              {auditoria.dataPlanejada ? (
                <Chip>
                  <CalendarDays className="h-3 w-3" />
                  {dataISOparaBR(auditoria.dataPlanejada)}
                </Chip>
              ) : null}
            </div>

            {auditoria.setoresAuditados.length > 0 ? (
              <Campo rotulo="Setores auditados">
                <div className="flex flex-wrap gap-1">
                  {auditoria.setoresAuditados.map((setor) => (
                    <span
                      key={setor}
                      className="rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#1E3A8A]"
                    >
                      {setor}
                    </span>
                  ))}
                </div>
              </Campo>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Auditores">
                {auditoria.auditores.length > 0 ? (
                  <ul className="space-y-1">
                    {auditoria.auditores.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-[#64748B]" />
                        {p.nome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic text-[#94A3B8]">—</p>
                )}
              </Campo>
              <Campo rotulo="Auditados">
                {auditoria.auditados.length > 0 ? (
                  <ul className="space-y-1">
                    {auditoria.auditados.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-[#64748B]" />
                        {p.nome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic text-[#94A3B8]">—</p>
                )}
              </Campo>
            </div>

            <BlocoTexto rotulo="Relatório" texto={auditoria.relatorio} />
            <BlocoTexto rotulo="Evidências" texto={auditoria.evidencias} />

            <div className="grid gap-4 border-t border-[#EEF2F7] pt-4 sm:grid-cols-2">
              <Campo rotulo="Criada por">
                {auditoria.criadaPorNome
                  ? `${auditoria.criadaPorNome}${auditoria.criadaPorEmail ? ` — ${auditoria.criadaPorEmail}` : ""}`
                  : "—"}
              </Campo>
              <Campo rotulo="Criada em">
                {auditoria.createdAt ? formatarDataHoraBrasilia(auditoria.createdAt) : "—"}
              </Campo>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Fechar
            </Button>
            {podeGerenciar && auditoria.status === "planejada" ? (
              <IniciarExecucaoBotao auditoria={auditoria} onAlterada={onAlterada} />
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function IniciarExecucaoBotao({
  auditoria,
  onAlterada,
}: {
  auditoria: Auditoria;
  onAlterada?: ((auditoria: Auditoria) => void) | undefined;
}) {
  const [salvando, setSalvando] = useState(false);

  async function iniciar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await atualizarStatusAuditoria(auditoria.id, "em_execucao");
      toast.success("Auditoria movida para Em Execução");
      onAlterada?.({ ...auditoria, status: "em_execucao" });
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void iniciar()}
      disabled={salvando}
      className="gap-2 bg-[#15803D] text-white hover:bg-[#166534]"
    >
      <Play className="h-4 w-4" />
      {salvando ? "Movendo…" : "Iniciar Execução"}
    </Button>
  );
}
