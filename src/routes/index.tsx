import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Foto = { id: string; dataHora: string; url: string };
type Pacote = {
  numero: number;
  nomeRecebedor: string;
  dataEntrega: string;
  horaEntrega: string;
  fotos: Foto[];
  status: "pendente" | "registrado";
  baixaConferida: boolean;
};
type ListaBaixas = { id: string; data: string; quantidade: number; pacotes: Pacote[] };

const STORAGE = "baixa-de-entregas-v2";

const agora = () => {
  const d = new Date();
  return {
    data: d.toISOString().slice(0, 10),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    dataHora: d.toLocaleString("pt-BR"),
  };
};

function Index() {
  const [usuario, setUsuario] = useState<string | null>(() => localStorage.getItem("usuario"));
  const storageKey = usuario ? `${STORAGE}-${usuario}` : STORAGE;
  const [listas, setListas] = useState<ListaBaixas[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${STORAGE}-${localStorage.getItem("usuario") || ""}`) || "[]"); } catch { return []; }
  });
  const [mostrarNova, setMostrarNova] = useState(false);
  const [data, setData] = useState(() => agora().data);
  const [quantidade, setQuantidade] = useState("");
  const [listaAtiva, setListaAtiva] = useState<ListaBaixas | null>(null);
  const [pacoteAtivo, setPacoteAtivo] = useState<Pacote | null>(null);
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [dataEntrega, setDataEntrega] = useState(agora().data);
  const [horaEntrega, setHoraEntrega] = useState(agora().hora);
  const [busca, setBusca] = useState("");
  const [erroCamera, setErroCamera] = useState("");
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!usuario) return;
    try { setListas(JSON.parse(localStorage.getItem(`${STORAGE}-${usuario}`) || "[]")); } catch { setListas([]); }
  }, [usuario]);

  useEffect(() => {
    if (usuario) localStorage.setItem(storageKey, JSON.stringify(listas));
  }, [listas, storageKey, usuario]);

  const atualizarLista = (lista: ListaBaixas) => {
    setListas(prev => prev.map(l => l.id === lista.id ? lista : l));
    setListaAtiva(lista);
  };

  const criarLista = () => {
    const qtd = Number(quantidade);
    if (!data || !Number.isInteger(qtd) || qtd < 1) return;
    const nova: ListaBaixas = {
      id: crypto.randomUUID(), data, quantidade: qtd,
      pacotes: Array.from({ length: qtd }, (_, i) => ({ numero: i + 1, nomeRecebedor: "", dataEntrega: "", horaEntrega: "", fotos: [], status: "pendente", baixaConferida: false })),
    };
    setListas(prev => [nova, ...prev]);
    setListaAtiva(nova);
    setMostrarNova(false);
    setQuantidade("");
  };

  const abrirPacote = (p: Pacote) => {
    setPacoteAtivo(p);
    setNomeRecebedor(p.nomeRecebedor);
    const a = agora();
    setDataEntrega(p.dataEntrega || a.data);
    setHoraEntrega(p.horaEntrega || a.hora);
    setErroCamera("");
  };

  const fotosAdicionar = (files: FileList | null) => {
    if (!files || !pacoteAtivo) return;
    const novas: Foto[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      novas.push({ id: crypto.randomUUID(), dataHora: agora().dataHora, url: URL.createObjectURL(file) });
    });
    if (!novas.length) return;
    const atualizado = { ...pacoteAtivo, fotos: [...pacoteAtivo.fotos, ...novas] };
    setPacoteAtivo(atualizado);
    setErroCamera("");
  };

  const salvarPacote = (irProximo = true) => {
    if (!listaAtiva || !pacoteAtivo) return;
    const atualizado = { ...pacoteAtivo, nomeRecebedor: nomeRecebedor.trim(), dataEntrega, horaEntrega, status: "registrado" as const };
    const novaLista = { ...listaAtiva, pacotes: listaAtiva.pacotes.map(p => p.numero === atualizado.numero ? atualizado : p) };
    atualizarLista(novaLista);
    if (!irProximo) { setPacoteAtivo(atualizado); return; }
    const proximo = novaLista.pacotes.find(p => p.numero > atualizado.numero && p.status === "pendente");
    setPacoteAtivo(proximo || null);
    if (proximo) abrirPacote(proximo);
  };

  const navegar = (direcao: -1 | 1) => {
    if (!listaAtiva || !pacoteAtivo) return;
    const atual = listaAtiva.pacotes.findIndex(p => p.numero === pacoteAtivo.numero);
    const destino = listaAtiva.pacotes[atual + direcao];
    if (destino) abrirPacote(destino);
  };

  const conferir = (numero: number) => {
    if (!listaAtiva) return;
    const lista = { ...listaAtiva, pacotes: listaAtiva.pacotes.map(p => p.numero === numero ? { ...p, baixaConferida: !p.baixaConferida } : p) };
    atualizarLista(lista);
    if (pacoteAtivo?.numero === numero) setPacoteAtivo(lista.pacotes.find(p => p.numero === numero) || null);
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
          <button onClick={() => setListaAtiva(null)} className="rounded-xl border border-slate-700 px-4 py-2">Voltar</button>
        </header>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar pacote ou nome..." className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-white outline-none focus:border-emerald-500" />
        <section className="mb-5 grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl bg-slate-900 p-3"><b>{listaAtiva.pacotes.length}</b><span className="block text-xs text-slate-400">Total</span></div>
          <div className="rounded-xl bg-slate-900 p-3"><b>{listaAtiva.pacotes.filter(p => p.status === "registrado").length}</b><span className="block text-xs text-slate-400">Registradas</span></div>
          <div className="rounded-xl bg-slate-900 p-3"><b>{listaAtiva.pacotes.filter(p => p.baixaConferida).length}</b><span className="block text-xs text-slate-400">Conferidas</span></div>
        </section>
        <h2 className="mb-3 text-lg font-bold">Pacotes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {filtrados.map(p => <button key={p.numero} onClick={() => abrirPacote(p)} className={`rounded-xl border p-4 text-left ${p.status === "registrado" ? "border-emerald-700 bg-slate-900" : "border-slate-700 bg-slate-900 hover:border-emerald-500"}`}><div className="flex items-center justify-between"><strong>Pacote {p.numero}</strong>{p.status === "registrado" && <span className="text-emerald-400">✓</span>}</div><span className="mt-2 block truncate text-sm text-slate-400">{p.nomeRecebedor || "Pendente de registro"}</span><span className="mt-2 block text-xs text-slate-500">{p.fotos.length} foto(s)</span><span className={`mt-1 block text-xs ${p.baixaConferida ? "text-emerald-400" : "text-amber-400"}`}>{p.baixaConferida ? "Baixa conferida" : "Aguardando conferência"}</span></button>)}
        </div>
        <h2 className="mb-3 mt-8 text-lg font-bold">Entregas registradas</h2>
        <div className="space-y-2">{listaAtiva.pacotes.filter(p => p.status === "registrado").map(p => <button key={`r-${p.numero}`} onClick={() => abrirPacote(p)} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4 text-left"><span><b>Pacote {p.numero}</b><span className="ml-3 text-slate-300">{p.nomeRecebedor || "Sem nome"}</span></span><span className="text-right text-xs text-slate-400">{p.dataEntrega ? new Date(p.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR") : "-"} {p.horaEntrega}<br />{p.fotos.length} foto(s)</span></button>)}</div>
      </div>
      <button onClick={() => setListaAtiva(null)} className="fixed bottom-5 right-5 rounded-full bg-emerald-600 px-6 py-4 font-bold shadow-xl hover:bg-emerald-500">+ Nova lista</button>
    </main>
  );

  if (pacoteAtivo && listaAtiva) {
    const indice = listaAtiva.pacotes.findIndex(p => p.numero === pacoteAtivo.numero);
    const anterior = listaAtiva.pacotes[indice - 1];
    const proximo = listaAtiva.pacotes[indice + 1];
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 pb-10 text-white">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center justify-between gap-3"><button onClick={() => setPacoteAtivo(null)} className="rounded-xl border border-slate-700 px-4 py-2">← Pacotes</button><span className="text-sm text-slate-400">{indice + 1} de {listaAtiva.quantidade}</span></div>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-sm text-emerald-400">Registro individual</p><h1 className="mt-1 text-3xl font-bold">Pacote {pacoteAtivo.numero}</h1></div>{pacoteAtivo.status === "registrado" && <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs text-emerald-300">Registrado</span>}</div>
            <label className="mt-6 block text-sm text-slate-400">Número do pacote</label><input value={pacoteAtivo.numero} readOnly className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" />
            <label className="mt-5 block text-sm text-slate-400">Nome de quem recebeu</label><input value={nomeRecebedor} onChange={e => setNomeRecebedor(e.target.value)} placeholder="Digite o nome" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-emerald-500" />
            <div className="mt-5 grid grid-cols-2 gap-3"><div><label className="block text-sm text-slate-400">Data da entrega</label><input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /></div><div><label className="block text-sm text-slate-400">Horário da entrega</label><input type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /></div></div>
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><div><b>Fotos da entrega</b><p className="text-xs text-slate-400">{pacoteAtivo.fotos.length} imagem(ns) • cada foto guarda seu horário</p></div><span className="text-xs text-emerald-400">Sem limite</span></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{pacoteAtivo.fotos.map(f => <div key={f.id} className="overflow-hidden rounded-lg border border-slate-700"><img src={f.url} alt={`Foto do pacote ${pacoteAtivo.numero}`} className="h-24 w-full object-cover" /><p className="truncate px-1 py-1 text-[10px] text-slate-400">{f.dataHora}</p></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => { setErroCamera(""); cameraInput.current?.click(); }} className="rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">📷 Tirar fotos</button><button onClick={() => fileInput.current?.click()} className="rounded-xl border border-slate-600 p-3 font-semibold hover:border-emerald-500">🖼️ Selecionar fotos</button></div><input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => fotosAdicionar(e.target.files)} /><input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={e => fotosAdicionar(e.target.files)} />{erroCamera && <p className="mt-3 rounded-lg bg-red-950 p-3 text-sm text-red-300">{erroCamera}</p>}</div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3"><div><b>Conferência da baixa</b><p className="text-xs text-slate-400">Registro e conferência são etapas diferentes.</p></div><button onClick={() => conferir(pacoteAtivo.numero)} disabled={pacoteAtivo.status !== "registrado"} className={`rounded-xl px-4 py-2 text-sm font-bold ${pacoteAtivo.baixaConferida ? "bg-emerald-700" : "bg-slate-700"}`}>{pacoteAtivo.baixaConferida ? "✓ Baixa realizada" : "Marcar baixa"}</button></div>
            <div className="mt-6 grid grid-cols-2 gap-2"><button disabled={!anterior} onClick={() => anterior && abrirPacote(anterior)} className="rounded-xl border border-slate-700 p-3 disabled:opacity-30">← Anterior</button><button disabled={!proximo} onClick={() => proximo && abrirPacote(proximo)} className="rounded-xl border border-slate-700 p-3 disabled:opacity-30">Próximo →</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => salvarPacote(false)} className="rounded-xl border border-emerald-700 p-3 font-semibold">Salvar e continuar</button><button onClick={() => salvarPacote(true)} className="rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">Salvar e próximo</button></div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-4xl"><header className="mb-8 flex items-center justify-between"><div><p className="text-sm text-emerald-400">Olá, {usuario}</p><h1 className="text-3xl font-bold">Baixa de Entregas</h1><p className="text-slate-400">Organize as baixas do dia</p></div><button onClick={() => { localStorage.removeItem("usuario"); setUsuario(null); }} className="rounded-xl border border-slate-700 px-4 py-2">Sair</button></header><section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Nova lista de baixas</h2><p className="text-sm text-slate-400">Crie automaticamente todos os pacotes do dia.</p></div><button onClick={() => setMostrarNova(true)} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold hover:bg-emerald-500">+</button></div></section><div className="mt-6 space-y-3">{listas.map(l => <button key={l.id} onClick={() => setListaAtiva(l)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-500"><div className="flex justify-between"><strong>{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</strong><span className="text-emerald-400">{l.pacotes.filter(p => p.status === "registrado").length}/{l.quantidade} registrados</span></div><p className="mt-1 text-sm text-slate-400">{l.quantidade} pacotes • {l.pacotes.filter(p => p.baixaConferida).length} conferidos</p></button>)}</div></div>{mostrarNova && <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"><h2 className="text-2xl font-bold">Nova lista de baixas</h2><label className="mt-6 block text-sm text-slate-400">Data das baixas</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /><label className="mt-5 block text-sm text-slate-400">Quantidade de pacotes</label><input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Ex.: 150" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white" /><div className="mt-6 flex gap-3"><button onClick={() => setMostrarNova(false)} className="flex-1 rounded-xl border border-slate-700 p-3">Cancelar</button><button onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 p-3 font-bold">Salvar e iniciar</button></div></section></div>}</main>
  );
}

function Login({ onEnter }: { onEnter: (nome: string) => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4"><section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-white shadow-2xl"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-bold text-emerald-500">BE</div><h1 className="text-3xl font-bold">Baixa de Entregas</h1><p className="mt-2 text-slate-400">Escolha seu usuário para começar.</p></div><div className="space-y-3">{["Rafael", "Rangel"].map(nome => <button key={nome} onClick={() => onEnter(nome)} className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 text-left hover:border-emerald-500"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 font-bold">{nome[0]}</span><span><strong className="block text-lg">{nome}</strong><span className="text-sm text-slate-400">Entrar sem senha</span></span></button>)}</div></section></main>;
}
