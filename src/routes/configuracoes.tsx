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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CARGOS_POR_SETOR, COLABORADORES, SETORES, UNIDADES, type Colaborador } from "@/lib/dados";

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

const NIVEIS_ACESSO = [
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
    descricao: "Somente POPs e políticas expressamente liberados.",
  },
];

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
  const [novoSetorAberto, setNovoSetorAberto] = useState(false);
  const [setorEmEdicao, setSetorEmEdicao] = useState<SetorConfig | null>(null);
  const [cargoEmEdicao, setCargoEmEdicao] = useState<CargoEmEdicao | null>(null);
  const [setorParaRemover, setSetorParaRemover] = useState<SetorConfig | null>(null);

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

  // Ações de setores e cargos compartilhadas pelas abas "Cargos" e "Unidades e setores".
  const acoesSetores: SetoresTabProps = {
    setores: gerenciador.setores,
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
          <ColaboradoresTab setores={gerenciador.setores} />
        </TabsContent>
        <TabsContent value="cargos">
          <CargosTab {...acoesSetores} />
        </TabsContent>
        <TabsContent value="unidades">
          <SetoresTab {...acoesSetores} />
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

      <p className="mt-8 text-center text-[11px] text-[#94A3B8]">
        Desenvolvido com 💙 pelos Desenvolvedores Orcoma Contabilidade
      </p>
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

        {setores.length === 0 ? (
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
                        const quantidade = COLABORADORES.filter(
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
  criarSetor: (nome: string) => void;
  renomearSetor: (setorId: string, nome: string) => void;
  removerSetor: (setorId: string) => void;
  criarCargo: (setorId: string, nome: string) => void;
  editarCargo: (cargoId: string, setorDestinoId: string, nome: string) => void;
  removerCargo: (cargoId: string) => void;
}

interface SetoresTabProps extends GerenciadorSetores {
  onNovoSetor: () => void;
  onEditarSetor: (setor: SetorConfig) => void;
  onNovoCargo: (setorId: string) => void;
  onEditarCargo: (setorId: string, cargo: CargoConfig) => void;
}

function idUnico(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Monta a estrutura inicial de setores e cargos a partir do mock de dados. */
function criarSetoresIniciais(): SetorConfig[] {
  return SETORES.map((nome, indice) => ({
    id: `setor_base_${indice}`,
    nome,
    cargos: (CARGOS_POR_SETOR[nome] ?? []).map((cargo, posicao) => ({
      id: `cargo_base_${indice}_${posicao}`,
      nome: cargo,
    })),
  }));
}

/**
 * Estado único de setores e cargos, compartilhado pelas abas "Cargos" e
 * "Unidades e setores" da tela de Configurações.
 */
function useGerenciadorSetores(): GerenciadorSetores {
  const [setores, setSetores] = useState<SetorConfig[]>(criarSetoresIniciais);

  function criarSetor(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    setSetores((atual) => [...atual, { id: idUnico("setor"), nome: limpo, cargos: [] }]);
  }

  function renomearSetor(setorId: string, nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    setSetores((atual) =>
      atual.map((setor) => (setor.id === setorId ? { ...setor, nome: limpo } : setor)),
    );
  }

  function removerSetor(setorId: string) {
    setSetores((atual) => atual.filter((setor) => setor.id !== setorId));
  }

  function criarCargo(setorId: string, nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    setSetores((atual) =>
      atual.map((setor) =>
        setor.id === setorId
          ? { ...setor, cargos: [...setor.cargos, { id: idUnico("cargo"), nome: limpo }] }
          : setor,
      ),
    );
  }

  function editarCargo(cargoId: string, setorDestinoId: string, nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    setSetores((atual) => {
      const setorOrigem = atual.find((setor) => setor.cargos.some((cargo) => cargo.id === cargoId));
      if (!setorOrigem) return atual;

      // Mesmo setor: renomeia mantendo a posição na coluna.
      if (setorOrigem.id === setorDestinoId) {
        return atual.map((setor) =>
          setor.id === setorDestinoId
            ? {
                ...setor,
                cargos: setor.cargos.map((cargo) =>
                  cargo.id === cargoId ? { ...cargo, nome: limpo } : cargo,
                ),
              }
            : setor,
        );
      }

      // Troca de setor: move o cargo para o destino preservando o id.
      return atual.map((setor) => {
        if (setor.id === setorOrigem.id) {
          return { ...setor, cargos: setor.cargos.filter((cargo) => cargo.id !== cargoId) };
        }
        if (setor.id === setorDestinoId) {
          return { ...setor, cargos: [...setor.cargos, { id: cargoId, nome: limpo }] };
        }
        return setor;
      });
    });
  }

  function removerCargo(cargoId: string) {
    setSetores((atual) =>
      atual.map((setor) => ({
        ...setor,
        cargos: setor.cargos.filter((cargo) => cargo.id !== cargoId),
      })),
    );
  }

  return {
    setores,
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
  onNovoSetor,
  onEditarSetor,
  onNovoCargo,
  onEditarCargo,
  removerSetor,
  removerCargo,
}: SetoresTabProps) {
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
        <div className="border-b border-[#E9EEF5] p-4">
          <h3 className="text-[14px] font-semibold text-[#1F2937]">Unidades</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Unidades em que os setores e cargos abaixo são aplicados.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {UNIDADES.map((unidade) => (
            <div
              key={unidade}
              className="rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] px-4 py-3"
            >
              <p className="text-[13px] font-semibold text-[#1F2937]">{unidade}</p>
              <p className="text-[11px] text-[#64748B]">
                {unidade === "Matriz" ? "Maracás/BA" : "Unidade"}
              </p>
            </div>
          ))}
        </div>
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

        {filtrados.length === 0 ? (
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
                      const quantidade = COLABORADORES.filter(
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
}

function ColaboradoresTab({ setores }: ColaboradoresTabProps) {
  const session = usePanelSession();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(COLABORADORES);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState("todas");
  const [setor, setSetor] = useState("todos");
  const [novoAberto, setNovoAberto] = useState(false);
  const [gerindo, setGerindo] = useState<Colaborador | null>(null);

  const usuarioAtual = colaboradores.find((colaborador) => colaborador.email === session?.email);
  const podeDarAdministracao =
    session?.role === "admin" ||
    usuarioAtual?.nivelAcesso === "Administrador" ||
    usuarioAtual?.nivelAcesso === "Desenvolvedor";

  const filtrados = colaboradores.filter((colaborador) => {
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

  function adicionar(colaborador: Colaborador) {
    setColaboradores((atual) => [colaborador, ...atual]);
    setNovoAberto(false);
  }

  function salvar(colaborador: Colaborador) {
    setColaboradores((atual) =>
      atual.map((item) => (item.id === colaborador.id ? colaborador : item)),
    );
    setGerindo(null);
  }

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
              {UNIDADES.map((opcao) => (
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
                <Th>Exclusão</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((colaborador) => (
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
                        <p className="truncate text-[11px] text-[#64748B]">{colaborador.cargo}</p>
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
              ))}
            </tbody>
          </table>
        </div>

        {filtrados.length === 0 ? (
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
        onFechar={() => setNovoAberto(false)}
        onCriar={adicionar}
        podeDarAdministracao={podeDarAdministracao}
      />
      {gerindo ? (
        <GerirColaboradorDialog
          colaborador={gerindo}
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
  onFechar: () => void;
  onCriar: (colaborador: Colaborador) => void;
  podeDarAdministracao: boolean;
}

function novoId() {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function NovoColaboradorDialog({
  aberto,
  setores,
  onFechar,
  onCriar,
  podeDarAdministracao,
}: NovoColaboradorDialogProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState(() => setores[0]?.nome ?? "");
  const [unidade, setUnidade] = useState("Matriz");
  const [nivelAcesso, setNivelAcesso] = useState("Colaborador");
  const [grupos, setGrupos] = useState<string[]>([]);

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
    setUnidade("Matriz");
    setNivelAcesso("Colaborador");
    setGrupos([]);
  }

  function enviar() {
    if (!nome.trim()) return;
    onCriar({
      id: novoId(),
      nome: nome.trim(),
      cargo: cargo || "Sem cargo",
      email: email.trim(),
      unidade,
      cidade: "Maracás/BA",
      setor,
      nivelAcesso,
      ...(grupos.length > 0 ? { grupos: grupos.join(", ") } : {}),
      exclusao: "Sem acesso",
    });
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
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((opcao) => (
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
  onFechar: () => void;
  onSalvar: (colaborador: Colaborador) => void;
  podeDarAdministracao: boolean;
}

function GerirColaboradorDialog({
  colaborador,
  onFechar,
  onSalvar,
  podeDarAdministracao,
}: GerirColaboradorDialogProps) {
  const [setor, setSetor] = useState(colaborador?.setor ?? "Qualidade");
  const [unidade, setUnidade] = useState(colaborador?.unidade ?? "Matriz");
  const [nivelAcesso, setNivelAcesso] = useState(colaborador?.nivelAcesso ?? "Colaborador");
  const [exclusao, setExclusao] = useState(colaborador?.exclusao ?? "Sem acesso");
  const [grupos, setGrupos] = useState<string[]>(
    colaborador?.grupos ? colaborador.grupos.split(", ").filter(Boolean) : [],
  );

  const atual = colaborador;
  if (!atual) return null;

  const nivelSelecionado = NIVEIS_ACESSO.find((nivel) => nivel.rotulo === nivelAcesso);
  const niveisDisponiveis = podeDarAdministracao
    ? NIVEIS_ACESSO
    : NIVEIS_ACESSO.filter((nivel) => nivel.rotulo !== "Administrador");

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
      nome: atual.nome,
      cargo: atual.cargo,
      setor,
      unidade,
      nivelAcesso,
      exclusao,
    };
    if (atual.email) atualizado.email = atual.email;
    if (atual.cidade) atualizado.cidade = atual.cidade;
    if (grupos.length > 0) atualizado.grupos = grupos.join(", ");
    onSalvar(atualizado);
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
            <Campo rotulo="Setor">
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Unidade">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((opcao) => (
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
      {children}
    </th>
  );
}
