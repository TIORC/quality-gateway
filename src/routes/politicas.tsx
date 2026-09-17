import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  History,
  Lightbulb,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useCatalogoOrganizacional } from "@/hooks/use-catalogo";
import { supabase } from "@/integrations/supabase/client";
import { getSession, type UserSession } from "@/lib/auth";
import { organizacaoDisponivel } from "@/lib/organizacao";
import {
  podeAdicionarDocumentos,
  podeExcluirDocumentos,
  podeModificarDocumentos,
} from "@/lib/permissoes";
import {
  BUCKET_ANEXOS,
  ROTULO_TIPO_ANEXO,
  TIPOS_ANEXO_ACEITOS,
  textoDoAnexoOffice,
  urlAssinadaDoAnexo,
} from "@/lib/pops";
import { cn, mascaraDataBr } from "@/lib/utils";
import {
  atualizarPolitica,
  carregarPoliticasAcessiveis,
  carregarLeiturasPoliticaDoUsuario,
  criarPolitica,
  enviarSugestaoPolitica,
  excluirPolitica,
  listarLeiturasPolitica,
  listarSugestoesPolitica,
  politicasDisponiveis,
  registrarLeituraPolitica,
  marcarSugestaoConcluidaPolitica,
  type ParecerPolitica,
  type PoliticaAnexo,
  type PoliticaItem,
  type PoliticaLeitura,
  type PoliticaSugestao,
  type SugestaoPolitica,
} from "@/lib/politicas";

/** Verifica se o usuário pode ver a seção de sugestões de melhoria.
 * Perfis habilitados: Coordenador da Qualidade, Desenvolvedor, Administrador e o próprio autor.
 */
function podeVerSugestoes(sessao: UserSession | null, autorEmail: string): boolean {
  if (!sessao) return false;
  const emailNormalizado = sessao.email.toLowerCase();
  const autorNormalizado = autorEmail.toLowerCase();

  // Coordenador da Qualidade
  if (sessao.cargo === "Coordenador da Qualidade") return true;
  // Administrador (Gabriel como desenvolvedor/administrador)
  if (sessao.role === "admin") return true;
  // Desenvolvedor
  if (sessao.cargo.toLowerCase().includes("desenvolvedor")) return true;
  // O próprio autor da sugestão
  if (emailNormalizado === autorNormalizado) return true;
  return false;
}

/** Verifica se o usuário pode marcar sugestões como concluídas.
 * Perfis habilitados: Coordenador da Qualidade, Desenvolvedor, Administrador.
 */
function podeConcluirSugestoes(sessao: UserSession | null): boolean {
  if (!sessao) return false;
  // Coordenador da Qualidade
  if (sessao.cargo === "Coordenador da Qualidade") return true;
  // Administrador (Gabriel como desenvolvedor/administrador)
  if (sessao.role === "admin") return true;
  // Desenvolvedor
  if (sessao.cargo.toLowerCase().includes("desenvolvedor")) return true;
  return false;
}
/** Verifica se o usuário pode ver a seção de sugestões de melhoria. */

export const Route = createFileRoute("/politicas")({
  head: () => ({
    meta: [{ title: "Políticas | Gestão da Qualidade" }],
  }),
  validateSearch: (search: Record<string, unknown>): { abrir?: string } => {
    const abrir = typeof search["abrir"] === "string" ? search["abrir"] : undefined;
    return abrir ? { abrir } : {};
  },
  component: Politicas,
});

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "preciso-ler", rotulo: "Preciso ler" },
  { valor: "meu-parecer", rotulo: "Meu parecer" },
  { valor: "vencendo", rotulo: "Vencendo" },
] as const;

const STATUS_POLITICA = ["Em aprovação", "Aprovado", "Divulgado"] as const;

function novaId() {
  return `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function proximoCodigoPolitica(itens: PoliticaItem[]): string {
  let maior = 0;
  for (const item of itens) {
    const m = /(\d+)\s*$/.exec(item.codigo.trim());
    if (m) maior = Math.max(maior, Number(m[1]));
  }
  return `POLITICA – ORC – ${String(maior + 1).padStart(3, "0")}`;
}

function rotuloRevisao(numero: number) {
  return `Revisão ${String(numero).padStart(2, "0")}`;
}

function dataHojeBr() {
  const agora = new Date();
  const dd = String(agora.getDate()).padStart(2, "0");
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${agora.getFullYear()}`;
}

