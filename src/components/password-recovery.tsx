import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { emailAutorizado, mensagemAuth } from "@/lib/delivery-auth";

export function PasswordRecovery() {
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    let ativo = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recovery = hash.get("type") === "recovery";
    const hashError = hash.get("error_description");
    if (hashError) setErro(hashError);
    else if (!recovery) setErro("Abra o link de recuperação enviado ao seu e-mail para definir uma nova senha.");
    // getUser waits for the auth client to process the recovery tokens and validates the account.
    if (recovery) void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!ativo) return;
      if (error) return setErro(error.message);
      if (!emailAutorizado(data.user?.email)) {
        setErro("Este e-mail não tem autorização para acessar o aplicativo.");
        await supabase.auth.signOut();
        return;
      }
      setPronto(true);
    }).catch(error => { if (ativo) setErro(mensagemAuth(error)); });
    return () => { ativo = false; };
  }, []);

  const salvar = async () => {
    if (!pronto) return;
    if (senha !== confirmacao) return setErro("As senhas não coincidem.");
    setSalvando(true);
    setErro("");
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!emailAutorizado(data.user?.email)) throw new Error("Este e-mail não tem autorização para acessar o aplicativo.");
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await supabase.auth.signOut();
      window.history.replaceState(null, "", "/reset-password");
      setConcluido(true);
    } catch (error) { setErro(mensagemAuth(error)); }
    finally { setSalvando(false); }
  };

  return <main className="auth-theme flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
    <section className="w-full max-w-md rounded-lg border border-border bg-card p-8">
      <h1 className="text-center text-2xl font-bold">Nova senha</h1>
      {erro && <p role="alert" className="mt-4 break-words text-sm text-destructive">{erro}</p>}
      {concluido ? <><p role="status" className="mt-5">Senha atualizada com sucesso.</p><Button asChild className="mt-5 w-full"><a href="/">Voltar para entrar</a></Button></> : <form onSubmit={event => { event.preventDefault(); void salvar(); }}>
        <label className="mt-5 block text-sm">Nova senha<input required type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-secondary p-3" /></label>
        <label className="mt-4 block text-sm">Confirmar nova senha<input required type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-secondary p-3" /></label>
        <Button type="submit" disabled={!pronto || salvando || !senha || !confirmacao} className="mt-5 h-12 w-full">{salvando ? "Salvando..." : "Salvar nova senha"}</Button>
        <Button asChild variant="link" className="mt-4 w-full"><a href="/">Voltar para entrar</a></Button>
      </form>}
    </section>
  </main>;
}