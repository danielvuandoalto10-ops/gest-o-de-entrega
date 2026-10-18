import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { EMAIL_AUTORIZADO, entrarComSenha, recuperarSenha, mensagemAuth, emailAutorizado } from "@/lib/delivery-auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Baixas de Entrega | Acesso e registros" },
    { name: "description", content: "Acesso autorizado aos registros e fotos de baixas de entrega." },
    { property: "og:title", content: "Baixas de Entrega | Acesso e registros" },
    { property: "og:description", content: "Registros e fotos de baixas de entrega com acesso protegido." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Index,
});

type Foto = { id: string; dataHora: string; url: string; file?: File; storagePath?: string };
type Pacote = {
  id?: string;
  numero: number;
  nome: string;
  dataEntrega: string;
  horaEntrega: string;
  fotos: Foto[];
  status: "pendente" | "registrado" | "conferido";
  registradoPor: string;
  conferidoEm?: string;
};
type Lista = { id: string; data: string; quantidade: number; pacotes: Pacote[] };

const agora = () => {
  const d = new Date();
  return { data: d.toISOString().slice(0, 10), hora: d.toTimeString().slice(0, 5) };
};

async function urlDaFoto(path: string) {
  if (!supabase) return "";
  const { data, error } = await supabase.storage.from("fotos-entregas").createSignedUrl(path, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

async function carregarListas(usuario: string): Promise<Lista[]> {
  if (!supabase) throw new Error("Supabase ainda não está configurado no aplicativo.");
  const { data: rows, error } = await supabase.from("listas_baixas").select("id,data_baixas,quantidade,created_at").eq("usuario", usuario).order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.id);
  const { data: pacotesRows, error: pacotesError } = await supabase.from("pacotes").select("id,lista_id,numero,nome_recebedor,data_entrega,hora_entrega,status,registrado_por,conferido_em").in("lista_id", ids).order("numero");
  if (pacotesError) throw pacotesError;

  const pacoteIds = (pacotesRows ?? []).map((p) => p.id);
  const { data: fotosRows, error: fotosError } = pacoteIds.length
    ? await supabase.from("fotos_entrega").select("id,pacote_id,storage_path,captured_at").in("pacote_id", pacoteIds).order("captured_at")
    : { data: [], error: null };
  if (fotosError) throw fotosError;

  const fotosMap = new Map<string, Foto[]>();
  for (const f of fotosRows ?? []) {
    try {
      const url = await urlDaFoto(f.storage_path);
      const atual = fotosMap.get(f.pacote_id) ?? [];
      atual.push({ id: f.id, dataHora: f.captured_at, url, storagePath: f.storage_path });
      fotosMap.set(f.pacote_id, atual);
    } catch {
      const atual = fotosMap.get(f.pacote_id) ?? [];
      atual.push({ id: f.id, dataHora: f.captured_at, url: "", storagePath: f.storage_path });
      fotosMap.set(f.pacote_id, atual);
    }
  }

  return rows.map((l) => ({
    id: l.id,
    data: l.data_baixas,
    quantidade: l.quantidade,
    pacotes: (pacotesRows ?? []).filter((p) => p.lista_id === l.id).map((p) => ({
      id: p.id,
      numero: p.numero,
      nome: p.nome_recebedor ?? "",
      dataEntrega: p.data_entrega ?? "",
      horaEntrega: p.hora_entrega?.slice(0, 5) ?? "",
      fotos: fotosMap.get(p.id) ?? [],
      status: p.status,
      registradoPor: p.registrado_por ?? "",
      conferidoEm: p.conferido_em ?? undefined,
    })),
  }));
}

function Index() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState<string | null>(null);
  const [pacote, setPacote] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [aba, setAba] = useState<"pendentes" | "registrados" | "conferidos">("pendentes");
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState("");
  const [avisoAuth, setAvisoAuth] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [nova, setNova] = useState(false);
  const [dataLista, setDataLista] = useState(agora().data);
  const [qtd, setQtd] = useState("");
  const [zoom, setZoom] = useState<{ fotos: Foto[]; i: number } | null>(null);

  const lista = useMemo(() => listas.find((l) => l.id === listaId), [listas, listaId]);
  const pendentes = lista?.pacotes.filter((p) => p.status === "pendente") ?? [];
  const registrados = lista?.pacotes.filter((p) => p.status === "registrado") ?? [];
  const conferidos = lista?.pacotes.filter((p) => p.status === "conferido") ?? [];
  const detalhe = lista?.pacotes.find((p) => p.numero === detalheId);

  useEffect(() => {
    const recoveryHash = new URLSearchParams(window.location.hash.slice(1));
    if (recoveryHash.get("type") === "recovery" || recoveryHash.has("error_description")) {
      window.location.replace(`/reset-password${window.location.hash}`);
      return;
    }
    if (!supabase) return;
    let ativo = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "PASSWORD_RECOVERY") {
        setUsuario(null);
        window.location.replace(`/reset-password${window.location.hash}`);
        return;
      }
      if (evento !== "SIGNED_OUT") return;
      setUsuario(null);
      setListas([]);
      setListaId(null);
    });

    const validarUsuario = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!ativo) return;
      if (error) {
        setUsuario(null);
        return;
      }
      const email = data.user?.email?.toLowerCase() ?? null;
      if (email && email !== EMAIL_AUTORIZADO) {
        void supabase.auth.signOut();
        if (ativo) {
          setUsuario(null);
          setErro("Este e-mail não tem autorização para acessar o aplicativo.");
        }
        return;
      }
      if (ativo) setUsuario(email);
    };
    void validarUsuario().catch(error => { if (ativo) setErro(mensagemAuth(error)); });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!usuario || !supabase) return;
    setCarregando(true);
    carregarListas(usuario)
      .then((dados) => {
        setListas(dados);
        setListaId((atual) => atual && dados.some((l) => l.id === atual) ? atual : dados[0]?.id ?? null);
      })
      .catch((e) => setErro(`Não foi possível carregar os registros: ${e.message}`))
      .finally(() => setCarregando(false));
  }, [usuario]);

  const entrar = async (email: string, senha: string) => {
    setSalvando(true);
    setErro("");
    setAvisoAuth("");
    try {
      await entrarComSenha(supabase, email, senha);
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!emailAutorizado(data.user?.email)) {
        await supabase.auth.signOut();
        throw new Error("Este e-mail não tem autorização para acessar o aplicativo.");
      }
      setUsuario(EMAIL_AUTORIZADO);
    } catch (error) {
      setErro(mensagemAuth(error));
    } finally {
      setSalvando(false);
    }
  };

  const esqueciSenha = async () => {
    setSalvando(true);
    setErro("");
    setAvisoAuth("");
    try {
      await recuperarSenha(supabase);
      setAvisoAuth("Solicitação enviada. Confira seu e-mail e a pasta de spam para recuperar a senha.");
    } catch (error) { setErro(mensagemAuth(error)); }
    finally { setSalvando(false); }
  };

  const sair = async () => {
    if (supabase) await supabase.auth.signOut();
    setUsuario(null);
    setListas([]);
    setListaId(null);
  };

  const criarLista = async () => {
    const n = Number(qtd);
    if (!Number.isInteger(n) || n < 1) return setErro("Informe uma quantidade válida de pacotes.");
    if (!supabase || !usuario) return setErro("O aplicativo ainda não está conectado ao Supabase.");
    setSalvando(true);
    setErro("");
    try {
      const { data: novaLista, error } = await supabase.from("listas_baixas").insert({ usuario, data_baixas: dataLista, quantidade: n }).select("id,data_baixas,quantidade").single();
      if (error) throw error;
      const pacotes = Array.from({ length: n }, (_, i) => ({ lista_id: novaLista.id, numero: i + 1, status: "pendente" }));
      const { error: pacotesError } = await supabase.from("pacotes").insert(pacotes);
      if (pacotesError) {
        await supabase.from("listas_baixas").delete().eq("id", novaLista.id);
        throw pacotesError;
      }
      const carregadas = await carregarListas(usuario);
      setListas(carregadas);
      setListaId(novaLista.id);
      setNova(false);
      setQtd("");
      setAba("pendentes");
    } catch (e: any) {
      setErro(`Não foi possível criar a lista: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const abrirPacote = (n: number) => {
    const p = lista?.pacotes.find((x) => x.numero === n);
    if (!p || p.status !== "pendente") return;
    const t = agora();
    setPacote(n);
    setNome(p.nome);
    setData(p.dataEntrega || t.data);
    setHora(p.horaEntrega || t.hora);
    setFotos(p.fotos);
    setErro("");
  };

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    const novas: Foto[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 15 * 1024 * 1024) {
        setErro("Uma das fotos ultrapassa 15 MB. Escolha uma imagem menor.");
        return;
      }
      novas.push({ id: `${Date.now()}-${Math.random()}`, dataHora: new Date().toISOString(), url: URL.createObjectURL(file), file });
    });
    if (novas.length) setFotos((v) => [...v, ...novas]);
  };

  const salvar = async () => {
    if (!lista || pacote === null || !supabase || !usuario) return;
    if (!nome.trim()) return setErro("Informe o nome de quem recebeu.");
    if (!fotos.length) return setErro("Adicione pelo menos uma foto da entrega.");

    const atual = lista.pacotes.find((p) => p.numero === pacote);
    if (!atual || atual.status !== "pendente" || !atual.id) {
      return setErro("Este pacote já foi registrado ou não está disponível.");
    }

    setSalvando(true);
    setErro("");
    const arquivosEnviados: string[] = [];
    const fotosInseridas: string[] = [];
    let registroConcluido = false;

    try {
      // Primeiro envia e registra as fotos. O pacote só muda de status depois
      // que todas as fotos forem salvas com sucesso.
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i]!;
        if (!foto.file) continue;

        const extensao = foto.file.type.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${usuario}/${lista.id}/pacote-${pacote}-${Date.now()}-${i}-${crypto.randomUUID()}.${extensao}`;
        const { error: uploadError } = await supabase.storage
          .from("fotos-entregas")
          .upload(path, foto.file, { contentType: foto.file.type, upsert: false });
        if (uploadError) throw uploadError;
        arquivosEnviados.push(path);

        const { data: fotoSalva, error: fotoError } = await supabase
          .from("fotos_entrega")
          .insert({ pacote_id: atual.id, storage_path: path, captured_at: foto.dataHora })
          .select("id")
          .single();
        if (fotoError) throw fotoError;
        fotosInseridas.push(fotoSalva.id);
      }

      // Confirma que o pacote realmente foi atualizado; UPDATE sem SELECT pode
      // retornar zero linhas sem erro quando as permissões não permitem a ação.
      const { data: pacoteAtualizado, error: pacoteError } = await supabase
        .from("pacotes")
        .update({
          nome_recebedor: nome.trim(),
          data_entrega: data,
          hora_entrega: hora,
          status: "registrado",
          registrado_por: usuario,
        })
        .eq("id", atual.id)
        .eq("status", "pendente")
        .select("id")
        .maybeSingle();

      if (pacoteError) throw pacoteError;
      if (!pacoteAtualizado) {
        throw new Error("O pacote não foi atualizado. Verifique as permissões de acesso do banco de dados.");
      }
      registroConcluido = true;

      setPacote(null);
      setNome("");
      setFotos([]);
      setAba("pendentes");

      try {
        const carregadas = await carregarListas(usuario);
        setListas(carregadas);
        setListaId(lista.id);
      } catch (e: any) {
        setErro(`A entrega foi salva, mas não consegui atualizar a lista na tela. Atualize a página. Motivo: ${e.message}`);
      }
    } catch (e: any) {
      // Se o salvamento não foi concluído, remove os registros parciais para
      // evitar fotos órfãs e deixa os arquivos na tela para nova tentativa.
      if (!registroConcluido) {
        if (fotosInseridas.length) {
          await supabase.from("fotos_entrega").delete().in("id", fotosInseridas);
        }
        if (arquivosEnviados.length) {
          await supabase.storage.from("fotos-entregas").remove(arquivosEnviados);
        }
      }
      setErro(
        registroConcluido
          ? `A entrega foi salva, mas ocorreu um erro ao atualizar a tela. Atualize a página. Motivo: ${e.message}`
          : `Não foi possível salvar a entrega. As fotos continuam na tela para tentar novamente. Motivo: ${e.message}`,
      );
    } finally {
      setSalvando(false);
    }
  };

  const confirmar = async () => {
    if (!lista || detalheId === null || !detalhe?.id || detalhe.status !== "registrado" || !supabase) return;
    setSalvando(true);
    try {
      const quando = new Date().toISOString();
      const { error } = await supabase.from("pacotes").update({ status: "conferido", conferido_em: quando }).eq("id", detalhe.id).eq("status", "registrado");
      if (error) throw error;
      const carregadas = await carregarListas(usuario!);
      setListas(carregadas);
      setDetalheId(null);
      setAba("conferidos");
    } catch (e: any) {
      setErro(`Não foi possível confirmar a conferência: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  if (!usuario) return <Login entrar={entrar} esqueciSenha={esqueciSenha} erro={erro} aviso={avisoAuth} salvando={salvando} />;

  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-4"><div className="mx-auto flex max-w-6xl justify-between"><div><h1 className="text-2xl font-bold">Baixa de Entregas</h1><p className="text-sm text-slate-400">Usuário: {usuario}</p></div><button onClick={sair} className="rounded-lg border border-slate-700 px-3 py-2">Sair</button></div></header>
    <div className="mx-auto max-w-6xl px-4 py-6">
      {erro && <div className="mb-5 rounded-xl border border-red-900 bg-red-950/60 p-4 text-sm text-red-200">{erro}</div>}
      {!supabase && <div className="mb-5 rounded-xl border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200">O aplicativo ainda precisa das variáveis do Supabase para salvar na nuvem.</div>}
      {carregando && <div className="mb-5 text-sm text-slate-400">Carregando registros...</div>}
      {!lista && <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><h2 className="text-xl font-semibold">Listas de baixas</h2><button disabled={!supabase} onClick={() => setNova(true)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold disabled:opacity-50">＋ Nova lista de baixas</button></section>}
      {lista && detalheId === null && pacote === null && <><div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Baixas de {new Date(`${lista.data}T12:00`).toLocaleDateString("pt-BR")}</h2><p className="text-sm text-slate-400">{lista.quantidade} pacotes · {registrados.length} registrados · {conferidos.length} conferidos</p></div><button disabled={!supabase} onClick={() => setNova(true)} className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-50">＋ Nova lista</button></div><div className="mb-5 flex flex-wrap gap-2">{([["pendentes","Pendentes",pendentes.length],["registrados","Registrados",registrados.length],["conferidos","Conferidos",conferidos.length]] as const).map(([id,label,n])=><button key={id} onClick={()=>setAba(id)} className={`rounded-lg px-4 py-2 ${aba===id?"bg-emerald-600":"bg-slate-800"}`}>{label} ({n})</button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba==="pendentes"?pendentes:aba==="registrados"?registrados:conferidos).map(p=><button key={p.numero} onClick={()=>aba==="pendentes"?abrirPacote(p.numero):setDetalheId(p.numero)} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-emerald-500"><b className="text-lg">Pacote {p.numero}</b><div className="text-sm text-slate-400">{p.nome}</div><div className="mt-2 text-xs text-slate-500">{p.fotos.length} foto(s) · {p.status==="conferido"?"✓ Conferido":"Pendente de conferência"}</div></button>)}</div></>}
      {lista && detalheId !== null && detalhe && <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-6 flex justify-between"><div><p className="text-sm text-slate-400">Detalhes da entrega</p><h2 className="text-2xl font-bold">Pacote {detalhe.numero}</h2></div><button onClick={()=>setDetalheId(null)} className="rounded-lg border border-slate-700 px-4 py-2">Voltar</button></div><div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-2"><div><small>Número do pacote</small><p>Pacote {detalhe.numero}</p></div><div><small>Quem recebeu</small><p>{detalhe.nome}</p></div><div><small>Data da entrega</small><p>{new Date(`${detalhe.dataEntrega}T12:00`).toLocaleDateString("pt-BR")}</p></div><div><small>Horário da entrega</small><p>{detalhe.horaEntrega}</p></div><div><small>Registrado por</small><p>{detalhe.registradoPor}</p></div><div><small>Status</small><p>{detalhe.status==="conferido"?"✓ Conferido com sucesso":"Pendente de conferência"}</p></div>{detalhe.conferidoEm&&<div className="sm:col-span-2"><small>Conferência confirmada em</small><p>{new Date(detalhe.conferidoEm).toLocaleString("pt-BR")}</p></div>}</div><div className="mt-6"><h3 className="mb-3 text-lg font-semibold">Fotos da entrega ({detalhe.fotos.length})</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{detalhe.fotos.map((f,i)=><button key={f.id} onClick={()=>setZoom({fotos:detalhe.fotos,i})} className="overflow-hidden rounded-xl border border-slate-700 text-left hover:border-emerald-500"><img src={f.url} className="h-36 w-full object-cover"/><div className="p-2 text-xs"><div>Foto {i+1}</div><div>{new Date(f.dataHora).toLocaleString("pt-BR")}</div></div></button>)}</div></div>{detalhe.status==="registrado"&&<div className="mt-7 border-t border-slate-800 pt-5"><button disabled={salvando} onClick={confirmar} className="w-full rounded-xl bg-emerald-600 px-5 py-4 text-lg font-bold disabled:opacity-50">✓ CONFERÊNCIA CONFIRMADA</button><p className="mt-2 text-center text-xs text-slate-500">O pacote será movido para Conferidos.</p></div>}</section>}
      {lista && pacote !== null && <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-5 flex justify-between"><h2 className="text-2xl font-bold">Pacote {pacote}</h2><button disabled={salvando} onClick={()=>setPacote(null)} className="rounded-lg border border-slate-700 px-3 py-2">Voltar</button></div><label className="block text-sm">Nome de quem recebeu<input value={nome} onChange={e=>setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label>Data<input type="date" value={data} onChange={e=>setData(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><label>Horário<input type="time" value={hora} onChange={e=>setHora(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label></div><div className="mt-5 rounded-xl border border-dashed border-slate-700 p-4"><div className="flex items-center justify-between gap-3"><div><b>Fotos da entrega</b><p className="text-xs text-slate-400">Mínimo de 1 foto. Máximo de 15 MB por imagem.</p></div><label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 font-semibold">📷 Tirar fotos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e=>addFotos(e.target.files)}/></label></div><label className="mt-3 inline-block cursor-pointer text-sm text-emerald-400">🖼️ Selecionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={e=>addFotos(e.target.files)}/></label>{fotos.length>0&&<div className="mt-4 grid grid-cols-3 gap-2">{fotos.map((f,i)=><button key={f.id} onClick={()=>setZoom({fotos,i})}><img src={f.url} className="h-24 w-full rounded-lg object-cover"/><span className="text-[10px]">{new Date(f.dataHora).toLocaleString("pt-BR")}</span></button>)}</div>}</div><button disabled={salvando||!supabase} onClick={salvar} className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 text-lg font-bold disabled:opacity-50">{salvando?"Salvando...":"Salvar registro"}</button></section>}
    </div>
    {nova&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl bg-slate-900 p-6"><h2 className="text-xl font-bold">Nova lista de baixas</h2><label className="mt-5 block">Data<input type="date" value={dataLista} onChange={e=>setDataLista(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><label className="mt-4 block">Quantidade<input type="number" min="1" value={qtd} onChange={e=>setQtd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3"/></label><div className="mt-5 flex gap-3"><button disabled={salvando} onClick={()=>setNova(false)} className="flex-1 rounded-xl border border-slate-700 px-4 py-3">Cancelar</button><button disabled={salvando} onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3">{salvando?"Criando...":"Salvar e iniciar"}</button></div></section></div>}
    {zoom&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={()=>setZoom(null)}><div className="flex items-center gap-3" onClick={e=>e.stopPropagation()}><button onClick={()=>setZoom(v=>v&&{...v,i:(v.i-1+v.fotos.length)%v.fotos.length})} className="rounded-full bg-slate-800 px-4 py-3">‹</button><div className="text-center">{zoom.fotos[zoom.i]!.url?<img src={zoom.fotos[zoom.i]!.url} className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain"/>:<div className="rounded-xl bg-slate-800 p-10">Imagem indisponível</div>}<p className="mt-2 text-sm">{new Date(zoom.fotos[zoom.i]!.dataHora).toLocaleString("pt-BR")}</p></div><button onClick={()=>setZoom(v=>v&&{...v,i:(v.i+1)%v.fotos.length})} className="rounded-full bg-slate-800 px-4 py-3">›</button><button onClick={()=>setZoom(null)} className="fixed right-5 top-5 rounded-lg bg-slate-800 px-3 py-2">Fechar</button></div></div>}
  </main>;
}

function Login({
  entrar,
  esqueciSenha,
  erro,
  aviso,
  salvando,
}: {
  entrar: (email: string, senha: string) => void;
  esqueciSenha: () => void;
  erro: string;
  aviso: string;
  salvando: boolean;
}) {
  const [senha, setSenha] = useState("");

  return <main className="auth-theme flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
    <section className="w-full max-w-md rounded-lg border border-border bg-card p-8">
      <h1 className="mb-2 text-center text-3xl font-bold">Baixa de Entregas</h1>
      <p className="mb-6 text-center text-muted-foreground">Acesso protegido por e-mail e senha.</p>
      {erro && <div role="alert" className="mb-4 break-words rounded-lg border border-destructive p-3 text-sm text-destructive">{erro}</div>}
      {aviso && <p role="status" className="mb-4 text-sm text-foreground">{aviso}</p>}
      <form onSubmit={event => { event.preventDefault(); entrar(EMAIL_AUTORIZADO, senha); }}>
      <label className="block text-sm">E-mail autorizado
        <input type="email" autoComplete="username" value={EMAIL_AUTORIZADO} readOnly className="mt-1 w-full rounded-lg border border-input bg-secondary p-3" />
      </label>
      <label className="mt-4 block text-sm">Senha
        <input required type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-secondary p-3" />
      </label>
      <Button type="submit" disabled={salvando || !senha} className="mt-5 h-12 w-full font-bold">{salvando ? "Aguarde..." : "Entrar"}</Button>
      </form>
      <Button type="button" variant="link" disabled={salvando} onClick={esqueciSenha} className="mt-4 w-full">Esqueci minha senha</Button>
      <p className="mt-5 text-center text-xs text-muted-foreground">Somente o e-mail autorizado tem permissão para acessar os registros e as fotos.</p>
    </section>
  </main>;
}
