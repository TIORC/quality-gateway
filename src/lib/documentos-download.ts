/**
 * Documentos para download ligados a um registro (POP, política...).
 *
 * Diferente do anexo principal (um arquivo por registro), aqui cabem vários.
 * Os arquivos ficam no bucket privado `pop-anexos`, em
 * `documentos/<id do registro>/...`, e só são baixados pelo sistema.
 *
 * Cada tipo de registro tem a sua tabela e as suas funções de banco; a
 * lógica de envio, listagem, remoção e download é a mesma, por
 * `criarServicoDocumentos`.
 */
import { exigirCloud } from "@/integrations/supabase/client";
import type { UserSession } from "@/lib/auth";
import { ehUsuarioDaQualidade } from "@/lib/permissoes";
import { traduzErro } from "@/lib/organizacao";
import { clienteLivre } from "@/lib/supabase-livro";

const BUCKET = "pop-anexos";

/** Tamanho máximo de cada documento (mesmo limite do anexo principal). */
export const TAMANHO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024;

/** Extensões aceitas. Acrescente aqui se precisar de outro formato. */
export const EXTENSOES_DOCUMENTO = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "txt",
] as const;

/** Valor do atributo `accept` do input de arquivo. */
export const ACCEPT_DOCUMENTO = EXTENSOES_DOCUMENTO.map((ext) => `.${ext}`).join(",");

/** Documento para download, já no formato da tela. */
export interface DocumentoDownload {
  id: string;
  /** Id do registro ao qual o documento pertence (POP ou política). */
  entidadeId: string;
  nome: string;
  caminho: string;
  tipo: string | null;
  tamanho: number | null;
  enviadoPorNome: string;
  criadoEm: string;
}

/** Operações de documentos de um tipo de registro. */
export interface ServicoDocumentos {
  listar(entidadeId: string): Promise<DocumentoDownload[]>;
  enviar(entidadeId: string, arquivo: File, sessao: UserSession | null): Promise<DocumentoDownload>;
  remover(documento: DocumentoDownload, sessao: UserSession | null): Promise<void>;
  baixar(documento: DocumentoDownload): Promise<void>;
}

/** Nomes das tabelas e funções de banco de um tipo de registro. */
export interface ConfigServicoDocumentos {
  /** Tabela de metadados (ex.: `pop_documentos`). */
  tabela: string;
  /** Coluna que liga o documento ao registro (ex.: `pop_id`). */
  colunaEntidade: string;
  /** Função que registra o documento (ex.: `adicionar_documento_pop`). */
  rpcAdicionar: string;
  /** Parâmetro com o id do registro na função de adicionar (ex.: `p_pop_id`). */
  paramEntidade: string;
  /** Função que remove o registro (ex.: `remover_documento_pop`). */
  rpcRemover: string;
}

/** Só o setor da Qualidade (e a liderança) adiciona ou remove documentos. */
export function podeGerenciarDocumentos(sessao: UserSession | null | undefined): boolean {
  return ehUsuarioDaQualidade(sessao);
}

/** `true` quando a extensão do arquivo está na lista aceita. */
export function formatoDocumentoAceito(nome: string): boolean {
  const extensao = nome.includes(".") ? (nome.split(".").pop() ?? "").toLowerCase() : "";
  return (EXTENSOES_DOCUMENTO as readonly string[]).includes(extensao);
}

/** Extensão em maiúsculas, para o rótulo (ex.: "XLSX"). */
export function rotuloFormato(nome: string): string {
  return nome.includes(".") ? (nome.split(".").pop() ?? "").toUpperCase() : "";
}

/** Tamanho legível, ex.: "845 KB" ou "2,3 MB". */
export function formatarTamanhoDocumento(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function emailDaSessao(sessao: UserSession | null): string {
  return (sessao?.email ?? "").trim().toLowerCase();
}

/** Cria o conjunto de operações para um tipo de registro. */
export function criarServicoDocumentos(config: ConfigServicoDocumentos): ServicoDocumentos {
  function docDoBanco(row: Record<string, unknown>): DocumentoDownload {
    return {
      id: String(row["id"]),
      entidadeId: String(row[config.colunaEntidade]),
      nome: String(row["nome"] ?? ""),
      caminho: String(row["caminho"] ?? ""),
      tipo: (row["tipo"] as string | null) ?? null,
      tamanho: typeof row["tamanho"] === "number" ? (row["tamanho"] as number) : null,
      enviadoPorNome: String(row["enviado_por_nome"] ?? ""),
      criadoEm: String(row["created_at"] ?? ""),
    };
  }

  return {
    async listar(entidadeId) {
      const { data, error } = await clienteLivre()
        .from(config.tabela)
        .select(`id,${config.colunaEntidade},nome,caminho,tipo,tamanho,enviado_por_nome,created_at`)
        .eq(config.colunaEntidade, entidadeId)
        .order("created_at", { ascending: true });
      if (error) throw traduzErro(error);
      return ((data ?? []) as Record<string, unknown>[]).map(docDoBanco);
    },

    async enviar(entidadeId, arquivo, sessao) {
      if (!podeGerenciarDocumentos(sessao)) {
        throw new Error("Apenas o setor da Qualidade pode adicionar documentos.");
      }
      if (!formatoDocumentoAceito(arquivo.name)) {
        throw new Error(
          `Formato não aceito. Use: ${EXTENSOES_DOCUMENTO.join(", ").toUpperCase()}.`,
        );
      }
      if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO) {
        throw new Error("O documento deve ter no máximo 20 MB.");
      }

      const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "bin";
      const aleatorio = Math.random().toString(36).slice(2, 8);
      const caminho = `documentos/${entidadeId}/${Date.now()}-${aleatorio}.${extensao}`;
      const storage = exigirCloud().storage.from(BUCKET);

      const { error: erroEnvio } = await storage.upload(caminho, arquivo, {
        contentType: arquivo.type || undefined,
        upsert: false,
      });
      if (erroEnvio) throw traduzErro(erroEnvio);

      const { data, error } = await clienteLivre().rpc(config.rpcAdicionar, {
        email_caller: emailDaSessao(sessao),
        [config.paramEntidade]: entidadeId,
        p_documento: {
          nome: arquivo.name,
          caminho,
          tipo: arquivo.type || null,
          tamanho: arquivo.size,
          enviado_por_nome: sessao?.nome ?? "",
        },
      });
      if (error) {
        // Sem registro no banco, o arquivo enviado não pode ficar órfão no Storage.
        await storage.remove([caminho]);
        throw traduzErro(error);
      }
      return docDoBanco(data as Record<string, unknown>);
    },

    async remover(documento, sessao) {
      if (!podeGerenciarDocumentos(sessao)) {
        throw new Error("Apenas o setor da Qualidade pode remover documentos.");
      }
      const { data, error } = await clienteLivre().rpc(config.rpcRemover, {
        email_caller: emailDaSessao(sessao),
        p_documento_id: documento.id,
      });
      if (error) throw traduzErro(error);
      const caminho = typeof data === "string" ? data : documento.caminho;
      await exigirCloud().storage.from(BUCKET).remove([caminho]);
    },

    async baixar(documento) {
      const { data, error } = await exigirCloud().storage.from(BUCKET).download(documento.caminho);
      if (error || !data) throw new Error("Não foi possível baixar o documento.");

      // Download pelo sistema (sem link público): o blob vira um link temporário.
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = documento.nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
