export const NIVEIS_ACESSO = [
  {
    rotulo: "Administrador",
    descricao:
      "Acesso total e irrestrito. Gerencia usuários e concede permissões de administração a qualquer pessoa.",
  },
  {
    rotulo: "Gestor da Qualidade",
    descricao: "Acesso total. Cria e publica documentos, atas, projetos e indicadores.",
  },
  {
    rotulo: "Auxiliar da Qualidade",
    descricao: "Elabora e apura, mas não libera divulgação de POP.",
  },
  {
    rotulo: "Diretoria",
    descricao: "Enxerga tudo em leitura. Assina atas e aprova políticas.",
  },
  {
    rotulo: "Líder de setor",
    descricao: "Seu setor: ações, documentos, ocorrências e projetos.",
  },
  {
    rotulo: "Desenvolvedor",
    descricao:
      "Acesso como colaborador: suas ações, o que segue e o que foi divulgado ao seu setor.",
  },
  {
    rotulo: "Colaborador",
    descricao: "Suas ações, o que segue e o que foi divulgado a ele.",
  },
  {
    rotulo: "Colaborador de outra unidade",
    descricao: "Somente POPs expressamente liberados.",
  },
] as const;

/** Rótulos dos níveis de acesso (mesma ordem do array acima). */
export const ROTULOS_NIVEIS_ACESSO = NIVEIS_ACESSO.map((nivel) => nivel.rotulo);

/** Níveis que enxergam todos os POPs, sem liberação nem filtro de setor. */
export const NIVEIS_ACESSO_TOTAL_POPS = new Set<string>(["Administrador", "Gestor da Qualidade"]);

/** Níveis que filtram os POPs pelo setor do colaborador. */
export const NIVEIS_FILTRAM_POR_SETOR = new Set<string>(["Colaborador", "Líder de setor"]);

/** Nível que vê somente o que foi liberado individualmente. */
export const NIVEL_SOMENTE_LIBERADOS = "Colaborador de outra unidade";
