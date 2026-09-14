import { AtSign } from "lucide-react";
import { useState } from "react";
import type { Colaborador } from "@/lib/dados";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export interface CampoMencaoProps {
  colaboradores: Colaborador[];
  selecionados: Colaborador[];
  onChange: (lista: Colaborador[]) => void;
  placeholder?: string;
  exibirAvatar?: boolean;
}

export function CampoMencao({
  colaboradores,
  selecionados,
  onChange,
  placeholder = "Digite @ para mencionar colaboradores…",
  exibirAvatar = false,
}: CampoMencaoProps) {
  const [texto, setTexto] = useState("");

  const ultimaPalavra = texto.split(/\s+/).pop() ?? "";
  const buscando = ultimaPalavra.startsWith("@");
  const consulta = buscando ? ultimaPalavra.slice(1) : "";

  const disponiveis = colaboradores.filter(
    (colaborador) => !selecionados.some((item) => item.id === colaborador.id),
  );

  const filtrados = disponiveis.filter((colaborador) =>
    colaborador.nome.toLowerCase().includes(consulta.toLowerCase()),
  );

  function selecionar(colaborador: Colaborador) {
    const partes = texto.split(/\s+/);
    partes[partes.length - 1] = `@${colaborador.nome}`;
    setTexto(`${partes.join(" ")} `);
    onChange([...selecionados, colaborador]);
  }

  function remover(colaborador: Colaborador) {
    onChange(selecionados.filter((item) => item.id !== colaborador.id));
  }

  return (
    <div>
      <Popover open={buscando}>
        <PopoverTrigger asChild>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder={placeholder}
              className="pl-9"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          {filtrados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#64748B]">Nenhum colaborador encontrado.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto p-1">
              {filtrados.map((colaborador) => (
                <button
                  key={colaborador.id}
                  type="button"
                  onClick={() => selecionar(colaborador)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition hover:bg-[#F1F5F9]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#312E81] text-[10px] font-semibold text-white">
                    {iniciais(colaborador.nome)}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-[#1F2937]">
                      @{colaborador.nome}
                    </span>
                    <span className="block text-[11px] text-[#64748B]">{colaborador.cargo}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selecionados.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selecionados.map((colaborador) => (
            <span
              key={colaborador.id}
              className={`inline-flex items-center gap-1 rounded-full bg-[#EEF2F7] py-1 pr-1 text-xs font-medium text-[#1F2937] ${exibirAvatar ? "pl-1.5" : "pl-2.5"}`}
            >
              {exibirAvatar ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#312E81] text-[10px] font-semibold text-white">
                  {iniciais(colaborador.nome)}
                </span>
              ) : null}
              {exibirAvatar ? colaborador.nome : `@${colaborador.nome}`}
              <button
                type="button"
                onClick={() => remover(colaborador)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#E2E8F0] hover:text-[#E11D48]"
                aria-label={`Remover ${colaborador.nome}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
