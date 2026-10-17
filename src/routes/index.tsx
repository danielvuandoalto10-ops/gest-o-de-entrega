import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [usuario, setUsuario] = useState<string | null>(null);

  const entrar = (nome: string) => {
    localStorage.setItem("usuario", nome);
    setUsuario(nome);
  };

  const sair = () => {
    localStorage.removeItem("usuario");
    setUsuario(null);
  };

  if (usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white">
            {usuario.charAt(0)}
          </div>
          <h1 className="text-3xl font-bold text-white">Olá, {usuario}!</h1>
          <p className="mt-2 text-slate-400">Você entrou no Baixas sem Entrega.</p>
          <button
            type="button"
            onClick={sair}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-bold text-emerald-500 ring-1 ring-slate-700">
            BE
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Baixas sem Entrega</h1>
          <p className="mt-3 text-slate-400">Escolha seu usuário para acessar o aplicativo.</p>
          <p className="mt-1 text-sm text-slate-500">Acesso rápido, sem senha.</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => entrar("Rafael")}
            className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-left transition hover:border-emerald-500 hover:bg-slate-800 active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">R</span>
            <span>
              <strong className="block text-lg text-white">Rafael</strong>
              <span className="text-sm text-slate-400">Entrar sem senha</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => entrar("Arranjar")}
            className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-left transition hover:border-emerald-500 hover:bg-slate-800 active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">A</span>
            <span>
              <strong className="block text-lg text-white">Arranjar</strong>
              <span className="text-sm text-slate-400">Entrar sem senha</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
