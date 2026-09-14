import { createFileRoute } from "@tanstack/react-router";
import { PanelPage } from "@/components/panel-page";

export const Route = createFileRoute("/configuracoes")({
  component: () => <PanelPage title="Configurações" />,
});