function Politicas() {
  const router = useRouter();
  const { abrir } = Route.useSearch();
  const catalogo = useCatalogoOrganizacional();
  const [novaPolitica, setNovaPolitica] = useState(false);
  const [politicaEmEdicao, setPoliticaEmEdicao] = useState<PoliticaItem | null>(null);
  const [politicaParaExcluir, setPoliticaParaExcluir] = useState<PoliticaItem | null>(null);
  const [politicaAberta, setPoliticaAberta] = useState<PoliticaItem | null>(null);
  const [usarBanco, setUsarBanco] = useState<boolean>(() => politicasDisponiveis());
  const [itens, setItens] = useState<PoliticaItem[]>(() =>
    politicasDisponiveis() ? [] : exemplosIniciais(),
  );

  const sessao = getSession();
  const podeAdicionar = podeAdicionarDocumentos(sessao);
  const podeModificar = podeModificarDocumentos(sessao);
  const podeExcluir = podeExcluirDocumentos(sessao);

  // Carrega as políticas do banco quando o Lovable Cloud está disponível.
  useEffect(() => {
    if (!politicasDisponiveis()) return;
    let ativo = true;
    carregarPoliticasAcessiveis(sessao)
      .then((dados) => {
        if (ativo) setItens(dados);
      })
      .catch(() => {
        if (!ativo) return;
        setUsarBanco(false);
        setItens(exemplosIniciais());
        toast("Políticas em modo de demonstração — banco de dados indisponível.", {
          description: "As alterações não serão persistidas até o banco responder.",
        });
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Deep link: abre uma política específica quando chega com `?abrir=<id>` (painel).
  useEffect(() => {
    if (!abrir || politicaAberta) return;
    const alvo = itens.find((item) => item.id === abrir);
    if (!alvo) return;
    setPoliticaAberta(alvo);
    void router.navigate({ to: "/politicas", search: {} });
  }, [abrir, itens, politicaAberta, router]);

  function listaDaAba(valor: string) {
    if (valor === "todas") return itens;
    if (valor === "preciso-ler") return itens.filter((i) => !i.parecer);
    if (valor === "meu-parecer") return itens.filter((i) => i.parecer || i.sugestoes.length > 0);
    if (valor === "vencendo") return itens.filter((i) => i.status === "Em aprovação");
    return itens;
  }

  function salvarPolitica(politicaId: string | null, dados: Omit<PoliticaItem, "id">) {
    const idTemporario = politicaId ?? novaId();
    setItens((atual) => {
      if (politicaId) {
        return atual.map((item) => (item.id === politicaId ? { id: politicaId, ...dados } : item));
      }
      return [{ id: idTemporario, ...dados }, ...atual];
    });
    setPoliticaAberta((aberta) =>
      aberta && politicaId && aberta.id === politicaId ? { id: politicaId, ...dados } : aberta,
    );
    if (!usarBanco) return;
    if (politicaId) {
      void atualizarPolitica({ id: politicaId, ...dados })
        .then((atualizada) =>
          setItens((atual) => atual.map((item) => (item.id === politicaId ? atualizada : item))),
        )
        .catch((erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a política."),
        );
    } else {
      void criarPolitica({ id: idTemporario, ...dados })
        .then((criada) =>
          setItens((atual) => atual.map((item) => (item.id === idTemporario ? criada : item))),
        )
        .catch((erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a política."),
        );
    }
  }

  function registrarParecer(id: string, parecer: ParecerPolitica | null) {
    const alvo = itens.find((item) => item.id === id);
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, parecer } : item)));
    setPoliticaAberta((aberta) => (aberta && aberta.id === id ? { ...aberta, parecer } : aberta));
    if (!usarBanco || !alvo) return;
    void atualizarPolitica({ ...alvo, parecer })
      .then((atualizada) =>
        setItens((atual) => atual.map((item) => (item.id === id ? atualizada : item))),
      )
      .catch((erro) =>
        toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o parecer."),
      );
  }

  function adicionarSugestao(id: string, texto: string) {
    const sugestao: SugestaoPolitica = {
      id: novaId(),
      texto: texto.trim(),
      data: dataHojeBr(),
    };
    const alvo = itens.find((item) => item.id === id);
    setItens((atual) =>
      atual.map((item) => (item.id === id ? { ...item, sugestoes: [sugestao, ...item.sugestoes] } : item)),
    );
    setPoliticaAberta((aberta) =>
      aberta && aberta.id === id ? { ...aberta, sugestoes: [sugestao, ...aberta.sugestoes] } : aberta,
    );
    if (!usarBanco || !alvo) return;
    void atualizarPolitica({ ...alvo, sugestoes: [sugestao, ...alvo.sugestoes] })
      .then((atualizada) =>
        setItens((atual) => atual.map((item) => (item.id === id ? atualizada : item))),
      )
      .catch((erro) =>
        toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a sugestão."),
      );
  }

  function removerPolitica(id: string) {
    setItens((atual) => atual.filter((item) => item.id !== id));
    if (!usarBanco) return;
    void excluirPolitica(id).catch((erro) =>
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir a política."),
    );
  }

  const codigoSugerido = useMemo(() => proximoCodigoPolitica(itens), [itens]);

  return (
    <PanelShell wide>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#64748B]">
            Documentos normativos
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#1F2937] sm:text-[26px]">
            Políticas
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#64748B]">
            A aba Políticas será destinada ao cadastro, publicação, aprovação, divulgação e controle
            das revisões das políticas da Orcoma. Cada política terá um código próprio e sequencial,
            mantendo seu histórico sempre que houver alterações.
          </p>
        </div>

        {podeAdicionar ? (
          <Button className="shrink-0" onClick={() => setNovaPolitica(true)}>
            <Plus className="h-4 w-4" />
            Nova política
          </Button>
        ) : null}
      </div>

      {politicaAberta ? (
        <PoliticaDetalhe
          politica={itens.find((i) => i.id === politicaAberta.id) ?? politicaAberta}
          podeModificar={podeModificar}
          onFechar={() => setPoliticaAberta(null)}
          onEditar={(item) => {
            setPoliticaAberta(null);
            setPoliticaEmEdicao(item);
          }}
          onParecer={registrarParecer}
          onSugestao={adicionarSugestao}
        />
      ) : (
      <Tabs defaultValue="todas">
        <TabsList>
          {ABAS.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="gap-1.5">
              {aba.rotulo}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground">
                {listaDaAba(aba.valor).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ABAS.map((aba) => (
          <TabsContent key={aba.valor} value={aba.valor}>
            <ListaPoliticas
              itens={listaDaAba(aba.valor)}
              onNova={() => setNovaPolitica(true)}
              podeAdicionar={podeAdicionar}
              podeModificar={podeModificar}
              podeExcluir={podeExcluir}
              onAbrir={(item) => setPoliticaAberta(item)}
              onEditar={(item) => setPoliticaEmEdicao(item)}
              onExcluir={(item) => setPoliticaParaExcluir(item)}
            />
          </TabsContent>
        ))}
      </Tabs>
      )}

      <PoliticaDialog
        aberto={novaPolitica || politicaEmEdicao !== null}
        politica={politicaEmEdicao}
        codigoSugerido={codigoSugerido}
        opcoesSetores={catalogo.setores}
        carregandoSetores={catalogo.carregando}
        onFechar={() => {
          setNovaPolitica(false);
          setPoliticaEmEdicao(null);
        }}
        onSalvar={salvarPolitica}
      />

      <Dialog
        open={politicaParaExcluir !== null}
        onOpenChange={(abre) => (abre ? undefined : setPoliticaParaExcluir(null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir política?</DialogTitle>
            <DialogDescription>
              {politicaParaExcluir?.codigo} — {politicaParaExcluir?.titulo}. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPoliticaParaExcluir(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#B91C1C] text-white hover:bg-[#DC2626]"
              onClick={() => {
                if (politicaParaExcluir) removerPolitica(politicaParaExcluir.id);
                setPoliticaParaExcluir(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

function statusCor(status: string) {
  if (status === "Aprovado") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Divulgado") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "Em aprovação") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function exemplosIniciais(): PoliticaItem[] {
  return [
    {
      id: "pol_exemplo_001",
      codigo: "POLITICA – ORC – 001",
      titulo: "Política da Qualidade Orcoma",
      objetivo:
        "Estabelecer os princípios e diretrizes da qualidade para garantir a padronização dos processos e a satisfação dos clientes.",
      setores: ["Todos"],
      aplicabilidade: "Aplica-se a todos os setores e unidades da Orcoma.",
      links: ["https://orcoma.com.br/qualidade"],
      dataPostagem: dataHojeBr(),
      status: "Divulgado",
      historico: [
        {
          id: "rev_ex_001",
          numero: 1,
          data: dataHojeBr(),
          observacao: "Publicação inicial da política.",
        },
      ],
      dataRevisao: dataHojeBr(),
      revisao: 1,
      observacaoRevisao: "Publicação inicial da política.",
      anexo: null,
      parecer: null,
      sugestoes: [],
      dataVencimento: "20/09/2026",
    },
  ];
}

function ListaPoliticas({
  itens,
  onNova,
  podeAdicionar,
  podeModificar,
  podeExcluir,
  onAbrir,
  onEditar,
  onExcluir,
}: {
  itens: PoliticaItem[];
  onNova: () => void;
  podeAdicionar: boolean;
  podeModificar: boolean;
  podeExcluir: boolean;
  onAbrir: (item: PoliticaItem) => void;
  onEditar: (item: PoliticaItem) => void;
  onExcluir: (item: PoliticaItem) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F7]">
            <FileText className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#1F2937]">Nenhuma política aqui</h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B]">
            Crie a política, envie para o comitê de aprovação e acompanhe as leituras.
          </p>
          {podeAdicionar ? (
            <Button variant="outline" className="mt-5" onClick={onNova}>
              <Plus className="h-4 w-4" />
              Nova política
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-[#E9EEF5] overflow-hidden rounded-2xl border border-[#D9E0EA] bg-white shadow-sm">
      {itens.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <button
            type="button"
            onClick={() => onAbrir(item)}
            className="flex min-w-0 flex-1 flex-col gap-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-semibold text-[#64748B]">
                {item.codigo}
              </span>
              <p className="truncate text-[14px] font-semibold text-[#1F2937]">{item.titulo}</p>
              <Badge variant="outline" className={cn("text-[11px]", statusCor(item.status))}>
                {item.status}
              </Badge>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {rotuloRevisao(item.revisao)}
              </span>
            </div>
            <p className="line-clamp-1 text-xs text-[#64748B]">
              {item.objetivo || "Sem objetivo cadastrado."} ·{" "}
              {item.setores.length > 0 ? item.setores.join(", ") : "Todos os setores"} · Postada em{" "}
              {item.dataPostagem || "—"}
            </p>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {item.anexo ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A]">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="max-w-[180px] truncate">{item.anexo.nome}</span>
              </span>
            ) : null}
            {item.parecer ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px]",
                  item.parecer.tipo === "concordo"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
                )}
              >
                {item.parecer.tipo === "concordo" ? "Lido" : "Discordo"}
              </Badge>
            ) : null}

            <Button type="button" variant="outline" size="sm" onClick={() => onAbrir(item)}>
              Abrir
            </Button>
            {podeModificar || podeExcluir ? (
              <div className="flex shrink-0 items-center gap-1">
                {podeModificar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#64748B]"
                    aria-label={`Editar ${item.titulo}`}
                    onClick={() => onEditar(item)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                ) : null}
                {podeExcluir ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#64748B] hover:text-rose-600"
                    aria-label={`Excluir ${item.titulo}`}
                    onClick={() => onExcluir(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface CampoProps {
  rotulo: string;
  children: ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

interface PoliticaDialogProps {
  aberto: boolean;
  politica: PoliticaItem | null;
  codigoSugerido: string;
  opcoesSetores: string[];
  carregandoSetores: boolean;
  onFechar: () => void;
  onSalvar: (politicaId: string | null, dados: Omit<PoliticaItem, "id">) => void;
}

function PoliticaDialog({
  aberto,
  politica,
  codigoSugerido,
  opcoesSetores,
  carregandoSetores,
  onFechar,
  onSalvar,
}: PoliticaDialogProps) {
  const [codigo, setCodigo] = useState(codigoSugerido);
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [setores, setSetores] = useState<string[]>([]);
  const [aplicabilidade, setAplicabilidade] = useState("");
  const [linksTexto, setLinksTexto] = useState("");
  const [dataPostagem, setDataPostagem] = useState(dataHojeBr());
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState<string>("Em aprovação");
  const [dataRevisao, setDataRevisao] = useState(dataHojeBr());
  const [observacaoRevisao, setObservacaoRevisao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const setoresDisponiveis = useMemo(() => {
    const base = opcoesSetores.length > 0 ? opcoesSetores : ["Todos"];
    return base.includes("Todos") ? base : ["Todos", ...base];
  }, [opcoesSetores]);

  function alternarSetor(setor: string) {
    setSetores((atual) => {
      if (setor === "Todos") return atual.includes("Todos") ? [] : [...setoresDisponiveis];
      const semTodos = atual.filter((item) => item !== "Todos");
      const proximo = semTodos.includes(setor)
        ? semTodos.filter((item) => item !== setor)
        : [...semTodos, setor];
      // Se todos os setores (exceto "Todos") estiverem marcados, marca "Todos" também.
      const todosOsOutros = setoresDisponiveis.filter((s) => s !== "Todos");
      if (todosOsOutros.length > 0 && todosOsOutros.every((s) => proximo.includes(s))) {
        return ["Todos", ...proximo];
      }
      return proximo;
    });
  }

  function marcarTodos() {
    setSetores([...setoresDisponiveis]);
  }

  useEffect(() => {
    if (!aberto) return;
    if (politica) {
      setCodigo(politica.codigo);
      setTitulo(politica.titulo ?? "");
      setObjetivo(politica.objetivo ?? "");
      setSetores(politica.setores?.length ? politica.setores : [...setoresDisponiveis]);
      setAplicabilidade(politica.aplicabilidade ?? "");
      setLinksTexto((politica.links ?? []).join("\n"));
      setDataPostagem(politica.dataPostagem ?? dataHojeBr());
      setDataVencimento(politica.dataVencimento ?? "");
      setStatus(politica.status ?? "Em aprovação");
      setDataRevisao(politica.dataRevisao ?? dataHojeBr());
      setObservacaoRevisao(politica.observacaoRevisao ?? "");
      setArquivo(null);
    } else {
      setCodigo(codigoSugerido);
      setTitulo("");
      setObjetivo("");
      // Regra: já vem com TODOS selecionados; desmarque o que não se aplica (implica no acesso).
      setSetores([...setoresDisponiveis]);
      setAplicabilidade("");
      setLinksTexto("");
      setDataPostagem(dataHojeBr());
      setDataVencimento("");
      setStatus("Em aprovação");
      setDataRevisao(dataHojeBr());
      setObservacaoRevisao("");
      setArquivo(null);
    }
  }, [aberto, politica, codigoSugerido, setoresDisponiveis]);

  const [erroUpload, setErroUpload] = useState("");

  function enviar() {
    setErroUpload("");
    void gravar();
  }

  async function gravar() {
    let anexoFinal: PoliticaAnexo | null = politica?.anexo ?? null;

    if (arquivo) {
      const tipoValido = (TIPOS_ANEXO_ACEITOS as readonly string[]).includes(arquivo.type);
      if (!tipoValido) {
        setErroUpload("Formato não suportado. Envie um arquivo PDF ou Word (doc/docx).");
        return;
      }
      if (arquivo.size > 20 * 1024 * 1024) {
        setErroUpload("O anexo deve ter no máximo 20 MB.");
        return;
      }

      if (organizacaoDisponivel()) {
        const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
        const caminho = `politicas/${politica?.id ?? novaId()}/${Date.now()}.${(extensao ?? "bin").toLowerCase()}`;
        try {
          const { error: erroUploadStorage } = await supabase.storage
            .from(BUCKET_ANEXOS)
            .upload(caminho, arquivo, {
              contentType: arquivo.type,
              upsert: false,
              cacheControl: "3600",
            });
          if (erroUploadStorage) throw erroUploadStorage;
          anexoFinal = { path: caminho, nome: arquivo.name, tipo: arquivo.type };
        } catch (erro) {
          setErroUpload(
            "Não foi possível enviar o anexo no momento. A política foi salva sem o arquivo.",
          );
          toast.error("Não foi possível enviar o anexo.", {
            description: String((erro as Error)?.message),
          });
          anexoFinal = { path: null, nome: arquivo.name, tipo: arquivo.type };
        }
      } else {
        anexoFinal = { path: null, nome: arquivo.name, tipo: arquivo.type };
        toast("Anexo mantido em memória (preview indisponível sem conexão ao storage).", {
          description: "Conecte o Supabase para envio e visualização do documento.",
        });
      }
    }

    const links = linksTexto
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const setoresFinais = setores.length > 0 ? setores : [...setoresDisponiveis];
    const revisaoAtual = politica?.revisao ?? 1;
    const houveAlteracaoRevisao =
      (observacaoRevisao.trim() || dataRevisao.trim()) &&
      (observacaoRevisao.trim() !== (politica?.observacaoRevisao ?? "").trim() ||
        dataRevisao.trim() !== (politica?.dataRevisao ?? "").trim() ||
        !politica);
    const novaRevisao = politica && houveAlteracaoRevisao ? revisaoAtual + 1 : revisaoAtual;
    const historicoBase = politica?.historico ?? [];
    const historico =
      politica && houveAlteracaoRevisao
        ? [
            {
              id: novaId(),
              numero: novaRevisao,
              data: dataRevisao.trim() || dataHojeBr(),
              observacao: observacaoRevisao.trim() || "Revisão registrada.",
            },
            ...historicoBase,
          ]
        : historicoBase.length > 0
          ? historicoBase
          : [
              {
                id: novaId(),
                numero: 1,
                data: dataRevisao.trim() || dataHojeBr(),
                observacao: observacaoRevisao.trim() || "Publicação inicial da política.",
              },
            ];
    onSalvar(politica?.id ?? null, {
      codigo: codigo.trim() || codigoSugerido,
      titulo: titulo.trim(),
      objetivo: objetivo.trim(),
      setores: setoresFinais,
      aplicabilidade: aplicabilidade.trim(),
      links,
      dataPostagem: dataPostagem.trim() || dataHojeBr(),
      dataVencimento: dataVencimento.trim(),
      status: status.trim() || "Em aprovação",
      historico,
      dataRevisao: dataRevisao.trim() || dataHojeBr(),
      revisao: novaRevisao,
      observacaoRevisao: observacaoRevisao.trim(),
      anexo: anexoFinal,
      parecer: politica?.parecer ?? null,
      sugestoes: politica?.sugestoes ?? [],
    });
    onFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{politica ? "Editar política" : "Nova política"}</DialogTitle>
          <DialogDescription>
            {politica
              ? "Ajuste os dados. O código é sequencial e o histórico é mantido a cada alteração."
              : "Cadastre com código sequencial. O histórico será mantido a cada alteração."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Campo rotulo="Código">
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="POLITICA – ORC – 001"
            />
            <p className="text-xs italic text-[#94A3B8]">
              Código próprio e sequencial: POLITICA – ORC – 001, 002 etc.
            </p>
          </Campo>

          <Campo rotulo="Título da política">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Política de Qualidade Orcoma"
            />
          </Campo>

          <Campo rotulo="Objetivo">
            <Textarea
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Breve descrição do conteúdo e finalidade da política."
              className="min-h-[90px]"
            />
          </Campo>

          <Campo rotulo="Setor/Área responsável">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={marcarTodos}>
                Selecionar todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSetores([])}
                className="text-[#64748B]"
              >
                Limpar
              </Button>
              <span className="text-xs text-[#64748B]">
                {setores.length} de {setoresDisponiveis.length} selecionados
              </span>
            </div>
            {carregandoSetores ? (
              <p className="text-xs text-[#94A3B8]">Carregando setores…</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {setoresDisponiveis.map((setor) => (
                  <label
                    key={setor}
                    htmlFor={`setor-politica-${setor}`}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E9EEF5] px-3 py-2.5 text-[13px] text-[#1F2937] transition hover:border-[#D9E0EA] hover:bg-[#F8FAFC]"
                  >
                    <Checkbox
                      id={`setor-politica-${setor}`}
                      checked={setores.includes(setor)}
                      onCheckedChange={() => alternarSetor(setor)}
                    />
                    {setor}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs italic text-[#94A3B8]">
              Todos já vêm selecionados — desmarque as áreas que não se aplicam. Implica no acesso.
            </p>
          </Campo>

          <Campo rotulo="Aplicabilidade">
            <Textarea
              value={aplicabilidade}
              onChange={(e) => setAplicabilidade(e.target.value)}
              placeholder="Setores ou unidades aos quais a política se aplica — uma área específica ou toda a Orcoma."
              className="min-h-[80px]"
            />
          </Campo>

          <Campo rotulo="Links vinculados">
            <Textarea
              value={linksTexto}
              onChange={(e) => setLinksTexto(e.target.value)}
              placeholder="Documentos, formulários, materiais ou referências (um por linha)."
              className="min-h-[80px]"
            />
            <p className="text-xs italic text-[#94A3B8]">Um por linha (aceita vírgula ou ;).</p>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data da postagem">
              <Input
                value={dataPostagem}
                onChange={(e) => setDataPostagem(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>
            <Campo rotulo="Data de validade">
              <Input
                value={dataVencimento}
                onChange={(e) => setDataVencimento(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
              <p className="text-xs italic text-[#94A3B8]">
                Data em que a política expira — alimenta "Próximos vencimentos" no painel.
              </p>
            </Campo>
            <Campo rotulo="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_POLITICA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs italic text-[#94A3B8]">Em aprovação, aprovado, divulgado…</p>
            </Campo>
          </div>

          {politica && politica.historico.length > 0 ? (
            <div className="rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]">
                <History className="h-4 w-4 text-[#64748B]" />
                Histórico de modificações
              </p>
              <ul className="mt-2 space-y-1.5">
                {politica.historico.map((h) => (
                  <li key={h.id} className="text-xs text-[#475569]">
                    <span className="font-semibold text-[#1F2937]">{rotuloRevisao(h.numero)}</span>
                    {" · "}
                    {h.data}
                    {h.observacao ? ` — ${h.observacao}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data da revisão">
              <Input
                value={dataRevisao}
                onChange={(e) => setDataRevisao(mascaraDataBr(e.target.value))}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </Campo>
            <Campo rotulo="Revisão">
              <Input
                value={rotuloRevisao(politica ? politica.revisao : 1)}
                disabled
                className="bg-[#F8FAFC] text-[#64748B]"
              />
              <p className="text-xs italic text-[#94A3B8]">
                Revisão 01, 02, 03… incrementada ao salvar.
              </p>
            </Campo>
          </div>

          <Campo rotulo="Observação da revisão">
            <Textarea
              value={observacaoRevisao}
              onChange={(e) => setObservacaoRevisao(e.target.value)}
              placeholder="Registro objetivo do que foi alterado nesta versão."
              className="min-h-[80px]"
            />
          </Campo>

          <Campo rotulo="Arquivo da política (opcional)">
            <input
              ref={inputRef}
              type="file"
              accept=".docx,.doc,.pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setArquivo(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9E0EA] bg-[#F8FAFC] px-6 py-8 text-center transition hover:border-[#94A3B8] hover:bg-[#F1F5F9]"
            >
              <UploadCloud className="h-8 w-8 text-[#94A3B8]" />
              {arquivo || politica?.anexo?.nome ? (
                <>
                  <p className="mt-3 text-[13px] font-semibold text-[#1F2937]">
                    {arquivo?.name ?? politica?.anexo?.nome}
                  </p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Clique para trocar ou arraste outro arquivo.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-[13px] font-medium text-[#1F2937]">
                  Arraste o arquivo .docx ou .pdf, ou clique para selecionar
                </p>
              )}
            </button>
            {erroUpload ? (
              <p className="text-xs font-medium text-rose-600">{erroUpload}</p>
            ) : null}
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
            {politica ? "Salvar alterações" : "Criar política"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Tela de detalhe (página cheia) — mesma ordem + anexo + parecer/sugestão */
function PoliticaDetalhe({ politica, podeModificar, onFechar, onEditar, onParecer, onSugestao }: {
  politica: PoliticaItem;
  podeModificar: boolean;
  onFechar: () => void;
  onEditar: (item: PoliticaItem) => void;
  onParecer: (id: string, parecer: ParecerPolitica | null) => void;
  onSugestao: (id: string, texto: string) => void;
}) {
  const sessao = getSession();
  const [mostrarSugestao, setMostrarSugestao] = useState(false);
  const [textoSugestao, setTextoSugestao] = useState("");
  const [leituras, setLeituras] = useState<PoliticaLeitura[]>([]);
  const [sugestoes, setSugestoes] = useState<PoliticaSugestao[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [marcandoSugestao, setMarcandoSugestao] = useState<string | null>(null);
  const politicaId = politica.id;
  const item = politica;

  // Filtra sugestões visíveis para o usuário atual
  const sugestoesVisiveis = useMemo(() => {
    return sugestoes.filter((s) => podeVerSugestoes(sessao, s.usuarioEmail));
  }, [sugestoes, sessao]);

  // Carrega leituras e sugestões do Cloud (tabelas dedicadas)
  useEffect(() => {
    if (!politicasDisponiveis()) return;
    let ativo = true;
    Promise.all([
      listarLeiturasPolitica(politicaId),
      listarSugestoesPolitica(politicaId),
    ])
      .then(([l, s]) => {
        if (ativo) {
          setLeituras(l);
          setSugestoes(s);
        }
      })
      .catch(() => {
        if (!ativo) return;
        setLeituras([]);
        setSugestoes([]);
      });
    return () => { ativo = false; };
  }, [politicaId]);

  function confirmarLeitura() {
    // Primeiro salva no banco (tabela politica_leituras), depois atualiza o estado local via onParecer
    const usuario = sessao ? { email: sessao.email, nome: sessao.nome } : { email: "", nome: "" };
    if (!usuario.email) {
      toast.error("Entre no portal para registrar sua leitura");
      return;
    }
    setEnviando(true);
    registrarLeituraPolitica(politicaId, usuario, "lido")
      .then(() => {
        // Recarrega as leituras e atualiza o parecer local
        return listarLeiturasPolitica(politicaId).then((novas) => {
          setLeituras(novas);
          onParecer(politicaId, { tipo: "concordo", clausula: "", motivo: "", data: dataHojeBr() });
        });
      })
      .catch((erro) => {
        toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar sua leitura");
      })
      .finally(() => setEnviando(false));
  }

  function enviarSugestao() {
    if (!textoSugestao.trim()) return;
    const usuario = sessao ? { email: sessao.email, nome: sessao.nome } : { email: "", nome: "" };
    if (!usuario.email) {
      toast.error("Entre no portal para sugerir uma melhoria");
      return;
    }
    setEnviando(true);
    enviarSugestaoPolitica(politicaId, usuario, textoSugestao)
      .then(() => {
        setTextoSugestao("");
        setMostrarSugestao(false);
        onSugestao(politicaId, textoSugestao);
        return listarSugestoesPolitica(politicaId);
      })
      .then((novas) => setSugestoes(novas))
      .catch((erro) => {
        toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a sugestão");
      })
      .finally(() => setEnviando(false));
  }

  function concluirSugestao(sugestaoId: string) {
    if (!sessao) {
      toast.error("Entre no portal para concluir a sugestão");
      return;
    }
    setMarcandoSugestao(sugestaoId);
    marcarSugestaoConcluidaPolitica(sugestaoId, { email: sessao.email, nome: sessao.nome })
      .then(() => {
        toast.success("Sugestão marcada como concluída!");
        return listarSugestoesPolitica(politicaId);
      })
      .then((novas) => setSugestoes(novas))
      .catch((erro) => {
        toast.error(erro instanceof Error ? erro.message : "Não foi possível concluir a sugestão");
      })
      .finally(() => setMarcandoSugestao(null));
  }

  // Leituras registradas (Cloud + fallback do parecer antigo, sem duplicar o usuário atual)
  const todasLeituras = useMemo(() => {
    const emailAtual = (sessao?.email ?? "").trim().toLowerCase();
    const cloud = leituras.filter((l) => l.decisao !== "discordo");
    const jaRegistrouNoCloud = cloud.some(
      (l) => l.usuarioEmail.trim().toLowerCase() === emailAtual,
    );
    const json =
      item.parecer && item.parecer.tipo !== "discordo" && !jaRegistrouNoCloud
        ? [
            {
              id: "json",
              politicaId,
              usuarioEmail: sessao?.email ?? "",
              usuarioNome: sessao?.nome ?? "",
              decisao: item.parecer.tipo,
              createdAt: item.parecer.data,
            },
          ]
        : [];
    return [...cloud, ...json];
  }, [leituras, item.parecer, politicaId, sessao?.email, sessao?.nome]);

  const leitores = todasLeituras;
  const jaLeu = leitores.length > 0 || (!!item.parecer && item.parecer.tipo === "discordo");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onFechar} className="text-[#64748B]">
          <ArrowLeft className="h-4 w-4" /> Voltar para as Políticas
        </Button>
        <span className="rounded-md bg-[#EEF2F7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E3A8A]">
          {item.codigo}
        </span>
      </div>

      <article className="rounded-2xl border border-[#D9E0EA] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-lg font-bold tracking-tight text-[#1F2937] sm:text-xl">
            {item.titulo || "Política sem título"}
          </h2>
          <Badge variant="outline" className={cn("text-[11px]", statusCor(item.status))}>{item.status}</Badge>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{rotuloRevisao(item.revisao)}</span>
        </div>
        <p className="mt-2.5 text-[13px] text-[#64748B]">
          Postada em {item.dataPostagem || "—"} · Revisão de {item.dataRevisao || "—"}
        </p>

        <div className="mt-6 space-y-4">
          <DetalheItem rotulo="Código" valor={item.codigo} />
          <DetalheItem rotulo="Título da política" valor={item.titulo} />
          <DetalheItem rotulo="Objetivo" valor={item.objetivo} />
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-[#1F2937]">Setor/Área responsável</p>
            <div className="flex flex-wrap gap-1.5">
              {(item.setores.length > 0 ? item.setores : ["Todos"]).map((s) => (<Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>))}
            </div>
            <p className="text-xs italic text-[#94A3B8]">Define o acesso à política.</p>
          </div>
          <DetalheItem rotulo="Aplicabilidade" valor={item.aplicabilidade} />
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-[#1F2937]">Links vinculados</p>
            {item.links.length > 0 ? (<ul className="space-y-1">{item.links.map((link) => (<li key={link}><a href={/^https?:\/\//i.test(link) ? link : `https://${link}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-[#1E3A8A] hover:underline"><Link2 className="h-3.5 w-3.5" />{link}</a></li>))}</ul>) : (<p className="text-[13px] text-[#94A3B8]">Nenhum link vinculado.</p>)}
          </div>
          <DetalheItem rotulo="Data da postagem" valor={item.dataPostagem} />
          <DetalheItem rotulo="Status" valor={item.status} />
          <PoliticaAnexoVisualizador anexo={item.anexo} />
          <div className="rounded-xl border border-[#E9EEF5] bg-[#F8FAFC] p-3">
            <p className="text-[13px] font-semibold text-[#1F2937]">Ciência / Leituras</p>
            {jaLeu ? (
              <p className="mt-1 text-[13px] text-[#475569]">
                <span className="font-semibold text-emerald-700">Lido</span>{" "}
                {leitores.length} {leitores.length === 1 ? "leitura" : "leituras"} registradas
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#64748B]">Registre aqui que leu a política, ou sugira uma melhoria.</p>
            )}
            {leitores.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {leitores.slice(0, 5).map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#047857]">
                    <Check className="h-3 w-3" /> {l.usuarioNome || l.usuarioEmail}
                  </span>
                ))}
                {leitores.length > 5 && (
                  <span className="text-[11px] text-[#64748B]">+{leitores.length - 5} mais</span>
                )}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmarLeitura} disabled={enviando}><Check className="h-4 w-4" />LIDO</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setMostrarSugestao((v) => !v)} disabled={enviando}><Lightbulb className="h-4 w-4" />Sugerir Melhoria</Button>
            </div>
            {mostrarSugestao ? (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-white p-3">
                <Label className="text-[13px] font-medium">Sugestão de melhoria</Label>
                <Textarea value={textoSugestao} onChange={(e) => setTextoSugestao(e.target.value)} placeholder="Descreva sua sugestão (vale mesmo se você concorda)." className="min-h-[70px]" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setMostrarSugestao(false)} disabled={enviando}>Cancelar</Button>
                  <Button type="button" size="sm" className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]" onClick={enviarSugestao} disabled={!textoSugestao.trim() || enviando}>{enviando ? "Enviando..." : "Enviar sugestão"}</Button>
                </div>
              </div>
            ) : null}
            {sugestoes.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {sugestoes.map((s) => (
                  <div key={s.id} className="rounded-lg border border-[#D9E0EA] bg-white p-2.5">
                    <p className="text-[12px] font-semibold text-[#1F2937]">
                      <Lightbulb className="mr-1 inline h-3 w-3 text-amber-500" />
                      {s.usuarioNome || s.usuarioEmail} sugeriu
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[#475569]">{s.sugestao}</p>
                  </div>
                ))}
              </div>
            ) : item.sugestoes.length > 0 ? (
              <ul className="mt-3 space-y-1.5">{item.sugestoes.map((s) => (<li key={s.id} className="rounded-lg bg-white p-2 text-xs text-[#475569] ring-1 ring-[#E9EEF5]"><span className="font-semibold text-[#1F2937]">Sugestão · {s.data}:</span> {s.texto}</li>))}</ul>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F2937]"><History className="h-4 w-4 text-[#64748B]" />Histórico de modificações</p>
            {item.historico.length > 0 ? (<ul className="space-y-1.5">{item.historico.map((h) => (<li key={h.id} className="text-[13px] text-[#475569]"><span className="font-semibold text-[#1F2937]">{rotuloRevisao(h.numero)}</span>{" · "}{h.data}{h.observacao ? ` — ${h.observacao}` : ""}</li>))}</ul>) : (<p className="text-[13px] text-[#94A3B8]">Nenhuma modificação registrada.</p>)}
          </div>
          <DetalheItem rotulo="Data da revisão" valor={item.dataRevisao} />
          <DetalheItem rotulo="Data de validade" valor={item.dataVencimento} />
          <DetalheItem rotulo="Revisão" valor={rotuloRevisao(item.revisao)} />
          <DetalheItem rotulo="Observação da revisão" valor={item.observacaoRevisao} />
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-[#E9EEF5] pt-4 sm:flex-row sm:justify-end">
          {podeModificar ? (
            <Button type="button" variant="outline" onClick={() => onEditar(item)}>
              <Edit3 className="h-4 w-4" /> Editar política
            </Button>
          ) : null}
          <Button type="button" onClick={onFechar} className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]">
            Voltar
          </Button>
        </div>
      </article>
    </div>
  );
}

/* Visualizador do anexo da política — somente leitura (PDF embutido; Word como texto extraído). */
function PoliticaAnexoVisualizador({ anexo }: { anexo: PoliticaAnexo | null }) {
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");

  useEffect(() => {
    if (!anexo?.path) {
      setUrlPdf(null);
      setTexto(null);
      setEstado("carregando");
      return;
    }
    let ativo = true;
    setEstado("carregando");
    const ehPdf = anexo.tipo === "application/pdf";
    Promise.all([
      urlAssinadaDoAnexo(anexo.path),
      ehPdf ? Promise.resolve(null) : textoDoAnexoOffice(anexo.path),
    ])
      .then(([link, textoExtraido]) => {
        if (!ativo) return;
        setUrlPdf(ehPdf ? link : null);
        setTexto(textoExtraido);
        setEstado("pronto");
      })
      .catch(() => {
        if (ativo) setEstado("erro");
      });
    return () => {
      ativo = false;
    };
  }, [anexo?.path, anexo?.tipo]);

  if (!anexo) return null;

  const badgeTipo = ROTULO_TIPO_ANEXO[anexo.tipo] ?? "Documento";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold text-[#1F2937]">Documento da política</p>
        <Badge variant="outline" className="bg-[#EEF2F7] text-[10px] text-[#1E3A8A]">{badgeTipo}</Badge>
        <span className="text-xs font-medium text-[#64748B]">{anexo.nome}</span>
        <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
          Somente leitura — download bloqueado
        </Badge>
      </div>

      {!anexo.path ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
          O arquivo não foi enviado ao armazenamento. Salve a política novamente com o anexo para
          visualizá-lo aqui.
        </p>
      ) : estado === "carregando" ? (
        <p className="rounded-lg border border-[#E9EEF5] bg-[#F8FAFC] p-3 text-[13px] text-[#64748B]">
          Abrindo o documento…
        </p>
      ) : estado === "erro" ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
          Não foi possível abrir o documento agora. Tente novamente mais tarde.
        </p>
      ) : anexo.tipo === "application/pdf" && urlPdf ? (
        <iframe
          src={`${urlPdf}#toolbar=0&navpanes=0&statusbar=0&view=FitH`}
          className="h-[640px] w-full rounded-lg border border-[#D9E0EA] bg-[#F8FAFC]"
          title={`Documento ${anexo.nome}`}
        />
      ) : (
        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#D9E0EA] bg-white p-4 font-sans text-[13px] leading-relaxed text-[#334155]">
          {texto ?? ""}
        </pre>
      )}
    </div>
  );
}
function DetalheItem({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (!valor?.trim()) return null;
  return (<div className="space-y-0.5"><p className="text-[13px] font-semibold text-[#1F2937]">{rotulo}</p><p className="whitespace-pre-line text-[13px] leading-relaxed text-[#475569]">{valor}</p></div>);
}



