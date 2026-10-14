import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listarLogs,
  type AcaoLog,
  type EntidadeLog,
  type LogAtividade,
} from "@/lib/logs-atividade";
import { podeVerLogs } from "@/lib/permissoes";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [{ title: "Logs de atividade | Gestão da Qualidade" }],
  }),
  component: Logs,
});

const ROTULO_ACAO: Record<AcaoLog, string> = {
  adicionado: "Adicionado",
  editado: "Editado",
  movimentado: "Movimentado",
  excluido: "Excluído",
};

const COR_ACAO: Record<AcaoLog, string> = {
  adicionado: "bg-green-100 text-green-800",
  editado: "bg-blue-100 text-blue-800",
  movimentado: "bg-amber-100 text-amber-800",
  excluido: "bg-red-100 text-red-800",
};

const ROTULO_ENTIDADE: Record<EntidadeLog, string> = {
  pop: "POP",
  politica: "Política",
};

const TODOS = "todos";

function Logs() {
  const sessao = usePanelSession();
  const permitido = podeVerLogs(sessao);
  const [logs, setLogs] = useState<LogAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState<AcaoLog | typeof TODOS>(TODOS);
  const [entidade, setEntidade] = useState<EntidadeLog | typeof TODOS>(TODOS);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLogs(await listarLogs());
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar os logs.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (permitido) void carregar();
    else setCarregando(false);
  }, [permitido, carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return logs.filter((log) => {
      if (acao !== TODOS && log.acao !== acao) return false;
      if (entidade !== TODOS && log.entidade !== entidade) return false;
      if (!termo) return true;
      return [log.codigo, log.titulo, log.detalhe, log.atorNome, log.atorEmail]
        .some((campo) => campo.toLowerCase().includes(termo));
    });
  }, [logs, acao, entidade, busca]);

  if (!permitido) {
    return (
      <PanelShell wide>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          Acesso restrito ao Desenvolvedor do Sistema e ao Gestor da Qualidade.
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Gestão
          </p>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Logs de atividade</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Adições, edições, movimentações e exclusões de POPs e políticas. Mostra os 500 eventos
            mais recentes.
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            className="pl-9"
            placeholder="Buscar por código, título, detalhe ou responsável"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
        <Select value={acao} onValueChange={(valor) => setAcao(valor as AcaoLog | typeof TODOS)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as ações</SelectItem>
            {(Object.keys(ROTULO_ACAO) as AcaoLog[]).map((item) => (
              <SelectItem key={item} value={item}>
                {ROTULO_ACAO[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={entidade}
          onValueChange={(valor) => setEntidade(valor as EntidadeLog | typeof TODOS)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {(Object.keys(ROTULO_ENTIDADE) as EntidadeLog[]).map((item) => (
              <SelectItem key={item} value={item}>
                {ROTULO_ENTIDADE[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Detalhe</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[#64748B]">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[#64748B]">
                  Nenhum evento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-[#475569]">
                    {new Date(log.criadoEm).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COR_ACAO[log.acao]}`}
                    >
                      {ROTULO_ACAO[log.acao]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{ROTULO_ENTIDADE[log.entidade]}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{log.codigo}</TableCell>
                  <TableCell className="text-sm">{log.titulo}</TableCell>
                  <TableCell className="text-xs text-[#475569]">{log.detalhe}</TableCell>
                  <TableCell className="text-xs">
                    {log.atorNome || log.atorEmail || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PanelShell>
  );
}
