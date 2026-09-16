export function AppFooter({ variant = "panel" }: { variant?: "panel" | "brand" }) {
  return (
    <footer
      className={
        variant === "brand"
          ? "relative pb-5 text-center"
          : "mt-10 border-t border-border py-6 text-center"
      }
    >
      <p
        className={
          variant === "brand" ? "text-xs text-brand-muted" : "text-xs text-muted-foreground"
        }
      >
        Desenvolvido com 💙 pelos Desenvolvedores da{" "}
        <span className="font-medium text-blue-600 dark:text-blue-400">Orcoma Contabilidade</span> -
        G.
      </p>
    </footer>
  );
}
