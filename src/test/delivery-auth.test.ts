import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { entrarComSenha, recuperarSenha, emailAutorizado, mensagemAuth } from "@/lib/delivery-auth";

function clientMock() {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
}

describe("Delivery authentication", () => {
  it("allows only the specified account", () => {
    expect(emailAutorizado("daniel.vuandoalto10@gmail.com")).toBe(true);
    expect(emailAutorizado("another@example.com")).toBe(false);
    expect(emailAutorizado(null)).toBe(false);
  });

  it("rejects an unauthorized email before making an auth request", async () => {
    const { client, auth } = clientMock();
    await expect(entrarComSenha(client, "another@example.com", "example")).rejects.toThrow();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("uses password login and lets the provider validate shorter existing passwords", async () => {
    const { client, auth } = clientMock();
    await entrarComSenha(client, "daniel.vuandoalto10@gmail.com", "123456");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "daniel.vuandoalto10@gmail.com", password: "123456" });
  });

  it("preserves the provider's login error", async () => {
    const { client, auth } = clientMock();
    const error = new Error("Invalid login credentials");
    auth.signInWithPassword.mockResolvedValue({ error });
    await expect(entrarComSenha(client, "daniel.vuandoalto10@gmail.com", "example")).rejects.toBe(error);
    expect(mensagemAuth(error)).toBe("Invalid login credentials");
  });

  it("sends recovery only to the authorized account with the exact published redirect", async () => {
    const { client, auth } = clientMock();
    await recuperarSenha(client);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("daniel.vuandoalto10@gmail.com", {
      redirectTo: "https://hello-world-tool-90.lovable.app/reset-password",
    });
  });

  it("preserves recovery request errors", async () => {
    const { client, auth } = clientMock();
    const error = new Error("Email rate limit exceeded");
    auth.resetPasswordForEmail.mockResolvedValue({ error });
    await expect(recuperarSenha(client)).rejects.toBe(error);
  });
});