import { useEffect, useState } from "react";
import type { Colaborador } from "@/lib/dados";
import {
  carregarColaboradores,
  carregarSetoresECargos,
  carregarUnidades,
  organizacaoDisponivel,
} from "@/lib/organizacao";

export interface CatalogoOrganizacional {
  colaboradores: Colaborador[];
  /** Nomes dos setores cadastrados. */
  setores: string[];
  /** Nomes dos cargos cadastrados (across setores). */
  cargos: string[];
  /** Nomes das unidades cadastradas. */
  unidades: string[];
  carregando: boolean;
  disponivel: boolean;
}

/**
 * Carrega as listas da estrutura organizacional (colaboradores, setores e
 * unidades) direto do Lovable Cloud. Enquanto o Cloud não estiver configurado,
 * devolve listas vazias.
 */
export function useCatalogoOrganizacional(): CatalogoOrganizacional {
  const [estado, setEstado] = useState<CatalogoOrganizacional>({
    colaboradores: [],
    setores: [],
    cargos: [],
    unidades: [],
    carregando: true,
    disponivel: organizacaoDisponivel(),
  });

  useEffect(() => {
    if (!organizacaoDisponivel()) {
      setEstado((atual) => ({ ...atual, carregando: false }));
      return;
    }

    let ativo = true;
    Promise.all([carregarColaboradores(), carregarSetoresECargos(), carregarUnidades()])
      .then(([colaboradores, setoresECargos, unidades]) => {
        if (!ativo) return;
        setEstado({
          colaboradores,
          setores: setoresECargos.map((setor) => setor.nome),
          cargos: setoresECargos.flatMap((setor) => setor.cargos.map((cargo) => cargo.nome)),
          unidades: unidades.map((unidade) => unidade.nome),
          carregando: false,
          disponivel: true,
        });
      })
      .catch(() => {
        if (ativo) setEstado((atual) => ({ ...atual, carregando: false }));
      });

    return () => {
      ativo = false;
    };
  }, []);

  return estado;
}
