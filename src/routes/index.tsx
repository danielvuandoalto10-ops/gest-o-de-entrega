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
      <main className="flex min-h-screen items-center justify-center bg-pink-50 px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-3xl font-bold text-white">
            {usuario.charAt(0)}
          </div>
          <h1 className="text-3xl font-bold text-pink-700">Olá, {usuario}! 💗</h1>
          <p className="mt-2 text-gray-600">Você entrou no Projeto Aline.</p>
          <button
            type="button"
            onClick={sair}
            className="mt-6 rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white transition hover:bg-pink-700"
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pink-50 px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-4xl text-white">
            💗
          </div>
          <h1 className="text-3xl font-bold text-pink-700">Projeto Aline</h1>
          <p className="mt-2 text-gray-600">Escolha seu usuário para entrar</p>
          <p className="mt-1 text-sm text-gray-400">Não é necessário usar senha.</p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => entrar("Rafael")}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-pink-100 bg-pink-50 p-4 text-left transition hover:border-pink-400 hover:bg-pink-100"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500 font-bold text-white">R</span>
            <span>
              <strong className="block text-lg text-gray-800">Rafael</strong>
              <span className="text-sm text-gray-500">Entrar sem senha</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => entrar("Rangel")}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-pink-100 bg-pink-50 p-4 text-left transition hover:border-pink-400 hover:bg-pink-100"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500 font-bold text-white">R</span>
            <span>
              <strong className="block text-lg text-gray-800">Rangel</strong>
              <span className="text-sm text-gray-500">Entrar sem senha</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
