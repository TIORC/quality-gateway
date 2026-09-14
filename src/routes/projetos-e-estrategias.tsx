import { createFileRoute } from "@tanstack/react-router";
import { PanelPage } from "@/components/panel-page";

export const Route = createFileRoute("/projetos-e-estrategias")({
  component: () => <PanelPage title="Projetos e Estretégias" />,
});