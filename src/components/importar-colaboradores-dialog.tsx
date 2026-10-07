import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { criarAcessoColaborador } from "@/lib/auth";
import type { Colaborador } from "@/lib/dados";
import * as org from "@/lib/organizacao";
import type { SetorConfig } from "@/lib/organizacao";

const COLUNAS_MODELO = [
  "NOME COMPLETO",
  "EMAIL",
  "UNIDADE",
  "SETOR",
  "É LÍDER DE SETOR?",
  "EMAIL PARA ACESSO",
  "SENHA PARA ACESSO",
] as const;

type Campo = "nome" | "email" | "unidade" | "setor" | "lider" | "emailAcesso" | "senha";

interface LinhaImportada {
  linha: number;
  nome: string;
  email: string;
  unidade: string;
  setor: string;
  lider: boolean;
  emailAcesso: string;
  senha: string;
  erro?: string;
  /** Setor informado que ainda não existe no cadastro. */
  setorNovo?: boolean;
}

interface ResultadoLinha {
  linha: number;
  nome: string;
  status: "criado" | "ignorado" | "erro";
  detalhe: string;
  loginEmail?: string;
  senhaGerada?: string;
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function identificarColuna(cabecalho: unknown): Campo | null {
  const t = normalizar(cabecalho);
  if (!t) return null;
  if (t.includes("senha")) return "senha";
  if (t.includes("lider")) return "lider";
  if (t.includes("mail") && t.includes("acesso")) return "emailAcesso";
  if (t.includes("mail")) return "email";
  if (t.includes("nome")) return "nome";
  if (t.includes("unidade")) return "unidade";
  if (t.includes("setor")) return "setor";
  return null;
}

function ehSim(valor: unknown): boolean {
  return ["sim", "s", "x", "1", "true", "yes", "y", "lider"].includes(normalizar(valor));
}

function gerarSenha(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

interface ImportarColaboradoresDialogProps {
  aberto: boolean;
  setores: { nome: string }[];
  unidades: string[];
  cidadesUnidades: Map<string, string>;
  /** E-mails de colaboradores já cadastrados (para evitar duplicidade). */
  emailsExistentes: string[];
  /** E-mails que já possuem login: nunca têm a senha sobrescrita pela importação. */
  emailsComLogin: string[];
  /** Chamado com os setores criados durante a importação. */
  onSetoresCriados: (novos: SetorConfig[]) => void;
  /** Só admin / Desenvolvedor do Sistema podem criar acessos de login. */
  podeCriarLogin: boolean;
  onFechar: () => void;
  onImportado: (criados: Colaborador[], emailsComLogin: string[]) => void;
}

export function ImportarColaboradoresDialog({
  aberto,
  setores,
  unidades,
  cidadesUnidades,
  emailsExistentes,
  emailsComLogin,
  onSetoresCriados,
  podeCriarLogin,
  onFechar,
  onImportado,
}: ImportarColaboradoresDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<LinhaImportada[]>([]);
  const [erroArquivo, setErroArquivo] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoLinha[] | null>(null);
  const [criarSetores, setCriarSetores] = useState(false);

  function reiniciar() {
    setArquivo("");
    setLinhas([]);
    setErroArquivo("");
    setResultado(null);
    setProgresso(0);
    setCriarSetores(false);
  }

  function fechar() {
    if (importando) return;
    reiniciar();
    onFechar();
  }

  async function baixarModelo() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUNAS_MODELO],
      [
        "Maria da Silva",
        "maria@empresa.com.br",
        unidades[0] ?? "Matriz",
        setores[0]?.nome ?? "Qualidade",
        "Não",
        "maria@empresa.com.br",
        "",
      ],
    ]);
    ws["!cols"] = COLUNAS_MODELO.map(() => ({ wch: 26 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "modelo-importacao-colaboradores.xlsx");
  }

  async function lerArquivo(file: File) {
    reiniciar();
    setArquivo(file.name);
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setErroArquivo("Formato não suportado. Envie um arquivo Excel (.xlsx ou .xls).");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const planilha = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!planilha) {
        setErroArquivo("A planilha está vazia.");
        return;
      }
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(planilha, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      if (matriz.length < 2) {
        setErroArquivo("A planilha está vazia ou só tem o cabeçalho.");
        return;
      }

      const mapa = new Map<Campo, number>();
      (matriz[0] ?? []).forEach((cab, indice) => {
        const campo = identificarColuna(cab);
        if (campo && !mapa.has(campo)) mapa.set(campo, indice);
      });
      const obrigatorias: Campo[] = ["nome", "email", "unidade", "setor"];
      const faltando = obrigatorias.filter((campo) => !mapa.has(campo));
      if (faltando.length > 0) {
        const rotulos: Record<string, string> = {
          nome: "NOME COMPLETO",
          email: "EMAIL",
          unidade: "UNIDADE",
          setor: "SETOR",
        };
        setErroArquivo(
          `Colunas não encontradas: ${faltando.map((f) => rotulos[f]).join(", ")}. Baixe o modelo para conferir o cabeçalho.`,
        );
        return;
      }

      const valor = (linha: unknown[], campo: Campo) => {
        const indice = mapa.get(campo);
        return indice === undefined ? "" : String(linha[indice] ?? "").trim();
      };

      const lidas: LinhaImportada[] = matriz.slice(1).map((linha, i) => {
        const item: LinhaImportada = {
          linha: i + 2,
          nome: valor(linha, "nome"),
          email: valor(linha, "email").toLowerCase(),
          unidade: valor(linha, "unidade"),
          setor: valor(linha, "setor"),
          lider: ehSim(valor(linha, "lider")),
          emailAcesso: valor(linha, "emailAcesso").toLowerCase(),
          senha: valor(linha, "senha"),
        };
        if (!item.nome) item.erro = "Nome vazio.";
        else if (!item.email && !item.emailAcesso) item.erro = "E-mail vazio.";
        else if (!unidades.some((u) => normalizar(u) === normalizar(item.unidade)))
          item.erro = `Unidade "${item.unidade}" não cadastrada.`;
        else if (!item.setor) item.erro = "Setor vazio.";
        else if (!setores.some((s) => normalizar(s.nome) === normalizar(item.setor)))
          item.setorNovo = true;
        return item;
      });
      setLinhas(lidas);
    } catch {
      setErroArquivo("Não foi possível ler o arquivo. Verifique se é um Excel válido.");
    }
  }

  async function importar() {
    const bloqueio = (l: LinhaImportada) =>
      l.erro ?? (l.setorNovo && !criarSetores ? `Setor "${l.setor}" não cadastrado.` : undefined);
    const validas = linhas.filter((l) => !bloqueio(l));
    const resultados: ResultadoLinha[] = linhas
      .filter((l) => bloqueio(l))
      .map((l) => ({ linha: l.linha, nome: l.nome, status: "erro", detalhe: bloqueio(l) ?? "" }));
    const criados: Colaborador[] = [];
    const comLogin: string[] = [];
    const vistos = new Set(emailsExistentes.map((e) => e.trim().toLowerCase()));
    const loginsExistentes = new Set(emailsComLogin.map((e) => e.trim().toLowerCase()));
    const setoresDisponiveis = [...setores];

    setImportando(true);

    // Cria os setores novos (uma vez cada) antes de cadastrar as pessoas.
    const setoresCriados: SetorConfig[] = [];
    const falhasSetor = new Map<string, string>();
    for (const l of validas) {
      if (!l.setorNovo) continue;
      const chave = normalizar(l.setor);
      if (setoresDisponiveis.some((s) => normalizar(s.nome) === chave) || falhasSetor.has(chave))
        continue;
      try {
        const novo = await org.criarSetor(l.setor);
        setoresCriados.push(novo);
        setoresDisponiveis.push(novo);
      } catch (erro) {
        falhasSetor.set(chave, erro instanceof Error ? erro.message : "Falha ao criar o setor.");
      }
    }
    if (setoresCriados.length > 0) onSetoresCriados(setoresCriados);
    for (const [i, l] of validas.entries()) {
      const email = l.email || l.emailAcesso;
      if (vistos.has(email)) {
        resultados.push({
          linha: l.linha,
          nome: l.nome,
          status: "ignorado",
          detalhe: "E-mail já cadastrado.",
        });
        setProgresso(i + 1);
        continue;
      }
      const falhaSetor = falhasSetor.get(normalizar(l.setor));
      if (falhaSetor) {
        resultados.push({
          linha: l.linha,
          nome: l.nome,
          status: "erro",
          detalhe: `Setor "${l.setor}" não pôde ser criado: ${falhaSetor}`,
        });
        setProgresso(i + 1);
        continue;
      }
      vistos.add(email);

      const unidade = unidades.find((u) => normalizar(u) === normalizar(l.unidade)) ?? l.unidade;
      const setor =
        setoresDisponiveis.find((s) => normalizar(s.nome) === normalizar(l.setor))?.nome ?? l.setor;
      try {
        const criado = await org.criarColaborador({
          id: "",
          nome: l.nome,
          cargo: "Sem cargo",
          email,
          unidade,
          cidade: cidadesUnidades.get(unidade) ?? "",
          setor,
          nivelAcesso: l.lider ? "Líder de setor" : "Colaborador",
          exclusao: "Sem acesso",
        });
        criados.push(criado);

        let detalhe = "Colaborador criado.";
        let loginEmail: string | undefined;
        let senhaGerada: string | undefined;
        const querLogin = Boolean(l.emailAcesso || l.senha);
        if (querLogin && !podeCriarLogin) {
          detalhe = "Criado sem login (apenas administradores criam acessos).";
        } else if (querLogin) {
          const emailLogin = l.emailAcesso || email;
          const senha = l.senha || gerarSenha();
          if (loginsExistentes.has(emailLogin)) {
            detalhe = `Criado sem login: já existe acesso para ${emailLogin} (senha preservada).`;
          } else {
            try {
              await criarAcessoColaborador(criado.id, emailLogin, senha, "usuario");
              loginsExistentes.add(emailLogin);
              comLogin.push(emailLogin);
              loginEmail = emailLogin;
              if (!l.senha) senhaGerada = senha;
              detalhe = "Colaborador criado com acesso de login.";
            } catch (erro) {
              detalhe = `Criado, mas o login falhou: ${erro instanceof Error ? erro.message : "erro desconhecido"}`;
            }
          }
        }
        resultados.push({
          linha: l.linha,
          nome: l.nome,
          status: "criado",
          detalhe,
          loginEmail,
          senhaGerada,
        });
      } catch (erro) {
        resultados.push({
          linha: l.linha,
          nome: l.nome,
          status: "erro",
          detalhe: erro instanceof Error ? erro.message : "Não foi possível criar.",
        });
      }
      setProgresso(i + 1);
    }
    setImportando(false);
    resultados.sort((a, b) => a.linha - b.linha);
    setResultado(resultados);
    onImportado(criados, comLogin);
    toast.success(
      `${criados.length} colaborador(es) importado(s)${setoresCriados.length > 0 ? ` e ${setoresCriados.length} setor(es) criado(s)` : ""}.`,
    );
  }

  async function baixarResultado() {
    if (!resultado) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["LINHA", "NOME", "STATUS", "DETALHE", "EMAIL DE ACESSO", "SENHA GERADA"],
      ...resultado.map((r) => [
        r.linha,
        r.nome,
        r.status,
        r.detalhe,
        r.loginEmail ?? "",
        r.senhaGerada ?? "",
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado-importacao-colaboradores.xlsx");
  }

  const novosSetores = Array.from(
    new Map(
      linhas.filter((l) => l.setorNovo && !l.erro).map((l) => [normalizar(l.setor), l.setor]),
    ).values(),
  );
  const bloqueada = (l: LinhaImportada) =>
    Boolean(l.erro) || (Boolean(l.setorNovo) && !criarSetores);
  const validas = linhas.filter((l) => !bloqueada(l)).length;
  const invalidas = linhas.length - validas;
  const geradas = resultado?.filter((r) => r.senhaGerada).length ?? 0;

  return (
    <Dialog open={aberto} onOpenChange={(abre) => (!abre ? fechar() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar colaboradores</DialogTitle>
          <DialogDescription>
            Envie uma planilha Excel com as colunas: Nome completo, Email, Unidade, Setor, É líder
            de setor?, Email para acesso e Senha para acesso.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              {(["criado", "ignorado", "erro"] as const).map((status) => (
                <div key={status} className="rounded-xl border border-[#E9EEF5] p-3">
                  <p className="text-xl font-semibold text-[#1F2937]">
                    {resultado.filter((r) => r.status === status).length}
                  </p>
                  <p className="text-[12px] text-[#64748B]">
                    {status === "criado"
                      ? "Criados"
                      : status === "ignorado"
                        ? "Ignorados"
                        : "Com erro"}
                  </p>
                </div>
              ))}
            </div>
            {geradas > 0 ? (
              <p className="rounded-lg bg-[#FEF3C7] p-3 text-[13px] text-[#92400E]">
                {geradas} senha(s) foram geradas automaticamente. Baixe o resultado agora: elas não
                serão exibidas novamente.
              </p>
            ) : null}
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[#E9EEF5]">
              {resultado.map((r) => (
                <div
                  key={`${r.linha}-${r.nome}`}
                  className="flex items-start justify-between gap-3 border-b border-[#E9EEF5] px-3 py-2 text-[13px] last:border-0"
                >
                  <span className="font-medium text-[#1F2937]">
                    Linha {r.linha} · {r.nome || "—"}
                  </span>
                  <span
                    className={
                      r.status === "criado"
                        ? "text-[#059669]"
                        : r.status === "erro"
                          ? "text-[#E11D48]"
                          : "text-[#92400E]"
                    }
                  >
                    {r.detalhe}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                const file = e.dataTransfer.files[0];
                if (file) void lerArquivo(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                arrastando ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-[#D9E0EA] hover:bg-[#F8FAFC]"
              }`}
            >
              {arquivo ? (
                <FileSpreadsheet className="h-8 w-8 text-[#059669]" />
              ) : (
                <Upload className="h-8 w-8 text-[#94A3B8]" />
              )}
              <p className="mt-2 text-sm font-medium text-[#1F2937]">
                {arquivo || "Arraste o arquivo Excel aqui ou clique para selecionar"}
              </p>
              <p className="text-[12px] text-[#64748B]">.xlsx ou .xls</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void lerArquivo(file);
                  e.target.value = "";
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void baixarModelo()}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1E3A8A] hover:text-[#1E40AF]"
            >
              <Download className="h-4 w-4" />
              Baixar planilha modelo
            </button>

            {erroArquivo ? <p className="text-[13px] text-[#E11D48]">{erroArquivo}</p> : null}

            {linhas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[13px] text-[#1F2937]">
                  <strong>{validas}</strong> linha(s) prontas para importar
                  {invalidas > 0 ? (
                    <>
                      , <strong className="text-[#E11D48]">{invalidas}</strong> com problema
                    </>
                  ) : null}
                  .
                </p>
                {novosSetores.length > 0 ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[13px] text-[#92400E]">
                    <Checkbox
                      checked={criarSetores}
                      onCheckedChange={(marcado) => setCriarSetores(marcado === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong>Criar setores que não existem</strong> ({novosSetores.join(", ")}).
                      Sem marcar, as linhas desses setores não serão importadas.
                    </span>
                  </label>
                ) : null}
                {!podeCriarLogin ? (
                  <p className="text-[12px] text-[#92400E]">
                    Seu perfil não cria acessos de login: os colaboradores serão cadastrados sem
                    login.
                  </p>
                ) : null}
                <div className="max-h-[220px] overflow-y-auto rounded-xl border border-[#E9EEF5]">
                  {linhas.map((l) => (
                    <div
                      key={l.linha}
                      className="flex items-start justify-between gap-3 border-b border-[#E9EEF5] px-3 py-2 text-[13px] last:border-0"
                    >
                      <span className="text-[#1F2937]">
                        {l.nome || "—"}
                        <span className="text-[#64748B]">
                          {" "}
                          · {l.setor} · {l.unidade}
                          {l.lider ? " · Líder" : ""}
                        </span>
                      </span>
                      <span className={bloqueada(l) ? "text-[#E11D48]" : "text-[#059669]"}>
                        {l.erro ??
                          (l.setorNovo
                            ? criarSetores
                              ? "Setor será criado"
                              : `Setor "${l.setor}" não cadastrado.`
                            : "OK")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {resultado ? (
            <>
              <Button variant="outline" onClick={() => void baixarResultado()}>
                <Download className="h-4 w-4" />
                Baixar resultado
              </Button>
              <Button onClick={fechar}>Concluir</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={fechar} disabled={importando}>
                Cancelar
              </Button>
              <Button onClick={() => void importar()} disabled={validas === 0 || importando}>
                {importando ? `Importando… ${progresso}/${validas}` : `Importar ${validas || ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
