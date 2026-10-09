import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  atualizarSessao,
  getSession,
  logout,
  rolePodeAcessarPainel,
  type UserSession,
} from "@/lib/auth";
import { NAV_GROUPS } from "@/lib/navigation";
import { rotaInicial, rotaPermitida, rotasPermitidas } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppFooter } from "@/components/app-footer";
import { BarraSuperior } from "@/components/barra-superior";

const ICONS: Record<string, LucideIcon> = {
  Painel: LayoutDashboard,
  "Planos de Ação": Target,
  Ocorrencias: ClipboardList,
  Auditorias: ClipboardCheck,
  "Atas de Reunião": FileText,
  "Projetos e Estretégias": FolderKanban,
  Indicadores: BarChart3,
  Políticas: BookOpen,
  POPs: FileCheck,
  Colaboradores: Users,
  Configurações: Settings,
};

const PanelSessionContext = createContext<UserSession | null>(null);

export function usePanelSession(): UserSession | null {
  return useContext(PanelSessionContext);
}

export interface PanelShellProps {
  children: ReactNode;
  /** Remove a largura máxima do conteúdo (usar páginas que ocupam toda a tela). */
  wide?: boolean;
}

export function PanelShell({ children, wide = false }: PanelShellProps) {
  const router = useRouter();
  const location = useLocation();
  const [session, setSession] = useState<UserSession | null>(null);
  const [checando, setChecando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  // Guarda de acesso: admin, gestor e colaboradores com nível de acesso entram.
  // Antes, re-sincroniza a sessão com o vínculo organizacional atual (troca de
  // setor/cargo e permissões de documentos valem sem re-login).
  //
  // A sessão em cache (localStorage) libera a tela IMEDIATAMENTE (sem o flash
  // "Verificando acesso" a cada navegação entre módulos); a re-sincronização
  // roda em segundo plano e atualiza o estado ao concluir. `useLayoutEffect`
  // garante que a troca acontece antes do paint, mesmo na remontagem da rota.
  useLayoutEffect(() => {
    let ativo = true;
    const cache = getSession();
    if (cache && rolePodeAcessarPainel(cache) && rotaPermitida(cache, location.pathname)) {
      setSession(cache);
      setChecando(false);
    }
    void atualizarSessao().then((atual) => {
      if (!ativo) return;
      if (!atual || !rolePodeAcessarPainel(atual)) {
        logout();
        router.navigate({ to: "/", replace: true });
        return;
      }
      // Rota fora das permissões do nível: vai para a página inicial permitida.
      if (!rotaPermitida(atual, location.pathname)) {
        router.navigate({ to: rotaInicial(atual), replace: true });
        return;
      }
      setSession(atual);
      setChecando(false);
    });
    return () => {
      ativo = false;
    };
  }, [router, location.pathname]);

  // Fecha o menu mobile ao navegar.
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  if (checando || !session) {
    return (
      <main className="bg-brand-gradient relative flex min-h-screen items-center justify-center px-4">
        <div className="bg-brand-glow pointer-events-none absolute inset-0" />
        <p className="relative text-sm text-brand-muted">Verificando acesso…</p>
      </main>
    );
  }

  function handleLogout() {
    logout();
    router.navigate({ to: "/", replace: true });
  }

  // Menu filtrado pelas rotas permitidas ao nível de acesso da sessão.
  const permitidas = rotasPermitidas(session);
  const gruposVisiveis =
    permitidas.size === 0
      ? NAV_GROUPS
      : NAV_GROUPS.map((group) => ({
          ...group,
          items: group.items.filter((item) => permitidas.has(item.path)),
        })).filter((group) => group.items.length > 0);

  const sidebarContent = (
    <>
      <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-6 text-center">
        <img src="/logo-orcoma-branca.png" alt="Logo ORCOMA com Selo ISO" className="h-auto w-44 object-contain" />
        <div>
          <h1 className="text-sm font-semibold leading-tight text-brand-foreground">
            Gestão da Qualidade
          </h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {gruposVisiveis.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted/70">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = ICONS[item.label] ?? LayoutDashboard;
                const ativo = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        ativo
                          ? "bg-white/10 text-brand-foreground"
                          : "text-brand-muted hover:bg-white/5 hover:text-brand-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-line p-3">
        <ThemeToggle />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={handleLogout}
            className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted transition hover:bg-white/5 hover:text-brand-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair
          </button>
        </div>
      </div>
    </>
  );

  return (
    <PanelSessionContext.Provider value={session}>
      <div className="min-h-screen bg-muted/40">
        {/* Sidebar desktop */}
        <aside className="bg-brand-gradient fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex">
          {sidebarContent}
        </aside>

        {/* Overlay mobile */}
        {menuAberto ? (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuAberto(false)}
          />
        ) : null}

        {/* Sidebar mobile (drawer) */}
        <aside
          className={cn(
            "bg-brand-gradient fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 lg:hidden",
            menuAberto ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            onClick={() => setMenuAberto(false)}
            className="absolute right-3 top-4 rounded-md p-1 text-brand-muted transition hover:text-brand-foreground"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
          {sidebarContent}
        </aside>

        {/* Conteúdo */}
        <div className="relative isolate flex min-h-screen flex-col lg:pl-64">
          {/* Marca d'água: símbolo ocupando a área do conteúdo, atrás de tudo (10%). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-center bg-no-repeat opacity-10"
            style={{
              backgroundImage: "url(/logo-orcoma.png)",
              backgroundSize: "100% auto",
            }}
          />
          <BarraSuperior
            session={session}
            onAbrirMenu={() => setMenuAberto(true)}
            onSair={handleLogout}
          />
          <div className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-8", !wide && "max-w-6xl")}>
            {children}
          </div>
          <AppFooter />
        </div>
      </div>
    </PanelSessionContext.Provider>
  );
}
