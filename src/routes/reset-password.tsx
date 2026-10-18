import { createFileRoute } from "@tanstack/react-router";
import { PasswordRecovery } from "@/components/password-recovery";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Nova senha | Baixas de Entrega" },
    { name: "description", content: "Recuperação de senha do acesso autorizado às Baixas de Entrega." },
    { property: "og:title", content: "Nova senha | Baixas de Entrega" },
    { property: "og:description", content: "Recupere seu acesso às Baixas de Entrega." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PasswordRecovery,
});