import { createFileRoute } from "@tanstack/react-router";
import { PanelPage } from "@/components/panel-page";

export const Route = createFileRoute("/politicas")({
  component: () => <PanelPage title="Políticas" />,
});