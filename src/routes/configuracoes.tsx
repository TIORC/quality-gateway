import { createFileRoute } from "@tanstack/react-router";
import {
  Briefcase,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PanelShell, usePanelSession } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Colaborador } from "@/lib/dados";
import { criarAcessoColaborador, listarEmailsComLogin, type UserRole } from "@/lib/auth";
import { NIVEL_SOMENTE_LIBERADOS, NIVEIS_ACESSO, normalizarSetor } from "@/lib/niveis-acesso";
import { ehLiderancaDaQualidade } from "@/lib/permissoes";
import { carregarPoliticas, type PoliticaItem } from "@/lib/politicas";
import {
  carregarPops,
  listarDocumentosLiberados,
  salvarLiberacaoDocumentos,
  type Pop,
} from "@/lib/pops";
import * as org from "@/lib/organizacao";
import type { Unidade } from "@/lib/organizacao";

/** Senha de acesso + perfil de login informados nos diálogos de colaborador. */
interface AcessoLogin {
  senha: string;
  perfilLogin: UserRole;
}

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações | Gestão da Qualidade" }],
  }),
  component: Configuracoes,
});

const ABAS = [
  { valor: "colaboradores", rotulo: "Colaboradores" },
  { valor: "cargos", rotulo: "Cargos" },
  { valor: "unidades", rotulo: "Unidades e setores" },
  { valor: "grupos", rotulo: "Grupos de acesso" },
  { valor: "tipos-reuniao", rotulo: "Tipos de reunião" },
  { valor: "origens", rotulo: "Origens de ação" },
  { valor: "lixeira", rotulo: "Lixeira" },
] as const;

const GRUPOS_PERSONALIZADOS = [
  "Rotina de indicadores",
  "Aprovadores de POP",
  "Comitê de riscos",
  "CIPA",
] as const;

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function corAcesso(nivel: string): string {
  switch (nivel) {
    case "Administrador":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "Gestor da Qualidade":
      return "bg-[#EEF2FF] text-[#4F46E5]";
    case "Diretoria":
      return "bg-[#FFF7ED] text-[#EA580C]";
    case "Líder de setor":
      return "bg-[#EFF6FF] text-[#2563EB]";
    default:
      return "bg-[#F1F5F9] text-[#475569]";
  }
}

interface CargoEmEdicao {
  setorId: string;
  cargo: CargoConfig | null;
}

function Configuracoes() {
  const gerenciador = useGerenciadorSetores();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadesCarregando, setUnidadesCarregando] = useState(true);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [novoSetorAberto, setNovoSetorAberto] = useState(false);
  const [setorEmEdicao, setSetorEmEdicao] = useState<SetorConfig | null>(null);
  const [cargoEmEdicao, setCargoEmEdicao] = useState<CargoEmEdicao | null>(null);
  const [setorParaRemover, setSetorParaRemover] = useState<SetorConfig | null>(null);
  const [novaUnidadeAberta, setNovaUnidadeAberta] = useState(false);
  const [unidadeEmEdicao, setUnidadeEmEdicao] = useState<Unidade | null>(null);
  const [unidadeParaRemover, setUnidadeParaRemover] = useState<Unidade | null>(null);

  useEffect(() => {
    if (!org.organizacaoDisponivel()) {
      setUnidadesCarregando(false);
      return;
    }
    let ativo = true;
    org
      .carregarUnidades()
      .then((lista) => {
        if (ativo) setUnidades(lista);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar as unidades.");
      })
      .finally(() => {
        if (ativo) setUnidadesCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!org.organizacaoDisponivel()) return;
    let ativo = true;
    org
      .carregarColaboradores()
      .then((lista) => {
        if (ativo) setColaboradores(lista);
      })
      .catch(() => {
        // A aba de colaboradores carrega a própria lista; aqui apenas a contagem fica vazia.
      });
    return () => {
      ativo = false;
    };
  }, []);

  function fecharDialogosDeSetor() {
    setNovoSetorAberto(false);
    setSetorEmEdicao(null);
  }

  function salvarSetor(nome: string) {
    if (setorEmEdicao) {
      gerenciador.renomearSetor(setorEmEdicao.id, nome);
    } else {
      gerenciador.criarSetor(nome);
    }
    fecharDialogosDeSetor();
  }

  function salvarCargo(setorDestinoId: string, nome: string) {
    if (!cargoEmEdicao) return;
    if (cargoEmEdicao.cargo) {
      gerenciador.editarCargo(cargoEmEdicao.cargo.id, setorDestinoId, nome);
    } else {
      gerenciador.criarCargo(setorDestinoId, nome);
    }
    setCargoEmEdicao(null);
  }

  function pedirConfirmacaoDeRemocao(setorId: string) {
    const setor = gerenciador.setores.find((item) => item.id === setorId);
    if (setor) setSetorParaRemover(setor);
  }

  function fecharDialogosDeUnidade() {
    setNovaUnidadeAberta(false);
    setUnidadeEmEdicao(null);
  }

  function salvarUnidade(nome: string, cidade: string) {
    if (unidadeEmEdicao) {
      org
        .atualizarUnidade(unidadeEmEdicao.id, nome, cidade)
        .then(() =>
          setUnidades((atual) =>
            atual.map((unidade) =>
              unidade.id === unidadeEmEdicao.id
                ? { id: unidadeEmEdicao.id, nome: nome.trim(), cidade: cidade.trim() }
                : unidade,
            ),
          ),
        )
        .catch(() => toast.error("Não foi possível editar a unidade."));
    } else {
      org
        .criarUnidade(nome, cidade)
        .then((nova) => setUnidades((atual) => [...atual, nova]))
        .catch(() => toast.error("Não foi possível criar a unidade."));
    }
    fecharDialogosDeUnidade();
  }

  function confirmarRemocaoDeUnidade() {
    if (!unidadeParaRemover) return;
    org
      .removerUnidade(unidadeParaRemover.id)
      .then(() =>
        setUnidades((atual) => atual.filter((unidade) => unidade.id !== unidadeParaRemover.id)),
      )
      .catch(() => toast.error("Não foi possível remover a unidade."));
    setUnidadeParaRemover(null);
  }

  // Ações de setores e cargos compartilhadas pelas abas "Cargos" e "Unidades e setores".
  const acoesSetores: SetoresTabProps = {
    setores: gerenciador.setores,
    colaboradores,
    carregando: gerenciador.carregando,
    criarSetor: gerenciador.criarSetor,
    renomearSetor: gerenciador.renomearSetor,
    removerSetor: pedirConfirmacaoDeRemocao,
    criarCargo: gerenciador.criarCargo,
    editarCargo: gerenciador.editarCargo,
    removerCargo: gerenciador.removerCargo,
    onNovoSetor: () => setNovoSetorAberto(true),
    onEditarSetor: (setor) => setSetorEmEdicao(setor),
    onNovoCargo: (setorId) => setCargoEmEdicao({ setorId, cargo: null }),
    onEditarCargo: (setorId, cargo) => setCargoEmEdicao({ setorId, cargo }),
  };

  return (
    <PanelShell wide>
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
          Organização
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
          Configurações
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">
          Quem participa de quê. É daqui que sai o direcionamento automático das ações e dos
          documentos.
        </p>
      </div>

      <Tabs defaultValue="colaboradores">
        <TabsList className="flex-wrap">
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              {aba.valor === "lixeira" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                  0
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="colaboradores">
          <ColaboradoresTab
            setores={gerenciador.setores}
            unidades={unidades}
            unidadesCarregando={unidadesCarregando}
            colaboradores={colaboradores}
          />
        </TabsContent>
        <TabsContent value="cargos">
          <CargosTab {...acoesSetores} colaboradores={colaboradores} />
        </TabsContent>
        <TabsContent value="unidades">
          <SetoresTab
            {...acoesSetores}
            colaboradores={colaboradores}
            unidades={unidades}
            unidadesCarregando={unidadesCarregando}
            onNovaUnidade={() => setNovaUnidadeAberta(true)}
            onEditarUnidade={(unidade) => setUnidadeEmEdicao(unidade)}
            onRemoverUnidade={(unidade) => setUnidadeParaRemover(unidade)}
          />
        </TabsContent>
        <TabsContent value="grupos">
          <TabEmConstrucao
            icone={Users}
            titulo="Grupos de acesso"
            descricao="Defina os grupos e os níveis de acesso de cada grupo."
          />
        </TabsContent>
        <TabsContent value="tipos-reuniao">
          <TabEmConstrucao
            icone={Users}
            titulo="Tipos de reunião"
            descricao="Cadastre os tipos de reunião usados nas atas."
          />
        </TabsContent>
        <TabsContent value="origens">
          <TabEmConstrucao
            icone={Wrench}
            titulo="Origens de ação"
            descricao="Cadastre as origens disponíveis ao abrir um plano de ação."
          />
        </TabsContent>
        <TabsContent value="lixeira">
          <TabEmConstrucao
            icone={Users}
            titulo="Lixeira"
            descricao="Itens excluídos aguardam recuperação definitiva."
          />
        </TabsContent>
      </Tabs>

      <SetorDialog
        aberto={novoSetorAberto || setorEmEdicao !== null}
        setor={setorEmEdicao}
        setores={gerenciador.setores}
        onFechar={fecharDialogosDeSetor}
        onSalvar={salvarSetor}
      />

      {cargoEmEdicao ? (
        <CargoDialog
          setores={gerenciador.setores}
          setorId={cargoEmEdicao.setorId}
          cargo={cargoEmEdicao.cargo}
          onFechar={() => setCargoEmEdicao(null)}
          onSalvar={salvarCargo}
        />
      ) : null}

      <RemoverSetorDialog
        setor={setorParaRemover}
        onFechar={() => setSetorParaRemover(null)}
        onConfirmar={() => {
          if (setorParaRemover) gerenciador.removerSetor(setorParaRemover.id);
          setSetorParaRemover(null);
        }}
      />

      <UnidadeDialog
        aberto={novaUnidadeAberta || unidadeEmEdicao !== null}
        unidade={unidadeEmEdicao}
        onFechar={fecharDialogosDeUnidade}
        onSalvar={salvarUnidade}
      />

      <RemoverUnidadeDialog
        unidade={unidadeParaRemover}
        colaboradoresVinculados={
          unidadeParaRemover
            ? colaboradores.filter((colaborador) => colaborador.unidade === unidadeParaRemover.nome)
                .length
            : 0
        }
        onFechar={() => setUnidadeParaRemover(null)}
        onConfirmar={confirmarRemocaoDeUnidade}
      />
    </PanelShell>
  );
}

interface TabEmConstrucaoProps {
  icone: typeof Users;
  titulo: string;
  descricao: string;
}

function TabEmConstrucao({ icone: Icone, titulo, descricao }: TabEmConstrucaoProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
          <Icone className="h-7 w-7 text-[#94A3B8]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#1F2937]">{titulo}</h3>
        <p className="mt-1.5 max-w-md text-sm text-[#64748B]">{descricao}</p>
      </div>
    </div>
  );
}

