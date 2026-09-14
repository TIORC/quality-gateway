import { createFileRoute } from "@tanstack/react-router";
import { PanelPage } from "@/components/panel-page";

export const Route = createFileRoute("/atas-de-reuniao")({
  component: () => <PanelPage title="Atas de Reunião" />,
});