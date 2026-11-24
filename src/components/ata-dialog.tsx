import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AtaPrevia } from "@/components/ata-previa";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/auth";
import type {
  Ata,
  DocumentoAta,
  OrigemAta,
  ParticipanteDocumento,
  PautaDocumento,
  PlanoDocumento,
  TipoReuniao,
} from "@/lib/atas";
import { documentoVazio } from "@/lib/atas-base";
import { atualizarAta, criarAta } from "@/lib/atas-crud";
import { traduzErro } from "@/lib/organizacao";

interface CampoProps {
  rotulo: string;
  children: React.ReactNode;
}

function Campo({ rotulo, children }: CampoProps) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-[13px] font-medium text-[#1F2937]">{rotulo}</Label>
      {children}
    </div>
  );
}

/** Campo pequeno usado dentro das linhas das tabelas. */
function Mini({ rotulo, children }: CampoProps) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-[11px] font-medium text-[#64748B]">{rotulo}</span>
      {children}
    </div>
  );
}

interface AtaDialogProps {
  aberto: boolean;
  /** Ata em edição; `null`/ausente = novo cadastro. */
  ata: Ata | null;
  /** Tipos de reunião (usados só para atas já vinculadas a um tipo). */
  tipos: TipoReuniao[];
  /** Mantido por compatibilidade: a ata padronizada não tem mais escolha de origem. */
  podeCriarSimples: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

/** Data de hoje no formato `AAAA-MM-DD`, no fuso local (não UTC). */
function dataDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** Números das ações do modelo, usados como ponto de partida do plano. */
const NUMEROS_PLANO_PADRAO = ["1.1", "1.2", "2.1", "3.1", "4.1", "5.1"];
const PAUTAS_PADRAO = 5;

/** Linhas do formulário carregam um `id` estável para o React. */
type LinhaPauta = PautaDocumento & { id: number };
type LinhaPlano = PlanoDocumento & { id: number };
type LinhaParticipante = ParticipanteDocumento & { id: number };

let proximoId = 0;
function novoId(): number {
  proximoId += 1;
  return proximoId;
}

function novaPauta(): LinhaPauta {
  return { id: novoId(), area: "", pauta: "", descricao: "" };
}

function novoPlano(numero = ""): LinhaPlano {
  return { id: novoId(), numero, oQue: "", como: "", quem: "", quando: "", status: "" };
}

function novoParticipante(): LinhaParticipante {
  return { id: novoId(), nome: "", cargo: "" };
}

function planoInicial(): LinhaPlano[] {
  return NUMEROS_PLANO_PADRAO.map((numero) => novoPlano(numero));
}

function pautaInicial(): LinhaPauta[] {
  return Array.from({ length: PAUTAS_PADRAO }, () => novaPauta());
}

/**
 * Ata padronizada: toda nova ata é criada como avulsa, sem tipo de reunião.
 * Atas já existentes mantêm a origem e o tipo com que foram criadas.
 */
function origemDaAta(ata: Ata | null): OrigemAta {
  if (ata && (ata.origem === "simples" || ata.origem === "sistema")) return ata.origem;
  return "simples";
}

export function AtaDialog({ aberto, ata, tipos, onFechar, onSalvo }: AtaDialogProps) {
  const [tipoReuniaoId, setTipoReuniaoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [areas, setAreas] = useState("");
  const [horario, setHorario] = useState("");
  const [pauta, setPauta] = useState<LinhaPauta[]>(pautaInicial);
  const [plano, setPlano] = useState<LinhaPlano[]>(planoInicial);
  const [participantes, setParticipantes] = useState<LinhaParticipante[]>([]);
  const [texto, setTexto] = useState("");
  const [elaboradoPor, setElaboradoPor] = useState("");
  const [aprovadoPor, setAprovadoPor] = useState("");
  const [revisao, setRevisao] = useState("1");
  const [dataRevisao, setDataRevisao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const editando = ata !== null;
  const origem = origemDaAta(ata);
  // Só atas já vinculadas a um tipo mostram o campo de tipo (somente leitura).
  const mostrarTipo = editando && origem === "sistema";

  useEffect(() => {
    if (!aberto) return;
    // Edição: carrega o documento salvo. Nova ata: começa do documento em branco.
    const doc = ata ? ata.documento : documentoVazio();
    setSalvando(false);
    setAreas(doc.areas);
    setHorario(doc.horario);
    setPauta(
      doc.pauta.length > 0 ? doc.pauta.map((l) => ({ ...l, id: novoId() })) : pautaInicial(),
    );
    setPlano(
      doc.plano.length > 0 ? doc.plano.map((l) => ({ ...l, id: novoId() })) : planoInicial(),
    );
    setParticipantes(doc.participantes.map((l) => ({ ...l, id: novoId() })));
    setElaboradoPor(doc.elaboradoPor);
    setAprovadoPor(doc.aprovadoPor);
    setRevisao(doc.revisao || "1");
    setDataRevisao(doc.dataRevisao || dataDeHoje());
    if (ata) {
      setTipoReuniaoId(ata.tipoReuniaoId ?? "");
      setTitulo(ata.titulo);
      setDataReuniao(ata.dataReuniao);
      setTexto(ata.texto);
    } else {
      setTipoReuniaoId("");
      setTitulo("");
      // Nova ata: começa com a data de hoje, e o campo continua editável.
      setDataReuniao(dataDeHoje());
      setTexto("");
    }
  }, [aberto, ata]);

  // Edição: mantém o tipo atual mesmo que ele tenha sido desativado depois.
  const opcoesTipos = editando
    ? ata.tipoReuniaoId && !tipos.some((t) => t.id === ata.tipoReuniaoId && t.ativo)
      ? tipos
      : tipos.filter((t) => t.ativo)
    : tipos.filter((t) => t.ativo);

  function atualizarPauta(id: number, campo: keyof PautaDocumento, valor: string) {
    setPauta((lista) => lista.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }
  function atualizarPlano(id: number, campo: keyof PlanoDocumento, valor: string) {
    setPlano((lista) => lista.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }
  function atualizarParticipante(id: number, campo: keyof ParticipanteDocumento, valor: string) {
    setParticipantes((lista) => lista.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  /** Documento completo, sem os `id` do formulário, pronto para gravar. */
  function montarDocumento(): DocumentoAta {
    return {
      areas: areas.trim(),
      horario: horario.trim(),
      pauta: pauta.map(({ area, pauta: assunto, descricao }) => ({
        area: area.trim(),
        pauta: assunto.trim(),
        descricao: descricao.trim(),
      })),
      plano: plano.map(({ numero, oQue, como, quem, quando, status }) => ({
        numero: numero.trim(),
        oQue: oQue.trim(),
        como: como.trim(),
        quem: quem.trim(),
        quando: quando.trim(),
        status: status.trim(),
      })),
      participantes: participantes
        .filter((p) => p.nome.trim() || p.cargo.trim())
        .map(({ nome, cargo }) => ({ nome: nome.trim(), cargo: cargo.trim() })),
      elaboradoPor: elaboradoPor.trim(),
      aprovadoPor: aprovadoPor.trim(),
      revisao: revisao.trim() || "1",
      dataRevisao: dataRevisao.trim(),
    };
  }

  async function salvar() {
    if (salvando) return;
    if (!titulo.trim()) {
      toast.error("Informe o título da ata.");
      return;
    }
    if (!dataReuniao.trim()) {
      toast.error("Informe a data da reunião.");
      return;
    }
    setSalvando(true);
    const entrada = {
      origem,
      tipoReuniaoId: origem === "sistema" ? tipoReuniaoId || null : null,
      titulo: titulo.trim(),
      dataReuniao: dataReuniao.trim(),
      texto,
      documento: montarDocumento(),
    };
    try {
      if (editando) {
        await atualizarAta(ata.id, entrada, getSession());
        toast.success("Ata atualizada");
      } else {
        await criarAta(entrada, getSession());
        toast.success("Ata registrada");
      }
      onSalvo();
    } catch (e) {
      toast.error(traduzErro(e).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? onFechar() : undefined)}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] sm:max-w-[min(calc(100vw-24px),1600px)] max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar ata" : "Nova Ata de Reunião"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Altere os dados da reunião. A prévia ao lado mostra o documento."
              : "Preencha os dados da reunião. A prévia ao lado mostra o documento."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
          <div className="min-w-0 space-y-6 lg:max-h-[calc(94vh-170px)] lg:overflow-y-auto lg:pr-1">
            {/* Dados da reunião */}
            <section className="space-y-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                Dados da reunião
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Campo rotulo="Título">
                    <Input
                      value={titulo}
                      onChange={(evento) => setTitulo(evento.target.value)}
                      placeholder="Ex.: Reunião de análise crítica"
                    />
                  </Campo>
                </div>
                <Campo rotulo="Data da reunião">
                  <Input
                    type="date"
                    value={dataReuniao}
                    onChange={(evento) => setDataReuniao(evento.target.value)}
                  />
                </Campo>
                <Campo rotulo="Horário">
                  <Input
                    value={horario}
                    onChange={(evento) => setHorario(evento.target.value)}
                    placeholder="Ex.: 14:00 às 15:30"
                  />
                </Campo>
                <div className="sm:col-span-2">
                  <Campo rotulo="Áreas">
                    <Input
                      value={areas}
                      onChange={(evento) => setAreas(evento.target.value)}
                      placeholder="Ex.: Comercial, Financeiro"
                    />
                  </Campo>
                </div>
                {mostrarTipo ? (
                  <div className="sm:col-span-2">
                    <Campo rotulo="Tipo de reunião">
                      <Select value={tipoReuniaoId} onValueChange={setTipoReuniaoId} disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {opcoesTipos.map((tipo) => (
                            <SelectItem key={tipo.id} value={tipo.id}>
                              {tipo.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Pauta */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                  Pauta da reunião ({pauta.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPauta((lista) => [...lista, novaPauta()])}
                >
                  + Linha
                </Button>
              </div>
              {pauta.map((linha, indice) => (
                <div key={linha.id} className="space-y-2 rounded-lg border border-[#E2E8F0] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#475569]">
                      Item {indice + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPauta((lista) => lista.filter((l) => l.id !== linha.id))}
                      aria-label={`Remover item ${indice + 1}`}
                    >
                      Remover
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Mini rotulo="Área">
                      <Input
                        value={linha.area}
                        onChange={(e) => atualizarPauta(linha.id, "area", e.target.value)}
                      />
                    </Mini>
                    <Mini rotulo="Pauta">
                      <Input
                        value={linha.pauta}
                        onChange={(e) => atualizarPauta(linha.id, "pauta", e.target.value)}
                      />
                    </Mini>
                  </div>
                  <Mini rotulo="Descrição">
                    <Textarea
                      value={linha.descricao}
                      onChange={(e) => atualizarPauta(linha.id, "descricao", e.target.value)}
                      className="min-h-[60px] text-[13px]"
                    />
                  </Mini>
                </div>
              ))}
            </section>

            {/* Plano de ação */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                  Plano de ação ({plano.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPlano((lista) => [...lista, novoPlano()])}
                >
                  + Ação
                </Button>
              </div>
              {plano.map((linha, indice) => (
                <div key={linha.id} className="space-y-2 rounded-lg border border-[#E2E8F0] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#475569]">
                      Ação {indice + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlano((lista) => lista.filter((l) => l.id !== linha.id))}
                      aria-label={`Remover ação ${indice + 1}`}
                    >
                      Remover
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[90px_1fr]">
                    <Mini rotulo="Nº">
                      <Input
                        value={linha.numero}
                        onChange={(e) => atualizarPlano(linha.id, "numero", e.target.value)}
                      />
                    </Mini>
                    <Mini rotulo="O que?">
                      <Textarea
                        value={linha.oQue}
                        onChange={(e) => atualizarPlano(linha.id, "oQue", e.target.value)}
                        className="min-h-[52px] text-[13px]"
                      />
                    </Mini>
                  </div>
                  <Mini rotulo="Como">
                    <Textarea
                      value={linha.como}
                      onChange={(e) => atualizarPlano(linha.id, "como", e.target.value)}
                      className="min-h-[52px] text-[13px]"
                    />
                  </Mini>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Mini rotulo="Quem">
                      <Input
                        value={linha.quem}
                        onChange={(e) => atualizarPlano(linha.id, "quem", e.target.value)}
                      />
                    </Mini>
                    <Mini rotulo="Quando">
                      <Input
                        value={linha.quando}
                        onChange={(e) => atualizarPlano(linha.id, "quando", e.target.value)}
                      />
                    </Mini>
                    <Mini rotulo="Status">
                      <Input
                        value={linha.status}
                        onChange={(e) => atualizarPlano(linha.id, "status", e.target.value)}
                      />
                    </Mini>
                  </div>
                </div>
              ))}
            </section>

            {/* Participantes */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                  Participantes ({participantes.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setParticipantes((lista) => [...lista, novoParticipante()])}
                >
                  + Participante
                </Button>
              </div>
              {participantes.length === 0 ? (
                <p className="text-[12px] text-[#94A3B8]">Nenhum participante adicionado.</p>
              ) : null}
              {participantes.map((linha, indice) => (
                <div key={linha.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Mini rotulo={`Nome ${indice + 1}`}>
                    <Input
                      value={linha.nome}
                      onChange={(e) => atualizarParticipante(linha.id, "nome", e.target.value)}
                    />
                  </Mini>
                  <Mini rotulo="Cargo / função">
                    <Input
                      value={linha.cargo}
                      onChange={(e) => atualizarParticipante(linha.id, "cargo", e.target.value)}
                    />
                  </Mini>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setParticipantes((lista) => lista.filter((l) => l.id !== linha.id))
                    }
                    aria-label={`Remover participante ${indice + 1}`}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </section>

            {/* Responsáveis e revisão */}
            <section className="space-y-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">
                Responsáveis e revisão
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Elaborado por">
                  <Input
                    value={elaboradoPor}
                    onChange={(e) => setElaboradoPor(e.target.value)}
                    placeholder="Nome de quem elaborou"
                  />
                </Campo>
                <Campo rotulo="Aprovado por">
                  <Input
                    value={aprovadoPor}
                    onChange={(e) => setAprovadoPor(e.target.value)}
                    placeholder="Nome de quem aprovou"
                  />
                </Campo>
                <Campo rotulo="Revisão">
                  <Input
                    value={revisao}
                    onChange={(e) => setRevisao(e.target.value)}
                    placeholder="1"
                  />
                </Campo>
                <Campo rotulo="Data da revisão">
                  <Input
                    type="date"
                    value={dataRevisao}
                    onChange={(e) => setDataRevisao(e.target.value)}
                  />
                </Campo>
              </div>
            </section>

            <Campo rotulo="Observações (texto livre)">
              <Textarea
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Transcreva o conteúdo da reunião, se quiser…"
                className="min-h-[120px] text-[13px] leading-relaxed"
              />
            </Campo>
          </div>

          <aside className="min-w-0 overflow-x-auto rounded-xl bg-[#E2E8F0] p-3 lg:max-h-[calc(94vh-170px)] lg:overflow-y-auto">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475569]">
              Prévia do documento
            </p>
            <AtaPrevia
              titulo={titulo}
              dataReuniao={dataReuniao}
              areas={areas}
              horario={horario}
              pauta={pauta}
              plano={plano}
              participantes={participantes}
              texto={texto}
              elaboradoPor={elaboradoPor}
              aprovadoPor={aprovadoPor}
              revisao={revisao}
              dataRevisao={dataRevisao}
            />
          </aside>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="bg-[#1E3A8A] text-white hover:bg-[#1E40AF]"
          >
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Registrar ata"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