function CargosTab({
  setores,
  carregando,
  colaboradores,
  onNovoSetor,
  onEditarSetor,
  onNovoCargo,
  onEditarCargo,
  removerSetor,
  removerCargo,
}: SetoresTabProps) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const totalCargos = setores.reduce((soma, setor) => soma + setor.cargos.length, 0);

  const colunas = setores.map((setor) => {
    const cargosVisiveis = setor.cargos.filter(
      (cargo) => termo === "" || cargo.nome.toLowerCase().includes(termo),
    );
    const setorCombina = termo === "" || setor.nome.toLowerCase().includes(termo);
    return { setor, cargosVisiveis, visivel: setorCombina || cargosVisiveis.length > 0 };
  });

  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm text-[#64748B]">
              Cada setor tem a sua coluna de cargos. É daqui que sai a lista usada no cadastro de
              colaboradores.
            </p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              {setores.length} setor(es) · {totalCargos} cargo(s)
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar setor ou cargo"
                className="w-full pl-9 sm:w-[240px]"
              />
            </div>
            <Button variant="outline" onClick={onNovoSetor}>
              <Layers className="h-4 w-4" />
              Novo setor
            </Button>
          </div>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center px-6 py-12 text-sm text-[#64748B]">
            Carregando setores e cargos…
          </div>
        ) : setores.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <Briefcase className="h-6 w-6 text-[#94A3B8]" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Nenhum setor</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Crie o primeiro setor para depois inserir os cargos dentro dele.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 bg-[#F8FAFC] p-4 md:grid-cols-2 xl:grid-cols-3">
            {colunas.map(({ setor, cargosVisiveis, visivel }) =>
              !visivel ? null : (
                <div
                  key={setor.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E9EEF5] bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#E9EEF5] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#1F2937]">
                        {setor.nome}
                      </p>
                      <p className="text-[11px] text-[#64748B]">{setor.cargos.length} cargo(s)</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title={`Editar setor ${setor.nome}`}
                        aria-label={`Editar setor ${setor.nome}`}
                        onClick={() => onEditarSetor(setor)}
                        className="rounded-md p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1E3A8A]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={`Remover setor ${setor.nome}`}
                        aria-label={`Remover setor ${setor.nome}`}
                        onClick={() => removerSetor(setor.id)}
                        className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#E11D48]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 divide-y divide-[#E9EEF5]">
                    {cargosVisiveis.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
                        Nenhum cargo neste setor.
                      </p>
                    ) : (
                      cargosVisiveis.map((cargo) => {
                        const quantidade = colaboradores.filter(
                          (colaborador) => colaborador.cargo === cargo.nome,
                        ).length;
                        return (
                          <div
                            key={cargo.id}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-[#1F2937]">
                                {cargo.nome}
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                {quantidade > 0
                                  ? `${quantidade} colaborador(es)`
                                  : "Nenhum colaborador ainda"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onEditarCargo(setor.id, cargo)}
                                className="text-[12px] font-medium text-[#1E3A8A] transition hover:text-[#1E40AF]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removerCargo(cargo.id)}
                                className="text-[12px] font-medium text-[#E11D48] transition hover:text-[#BE123C]"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onNovoCargo(setor.id)}
                    className="flex items-center justify-center gap-1.5 border-t border-[#E9EEF5] px-4 py-2.5 text-[12px] font-medium text-[#1E3A8A] transition hover:bg-[#F8FAFC]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar cargo
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CargoConfig {
  id: string;
  nome: string;
}

interface SetorConfig {
  id: string;
  nome: string;
  cargos: CargoConfig[];
}

interface GerenciadorSetores {
  setores: SetorConfig[];
  carregando: boolean;
  criarSetor: (nome: string) => void;
  renomearSetor: (setorId: string, nome: string) => void;
  removerSetor: (setorId: string) => void;
  criarCargo: (setorId: string, nome: string) => void;
  editarCargo: (cargoId: string, setorDestinoId: string, nome: string) => void;
  removerCargo: (cargoId: string) => void;
}

interface SetoresTabProps extends GerenciadorSetores {
  carregando: boolean;
  colaboradores: Colaborador[];
  onNovoSetor: () => void;
  onEditarSetor: (setor: SetorConfig) => void;
  onNovoCargo: (setorId: string) => void;
  onEditarCargo: (setorId: string, cargo: CargoConfig) => void;
}

/**
 * Estado único de setores e cargos, compartilhado pelas abas "Cargos" e
 * "Unidades e setores" da tela de Configurações. Os dados vêm do Lovable Cloud.
 */
function useGerenciadorSetores(): GerenciadorSetores {
  const [setores, setSetores] = useState<SetorConfig[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    if (!org.organizacaoDisponivel()) {
      setCarregando(false);
      return;
    }
    org
      .carregarSetoresECargos()
      .then((lista) => {
        if (ativo) setSetores(lista);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar os setores e cargos.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function atualizarSetor(setorAtualizado: SetorConfig) {
    setSetores((atual) =>
      atual.map((setor) => (setor.id === setorAtualizado.id ? setorAtualizado : setor)),
    );
  }

  function recarregar() {
    org
      .carregarSetoresECargos()
      .then(setSetores)
      .catch(() => toast.error("Não foi possível atualizar os setores e cargos."));
  }

  function criarSetor(nome: string) {
    org
      .criarSetor(nome)
      .then((novo) => setSetores((atual) => [...atual, novo]))
      .catch((erro: unknown) =>
        toast.error(erro instanceof Error ? erro.message : "Não foi possível criar o setor."),
      );
  }

  function renomearSetor(setorId: string, nome: string) {
    org
      .renomearSetor(setorId, nome)
      .then(() =>
        setSetores((atual) =>
          atual.map((setor) => (setor.id === setorId ? { ...setor, nome: nome.trim() } : setor)),
        ),
      )
      .catch(() => toast.error("Não foi possível renomear o setor."));
  }

  function removerSetor(setorId: string) {
    org
      .removerSetor(setorId)
      .then(() => setSetores((atual) => atual.filter((setor) => setor.id !== setorId)))
      .catch(() => toast.error("Não foi possível remover o setor."));
  }

  function criarCargo(setorId: string, nome: string) {
    org
      .criarCargo(setorId, nome)
      .then(atualizarSetor)
      .catch(() => toast.error("Não foi possível criar o cargo."));
  }

  function editarCargo(cargoId: string, setorDestinoId: string, nome: string) {
    org
      .editarCargo(cargoId, setorDestinoId, nome)
      .then(recarregar)
      .catch(() => toast.error("Não foi possível editar o cargo."));
  }

  function removerCargo(cargoId: string) {
    org
      .removerCargo(cargoId)
      .then(recarregar)
      .catch(() => toast.error("Não foi possível remover o cargo."));
  }

  return {
    setores,
    carregando,
    criarSetor,
    renomearSetor,
    removerSetor,
    criarCargo,
    editarCargo,
    removerCargo,
  };
}

function SetoresTab({
  setores,
  carregando,
  colaboradores,
  unidades,
  unidadesCarregando,
  onNovoSetor,
  onEditarSetor,
  onNovoCargo,
  onEditarCargo,
  removerSetor,
  removerCargo,
  onNovaUnidade,
  onEditarUnidade,
  onRemoverUnidade,
}: SetoresTabProps & {
  unidades: Unidade[];
  unidadesCarregando: boolean;
  onNovaUnidade: () => void;
  onEditarUnidade: (unidade: Unidade) => void;
  onRemoverUnidade: (unidade: Unidade) => void;
}) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = setores.filter(
    (setor) =>
      termo === "" ||
      setor.nome.toLowerCase().includes(termo) ||
      setor.cargos.some((cargo) => cargo.nome.toLowerCase().includes(termo)),
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1F2937]">Unidades</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Unidades em que os setores e cargos abaixo são aplicados.
            </p>
          </div>
          <Button
            onClick={onNovaUnidade}
            className="shrink-0 bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            <Plus className="h-4 w-4" />
            Nova unidade
          </Button>
        </div>
        {unidadesCarregando ? (
          <div className="px-4 py-8 text-center text-sm text-[#64748B]">Carregando unidades…</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {unidades.map((unidade) => (
              <div
                key={unidade.id}
                className="group flex items-start justify-between gap-3 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] px-4 py-3 transition hover:border-[#D9E0EA]"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1F2937]">{unidade.nome}</p>
                  <p className="text-[11px] text-[#64748B]">{unidade.cidade || "Sem cidade"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title={`Editar unidade ${unidade.nome}`}
                    aria-label={`Editar unidade ${unidade.nome}`}
                    onClick={() => onEditarUnidade(unidade)}
                    className="rounded-md p-1.5 text-[#64748B] transition hover:bg-white hover:text-[#1E3A8A]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={`Remover unidade ${unidade.nome}`}
                    aria-label={`Remover unidade ${unidade.nome}`}
                    onClick={() => onRemoverUnidade(unidade)}
                    className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#E11D48]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {unidades.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">Nenhuma unidade cadastrada.</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1F2937]">Setores e cargos</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Crie o setor e insira os cargos dentro dele — exemplo: TI (Desenvolvedor,
              Infraestrutura) e Qualidade (Coordenador, Auxiliar).
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar setor ou cargo"
                className="w-full pl-9 sm:w-[220px]"
              />
            </div>
            <Button onClick={onNovoSetor} className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]">
              <Plus className="h-4 w-4" />
              Novo setor
            </Button>
          </div>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center px-6 py-12 text-sm text-[#64748B]">
            Carregando setores e cargos…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <Layers className="h-6 w-6 text-[#94A3B8]" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#1F2937]">
              {setores.length === 0 ? "Nenhum setor cadastrado" : "Nada encontrado"}
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              {setores.length === 0
                ? "Crie o primeiro setor para depois inserir os cargos."
                : "Ajuste a busca para ver setores e cargos."}
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto bg-[#F8FAFC] p-4">
            {filtrados.map((setor) => (
              <div
                key={setor.id}
                className="flex min-w-[240px] max-w-[300px] flex-col overflow-hidden rounded-2xl border border-[#E9EEF5] bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#E9EEF5] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#1F2937]">
                      {setor.nome}
                    </p>
                    <p className="text-[11px] text-[#64748B]">{setor.cargos.length} cargo(s)</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title={`Editar setor ${setor.nome}`}
                      aria-label={`Editar setor ${setor.nome}`}
                      onClick={() => onEditarSetor(setor)}
                      className="rounded-md p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1E3A8A]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={`Remover setor ${setor.nome}`}
                      aria-label={`Remover setor ${setor.nome}`}
                      onClick={() => removerSetor(setor.id)}
                      className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#E11D48]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 divide-y divide-[#E9EEF5]">
                  {setor.cargos.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
                      Nenhum cargo neste setor
                    </p>
                  ) : (
                    setor.cargos.map((cargo) => {
                      const quantidade = colaboradores.filter(
                        (colaborador) => colaborador.cargo === cargo.nome,
                      ).length;
                      return (
                        <div
                          key={cargo.id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[#1F2937]">
                              {cargo.nome}
                            </p>
                            <p className="text-[11px] text-[#94A3B8]">
                              {quantidade > 0
                                ? `${quantidade} colaborador(es)`
                                : "Nenhum colaborador ainda"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onEditarCargo(setor.id, cargo)}
                              className="text-[12px] font-medium text-[#1E3A8A] transition hover:text-[#1E40AF]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => removerCargo(cargo.id)}
                              className="text-[12px] font-medium text-[#E11D48] transition hover:text-[#BE123C]"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNovoCargo(setor.id)}
                  className="flex items-center justify-center gap-1.5 border-t border-[#E9EEF5] px-4 py-2.5 text-[12px] font-medium text-[#1E3A8A] transition hover:bg-[#F8FAFC]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar cargo
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onNovoSetor}
              className="flex min-w-[200px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-4 py-8 text-center transition hover:border-[#1E3A8A] hover:bg-[#EEF2FF]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A8A] text-white">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1F2937]">Novo setor</p>
                <p className="text-[11px] text-[#94A3B8]">Crie um novo setor</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ColaboradoresTabProps {
  setores: SetorConfig[];
  unidades: Unidade[];
  unidadesCarregando: boolean;
  colaboradores: Colaborador[];
}

function ColaboradoresTab({
  setores,
  unidades,
  unidadesCarregando,
  colaboradores,
}: ColaboradoresTabProps) {
  const session = usePanelSession();
  const [lista, setLista] = useState<Colaborador[]>(colaboradores);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState("todas");
  const [setor, setSetor] = useState("todos");
  const [novoAberto, setNovoAberto] = useState(false);
  const [gerindo, setGerindo] = useState<Colaborador | null>(null);
  const [liberadosPorColaborador, setLiberadosPorColaborador] = useState<Record<string, number>>(
    {},
  );
  const [emailsComLogin, setEmailsComLogin] = useState<string[]>([]);

  // Contagem de documentos liberados (POPs e políticas) por colaborador.
  useEffect(() => {
    let ativo = true;
    Promise.all(
      lista.map(async (colaborador) => {
        if (!colaborador.id) return [colaborador.id, 0] as const;
        try {
          const [pops, politicas] = await Promise.all([
            listarDocumentosLiberados(colaborador.id, "pop"),
            listarDocumentosLiberados(colaborador.id, "politica"),
          ]);
          return [colaborador.id, pops.length + politicas.length] as const;
        } catch {
          return [colaborador.id, 0] as const;
        }
      }),
    )
      .then((pares) => {
        if (!ativo) return;
        const mapa: Record<string, number> = {};
        for (const [id, quantidade] of pares) mapa[id] = quantidade;
        setLiberadosPorColaborador(mapa);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [lista]);

  // Quem já tem acesso de login (badge "Tem login" / "Sem login").
  useEffect(() => {
    let ativo = true;
    listarEmailsComLogin()
      .then((emails) => {
        if (ativo) setEmailsComLogin(emails);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    if (!org.organizacaoDisponivel()) {
      setCarregando(false);
      return;
    }
    org
      .carregarColaboradores()
      .then((dados) => {
        if (ativo) setLista(dados);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar os colaboradores.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const usuarioAtual = lista.find((colaborador) => colaborador.email === session?.email);
  const podeDarAdministracao =
    session?.role === "admin" ||
    usuarioAtual?.nivelAcesso === "Administrador" ||
    usuarioAtual?.nivelAcesso === "Desenvolvedor";

  const filtrados = lista.filter((colaborador) => {
    const termo = busca.trim().toLowerCase();
    const bateBusca =
      termo === "" ||
      colaborador.nome.toLowerCase().includes(termo) ||
      colaborador.cargo.toLowerCase().includes(termo) ||
      (colaborador.email ?? "").toLowerCase().includes(termo);
    const bateUnidade = unidade === "todas" || colaborador.unidade === unidade;
    const bateSetor = setor === "todos" || colaborador.setor === setor;
    return bateBusca && bateUnidade && bateSetor;
  });

  function adicionar(dados: Omit<Colaborador, "id">, acesso?: AcessoLogin) {
    org
      .criarColaborador({ ...dados, id: "" })
      .then(async (criado) => {
        setLista((atual) => [criado, ...atual]);
        // Cria o acesso de login quando o admin preencheu uma senha.
        if (acesso?.senha && (criado.email ?? dados.email)) {
          try {
            await criarAcessoColaborador(
              criado.id,
              criado.email ?? dados.email ?? "",
              acesso.senha,
              acesso.perfilLogin,
            );
            toast.success("Colaborador criado com acesso de login.");
            setEmailsComLogin((atual) => [
              ...atual,
              (criado.email ?? dados.email ?? "").trim().toLowerCase(),
            ]);
          } catch (erro) {
            toast.error(
              erro instanceof Error ? erro.message : "Não foi possível criar o acesso de login.",
            );
          }
        }
      })
      .catch((erro: unknown) =>
        toast.error(erro instanceof Error ? erro.message : "Não foi possível criar o colaborador."),
      );
    setNovoAberto(false);
  }

  function salvar(
    colaborador: Colaborador,
    liberados?: { pops: string[]; politicas: string[] } | null,
    acesso?: AcessoLogin,
  ) {
    org
      .atualizarColaborador(colaborador)
      .then((atualizado) => {
        setLista((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
        if (atualizado.email && colaborador.email !== atualizado.email) {
          const antigo = (colaborador.email ?? "").trim().toLowerCase();
          const novo = atualizado.email.trim().toLowerCase();
          setEmailsComLogin((atual) =>
            atual.includes(antigo)
              ? atual.map((atualEmail) => (atualEmail === antigo ? novo : atualEmail))
              : atual.includes(novo)
                ? atual
                : [...atual, novo],
          );
        }
      })
      .catch((erro: unknown) =>
        toast.error(
          erro instanceof Error ? erro.message : "Não foi possível salvar o colaborador.",
        ),
      );

    // Cria/atualiza o acesso de login quando o admin preencheu uma senha.
    if (acesso?.senha) {
      criarAcessoColaborador(
        colaborador.id,
        colaborador.email ?? "",
        acesso.senha,
        acesso.perfilLogin,
      )
        .then(() => {
          toast.success("Acesso de login salvo.");
          setEmailsComLogin((atual) =>
            atual.includes((colaborador.email ?? "").trim().toLowerCase())
              ? atual
              : [...atual, (colaborador.email ?? "").trim().toLowerCase()],
          );
        })
        .catch((erro: unknown) =>
          toast.error(
            erro instanceof Error ? erro.message : "Não foi possível salvar o acesso de login.",
          ),
        );
    }

    // Liberação individual de documentos (quando informada pelo diálogo).
    if (liberados && colaborador.id) {
      const autor = session?.nome ?? "";
      Promise.all([
        salvarLiberacaoDocumentos(colaborador.id, liberados.pops, "pop", autor),
        salvarLiberacaoDocumentos(colaborador.id, liberados.politicas, "politica", autor),
      ])
        .then(() => {
          setLiberadosPorColaborador((atual) => ({
            ...atual,
            [colaborador.id]: liberados.pops.length + liberados.politicas.length,
          }));
          toast.success("Liberação de documentos atualizada.");
        })
        .catch(() => toast.error("Não foi possível salvar a liberação de documentos."));
    }

    setGerindo(null);
  }

  const nomesUnidades = unidades.map((unidadeListada) => unidadeListada.nome);
  const cidadesUnidades = new Map(
    unidades.map((unidadeListada) => [unidadeListada.nome, unidadeListada.cidade]),
  );

  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar colaborador"
              className="pl-9"
            />
          </div>

          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger className="w-full xl:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {nomesUnidades.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className="w-full xl:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {setores.map((opcao) => (
                <SelectItem key={opcao.id} value={opcao.nome}>
                  {opcao.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setNovoAberto(true)}>
            <Plus className="h-4 w-4" />
            Novo colaborador
          </Button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center px-6 py-12 text-sm text-[#64748B]">
            Carregando colaboradores…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className="border-b border-[#E9EEF5]">
                  <Th>Colaborador</Th>
                  <Th>E-mail</Th>
                  <Th>Unidade</Th>
                  <Th>Cidade</Th>
                  <Th>Setor</Th>
                  <Th>Nível de acesso</Th>
                  <Th>Grupos</Th>
                  <Th>Acesso</Th>
                  <Th>Docs liberados</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((colaborador) => {
                  const temLogin = emailsComLogin.includes(
                    (colaborador.email ?? "").trim().toLowerCase(),
                  );
                  return (
                    <tr key={colaborador.id} className="border-b border-[#E9EEF5] last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#312E81] text-[12px] font-semibold text-white">
                            {iniciais(colaborador.nome)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#1F2937]">
                              {colaborador.nome}
                            </p>
                            <p className="truncate text-[11px] text-[#64748B]">
                              {colaborador.cargo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#64748B]">
                        {colaborador.email}
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#1F2937]">
                        {colaborador.unidade}
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#64748B]">
                        {colaborador.cidade}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-medium text-[#1F2937]">
                          {colaborador.setor}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${corAcesso(colaborador.nivelAcesso ?? "")}`}
                        >
                          {colaborador.nivelAcesso}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-[13px] text-[#64748B]">
                        {colaborador.grupos ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            temLogin ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                        >
                          {temLogin ? "Tem login" : "Sem login"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-block rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">
                          {liberadosPorColaborador[colaborador.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-4 whitespace-nowrap">
                          <span
                            className={
                              colaborador.exclusao === "Permitido"
                                ? "text-[13px] font-medium text-[#059669]"
                                : "text-[13px] font-medium text-[#E11D48]"
                            }
                          >
                            {colaborador.exclusao}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGerindo(colaborador)}
                            className="text-[13px] font-medium text-[#1E3A8A] transition hover:text-[#1E40AF]"
                          >
                            Gerir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!carregando && filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
              <UserPlus className="h-6 w-6 text-[#94A3B8]" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#1F2937]">
              Nenhum colaborador encontrado
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">Ajuste a busca ou os filtros.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-[#D9E0EA] bg-white p-5 shadow-sm">
        <h3 className="text-[14px] font-semibold text-[#1F2937]">Níveis de acesso</h3>
        <p className="mt-1 text-sm text-[#64748B]">
          O que cada nível pode ver e fazer dentro da plataforma.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
          {NIVEIS_ACESSO.map((nivel) => (
            <div key={nivel.rotulo} className="flex flex-col gap-0.5">
              <p className="text-[13px] font-semibold text-[#1F2937]">{nivel.rotulo}</p>
              <p className="text-[13px] leading-relaxed text-[#64748B]">{nivel.descricao}</p>
            </div>
          ))}
        </div>
      </div>

      <NovoColaboradorDialog
        aberto={novoAberto}
        setores={setores}
        unidades={nomesUnidades}
        cidadesUnidades={cidadesUnidades}
        unidadesCarregando={unidadesCarregando}
        onFechar={() => setNovoAberto(false)}
        onCriar={adicionar}
        podeDarAdministracao={podeDarAdministracao}
        podeCriarLogin={session?.role === "admin"}
      />
      {gerindo ? (
        <GerirColaboradorDialog
          colaborador={gerindo}
          setores={setores}
          unidades={nomesUnidades}
          cidadesUnidades={cidadesUnidades}
          unidadesCarregando={unidadesCarregando}
          onFechar={() => setGerindo(null)}
          onSalvar={salvar}
          podeDarAdministracao={podeDarAdministracao}
        />
      ) : null}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface NovoColaboradorDialogProps {
  aberto: boolean;
  setores: SetorConfig[];
  unidades: string[];
  cidadesUnidades: Map<string, string>;
  unidadesCarregando: boolean;
  onFechar: () => void;
  onCriar: (dados: Omit<Colaborador, "id">, acesso?: AcessoLogin) => void;
  podeDarAdministracao: boolean;
  /** Somente admins podem criar acesso de login para novos colaboradores. */
  podeCriarLogin: boolean;
}

function NovoColaboradorDialog({
  aberto,
  setores,
  unidades,
  cidadesUnidades,
  unidadesCarregando,
  onFechar,
  onCriar,
  podeDarAdministracao,
  podeCriarLogin,
}: NovoColaboradorDialogProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState(() => setores[0]?.nome ?? "");
  const [unidade, setUnidade] = useState(() => unidades[0] ?? "Matriz");
  const [nivelAcesso, setNivelAcesso] = useState("Colaborador");
  const [grupos, setGrupos] = useState<string[]>([]);
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [perfilLogin, setPerfilLogin] = useState<UserRole>("usuario");

  // Só aparecem no cadastro os cargos do setor escolhido.
  const cargosDoSetor = setores.find((item) => item.nome === setor)?.cargos ?? [];

  function trocarSetor(novoSetor: string) {
    setSetor(novoSetor);
    setCargo("");
  }

  const nivelSelecionado = NIVEIS_ACESSO.find((nivel) => nivel.rotulo === nivelAcesso);
  const niveisDisponiveis = podeDarAdministracao
    ? NIVEIS_ACESSO
    : NIVEIS_ACESSO.filter((nivel) => nivel.rotulo !== "Administrador");

  function alternarGrupo(grupo: string) {
    setGrupos((atual) =>
      atual.includes(grupo) ? atual.filter((item) => item !== grupo) : [...atual, grupo],
    );
  }

  function limpar() {
    setNome("");
    setEmail("");
    setCargo("");
    setSetor(setores[0]?.nome ?? "");
    setUnidade(unidades[0] ?? "Matriz");
    setNivelAcesso("Colaborador");
    setGrupos([]);
    setSenhaAcesso("");
    setPerfilLogin("usuario");
  }

  function enviar() {
    if (!nome.trim()) return;
    const cidade = cidadesUnidades.get(unidade) ?? "";
    onCriar(
      {
        nome: nome.trim(),
        cargo: cargo || "Sem cargo",
        email: email.trim(),
        unidade,
        cidade,
        setor,
        nivelAcesso,
        ...(grupos.length > 0 ? { grupos: grupos.join(", ") } : {}),
        exclusao: "Sem acesso",
      },
      podeCriarLogin && senhaAcesso.trim() ? { senha: senhaAcesso, perfilLogin } : undefined,
    );
    limpar();
  }

  useEffect(() => {
    if (!aberto) {
      limpar();
      return;
    }
    // Se o setor escolhido deixar de existir, volta para o primeiro da lista.
    setSetor((atual) =>
      setores.some((item) => item.nome === atual) ? atual : (setores[0]?.nome ?? ""),
    );
  }, [aberto, setores]);

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
          <DialogDescription>
            Cadastre o colaborador e defina o que ele pode ver e fazer.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo">
              <Input
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Maria da Silva"
              />
            </Campo>

            <Campo rotulo="E-mail corporativo">
              <Input
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                placeholder="nome@empresa.com.br"
                type="email"
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor">
              <Select value={setor} onValueChange={trocarSetor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((opcao: SetorConfig) => (
                    <SelectItem key={opcao.id} value={opcao.nome}>
                      {opcao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                O cargo é escolhido depois, dentro do setor selecionado.
              </p>
            </Campo>

            <Campo rotulo="Unidade">
              <Select value={unidade} onValueChange={setUnidade} disabled={unidadesCarregando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao === "Matriz" ? "Matriz — Maracás/BA" : opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Nível de acesso">
            <Select value={nivelAcesso} onValueChange={setNivelAcesso}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {niveisDisponiveis.map((nivel) => (
                  <SelectItem key={nivel.rotulo} value={nivel.rotulo}>
                    {nivel.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nivelSelecionado ? (
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                {nivelSelecionado.descricao}
              </p>
            ) : null}
          </Campo>

          <Campo rotulo="Grupos personalizados">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GRUPOS_PERSONALIZADOS.map((grupo) => (
                <label
                  key={grupo}
                  htmlFor={`novo-grupo-${grupo}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`novo-grupo-${grupo}`}
                    checked={grupos.includes(grupo)}
                    onCheckedChange={() => alternarGrupo(grupo)}
                  />
                  {grupo}
                </label>
              ))}
            </div>
          </Campo>

          {podeCriarLogin ? (
            <Campo rotulo="Acesso de login (opcional)">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Input
                    type="password"
                    value={senhaAcesso}
                    onChange={(evento) => setSenhaAcesso(evento.target.value)}
                    placeholder="Senha de acesso"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-[#94A3B8]">
                    Preencha para já criar o login deste colaborador.
                  </p>
                </div>
                <Select
                  value={perfilLogin}
                  onValueChange={(valor) => setPerfilLogin(valor as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Perfil de login: usuário</SelectItem>
                    <SelectItem value="gestor">Perfil de login: gestor</SelectItem>
                    <SelectItem value="admin">Perfil de login: admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Campo>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={enviar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Criar colaborador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GerirColaboradorDialogProps {
  colaborador: Colaborador | null;
  setores: SetorConfig[];
  unidades: string[];
  cidadesUnidades: Map<string, string>;
  unidadesCarregando: boolean;
  onFechar: () => void;
  onSalvar: (
    colaborador: Colaborador,
    liberados?: { pops: string[]; politicas: string[] } | null,
    acesso?: AcessoLogin,
  ) => void;
  podeDarAdministracao: boolean;
}

function GerirColaboradorDialog({
  colaborador,
  setores,
  unidades,
  cidadesUnidades,
  unidadesCarregando,
  onFechar,
  onSalvar,
  podeDarAdministracao,
}: GerirColaboradorDialogProps) {
  const [setor, setSetor] = useState(colaborador?.setor ?? "Qualidade");
  const [unidade, setUnidade] = useState(colaborador?.unidade ?? "Matriz");
  const [nivelAcesso, setNivelAcesso] = useState(colaborador?.nivelAcesso ?? "Colaborador");
  const [exclusao, setExclusao] = useState(colaborador?.exclusao ?? "Sem acesso");
  const [nome, setNome] = useState(colaborador?.nome ?? "");
  const [email, setEmail] = useState(colaborador?.email ?? "");
  const [cargo, setCargo] = useState(colaborador?.cargo ?? "Sem cargo");
  const [grupos, setGrupos] = useState<string[]>(
    colaborador?.grupos ? colaborador.grupos.split(", ").filter(Boolean) : [],
  );
  // Permissões de documentos (Qualidade): visíveis só para o setor Qualidade e
  // editáveis apenas pela liderança da Qualidade e administradores.
  const [permAdicionar, setPermAdicionar] = useState(
    colaborador?.permAdicionarDocumentos ?? false,
  );
  const [permModificar, setPermModificar] = useState(
    colaborador?.permModificarDocumentos ?? false,
  );
  const [permExcluir, setPermExcluir] = useState(
    colaborador?.permExcluirDocumentos ?? false,
  );
  // Permissão dedicada a planos de ação: concedida pelo Gestor da Qualidade.
  const [permExcluirPlanos, setPermExcluirPlanos] = useState(
    colaborador?.permExcluirPlanos ?? false,
  );
  // Liberação individual de documentos (quando o nível exige liberação).
  const [popsCatalogo, setPopsCatalogo] = useState<Pop[]>([]);
  const [politicasCatalogo, setPoliticasCatalogo] = useState<PoliticaItem[]>([]);
  const [popIdsLiberados, setPopIdsLiberados] = useState<string[]>([]);
  const [politicaIdsLiberados, setPoliticaIdsLiberados] = useState<string[]>([]);
  const [liberacaoCarregando, setLiberacaoCarregando] = useState(false);
  const podeLiberar = nivelAcesso === NIVEL_SOMENTE_LIBERADOS;
  // Criação de acesso de login: somente para sessão de admin.
  const sessionDialog = usePanelSession();
  const podeCriarLogin = sessionDialog?.role === "admin";
  // Edição das permissões de documentos: liderança da Qualidade e admins.
  const podeEditarPermissoes = ehLiderancaDaQualidade(sessionDialog);
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [perfilLogin, setPerfilLogin] = useState<UserRole>("usuario");

  // Re-sincroniza as permissões ao trocar de colaborador no mesmo diálogo.
  useEffect(() => {
    setPermAdicionar(colaborador?.permAdicionarDocumentos ?? false);
    setPermModificar(colaborador?.permModificarDocumentos ?? false);
    setPermExcluir(colaborador?.permExcluirDocumentos ?? false);
    setPermExcluirPlanos(colaborador?.permExcluirPlanos ?? false);
  }, [colaborador]);

  useEffect(() => {
    if (!colaborador || !podeLiberar) return;
    let ativo = true;
    setLiberacaoCarregando(true);
    Promise.all([
      carregarPops(),
      carregarPoliticas(),
      listarDocumentosLiberados(colaborador.id, "pop").catch(() => [] as string[]),
      listarDocumentosLiberados(colaborador.id, "politica").catch(() => [] as string[]),
    ])
      .then(([catalogoPops, politicas, idsPops, idsPoliticas]) => {
        if (!ativo) return;
        setPopsCatalogo([...catalogoPops.pops].sort((a, b) => a.codigo.localeCompare(b.codigo)));
        setPoliticasCatalogo([...politicas].sort((a, b) => a.codigo.localeCompare(b.codigo)));
        setPopIdsLiberados(idsPops);
        setPoliticaIdsLiberados(idsPoliticas);
      })
      .catch(() => undefined)
      .finally(() => {
        if (ativo) setLiberacaoCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [colaborador, podeLiberar]);

  function alternarLiberacaoPop(popId: string) {
    setPopIdsLiberados((atual) =>
      atual.includes(popId) ? atual.filter((id) => id !== popId) : [...atual, popId],
    );
  }

  function alternarLiberacaoPolitica(politicaId: string) {
    setPoliticaIdsLiberados((atual) =>
      atual.includes(politicaId)
        ? atual.filter((id) => id !== politicaId)
        : [...atual, politicaId],
    );
  }

  const atual = colaborador;
  if (!atual) return null;

  const cargosDoSetor = setores.find((item) => item.nome === setor)?.cargos ?? [];
  const nivelSelecionado = NIVEIS_ACESSO.find((nivel) => nivel.rotulo === nivelAcesso);
  const niveisDisponiveis = podeDarAdministracao
    ? NIVEIS_ACESSO
    : NIVEIS_ACESSO.filter((nivel) => nivel.rotulo !== "Administrador");

  function trocarSetor(novoSetor: string) {
    setSetor(novoSetor);
    const cargosDoNovoSetor = setores.find((item) => item.nome === novoSetor)?.cargos ?? [];
    setCargo(cargosDoNovoSetor[0]?.nome ?? "Sem cargo");
  }

  function alternarGrupo(grupo: string) {
    setGrupos((atualLista) =>
      atualLista.includes(grupo)
        ? atualLista.filter((item) => item !== grupo)
        : [...atualLista, grupo],
    );
  }

  function enviar() {
    if (!atual) return;
    const atualizado: Colaborador = {
      id: atual.id,
      nome: nome.trim() || atual.nome,
      email: email.trim() || (atual.email ?? ""),
      cargo: cargo.trim() || "Sem cargo",
      setor,
      unidade,
      nivelAcesso,
      exclusao,
      permAdicionarDocumentos: permAdicionar,
      permModificarDocumentos: permModificar,
      permExcluirDocumentos: permExcluir,
      permExcluirPlanos: permExcluirPlanos,
    };
    if (atual.cidade) atualizado.cidade = atual.cidade;
    if (grupos.length > 0) atualizado.grupos = grupos.join(", ");
    const acesso: AcessoLogin | undefined =
      podeCriarLogin && senhaAcesso.trim() ? { senha: senhaAcesso, perfilLogin } : undefined;
    onSalvar(
      atualizado,
      podeLiberar ? { pops: popIdsLiberados, politicas: politicaIdsLiberados } : null,
      acesso,
    );
  }

  return (
    <Dialog open onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerir colaborador</DialogTitle>
          <DialogDescription>Permissões e acesso de {colaborador.nome}.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#312E81] text-[14px] font-semibold text-white">
            {iniciais(colaborador.nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#1F2937]">{colaborador.nome}</p>
            <p className="truncate text-[12px] text-[#64748B]">
              {colaborador.cargo} · {colaborador.email}
            </p>
          </div>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo">
              <Input
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Maria da Silva"
              />
            </Campo>

            <Campo rotulo="E-mail corporativo">
              <Input
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                placeholder="nome@empresa.com.br"
                type="email"
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Setor">
              <Select value={setor} onValueChange={trocarSetor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((opcao) => (
                    <SelectItem key={opcao.id} value={opcao.nome}>
                      {opcao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Cargo">
              <Select value={cargo} onValueChange={(valor) => setCargo(valor)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {cargosDoSetor.map((opcao) => (
                    <SelectItem key={opcao.id} value={opcao.nome}>
                      {opcao.nome}
                    </SelectItem>
                  ))}
                  {cargosDoSetor.length === 0 ? (
                    <SelectItem value="Sem cargo">Sem cargo</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                Trocar o setor atualiza a lista de cargos disponíveis.
              </p>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Unidade">
              <Select value={unidade} onValueChange={setUnidade} disabled={unidadesCarregando}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao === "Matriz"
                        ? `Matriz — ${cidadesUnidades.get(opcao) ?? "Maracás/BA"}`
                        : opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Nível de acesso">
            <Select value={nivelAcesso} onValueChange={setNivelAcesso}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {niveisDisponiveis.map((nivel) => (
                  <SelectItem key={nivel.rotulo} value={nivel.rotulo}>
                    {nivel.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nivelSelecionado ? (
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                {nivelSelecionado.descricao}
              </p>
            ) : null}
          </Campo>

          <Campo rotulo="Grupos personalizados">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GRUPOS_PERSONALIZADOS.map((grupo) => (
                <label
                  key={grupo}
                  htmlFor={`gerir-grupo-${grupo}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                >
                  <Checkbox
                    id={`gerir-grupo-${grupo}`}
                    checked={grupos.includes(grupo)}
                    onCheckedChange={() => alternarGrupo(grupo)}
                  />
                  {grupo}
                </label>
              ))}
            </div>
          </Campo>

          {normalizarSetor(setor) === "qualidade" ? (
            <Campo rotulo="Permissões de documentos (Qualidade)">
              <div className="space-y-2.5 rounded-xl border border-[#E9EEF5] p-4">
                <label
                  htmlFor="perm-adicionar-documentos"
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#1F2937]">
                      Adicionar documentos
                    </span>
                    <span className="block text-[11.5px] leading-relaxed text-[#64748B]">
                      Permite criar novos POPs e políticas e duplicar documentos.
                    </span>
                  </span>
                  <Switch
                    id="perm-adicionar-documentos"
                    checked={permAdicionar}
                    onCheckedChange={setPermAdicionar}
                    disabled={!podeEditarPermissoes}
                    aria-label="Permitir adicionar documentos"
                  />
                </label>
                <label
                  htmlFor="perm-modificar-documentos"
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#1F2937]">
                      Modificar documentos
                    </span>
                    <span className="block text-[11.5px] leading-relaxed text-[#64748B]">
                      Permite editar POPs e políticas já cadastrados.
                    </span>
                  </span>
                  <Switch
                    id="perm-modificar-documentos"
                    checked={permModificar}
                    onCheckedChange={setPermModificar}
                    disabled={!podeEditarPermissoes}
                    aria-label="Permitir modificar documentos"
                  />
                </label>
                <label
                  htmlFor="perm-excluir-documentos"
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#1F2937]">
                      Excluir documentos
                    </span>
                    <span className="block text-[11.5px] leading-relaxed text-[#64748B]">
                      Permite remover POPs e políticas.
                    </span>
                  </span>
                  <Switch
                    id="perm-excluir-documentos"
                    checked={permExcluir}
                    onCheckedChange={setPermExcluir}
                    disabled={!podeEditarPermissoes}
                    aria-label="Permitir excluir documentos"
                  />
                </label>
                <label
                  htmlFor="perm-excluir-planos"
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#1F2937]">
                      Excluir planos de ação
                    </span>
                    <span className="block text-[11.5px] leading-relaxed text-[#64748B]">
                      Permite remover ações do módulo Planos de Ação.
                    </span>
                  </span>
                  <Switch
                    id="perm-excluir-planos"
                    checked={permExcluirPlanos}
                    onCheckedChange={setPermExcluirPlanos}
                    disabled={!podeEditarPermissoes}
                    aria-label="Permitir excluir planos de ação"
                  />
                </label>
              </div>
              {!podeEditarPermissoes ? (
                <p className="mt-1.5 text-[11.5px] text-[#94A3B8]">
                  Somente o Coordenador da Qualidade e os administradores podem alterar estas
                  permissões.
                </p>
              ) : null}
            </Campo>
          ) : null}

          <Campo rotulo="Acesso de login (opcional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Input
                  type="password"
                  value={senhaAcesso}
                  onChange={(evento) => setSenhaAcesso(evento.target.value)}
                  placeholder="Nova senha de acesso"
                  autoComplete="new-password"
                />
                <p className="text-xs text-[#94A3B8]">
                  Preencha para (re)criar o login deste colaborador.
                </p>
              </div>
              <Select
                value={perfilLogin}
                onValueChange={(valor) => setPerfilLogin(valor as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Perfil de login: usuário</SelectItem>
                  <SelectItem value="gestor">Perfil de login: gestor</SelectItem>
                  <SelectItem value="admin">Perfil de login: admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Campo>

          <Campo rotulo="Exclusão">
            <Select value={exclusao} onValueChange={setExclusao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sem acesso">Sem acesso</SelectItem>
                <SelectItem value="Permitido">Permitido</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          {podeLiberar ? (
            <>
              <Campo rotulo="Documentos liberados (POPs)">
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Este nível enxerga somente os POPs marcados abaixo.
                </p>
                {liberacaoCarregando ? (
                  <p className="text-[13px] text-[#64748B]">Carregando documentos…</p>
                ) : popsCatalogo.length === 0 ? (
                  <p className="text-[13px] text-[#94A3B8]">Nenhum POP cadastrado.</p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-[#E9EEF5] p-2">
                    {popsCatalogo.map((pop) => (
                      <label
                        key={pop.id}
                        htmlFor={`liberar-pop-${pop.id}`}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#1F2937] transition hover:bg-[#F8FAFC]"
                      >
                        <Checkbox
                          id={`liberar-pop-${pop.id}`}
                          checked={popIdsLiberados.includes(pop.id)}
                          onCheckedChange={() => alternarLiberacaoPop(pop.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{pop.codigo}</span> — {pop.titulo}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </Campo>
              <Campo rotulo="Documentos liberados (Políticas)">
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Este nível enxerga somente as políticas marcadas abaixo.
                </p>
                {liberacaoCarregando ? (
                  <p className="text-[13px] text-[#64748B]">Carregando documentos…</p>
                ) : politicasCatalogo.length === 0 ? (
                  <p className="text-[13px] text-[#94A3B8]">Nenhuma política cadastrada.</p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-[#E9EEF5] p-2">
                    {politicasCatalogo.map((politica) => (
                      <label
                        key={politica.id}
                        htmlFor={`liberar-politica-${politica.id}`}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#1F2937] transition hover:bg-[#F8FAFC]"
                      >
                        <Checkbox
                          id={`liberar-politica-${politica.id}`}
                          checked={politicaIdsLiberados.includes(politica.id)}
                          onCheckedChange={() => alternarLiberacaoPolitica(politica.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{politica.codigo}</span> — {politica.titulo}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[12px] text-[#94A3B8]">
                  {popIdsLiberados.length + politicaIdsLiberados.length} documento(s) liberado(s).
                </p>
              </Campo>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={enviar}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetorDialog({
  aberto,
  setor,
  setores,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  setor: SetorConfig | null;
  setores: SetorConfig[];
  onFechar: () => void;
  onSalvar: (nome: string) => void;
}) {
  const [nome, setNome] = useState(setor?.nome ?? "");

  useEffect(() => {
    setNome(setor?.nome ?? "");
  }, [setor?.nome, aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(abre) => !abre && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{setor ? "Editar setor" : "Novo setor"}</DialogTitle>
          <DialogDescription>Defina o nome do setor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do setor</Label>
            <Input
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: TI"
              autoFocus
            />
          </div>
          {setores.some((item) => item.nome.toLowerCase() === nome.trim().toLowerCase()) &&
            setor?.nome !== nome && (
              <p className="text-[12px] text-[#E11D48]">Esse setor já existe.</p>
            )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSalvar(nome)}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CargoDialog({
  setores,
  setorId,
  cargo,
  onFechar,
  onSalvar,
}: {
  setores: SetorConfig[];
  setorId: string;
  cargo: CargoConfig | null;
  onFechar: () => void;
  onSalvar: (setorDestinoId: string, nome: string) => void;
}) {
  const [nome, setNome] = useState(cargo?.nome ?? "");
  const [destinoId, setDestinoId] = useState(setorId);

  useEffect(() => {
    setNome(cargo?.nome ?? "");
    setDestinoId(setorId);
  }, [cargo, setorId]);

  return (
    <Dialog open onOpenChange={(abre) => !abre && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cargo ? "Editar cargo" : "Novo cargo"}</DialogTitle>
          <DialogDescription>
            {cargo
              ? `Edite o nome do cargo ou mova-o para outro setor.`
              : "Defina o nome do cargo e o setor de destino."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do cargo</Label>
            <Input
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Desenvolvedor"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Setor de destino</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((opcao) => (
                  <SelectItem key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSalvar(destinoId, nome)}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoverSetorDialog({
  setor,
  onFechar,
  onConfirmar,
}: {
  setor: SetorConfig | null;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={setor !== null} onOpenChange={(abre) => !abre && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remover setor</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover o setor <strong>{setor?.nome}</strong>? Isso também
            removerá todos os cargos associados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirmar}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnidadeDialog({
  aberto,
  unidade,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  unidade: Unidade | null;
  onFechar: () => void;
  onSalvar: (nome: string, cidade: string) => void;
}) {
  const [nome, setNome] = useState(unidade?.nome ?? "");
  const [cidade, setCidade] = useState(unidade?.cidade ?? "");

  useEffect(() => {
    setNome(unidade?.nome ?? "");
    setCidade(unidade?.cidade ?? "");
  }, [unidade, aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(abre) => !abre && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{unidade ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          <DialogDescription>Defina o nome e a cidade da unidade.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da unidade</Label>
            <Input
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Filial 3"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input
              value={cidade}
              onChange={(evento) => setCidade(evento.target.value)}
              placeholder="Ex.: Maracás/BA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (nome.trim()) onSalvar(nome, cidade);
            }}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoverUnidadeDialog({
  unidade,
  colaboradoresVinculados,
  onFechar,
  onConfirmar,
}: {
  unidade: Unidade | null;
  colaboradoresVinculados: number;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={unidade !== null} onOpenChange={(abre) => !abre && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remover unidade</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover a unidade <strong>{unidade?.nome}</strong>?
          </DialogDescription>
        </DialogHeader>
        {colaboradoresVinculados > 0 ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] leading-relaxed text-[#B91C1C]">
            A unidade possui {colaboradoresVinculados} colaborador(es) vinculado(s). Desvincule
            antes de excluir.
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={colaboradoresVinculados > 0}
            onClick={onConfirmar}
          >
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
      {children}
    </th>
  );
}
