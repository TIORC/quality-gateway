import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import LoadingScreen from "@/components/loading-screen";
import { getSession, isAuthenticated } from "@/lib/auth";
import { rotaInicial } from "@/lib/permissoes";

export const Route = createFileRoute("/loading")({
  head: () => ({
    meta: [
      { title: "Gestão da Qualidade | Carregando" },
      {
        name: "description",
        content: "Carregando o sistema de Gestão da Qualidade.",
      },
    ],
  }),
  component: LoadingPage,
});

function LoadingPage() {
  const router = useRouter();

  // Sem sessão válida, volta ao login.
  useEffect(() => {
    if (!isAuthenticated()) {
      router.navigate({ to: "/", replace: true });
    }
  }, [router]);

  return (
    <LoadingScreen
      onComplete={() => {
        router.navigate({ to: rotaInicial(getSession()), replace: true });
      }}
    />
  );
}
