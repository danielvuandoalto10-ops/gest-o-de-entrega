import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Foto = { id: string; dataHora: string; url: string };
type Pacote = {
  numero: number;
  nome: string;
  dataEntrega: string;
  horaEntrega: string;
  fotos: Foto[];
  status?: "registrado" | "conferido";
  registradoPor: string;
};
type Lista = { id: string; data: string; quantidade: number; pacotes: Pacote[] };
const storageKey = (u: string) => `baixa-entregas-${u}`;
const now = () => { const d = new Date(); return { data: d.toISOString().slice(0,10), hora: d.toTimeString().slice(0,5) }; };

function Index() {
  const [usuario, setUsuario] = useState<string | null>(() => localStorage.getItem("usuario"));
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaAtual, setListaAtual] = useState<string | null>(null);
  const [pacoteAtual, setPacoteAtual] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"pendentes"|"registrados">("pendentes");
  const [novaLista, setNovaLista] = useState(false);
  const [dataLista, setDataLista] = useState(now().data);
  const [quantidade, setQuantidade] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState<{fotos:Foto[]; indice:number}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (usuario) { const s=localStorage.getItem(storageKey(usuario)); if(s) setListas(JSON.parse(s)); } }, [usuario]);
  useEffect(() => { if(usuario) localStorage.setItem(storageKey(usuario), JSON.stringify(listas)); }, [listas,usuario]);
  const lista = useMemo(() => listas.find(l=>l.id===listaAtual), [listas,listaAtual]);
  const pendentes = useMemo(() => lista?.pacotes.filter(p=>!p.status) ?? [], [lista]);
  const registrados = useMemo(() => lista?.pacotes.filter(p=>!!p.status) ?? [], [lista]);

  const entrar=(u:string)=>{localStorage.setItem("usuario",u);setUsuario(u);};
  const sair=()=>{localStorage.removeItem("usuario");setUsuario(null);setListas([]);setListaAtual(null);setPacoteAtual(null);};
  const criarLista=()=>{const q=Number(quantidade);if(!Number.isInteger(q)||q<1)return setErro("Informe uma quantidade válida de pacotes.");const l:Lista={id:`${Date.now()}`,data:dataLista,quantidade:q,pacotes:Array.from({length:q},(_,i)=>({numero:i+1,nome:"",dataEntrega:"",horaEntrega:"",fotos:[],registradoPor:""}))};setListas(v=>[l,...v]);setListaAtual(l.id);setNovaLista(false);setQuantidade("");setErro("");};
  const abrirPacote=(n:number)=>{if(!lista)return;const p=lista.pacotes.find(x=>x.numero===n);if(!p||p.status)return;const t=now();setPacoteAtual(n);setNome(p.nome);setDataEntrega(p.dataEntrega||t.data);setHoraEntrega(p.horaEntrega||t.hora);setFotos(p.fotos);setErro("");};
  const adicionarFotos=(files:FileList|null)=>{if(!files)return;Array.from(files).forEach(file=>{if(!file.type.startsWith("image/"))return;const r=new FileReader();r.onload=()=>setFotos(v=>[...v,{id:`${Date.now()}-${Math.random()}`,dataHora:new Date().toISOString(),url:String(r.result)}]);r.readAsDataURL(file);});};
  const salvar=()=>{if(!lista||pacoteAtual===null)return;if(!nome.trim())return setErro("Informe o nome de quem recebeu.");if(!fotos.length)return setErro("Adicione pelo menos uma foto da entrega.");const l={...lista,pacotes:lista.pacotes.map(p=>p.numero===pacoteAtual?{...p,nome:nome.trim(),dataEntrega,horaEntrega,fotos,status:"registrado" as const,registradoPor:usuario!}:p)};setListas(v=>v.map(x=>x.id===lista.id?l:x));setPacoteAtual(null);setNome("");setFotos([]);setErro("");setAba("registrados");};
  const conferir=(n:number)=>{if(!lista)return;setListas(v=>v.map(l=>l.id===lista.id?{...l,pacotes:l.pacotes.map(p=>p.numero===n?{...p,status:"conferido" as const}:p)}:l));};
  if(!usuario)return <Login entrar={entrar}/>;

  return <main className="min-h-screen bg-slate-950 text-white"><header className="border-b border-slate-800 bg-slate-900 px-4 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><h1 className="text-2xl font-bold">Baixa de Entregas</h1><p className="text-sm text-slate-400">Usuário: {usuario}</p></div><button onClick={sair} className="rounded-lg border border-slate-700 px-3 py-2">Sair</button></div></header><div className="mx-auto max-w-6xl px-4 py-6">
    {!lista&&<section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><h2 className="text-xl font-semibold">Listas de baixas</h2><button onClick={()=>setNovaLista(true)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold">＋ Nova lista de baixas</button></section>}
    {lista&&pacoteAtual===null&&<><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Baixas de {new Date(`${lista.data}T12:00`).toLocaleDateString("pt-BR")}</h2><p className="text-sm text-slate-400">{lista.quantidade} pacotes · {registrados.length} registrados</p></div><button onClick={()=>setNovaLista(true)} className="rounded-lg border border-slate-700 px-4 py-2">＋ Nova lista</button></div><div className="mb-5 flex gap-2"><button onClick={()=>setAba("pendentes")} className={`rounded-lg px-4 py-2 ${aba==="pendentes"?"bg-emerald-600":"bg-slate-800"}`}>Pendentes ({pendentes.length})</button><button onClick={()=>setAba("registrados")} className={`rounded-lg px-4 py-2 ${aba==="registrados"?"bg-emerald-600":"bg-slate-800"}`}>Registrados ({registrados.length})</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba==="pendentes"?pendentes:registrados).map(p=><button key={p.numero} onClick={()=>aba==="pendentes"?abrirPacote(p.numero):setFotoAmpliada(p.fotos.length?{fotos:p.fotos,indice:0}:null)} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-emerald-500"><div className="text-lg font-bold">Pacote {p.numero}</div><div className="text-sm text-slate-400">{p.nome||"Pendente"}</div>{aba==="registrados"&&<div className="mt-2 text-xs text-slate-500">{p.fotos.length} foto(s) · {p.status==="conferido"?"✓ Conferido":"Pendente de conferência"}</div>}</button>)}</div></>}
    {lista&&pacoteAtual!==null&&<section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">Pacote selecionado</p><h2 className="text-2xl font-bold">Pacote {pacoteAtual}</h2></div><button onClick={()=>setPacoteAtual(null)} className="rounded-lg border border-slate-700 px-3 py-2">Voltar</button></div>{erro&&<div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{erro}</div>}<label className="block text-sm text-slate-300">Nome de quem recebeu<input value={nome} onChange={e=>setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm text-slate-300">Data<input type="date" value={dataEntrega} onChange={e=>setDataEntrega(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><label className="text-sm text-slate-300">Horário<input type="time" value={horaEntrega} onChange={e=>setHoraEntrega(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label></div><div className="mt-5 rounded-xl border border-dashed border-slate-700 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Fotos da entrega</h3><p className="text-xs text-slate-400">Mínimo de 1 foto. Cada foto recebe data e hora.</p></div><label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 font-semibold">📷 Tirar fotos<input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e=>adicionarFotos(e.target.files)}/></label></div><label className="mt-3 inline-block cursor-pointer text-sm text-emerald-400">🖼️ Selecionar fotos do dispositivo<input type="file" accept="image/*" multiple className="hidden" onChange={e=>adicionarFotos(e.target.files)}/></label>{fotos.length>0&&<div className="mt-4 grid grid-cols-3 gap-2">{fotos.map((f,i)=><button key={f.id} onClick={()=>setFotoAmpliada({fotos,indice:i})} className="overflow-hidden rounded-lg border border-slate-700"><img src={f.url} className="h-24 w-full object-cover"/><span className="block truncate p-1 text-[10px] text-slate-400">{new Date(f.dataHora).toLocaleString("pt-BR")}</span></button>)}</div>}</div><button onClick={salvar} className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 text-lg font-bold">Salvar registro</button></section>}
  </div>
  {novaLista&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl bg-slate-900 p-6"><h2 className="text-xl font-bold">Nova lista de baixas</h2><label className="mt-5 block text-sm">Data<input type="date" value={dataLista} onChange={e=>setDataLista(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><label className="mt-4 block text-sm">Quantidade<input type="number" min="1" value={quantidade} onChange={e=>setQuantidade(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label>{erro&&<p className="mt-3 text-sm text-red-300">{erro}</p>}<div className="mt-5 flex gap-3"><button onClick={()=>setNovaLista(false)} className="flex-1 rounded-xl border border-slate-700 px-4 py-3">Cancelar</button><button onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3">Salvar e iniciar</button></div></section></div>}
  {fotoAmpliada&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={()=>setFotoAmpliada(null)}><div className="flex max-w-5xl items-center gap-3" onClick={e=>e.stopPropagation()}><button onClick={()=>setFotoAmpliada(v=>v&&{...v,indice:(v.indice-1+v.fotos.length)%v.fotos.length})} className="rounded-full bg-slate-800 px-4 py-3">‹</button><img src={fotoAmpliada.fotos[fotoAmpliada.indice].url} className="max-h-[85vh] max-w-[80vw] rounded-xl object-contain"/><button onClick={()=>setFotoAmpliada(v=>v&&{...v,indice:(v.indice+1)%v.fotos.length})} className="rounded-full bg-slate-800 px-4 py-3">›</button><button onClick={()=>setFotoAmpliada(null)} className="fixed right-5 top-5 rounded-lg bg-slate-800 px-3 py-2">Fechar</button></div></div>}
  </main>;
}
function Login({entrar}:{entrar:(u:string)=>void}){return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4"><section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"><h1 className="mb-2 text-center text-3xl font-bold">Baixa de Entregas</h1><p className="mb-8 text-center text-slate-400">Escolha seu usuário.</p><div className="space-y-3">{["Rafael","Rangel"].map(u=><button key={u} onClick={()=>entrar(u)} className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 text-left hover:border-emerald-500"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 font-bold">{u[0]}</span><strong>{u}</strong></button>)}</div></section></main>}
