import type { SupabaseClient } from "@supabase/supabase-js";

export const EMAIL_AUTORIZADO = "daniel.vuandoalto10@gmail.com";
export const RECOVERY_REDIRECT = "https://hello-world-tool-90.lovable.app/reset-password";

export function emailAutorizado(email: string | undefined | null) {
  return email?.trim().toLowerCase() === EMAIL_AUTORIZADO;
}

export async function entrarComSenha(client: SupabaseClient, email: string, password: string) {
  if (!emailAutorizado(email)) throw new Error("Somente o e-mail autorizado pode acessar este aplicativo.");
  const { error } = await client.auth.signInWithPassword({ email: EMAIL_AUTORIZADO, password });
  if (error) throw error;
}

export async function recuperarSenha(client: SupabaseClient) {
  // Sempre usa o endereço publicado. window.location.origin pode ser localhost
  // ou um domínio de preview e faria o e-mail apontar para o endereço errado.
  const { error } = await client.auth.resetPasswordForEmail(EMAIL_AUTORIZADO, {
    redirectTo: RECOVERY_REDIRECT,
  });
  if (error) throw error;
}

export function mensagemAuth(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a autenticação. Tente novamente.";
}
