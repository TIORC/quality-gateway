import { createFileRoute } from "@tanstack/react-router";
import { OcorrenciasEquipe } from "@/routes/ocorrencias";

export const Route = createFileRoute("/minha-equipe")({
  head: () => ({
    meta: [{ title: "Minha equipe | Gestão da Qualidade" }],
  }),
  component: OcorrenciasEquipe,
});
