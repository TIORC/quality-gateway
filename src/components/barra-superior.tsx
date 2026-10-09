import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { UserSession } from "@/lib/auth";
import { carregarEmpresaPrincipal, type Empresa } from "@/lib/organizacao";
import { SinoNotificacoes } from "@/components/sino-notificacoes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BarraSuperiorProps {
  session: UserSession;
  onAbrirMenu: () => void;
  onSair: () => void;
}

/** Iniciais do nome (até duas letras), usadas no avatar. */
function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase();
}

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Cabeçalho exibido em todas as páginas: empresa e unidade de quem está logado,
 * data e hora, sino de notificações e os dados do usuário com menu de conta.
 */
export function BarraSuperior({ session, onAbrirMenu, onSair }: BarraSuperiorProps) {
  const [agora, setAgora] = useState(() => new Date());
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let ativo = true;
    void carregarEmpresaPrincipal().then((dados) => {
      if (ativo) setEmpresa(dados);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const nomeEmpresa = empresa?.nome ?? "";
  const unidade = session.unidade || empresa?.filial || "";
  const cargo = session.cargo || "Sem cargo";
  const data = formatoData.format(agora);

  return (
    <header className="bg-brand-gradient sticky top-0 z-30 border-b border-brand-line">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onAbrirMenu}
            className="rounded-md p-1 text-brand-muted transition hover:text-brand-foreground lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.15em] text-brand-muted">
            {nomeEmpresa}
            {unidade ? <span className="text-brand-foreground/60"> | {unidade.toUpperCase()}</span> : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <p className="hidden text-xs capitalize text-brand-muted md:block">{data}</p>
          <span className="hidden h-4 w-px bg-brand-line md:block" />
          <p className="hidden font-mono text-xs tabular-nums text-brand-muted sm:block">
            {formatoHora.format(agora)}
          </p>

          <SinoNotificacoes />

          <span className="hidden h-6 w-px bg-brand-line sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-white/5",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/30",
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-semibold text-white">
                {iniciais(session.nome) || <UserRound className="h-4 w-4" />}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-brand-foreground">
                  {session.nome}
                </span>
                <span className="block text-[11px] text-brand-muted">{cargo}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-brand-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold">{session.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{session.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/meu-perfil">
                  <UserRound className="mr-2 h-4 w-4" />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSair}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
