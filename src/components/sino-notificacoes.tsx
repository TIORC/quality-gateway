import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { getSession } from "@/lib/auth";
import {
  contarNaoLidas, listarNotificacoes, marcarNotificacaoLida,
  marcarTodasLidas, type NotificacaoPainel,
} from "@/lib/notificacoes";
import { formatarDataHoraBrasilia } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function SinoNotificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<NotificacaoPainel[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);

  async function recarregar() {
    const sessao = getSession();
    const email = sessao?.email;
    if (!email) return;
    try {
      const [lista, total] = await Promise.all([
        listarNotificacoes(email, 20), contarNaoLidas(email),
      ]);
      setItens(lista);
      setNaoLidas(total);
    } catch { /* sem banco: sino fica zerado */ }
  }

  useEffect(() => {
    recarregar();
    const id = window.setInterval(recarregar, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (aberto) void recarregar();
  }, [aberto]);

  async function abrirItem(n: NotificacaoPainel) {
    if (!n.lida) {
      try { await marcarNotificacaoLida(n.id); } catch { /* noop */ }
      setItens((atual) => atual.map((i) => (i.id === n.id ? { ...i, lida: true } : i)));
      setNaoLidas((v) => Math.max(0, v - 1));
    }
    setAberto(false);
    if (n.planoId) {
      void router.navigate({ to: "/planos-de-acao", search: { abrir: n.planoId } });
    } else {
      void router.navigate({ to: "/painel" });
    }
  }

  async function marcarTodas() {
    const sessao = getSession();
    if (!sessao?.email) return;
    try {
      await marcarTodasLidas(sessao.email);
      setItens((atual) => atual.map((i) => ({ ...i, lida: true })));
      setNaoLidas(0);
    } catch { /* noop */ }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative rounded-md p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1F2937]"
        >
          <Bell className="h-[18px] w-[18px]" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E11D48] px-1 text-[10px] font-bold text-white">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-[#E9EEF5] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#1F2937]">Notificações</p>
          {naoLidas > 0 && (
            <button type="button" onClick={marcarTodas} className="text-[12px] font-medium text-[#4F46E5] hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {itens.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">
              Nenhuma notificação por aqui. 🎉
            </p>
          ) : (
            itens.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void abrirItem(n)}
                className="flex w-full gap-3 border-b border-[#F1F5F9] px-4 py-3 text-left transition last:border-0 hover:bg-[#F8FAFC]"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? "bg-[#E2E8F0]" : "bg-[#4F46E5]"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#1F2937]">{n.titulo}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[12px] text-[#64748B]">{n.mensagem}</span>
                  <span className="mt-1 block text-[11px] text-[#94A3B8]" title={formatarDataHoraBrasilia(n.createdAt)}>
                    {tempoRelativo(n.createdAt)}
                    {n.autorNome ? ` · ${n.autorNome}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-[#E9EEF5] p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => { setAberto(false); void router.navigate({ to: "/painel" }); }}>
            Ver painel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
