import { CalendarClock, GitBranch, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TipoReuniaoDialog } from "@/components/tipo-reuniao-dialog";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import { PERIODICIDADE_LABELS, type TipoReuniao } from "@/lib/atas";
import { mudarAtivoTipoReuniao } from "@/lib/atas-crud";
import { listarTiposReuniao } from "@/lib/atas-base";
import type { Colaborador } from "@/lib/dados";
import {
  atualizarGrupoAcesso,
  criarGrupoAcesso,
  excluirGrupoAcesso,
  listarGruposAcesso,
} from "@/lib/grupos";
import { traduzErro } from "@/lib/organizacao";
import { criarOrigem, listarOrigens, mudarAtivaOrigem } from "@/lib/planos-base";
import type { OrigemAcao } from "@/lib/planos";
import type { GrupoAcesso } from "@/lib/projetos-crud";

/* -------------------------------------------------------------------------- */
/* Peças comuns                                                               */
/* -------------------------------------------------------------------------- */

interface CartaoProps {
  titulo: string;
  descricao: string;
  /** Pill de cadastro; ausente para quem não tem permissão. */
  acao?: { rotulo: string; aoClicar: () => void } | undefined;
  children: ReactNode;
}

function Cartao({ titulo, descricao, acao, children }: CartaoProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E9EEF5] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1F2937]">{titulo}</h3>
          <p className="mt-1 text-sm text-[#64748B]">{descricao}</p>
        </div>
        {acao ? (
          <Button variant="outline" className="shrink-0 rounded-full" onClick={acao.aoClicar}>
            <Plus className="h-4 w-4" />
            {acao.rotulo}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Vazio({ icone: Icone, texto }: { icone: typeof ShieldCheck; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2F7]">
        <Icone className="h-6 w-6 text-[#94A3B8]" />
      </div>
      <p className="mt-3 text-sm text-[#64748B]">{texto}</p>
    </div>
  );
}

function Carregando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-[#64748B]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {texto}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Grupos de acesso                                                           */
/* -------------------------------------------------------------------------- */

function GrupoDialog({
  aberto,
  grupo,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  grupo: GrupoAcesso | null;
  onFechar: () => void;
  onSalvo: (grupo: GrupoAcesso) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(grupo?.nome ?? "");
    setDescricao(grupo?.descricao ?? "");
    setSalvando(false);
  }, [aberto, grupo]);

  async function salvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      const salvo = grupo
        ? await atualizarGrupoAcesso(grupo.id, { nome: nome.trim(), descricao: descricao.trim() })
        : await criarGrupoAcesso(nome, descricao.trim(), {});
      toast.success(grupo ? "Grupo atualizado." : "Grupo cadastrado.");
      onSalvo(salvo);
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {grupo ? "Editar grupo de acesso" : "Cadastrar grupo de acesso"}
          </DialogTitle>
          <DialogDescription>
            Grupos reúnem colaboradores e podem ser marcados no cadastro de cada um.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do grupo</Label>
            <Input
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Comitê de riscos"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Para que serve este grupo"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!nome.trim() || salvando} onClick={() => void salvar()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GruposAcessoTab({
  podeGerenciar,
  grupos,
  carregando,
  onChange,
}: {
  podeGerenciar: boolean;
  grupos: GrupoAcesso[];
  carregando: boolean;
  onChange: (lista: GrupoAcesso[]) => void;
}) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<GrupoAcesso | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const atualizar = onChange;

  async function remover(grupo: GrupoAcesso) {
    try {
      await excluirGrupoAcesso(grupo.id);
      atualizar(grupos.filter((item) => item.id !== grupo.id));
      toast.success(`Grupo "${grupo.nome}" removido.`);
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    } finally {
      setConfirmando(null);
    }
  }

  return (
    <>
      <Cartao
        titulo="Grupos de acesso"
        descricao="Defina os grupos usados no cadastro dos colaboradores."
        acao={
          podeGerenciar
            ? {
                rotulo: "Cadastrar grupo",
                aoClicar: () => {
                  setEmEdicao(null);
                  setDialogAberto(true);
                },
              }
            : undefined
        }
      >
        {carregando ? (
          <Carregando texto="Carregando grupos…" />
        ) : grupos.length === 0 ? (
          <Vazio icone={ShieldCheck} texto="Nenhum grupo cadastrado." />
        ) : (
          grupos.map((grupo) => (
            <div
              key={grupo.id}
              className="flex items-center justify-between gap-3 border-b border-[#E9EEF5] px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#1F2937]">{grupo.nome}</p>
                {grupo.descricao ? (
                  <p className="truncate text-[12px] text-[#64748B]">{grupo.descricao}</p>
                ) : null}
              </div>
              {podeGerenciar ? (
                confirmando === grupo.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={() => void remover(grupo)}>
                      Confirmar remoção
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Editar grupo"
                      aria-label={`Editar grupo ${grupo.nome}`}
                      onClick={() => {
                        setEmEdicao(grupo);
                        setDialogAberto(true);
                      }}
                      className="rounded-md p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1E3A8A]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Remover grupo"
                      aria-label={`Remover grupo ${grupo.nome}`}
                      onClick={() => setConfirmando(grupo.id)}
                      className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#E11D48]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              ) : null}
            </div>
          ))
        )}
      </Cartao>

      <GrupoDialog
        aberto={dialogAberto}
        grupo={emEdicao}
        onFechar={() => setDialogAberto(false)}
        onSalvo={(salvo) => {
          atualizar(
            emEdicao
              ? grupos.map((item) => (item.id === salvo.id ? salvo : item))
              : [...grupos, salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
          );
          setDialogAberto(false);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tipos de reunião                                                           */
/* -------------------------------------------------------------------------- */

export function TiposReuniaoTab({
  podeGerenciar,
  colaboradores,
}: {
  podeGerenciar: boolean;
  colaboradores: Colaborador[];
}) {
  const [tipos, setTipos] = useState<TipoReuniao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<TipoReuniao | null>(null);

  useEffect(() => {
    let ativo = true;
    listarTiposReuniao()
      .then((lista) => {
        if (ativo) setTipos(lista);
      })
      .catch(() => toast.error("Não foi possível carregar os tipos de reunião."))
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function aplicar(salvo: TipoReuniao) {
    setTipos((atual) =>
      atual.some((item) => item.id === salvo.id)
        ? atual.map((item) => (item.id === salvo.id ? salvo : item))
        : [...atual, salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    );
    setDialogAberto(false);
  }

  async function alternar(tipo: TipoReuniao) {
    try {
      aplicar(await mudarAtivoTipoReuniao(tipo.id, !tipo.ativo, getSession()));
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    }
  }

  return (
    <>
      <Cartao
        titulo="Tipos de reunião"
        descricao="Tipos usados no cadastro das atas, com periodicidade, participantes e signatários."
        acao={
          podeGerenciar
            ? {
                rotulo: "Cadastrar tipo de reunião",
                aoClicar: () => {
                  setEmEdicao(null);
                  setDialogAberto(true);
                },
              }
            : undefined
        }
      >
        {carregando ? (
          <Carregando texto="Carregando tipos de reunião…" />
        ) : tipos.length === 0 ? (
          <Vazio icone={CalendarClock} texto="Nenhum tipo de reunião cadastrado." />
        ) : (
          tipos.map((tipo) => (
            <div
              key={tipo.id}
              className="flex items-center justify-between gap-3 border-b border-[#E9EEF5] px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-[13px] font-semibold ${tipo.ativo ? "text-[#1F2937]" : "text-[#94A3B8] line-through"}`}
                >
                  {tipo.nome}
                </p>
                <p className="text-[12px] text-[#64748B]">
                  {PERIODICIDADE_LABELS[tipo.periodicidade]} · {tipo.participantes.length}{" "}
                  participante(s) · {tipo.signatarios.length} signatário(s)
                  {tipo.ativo ? "" : " · Desativado"}
                </p>
              </div>
              {podeGerenciar ? (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEmEdicao(tipo);
                      setDialogAberto(true);
                    }}
                    className="text-[12px] font-medium text-[#1E3A8A] hover:text-[#1E40AF]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void alternar(tipo)}
                    className={`text-[12px] font-medium ${tipo.ativo ? "text-[#E11D48] hover:text-[#BE123C]" : "text-[#059669] hover:text-[#047857]"}`}
                  >
                    {tipo.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Cartao>

      <TipoReuniaoDialog
        aberto={dialogAberto}
        tipo={emEdicao}
        colaboradores={colaboradores}
        onFechar={() => setDialogAberto(false)}
        onSalvo={aplicar}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Origens de ação                                                            */
/* -------------------------------------------------------------------------- */

function OrigemDialog({
  aberto,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (origem: OrigemAcao) => void;
}) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setNome("");
      setSalvando(false);
    }
  }, [aberto]);

  async function salvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      const nova = await criarOrigem(nome);
      toast.success("Origem cadastrada.");
      onCriada(nova);
    } catch (erro) {
      toast.error(traduzErro(erro).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar origem de ação</DialogTitle>
          <DialogDescription>A origem fica disponível ao abrir um plano de ação.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-1.5"
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
        >
          <Label>Nome da origem</Label>
          <Input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Ex.: Visita técnica"
            maxLength={80}
            autoFocus
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!nome.trim() || salvando} onClick={() => void salvar()}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrigensAcaoTab({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [origens, setOrigens] = useState<OrigemAcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    listarOrigens()
      .then((lista) => {
        if (ativo) setOrigens(lista);
      })
      .catch(() => toast.error("Não foi possível carregar as origens de ação."))
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function alternar(origem: OrigemAcao, ativa: boolean) {
    setOrigens((atual) => atual.map((item) => (item.id === origem.id ? { ...item, ativa } : item)));
    try {
      await mudarAtivaOrigem(origem.id, ativa);
    } catch (erro) {
      setOrigens((atual) =>
        atual.map((item) => (item.id === origem.id ? { ...item, ativa: !ativa } : item)),
      );
      toast.error(traduzErro(erro).message);
    }
  }

  return (
    <>
      <Cartao
        titulo="Origens de ação"
        descricao="Origens disponíveis ao abrir um plano de ação. Só as ativas aparecem no formulário."
        acao={
          podeGerenciar
            ? { rotulo: "Cadastrar origem", aoClicar: () => setDialogAberto(true) }
            : undefined
        }
      >
        {carregando ? (
          <Carregando texto="Carregando origens…" />
        ) : origens.length === 0 ? (
          <Vazio icone={GitBranch} texto="Nenhuma origem cadastrada." />
        ) : (
          origens.map((origem) => (
            <div
              key={origem.id}
              className="flex items-center justify-between gap-3 border-b border-[#E9EEF5] px-4 py-3 last:border-0"
            >
              <p
                className={`truncate text-[13px] font-semibold ${origem.ativa ? "text-[#1F2937]" : "text-[#94A3B8]"}`}
              >
                {origem.nome}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[12px] text-[#64748B]">
                  {origem.ativa ? "Ativa" : "Inativa"}
                </span>
                <Switch
                  checked={origem.ativa}
                  disabled={!podeGerenciar}
                  onCheckedChange={(valor) => void alternar(origem, valor)}
                  aria-label={`${origem.ativa ? "Desativar" : "Ativar"} origem ${origem.nome}`}
                />
              </div>
            </div>
          ))
        )}
      </Cartao>

      <OrigemDialog
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        onCriada={(nova) => {
          setOrigens((atual) => [...atual, nova]);
          setDialogAberto(false);
        }}
      />
    </>
  );
}
