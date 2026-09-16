import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import LoadingScreen from "@/components/loading-screen";
import { isAuthenticated } from "@/lib/auth";

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
        router.navigate({ to: "/painel", replace: true });
      }}
    />
  );
}
