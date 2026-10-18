import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { criarSupabaseParaUsuario } from "../lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Baixas sem Entrega" },
    { name: "description", content: "Painel de baixas e ocorrências de entrega." },
  ] }),
  component: Index,
});

type Usuario = "Daniel" | "Rafael";
type StatusPacote = "pendente" | "registrado" | "conferido" | "sem_sucesso";
type Motivo = "Destinatário ausente" | "Endereço não localizado" | "Imóvel não encontrado" | "Destinatário não localizado" | "Outro motivo";
type Foto = { id: string; dataHora: string; url: string; file?: File; storagePath?: string };
type Pacote = {
  id?: string; numero: number; nome: string; destinatario: string; endereco: string; paradaRota: string;
  dataEntrega: string; horaEntrega: string; fotos: Foto[]; status: StatusPacote; registradoPor: string;
  conferidoEm?: string; motivoInsucesso: string; observacaoInsucesso: string; tentativaEm?: string;
};
type Lista = { id: string; data: string; quantidade: number; pacotes: Pacote[] };
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const agora = () => { const d = new Date(); return { data: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), hora: d.toTimeString().slice(0, 5) }; };
const dataBR = (v: string) => v ? new Date(v.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
const textoStatus = (s: StatusPacote) => s === "sem_sucesso" ? "Sem sucesso" : s === "pendente" ? "Pendente" : "Entregue";
const ehEntregue = (s: StatusPacote) => s === "registrado" || s === "conferido";

async function carregarListas(db: ReturnType<typeof criarSupabaseParaUsuario>, usuario: Usuario): Promise<Lista[]> {
  const { data: rows, error } = await db.from("listas_baixas").select("id,data_baixas,quantidade,created_at").eq("usuario", usuario).order("data_baixas", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: ps, error: pe } = await db.from("pacotes").select("id,lista_id,numero,nome_recebedor,nome_destinatario,endereco,parada_rota,data_entrega,hora_entrega,status,registrado_por,conferido_em,motivo_insucesso,observacao_insucesso,tentativa_em").in("lista_id", ids).order("numero");
  if (pe) throw pe;
  const pids = (ps ?? []).map((p) => p.id);
  const { data: fs, error: fe } = pids.length ? await db.from("fotos_entrega").select("id,pacote_id,storage_path,captured_at").in("pacote_id", pids).order("captured_at") : { data: [], error: null };
  if (fe) throw fe;
  const fotoMap = new Map<string, Foto[]>();
  for (const f of fs ?? []) {
    let url = "";
    try { const signed = await db.storage.from("fotos-entregas").createSignedUrl(f.storage_path, 86400); if (!signed.error) url = signed.data.signedUrl; } catch {}
    const arr = fotoMap.get(f.pacote_id) ?? [];
    arr.push({ id: f.id, dataHora: f.captured_at, url, storagePath: f.storage_path });
    fotoMap.set(f.pacote_id, arr);
  }
  return rows.map((l) => ({
    id: l.id, data: l.data_baixas, quantidade: l.quantidade,
    pacotes: (ps ?? []).filter((p) => p.lista_id === l.id).map((p) => ({
      id: p.id, numero: p.numero, nome: p.nome_recebedor ?? "", destinatario: p.nome_destinatario ?? "",
      endereco: p.endereco ?? "", paradaRota: p.parada_rota ?? "", dataEntrega: p.data_entrega ?? "",
      horaEntrega: p.hora_entrega?.slice(0, 5) ?? "", fotos: fotoMap.get(p.id) ?? [],
      status: p.status as StatusPacote, registradoPor: p.registrado_por ?? "", conferidoEm: p.conferido_em ?? undefined,
      motivoInsucesso: p.motivo_insucesso ?? "", observacaoInsucesso: p.observacao_insucesso ?? "", tentativaEm: p.tentativa_em ?? undefined,
    })),
  }));
}

function Index() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const db = useMemo(() => usuario ? criarSupabaseParaUsuario(usuario) : null, [usuario]);
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState<string | null>(null);
  const [pacote, setPacote] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [aba, setAba] = useState<"pendentes" | "entregues" | "insucessos">("pendentes");
  const [nome, setNome] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [endereco, setEndereco] = useState("");
  const [paradaRota, setParadaRota] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [tipoRegistro, setTipoRegistro] = useState<"entregue" | "sem_sucesso">("entregue");
  const [motivo, setMotivo] = useState<Motivo>("Destinatário ausente");
  const [observacao, setObservacao] = useState("");
  const [textoOCR, setTextoOCR] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [nova, setNova] = useState(false);
  const [dataLista, setDataLista] = useState(agora().data);
  const [qtd, setQtd] = useState("");
  const [zoom, setZoom] = useState<{ fotos: Foto[]; i: number } | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroEndereco, setFiltroEndereco] = useState("");
  const [filtroParada, setFiltroParada] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEntregaInicio, setFiltroEntregaInicio] = useState("");
  const [filtroEntregaFim, setFiltroEntregaFim] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState("");

  const lista = useMemo(() => listas.find((l) => l.id === listaId) ?? null, [listas, listaId]);
  const detalhe = lista?.pacotes.find((p) => p.numero === detalheId) ?? null;
  const pendentes = lista?.pacotes.filter((p) => p.status === "pendente") ?? [];
  const entregues = lista?.pacotes.filter((p) => ehEntregue(p.status)) ?? [];
  const insucessos = lista?.pacotes.filter((p) => p.status === "sem_sucesso") ?? [];
  const resultadosPesquisa = useMemo(() => listas.flatMap((l) => l.pacotes.map((p) => ({ lista: l, pacote: p }))).filter(({ lista: l, pacote: p }) => {
    const nomeBusca = normalizar(filtroCliente);
    const enderecoBusca = normalizar(filtroEndereco);
    const paradaBusca = normalizar(filtroParada);
    const dataListaOk = (!filtroDataInicio || l.data >= filtroDataInicio) && (!filtroDataFim || l.data <= filtroDataFim);
    const dataEntregaOk = (!filtroEntregaInicio || (!!p.dataEntrega && p.dataEntrega >= filtroEntregaInicio)) && (!filtroEntregaFim || (!!p.dataEntrega && p.dataEntrega <= filtroEntregaFim));
    const statusOk = !filtroStatus || (filtroStatus === "entregue" ? ehEntregue(p.status) : p.status === filtroStatus);
    return (!nomeBusca || normalizar(p.destinatario + " " + p.nome).includes(nomeBusca))
      && (!enderecoBusca || normalizar(p.endereco).includes(enderecoBusca))
      && (!paradaBusca || normalizar(p.paradaRota).includes(paradaBusca))
      && dataListaOk && dataEntregaOk && statusOk
      && (!filtroMotivo || p.motivoInsucesso === filtroMotivo);
  }), [listas, filtroCliente, filtroEndereco, filtroParada, filtroDataInicio, filtroDataFim, filtroEntregaInicio, filtroEntregaFim, filtroStatus, filtroMotivo]);

  useEffect(() => {
    if (!usuario || !db) return;
    let ativo = true;
    setCarregando(true); setErro(""); setListaId(null); setListas([]);
    carregarListas(db, usuario).then((dados) => { if (ativo) setListas(dados); })
      .catch((e) => { if (ativo) setErro("Não foi possível carregar os registros: " + e.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [usuario, db]);

  const atualizar = async (selecionarId?: string) => {
    if (!db || !usuario) return;
    const dados = await carregarListas(db, usuario);
    setListas(dados);
    if (selecionarId) setListaId(selecionarId);
  };

  const criarLista = async () => {
    const n = Number(qtd);
    if (!Number.isInteger(n) || n < 1) return setErro("Informe uma quantidade válida de pacotes.");
    if (!db || !usuario) return setErro("Escolha um usuário antes de continuar.");
    setSalvando(true); setErro("");
    try {
      const { data: l, error: le } = await db.from("listas_baixas").insert({ usuario, data_baixas: dataLista, quantidade: n }).select("id,data_baixas,quantidade").single();
      if (le) throw le;
      const novos = Array.from({ length: n }, (_, i) => ({ lista_id: l.id, numero: i + 1, status: "pendente" }));
      const { error: pe } = await db.from("pacotes").insert(novos);
      if (pe) { await db.from("listas_baixas").delete().eq("id", l.id).eq("usuario", usuario); throw pe; }
      await atualizar(l.id); setNova(false); setQtd(""); setAba("pendentes");
    } catch (e: any) { setErro("Não foi possível criar a lista: " + e.message); }
    finally { setSalvando(false); }
  };

  const abrirPacote = (n: number) => {
    const p = lista?.pacotes.find((x) => x.numero === n);
    if (!p || !lista || !usuario) return;
    const t = agora();
    setPacote(n); setNome(p.nome); setDestinatario(p.destinatario); setEndereco(p.endereco); setParadaRota(p.paradaRota);
    setData(p.dataEntrega || t.data); setHora(p.horaEntrega || t.hora); setFotos(p.fotos.filter((f) => !!f.storagePath));
    setTipoRegistro("entregue"); setMotivo("Destinatário ausente"); setObservacao(""); setTextoOCR(""); setErro("");
  };

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    const novas: Foto[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 15 * 1024 * 1024) { setErro("Uma foto ultrapassa 15 MB. Escolha uma imagem menor."); return; }
      novas.push({ id: crypto.randomUUID(), dataHora: new Date().toISOString(), url: URL.createObjectURL(file), file });
    });
    if (novas.length) setFotos((v) => [...v, ...novas]);
  };

  const lerTextoDaFoto = async () => {
    const arquivo = fotos.find((f) => f.file)?.file;
    const Detector = (window as any).TextDetector;
    if (!arquivo) return setErro("Tire ou selecione uma foto antes de ler a etiqueta.");
    if (!Detector) return setErro("OCR não disponível neste navegador. Preencha nome e endereço manualmente.");
    try {
      const bitmap = await createImageBitmap(arquivo);
      const blocos = await new Detector().detect(bitmap); bitmap.close();
      const texto = blocos.map((b: { rawValue?: string }) => b.rawValue?.trim()).filter(Boolean).join("\n");
      if (!texto) return setErro("Não consegui ler o texto. Preencha os campos manualmente.");
      setTextoOCR(texto);
      const linhas = texto.split(/\n+/).map((x) => x.trim()).filter(Boolean);
      const idx = linhas.findIndex((x) => /\b(rua|avenida|av\.?|travessa|alameda|estrada|rodovia|praça|cep)\b/i.test(x) || /\b\d{5}-?\d{3}\b/.test(x));
      if (!destinatario.trim() && idx > 0) setDestinatario(linhas[0]);
      if (!endereco.trim() && idx >= 0) setEndereco(linhas.slice(idx).join(", "));
      setErro("Texto identificado. Confira os campos antes de salvar.");
    } catch { setErro("Não foi possível ler essa foto. Preencha os campos manualmente."); }
  };

  const salvar = async () => {
    if (!db || !usuario || !lista || pacote === null) return;
    if (tipoRegistro === "entregue" && !nome.trim()) return setErro("Informe quem recebeu a entrega.");
    if (tipoRegistro === "entregue" && !fotos.length) return setErro("Adicione pelo menos uma foto da entrega.");
    if (tipoRegistro === "sem_sucesso" && motivo === "Outro motivo" && !observacao.trim()) return setErro("Descreva o motivo da tentativa sem sucesso.");
    const atual = lista.pacotes.find((p) => p.numero === pacote);
    if (!atual?.id || atual.status !== "pendente") return setErro("Este pacote não está mais pendente.");
    setSalvando(true); setErro("");
    const arquivosEnviados: string[] = [];
    const fotosInseridas: string[] = [];
    try {
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]!;
        if (!f.file) continue;
        const ext = f.file.type.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = usuario + "/" + lista.id + "/pacote-" + pacote + "-" + Date.now() + "-" + i + "-" + crypto.randomUUID() + "." + ext;
        const { error: ue } = await db.storage.from("fotos-entregas").upload(path, f.file, { contentType: f.file.type, upsert: false });
        if (ue) throw ue;
        arquivosEnviados.push(path);
        const { data: fotoRow, error: fe } = await db.from("fotos_entrega").insert({ pacote_id: atual.id, storage_path: path, captured_at: f.dataHora }).select("id").single();
        if (fe) throw fe;
        fotosInseridas.push(fotoRow.id);
      }
      const tentativaEm = new Date().toISOString();
      const patch = {
        nome_recebedor: tipoRegistro === "entregue" ? nome.trim() : null,
        nome_destinatario: destinatario.trim() || null,
        endereco: endereco.trim() || null,
        parada_rota: paradaRota.trim() || null,
        data_entrega: data || null,
        hora_entrega: hora || null,
        status: tipoRegistro === "sem_sucesso" ? "sem_sucesso" : "registrado",
        registrado_por: usuario,
        motivo_insucesso: tipoRegistro === "sem_sucesso" ? motivo : null,
        observacao_insucesso: tipoRegistro === "sem_sucesso" ? (observacao.trim() || null) : null,
        tentativa_em: tentativaEm,
      };
      const { data: atualizado, error: pe } = await db.from("pacotes").update(patch).eq("id", atual.id).eq("status", "pendente").select("id").maybeSingle();
      if (pe) throw pe;
      if (!atualizado) throw new Error("O pacote não foi atualizado. Atualize a página e tente novamente.");
      setPacote(null); setFotos([]); setNome(""); setDestinatario(""); setEndereco(""); setParadaRota(""); setObservacao(""); setTextoOCR("");
      await atualizar(lista.id);
    } catch (e: any) {
      if (fotosInseridas.length) await db.from("fotos_entrega").delete().in("id", fotosInseridas);
      if (arquivosEnviados.length) await db.storage.from("fotos-entregas").remove(arquivosEnviados);
      setErro("Não foi possível salvar o registro: " + e.message);
    } finally { setSalvando(false); }
  };

  const confirmar = async () => {
    if (!db || !lista || !detalhe?.id || detalhe.status !== "registrado") return;
    setSalvando(true);
    try {
      const { error } = await db.from("pacotes").update({ status: "conferido", conferido_em: new Date().toISOString() }).eq("id", detalhe.id).eq("status", "registrado");
      if (error) throw error;
      await atualizar(lista.id); setDetalheId(null); setAba("entregues");
    } catch (e: any) { setErro("Não foi possível confirmar: " + e.message); }
    finally { setSalvando(false); }
  };

  const limparFiltros = () => {
    setFiltroCliente(""); setFiltroEndereco(""); setFiltroParada(""); setFiltroDataInicio(""); setFiltroDataFim("");
    setFiltroEntregaInicio(""); setFiltroEntregaFim(""); setFiltroStatus(""); setFiltroMotivo(""); setMostrarResultados(false);
  };

  if (!usuario) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <section className="w-full max-w-md">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl">✓</div><h1 className="text-2xl font-bold">Baixas sem Entrega</h1><p className="mt-2 text-sm text-slate-400">Selecione seu usuário para continuar</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{(["Daniel", "Rafael"] as Usuario[]).map((u) => <button key={u} onClick={() => setUsuario(u)} className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-lg font-semibold transition hover:border-emerald-500 hover:bg-slate-800">{u}<span className="mt-2 block text-xs font-normal text-slate-400">Acessar painel →</span></button>)}</div>
    </section>
  </main>;

  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-3"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><h1 className="text-xl font-bold">Baixas sem Entrega</h1><p className="text-sm text-slate-400">Painel de {usuario}</p></div><button onClick={() => { setUsuario(null); setListas([]); setListaId(null); setPacote(null); setDetalheId(null); setFiltroAberto(false); setMostrarResultados(false); setErro(""); }} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Trocar usuário</button></div></header>
    <div className="mx-auto max-w-6xl px-4 py-5">
      {erro && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">{erro}</div>}
      {carregando && <p className="mb-4 text-sm text-slate-400">Carregando registros de {usuario}...</p>}
      {!carregando && !lista && !mostrarResultados && <section>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Resumo por dia</h2><p className="text-sm text-slate-400">Selecione uma data para ver os pacotes.</p></div><div className="flex gap-2"><button onClick={() => setFiltroAberto(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><span aria-hidden="true">⏷</span> Filtro</button><button onClick={() => setNova(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">＋ Nova lista</button></div></div>
        {listas.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><p className="text-slate-300">Ainda não há listas registradas para {usuario}.</p><button onClick={() => setNova(true)} className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 font-semibold">Criar primeira lista</button></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{listas.map((l) => { const entreguesDia = l.pacotes.filter((p) => ehEntregue(p.status)).length; const semSucessoDia = l.pacotes.filter((p) => p.status === "sem_sucesso").length; const pendentesDia = l.pacotes.filter((p) => p.status === "pendente").length; return <button key={l.id} onClick={() => { setListaId(l.id); setDetalheId(null); setPacote(null); }} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-emerald-500"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{dataBR(l.data)}</h3><span className="text-xs text-emerald-400">Ver dia →</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Pacotes</p><b>{l.quantidade}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Entregues</p><b>{entreguesDia}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Pendentes</p><b>{pendentesDia}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Sem sucesso</p><b>{semSucessoDia}</b></div></div></button>; })}</div>}
      </section>}

      {mostrarResultados && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Resultados do filtro</h2><p className="text-sm text-slate-400">{resultadosPesquisa.length} registro(s) encontrado(s) para {usuario}</p></div><button onClick={() => setMostrarResultados(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Voltar à lista</button></div>{resultadosPesquisa.length === 0 ? <div className="rounded-xl bg-slate-900 p-5 text-sm text-slate-400">Nenhum registro corresponde aos filtros selecionados.</div> : <div className="grid gap-3 md:grid-cols-2">{resultadosPesquisa.map(({ lista: lr, pacote: p }) => <article key={lr.id + ":" + p.numero} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">{p.fotos[0]?.url ? <img src={p.fotos[0].url} alt="Foto do pacote" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">Sem foto</div>}<div className="min-w-0 flex-1"><p className="font-semibold">Pacote {p.numero} · {p.destinatario || p.nome || "Sem nome"}</p><p className="text-sm text-slate-300">{p.endereco || "Endereço não informado"}</p><p className="mt-1 text-xs text-slate-400">Lista: {dataBR(lr.data)} · Entrega: {dataBR(p.dataEntrega)} · Parada: {p.paradaRota || "—"}</p><p className="text-xs text-slate-400">Status: {textoStatus(p.status)}{p.motivoInsucesso ? " · " + p.motivoInsucesso : ""}</p><button onClick={() => { setListaId(lr.id); setDetalheId(p.numero); setMostrarResultados(false); }} className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm">Ver registro</button></div></article>)}</div>}</section>}

      {lista && !mostrarResultados && detalheId === null && pacote === null && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><button onClick={() => setListaId(null)} className="mb-2 text-sm text-emerald-400">← Voltar às datas</button><h2 className="text-xl font-semibold">Registros de {dataBR(lista.data)}</h2><p className="text-sm text-slate-400">{lista.quantidade} pacotes · {entregues.length} entregues · {pendentes.length} pendentes · {insucessos.length} sem sucesso</p></div><div className="flex gap-2"><button onClick={() => setFiltroAberto(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">⏷ Filtro</button><button onClick={() => setNova(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">＋ Nova lista</button></div></div><div className="mb-4 flex flex-wrap gap-2">{([{id:"pendentes",label:"Pendentes",n:pendentes.length},{id:"entregues",label:"Entregues",n:entregues.length},{id:"insucessos",label:"Sem sucesso",n:insucessos.length}] as const).map((x) => <button key={x.id} onClick={() => setAba(x.id)} className={"rounded-lg px-3 py-2 text-sm " + (aba === x.id ? "bg-emerald-600" : "bg-slate-800")}>{x.label} ({x.n})</button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba === "pendentes" ? pendentes : aba === "entregues" ? entregues : insucessos).map((p) => <button key={p.id ?? p.numero} onClick={() => p.status === "pendente" ? abrirPacote(p.numero) : setDetalheId(p.numero)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-left hover:border-emerald-500"><b>Pacote {p.numero}</b><p className="mt-1 truncate text-sm text-slate-300">{p.destinatario || p.nome || "Sem nome"}</p><p className="mt-2 text-xs text-slate-400">{textoStatus(p.status)}</p>{p.motivoInsucesso && <p className="mt-1 text-xs text-amber-300">{p.motivoInsucesso}</p>}<p className="mt-1 text-xs text-slate-500">{p.fotos.length} foto(s)</p></button>)}</div></section>}

      {lista && detalheId !== null && detalhe && !mostrarResultados && <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><button onClick={() => setDetalheId(null)} className="mb-4 rounded-lg border border-slate-700 px-3 py-2 text-sm">← Voltar</button><p className="text-sm text-slate-400">Detalhes do registro</p><h2 className="mb-4 text-2xl font-bold">Pacote {detalhe.numero}</h2><div className="grid gap-3 rounded-xl bg-slate-950/50 p-4 sm:grid-cols-2"><div><small className="text-slate-400">Status</small><p>{textoStatus(detalhe.status)}</p></div><div><small className="text-slate-400">Destinatário</small><p>{detalhe.destinatario || "Não informado"}</p></div><div><small className="text-slate-400">Endereço</small><p>{detalhe.endereco || "Não informado"}</p></div><div><small className="text-slate-400">Quem recebeu</small><p>{detalhe.nome || "Não informado"}</p></div><div><small className="text-slate-400">Parada/rota</small><p>{detalhe.paradaRota || "Não informada"}</p></div><div><small className="text-slate-400">Data da lista</small><p>{dataBR(lista.data)}</p></div><div><small className="text-slate-400">Data da tentativa/entrega</small><p>{dataBR(detalhe.dataEntrega)} {detalhe.horaEntrega}</p></div>{detalhe.tentativaEm && <div><small className="text-slate-400">Tentativa registrada em</small><p>{new Date(detalhe.tentativaEm).toLocaleString("pt-BR")}</p></div>}{detalhe.motivoInsucesso && <div><small className="text-slate-400">Motivo do insucesso</small><p>{detalhe.motivoInsucesso}</p></div>}{detalhe.observacaoInsucesso && <div className="sm:col-span-2"><small className="text-slate-400">Observação</small><p>{detalhe.observacaoInsucesso}</p></div>}</div><h3 className="mb-3 mt-6 font-semibold">Fotos ({detalhe.fotos.length})</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{detalhe.fotos.map((f, i) => <button key={f.id} onClick={() => setZoom({fotos:detalhe.fotos,i})} className="overflow-hidden rounded-xl border border-slate-700 text-left">{f.url ? <img src={f.url} alt="Foto da entrega" className="h-36 w-full object-cover" /> : <div className="p-8 text-xs text-slate-400">Foto indisponível</div>}<p className="p-2 text-xs">{new Date(f.dataHora).toLocaleString("pt-BR")}</p></button>)}</div>{detalhe.status === "registrado" && <button disabled={salvando} onClick={confirmar} className="mt-5 w-full rounded-xl bg-emerald-600 p-3 font-semibold disabled:opacity-50">Confirmar conferência</button>}</section>}

      {lista && pacote !== null && !mostrarResultados && <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Registrar pacote {pacote}</h2><button disabled={salvando} onClick={() => setPacote(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">← Voltar</button></div><div className="mb-4 grid grid-cols-2 gap-2"><button onClick={() => setTipoRegistro("entregue")} className={"rounded-lg p-3 text-sm font-semibold " + (tipoRegistro === "entregue" ? "bg-emerald-600" : "bg-slate-800")}>✓ Entregue</button><button onClick={() => setTipoRegistro("sem_sucesso")} className={"rounded-lg p-3 text-sm font-semibold " + (tipoRegistro === "sem_sucesso" ? "bg-amber-700" : "bg-slate-800")}>! Sem sucesso</button></div><label className="block text-sm">Nome de quem recebeu {tipoRegistro === "entregue" ? "(obrigatório)" : "(se disponível)"}<input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="mt-3 block text-sm">Cliente/destinatário<input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Nome na etiqueta" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="mt-3 block text-sm">Endereço<input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço da entrega" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="mt-3 block text-sm">Parada/rota<input value={paradaRota} onChange={(e) => setParadaRota(e.target.value)} placeholder="Ex.: 5" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Data da tentativa/entrega<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Horário<input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label></div>{tipoRegistro === "sem_sucesso" && <div className="mt-4 rounded-xl border border-amber-900/70 bg-amber-950/30 p-3"><label className="block text-sm">Motivo da tentativa sem sucesso<select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3">{(["Destinatário ausente","Endereço não localizado","Imóvel não encontrado","Destinatário não localizado","Outro motivo"] as Motivo[]).map((m) => <option key={m}>{m}</option>)}</select></label>{motivo === "Outro motivo" && <label className="mt-3 block text-sm">Descreva o motivo<textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label>}<p className="mt-2 text-xs text-slate-400">Data e hora da tentativa serão salvas automaticamente junto com o motivo.</p></div>}<div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>Fotos</b><p className="text-xs text-slate-400">{tipoRegistro === "entregue" ? "Obrigatória para confirmar a entrega." : "Opcional para registrar o insucesso."}</p></div><label className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">📷 Tirar foto<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addFotos(e.target.files)} /></label></div><label className="mt-3 inline-block cursor-pointer text-sm text-emerald-400">Selecionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFotos(e.target.files)} /></label><button type="button" onClick={lerTextoDaFoto} className="mt-3 block rounded-lg border border-slate-700 px-3 py-2 text-sm">Ler texto da etiqueta (OCR, se disponível)</button>{textoOCR && <details className="mt-3 rounded-lg bg-slate-800 p-3"><summary className="cursor-pointer text-sm">Texto identificado — confira</summary><pre className="mt-2 whitespace-pre-wrap text-xs">{textoOCR}</pre></details>}{fotos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{fotos.map((f) => <div key={f.id} className="relative"><img src={f.url} alt="Prévia da foto" className="h-24 w-full rounded-lg object-cover" /><button onClick={() => setFotos((atual) => atual.filter((x) => x.id !== f.id))} className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs">×</button></div>)}</div>}</div><button disabled={salvando || !db} onClick={salvar} className="mt-4 w-full rounded-xl bg-emerald-600 p-4 font-bold disabled:opacity-50">{salvando ? "Salvando..." : tipoRegistro === "entregue" ? "Salvar entrega" : "Registrar insucesso"}</button></section>}
    </div>

    {nova && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl bg-slate-900 p-5"><h2 className="text-xl font-bold">Nova lista de baixas</h2><label className="mt-4 block text-sm">Data de referência<input type="date" value={dataLista} onChange={(e) => setDataLista(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="mt-3 block text-sm">Quantidade de pacotes<input type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><div className="mt-5 flex gap-3"><button disabled={salvando} onClick={() => setNova(false)} className="flex-1 rounded-xl border border-slate-700 p-3">Cancelar</button><button disabled={salvando} onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 p-3 font-semibold">{salvando ? "Criando..." : "Criar lista"}</button></div></section></div>}

    {filtroAberto && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center"><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">⏷ Filtro</h2><p className="text-sm text-slate-400">Combine uma ou mais opções.</p></div><button onClick={() => setFiltroAberto(false)} className="rounded-lg border border-slate-700 px-3 py-2">Fechar</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Parada<input value={filtroParada} onChange={(e) => setFiltroParada(e.target.value)} placeholder="Ex.: 5" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Nome do cliente/destinatário<input value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Ex.: Luciana" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm sm:col-span-2">Endereço<input value={filtroEndereco} onChange={(e) => setFiltroEndereco(e.target.value)} placeholder="Rua, número, bairro..." className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da lista — de<input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da lista — até<input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da entrega — de<input type="date" value={filtroEntregaInicio} onChange={(e) => setFiltroEntregaInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da entrega — até<input type="date" value={filtroEntregaFim} onChange={(e) => setFiltroEntregaFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Status<select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"><option value="">Todos</option><option value="entregue">Entregue</option><option value="pendente">Pendente</option><option value="sem_sucesso">Sem sucesso</option></select></label><label className="text-sm">Tipo de ocorrência<select value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"><option value="">Todas</option>{(["Destinatário ausente","Endereço não localizado","Imóvel não encontrado","Destinatário não localizado","Outro motivo"] as Motivo[]).map((m) => <option key={m}>{m}</option>)}</select></label></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => { setMostrarResultados(true); setFiltroAberto(false); setListaId(null); setDetalheId(null); setPacote(null); }} className="flex-1 rounded-xl bg-emerald-600 p-3 font-semibold">Aplicar filtros</button><button onClick={limparFiltros} className="rounded-xl border border-slate-700 px-4 py-3">Limpar filtros</button></div></section></div>}

    {zoom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}><div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}><button onClick={() => setZoom((v) => v && ({ ...v, i: (v.i - 1 + v.fotos.length) % v.fotos.length }))} className="rounded-full bg-slate-800 px-4 py-3">‹</button><div className="text-center">{zoom.fotos[zoom.i]?.url ? <img src={zoom.fotos[zoom.i]!.url} alt="Foto ampliada" className="max-h-[80vh] max-w-[75vw] rounded-xl object-contain" /> : <div className="rounded-xl bg-slate-800 p-10">Imagem indisponível</div>}<p className="mt-2 text-sm">{new Date(zoom.fotos[zoom.i]!.dataHora).toLocaleString("pt-BR")}</p></div><button onClick={() => setZoom((v) => v && ({ ...v, i: (v.i + 1) % v.fotos.length }))} className="rounded-full bg-slate-800 px-4 py-3">›</button><button onClick={() => setZoom(null)} className="fixed right-5 top-5 rounded-lg bg-slate-800 px-3 py-2">Fechar</button></div></div>}
  </main>;
}
