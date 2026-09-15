/** Definição central dos menus laterais do portal. */

export type AppRoutePath =
  | "/painel"
  | "/planos-de-acao"
  | "/ocorrencias"
  | "/auditorias"
  | "/atas-de-reuniao"
  | "/projetos-e-estrategias"
  | "/indicadores"
  | "/politicas"
  | "/pops"
  | "/funcionarios"
  | "/configuracoes"
  | "/disparo-de-cobrancas"
  | "/meu-perfil";

export interface NavItem {
  label: string;
  path: AppRoutePath;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Geral",
    items: [
      { label: "Painel", path: "/painel" },
      { label: "Planos de Ação", path: "/planos-de-acao" },
      { label: "Ocorrencias", path: "/ocorrencias" },
      { label: "Auditorias", path: "/auditorias" },
      { label: "Atas de Reunião", path: "/atas-de-reuniao" },
      { label: "Projetos e Estretégias", path: "/projetos-e-estrategias" },
      { label: "Indicadores", path: "/indicadores" },
      { label: "Políticas", path: "/politicas" },
      { label: "POPs", path: "/pops" },
      { label: "Funcionários", path: "/funcionarios" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Configurações", path: "/configuracoes" },
      { label: "Disparo de Cobranças", path: "/disparo-de-cobrancas" },
    ],
  },
  {
    title: "Conta",
    items: [{ label: "Meu Perfil", path: "/meu-perfil" }],
  },
];
