/**
 * Arquivos anexados às evidências de um plano de ação.
 *
 * Usa o bucket privado `pop-anexos` (o mesmo das ocorrências e dos POPs): o
 * arquivo fica em `planos/<id do plano>/...` e só é lido por URL assinada
 * efêmera. Não exige migration nova.
 */
import { exigirCloud } from "@/integrations/supabase/client";
import { traduzErro } from "@/lib/organizacao";
import type { AnexoPlano } from "@/lib/planos";

const BUCKET = "pop-anexos";

/** Envia o arquivo ao Storage e devolve o anexo com o caminho gravado. */
export async function enviarAnexoPlano(planoId: string, arquivo: File): Promise<AnexoPlano> {
  const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : "bin";
  const caminho = `planos/${planoId}/${Date.now()}.${(extensao ?? "bin").toLowerCase()}`;
  const { error } = await exigirCloud()
    .storage.from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) throw traduzErro(error);
  return { nome: arquivo.name, caminho, tipo: arquivo.type, tamanho: arquivo.size };
}

/** URL assinada, válida por 5 minutos, para abrir um anexo guardado. */
export async function urlAnexoPlano(caminho: string): Promise<string> {
  const { data, error } = await exigirCloud()
    .storage.from(BUCKET)
    .createSignedUrl(caminho, 60 * 5);
  if (error) throw traduzErro(error);
  if (!data) throw new Error("Não foi possível abrir o anexo.");
  return data.signedUrl;
}
