import { createFileRoute } from "@tanstack/react-router";
import { PanelPage } from "@/components/panel-page";

export const Route = createFileRoute("/disparo-de-cobrancas")({
  component: () => <PanelPage title="Disparo de Cobranças" />,
});