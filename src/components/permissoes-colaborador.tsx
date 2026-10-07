import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  GRUPOS_PERMISSOES_EXTRAS,
  carregarPermissoesExtras,
  salvarPermissoesExtras,
  type PermissoesExtras,
} from "@/lib/permissoes-extras";

export function PermissoesColaborador({ colaboradorId }: { colaboradorId: string }) {
  const [valores, setValores] = useState<PermissoesExtras>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarPermissoesExtras(colaboradorId)
      .then((v) => ativo && setValores(v))
      .catch(() => toast.error("Não foi possível carregar as permissões."))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [colaboradorId]);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarPermissoesExtras(colaboradorId, valores);
      toast.success("Permissões salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Permissões do colaborador</h2>
          <p className="text-sm text-muted-foreground">Marque o que esta pessoa pode fazer.</p>
        </div>
        <Button onClick={salvar} disabled={carregando || salvando}>
          {salvando ? "Salvando…" : "Salvar permissões"}
        </Button>
      </div>
      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {GRUPOS_PERMISSOES_EXTRAS.map((grupo) => (
            <div key={grupo.titulo} className="rounded-xl border border-border p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {grupo.titulo}
              </p>
              <div className="space-y-2.5">
                {grupo.itens.map((item) => (
                  <label key={item.chave} className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
                    <Checkbox
                      checked={!!valores[item.chave]}
                      onCheckedChange={(c) => setValores((v) => ({ ...v, [item.chave]: c === true }))}
                      className="mt-0.5"
                    />
                    {item.rotulo}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
