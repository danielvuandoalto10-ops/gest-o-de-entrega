import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Pacote = {
  numero: number;
  nomeRecebedor: string;
  fotos: { id: string; dataHora: string }[];
};

type ListaBaixas = {
  id: string;
  data: string;
  quantidade: number;
  pacotes: Pacote[];
};

const STORAGE = "baixa-de-entregas-listas";

function Index() {
  const [usuario, setUsuario] = useState<string | null>(() => localStorage.getItem("usuario"));
  const [listas, setListas] = useState<ListaBaixas[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "[]"); } catch { return []; }
  });
  const [mostrarNova, setMostrarNova] = useState(false);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantidade, setQuantidade] = useState("");
  const [listaAtiva, setListaAtiva] = useState<ListaBaixas | null>(null);
  const [pacoteAtivo, setPacoteAtivo] = useState<Pacote | null>(null);
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify(listas)), [listas]);

  const criarLista = () => {
    const qtd = Number(quantidade);
    if (!data || !Number.isInteger(qtd) || qtd < 1) return;
    const nova: ListaBaixas = {
      id: crypto.randomUUID(), data, quantidade: qtd,
      pacotes: Array.from({ length: qtd }, (_, i) => ({ numero: i + 1, nomeRecebedor: "", fotos: [] })),
    };
    setListas(prev => [nova, ...prev]);
    setListaAtiva(nova);
    setMostrarNova(false);
    setQuantidade("");
  };

  const abrirPacote = (p: Pacote) => {
    setPacoteAtivo(p);
    setNomeRecebedor(p.nomeRecebedor);
  };

  const salvarPacote = () => {
    if (!listaAtiva || !pacoteAtivo) return;
    const atualizada = { ...listaAtiva, pacotes: listaAtiva.pacotes.map(p => p.numero === pacoteAtivo.numero ? { ...p, nomeRecebedor } : p) };
    setListas(prev => prev.map(l => l.id === atualizada.id ? atualizada : l));
    setListaAtiva(atualizada);
    setPacoteAtivo(atualizada.pacotes.find(p => p.numero === pacoteAtivo.numero) || null);
  };

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!listaAtiva || !termo) return listaAtiva?.pacotes || [];
    return listaAtiva.pacotes.filter(p => String(p.numero).includes(termo) || p.nomeRecebedor.toLowerCase().includes(termo));
  }, [listaAtiva, busca]);

  if (!usuario) return <Login onEnter={nome => { localStorage.setItem("usuario", nome); setUsuario(nome); }} />;

  if (listaAtiva && !pacoteAtivo) return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 pb-28 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div><p className="text-sm text-emerald-400">{usuario}</p><h1 className="text-2xl font-bold">Baixa de Entregas</h1><p className="text-sm text-slate-400">Baixas de {new Date(listaAtiva.data + "T12:00:00").toLocaleDateString("pt-BR")}</p></div>
          <button onClick={() => setListaAtiva(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Voltar</button>
        </header>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar pacote ou nome..." className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-white outline-none focus:border-emerald-500" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {filtrados.map(p => <button key={p.numero} onClick={() => abrirPacote(p)} className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left hover:border-emerald-500"><strong>Pacote {p.numero}</strong><span className="mt-2 block truncate text-sm text-slate-400">{p.nomeRecebedor || "Aguardando baixa"}</span><span className="mt-2 block text-xs text-emerald-400">{p.fotos.length} foto(s)</span></button>)}
        </div>
      </div>
      <button onClick={() => setListaAtiva(null)} className="fixed bottom-5 right-5 rounded-full bg-emerald-600 px-6 py-4 font-bold shadow-xl hover:bg-emerald-500">+ Nova lista</button>
    </main>
  );

  if (pacoteAtivo) return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-xl">
        <button onClick={() => setPacoteAtivo(null)} className="mb-6 rounded-xl border border-slate-700 px-4 py-2">← Pacotes</button>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-emerald-400">Registro da entrega</p>
          <h1 className="mt-1 text-3xl font-bold">Pacote {pacoteAtivo.numero}</h1>
          <label className="mt-6 block text-sm text-slate-400">Número do pacote</label>
          <input value={pacoteAtivo.numero} readOnly className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" />
          <label className="mt-5 block text-sm text-slate-400">Nome de quem recebeu</label>
          <input value={nomeRecebedor} onChange={e => setNomeRecebedor(e.target.value)} placeholder="Digite o nome" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-emerald-500" />
          <button onClick={salvarPacote} className="mt-5 w-full rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">Salvar informações</button>
          <div className="mt-8 rounded-xl border border-dashed border-slate-700 p-5 text-center"><p className="font-semibold">📷 Captura de fotos</p><p className="mt-1 text-sm text-slate-400">A etapa de captura será vinculada a este pacote.</p></div>
        </section>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between"><div><p className="text-sm text-emerald-400">Olá, {usuario}</p><h1 className="text-3xl font-bold">Baixa de Entregas</h1><p className="text-slate-400">Organize as baixas do dia</p></div><button onClick={() => { localStorage.removeItem("usuario"); setUsuario(null); }} className="rounded-xl border border-slate-700 px-4 py-2">Sair</button></header>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Nova lista de baixas</h2><p className="text-sm text-slate-400">Crie automaticamente todos os pacotes do dia.</p></div><button onClick={() => setMostrarNova(true)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold hover:bg-emerald-500">+</button></div></section>
        <div className="mt-6 space-y-3">{listas.map(l => <button key={l.id} onClick={() => setListaAtiva(l)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-500"><div className="flex justify-between"><strong>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</strong><span className="text-emerald-400">{l.pacotes.filter(p => p.nomeRecebedor).length}/{l.quantidade} baixas</span></div><p className="mt-1 text-sm text-slate-400">{l.quantidade} pacotes</p></button>)}</div>
      </div>
      {mostrarNova && <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"><h2 className="text-2xl font-bold">Nova lista de baixas</h2><label className="mt-6 block text-sm text-slate-400">Data das baixas</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /><label className="mt-5 block text-sm text-slate-400">Quantidade de pacotes</label><input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Ex.: 150" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /><div className="mt-6 flex gap-3"><button onClick={() => setMostrarNova(false)} className="flex-1 rounded-xl border border-slate-700 p-3">Cancelar</button><button onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 p-3 font-bold">Salvar e iniciar</button></div></section></div>}
    </main>
  );
}

function Login({ onEnter }: { onEnter: (nome: string) => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4"><section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-white shadow-2xl"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-bold text-emerald-500">BE</div><h1 className="text-3xl font-bold">Baixa de Entregas</h1><p className="mt-2 text-slate-400">Escolha seu usuário para começar.</p></div><div className="space-y-3">{["Rafael", "Rangel"].map(nome => <button key={nome} onClick={() => onEnter(nome)} className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 text-left hover:border-emerald-500"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 font-bold">{nome[0]}</span><span><strong className="block text-lg">{nome}</strong><span className="text-sm text-slate-400">Entrar sem senha</span></span></button>)}</div></section></main>;
}
