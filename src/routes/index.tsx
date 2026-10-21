import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { criarSupabaseParaUsuario } from "../lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Gestão de Entregas" },
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
  conferidoEm?: string; quantidadeConferida: number; motivoInsucesso: string; observacaoInsucesso: string; tentativaEm?: string;
};
type Lista = { id: string; data: string; quantidade: number; pacotes: Pacote[] };
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const agora = () => { const d = new Date(); return { data: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), hora: d.toTimeString().slice(0, 5) }; };
const dataBR = (v: string) => v ? new Date(v.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
const textoStatus = (s: StatusPacote) => s === "sem_sucesso" ? "Insucesso" : s === "pendente" ? "Pendente" : s === "conferido" ? "Conferido" : "Entregue";
const ehEntregue = (s: StatusPacote) => s === "registrado";

const PALETA_CORES: { nome: string; tons: string[] }[] = [
  { nome: "Verde", tons: ["#ecfdf5","#d1fae5","#a7f3d0","#6ee7b7","#34d399","#10b981","#059669","#047857","#065f46","#064e3b"] },
  { nome: "Azul", tons: ["#eff6ff","#dbeafe","#bfdbfe","#93c5fd","#60a5fa","#3b82f6","#2563eb","#1d4ed8","#1e40af","#1e3a8a"] },
  { nome: "Vermelho", tons: ["#fef2f2","#fee2e2","#fecaca","#fca5a5","#f87171","#ef4444","#dc2626","#b91c1c","#991b1b","#7f1d1d"] },
  { nome: "Roxo", tons: ["#faf5ff","#f3e8ff","#e9d5ff","#d8b4fe","#c084fc","#a855f7","#9333ea","#7e22ce","#6b21a8","#581c87"] },
  { nome: "Rosa", tons: ["#fdf2f8","#fce7f3","#fbcfe8","#f9a8d4","#f472b6","#ec4899","#db2777","#be185d","#9d174d","#831843"] },
  { nome: "Amarelo", tons: ["#fefce8","#fef9c3","#fef08a","#fde047","#facc15","#eab308","#ca8a04","#a16207","#854d0e","#713f12"] },
  { nome: "Laranja", tons: ["#fff7ed","#ffedd5","#fed7aa","#fdba74","#fb923c","#f97316","#ea580c","#c2410c","#9a3412","#7c2d12"] },
  { nome: "Ciano", tons: ["#ecfeff","#cffafe","#a5f3fc","#67e8f9","#22d3ee","#06b6d4","#0891b2","#0e7490","#155e75","#164e63"] },
  { nome: "Turquesa", tons: ["#f0fdfa","#ccfbf1","#99f6e4","#5eead4","#2dd4bf","#14b8a6","#0d9488","#0f766e","#115e59","#134e4a"] },
  { nome: "Marrom", tons: ["#faf7f5","#f0e7e1","#dfc8b8","#c8a58c","#b08968","#93694d","#7f5539","#6f4518","#582f0e","#3f2614"] },
  { nome: "Cinza", tons: ["#f9fafb","#f3f4f6","#e5e7eb","#d1d5db","#9ca3af","#6b7280","#4b5563","#374151","#1f2937","#111827"] },
  { nome: "Preto e neutros", tons: ["#ffffff","#f8fafc","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569","#334155","#1e293b","#020617"] },
];
const luminanciaHex = (hex: string) => { const n = hex.replace("#", ""); const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2)); return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!; };

async function carregarListas(db: ReturnType<typeof criarSupabaseParaUsuario>, usuario: Usuario): Promise<Lista[]> {
  const { data: rows, error } = await db.from("listas_baixas").select("id,data_baixas,quantidade,created_at").eq("usuario", usuario).order("data_baixas", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.id);
  let { data: ps, error: pe } = await db.from("pacotes").select("id,lista_id,numero,nome_recebedor,nome_destinatario,endereco,parada_rota,data_entrega,hora_entrega,status,registrado_por,conferido_em,quantidade_conferida,motivo_insucesso,observacao_insucesso,tentativa_em").in("lista_id", ids).order("numero");
  // Mantém o app carregando caso a migration ainda não tenha sido aplicada no Supabase.
  if (pe && /quantidade_conferida|column/i.test(pe.message || "")) {
    const fallback = await db.from("pacotes").select("id,lista_id,numero,nome_recebedor,nome_destinatario,endereco,parada_rota,data_entrega,hora_entrega,status,registrado_por,conferido_em,motivo_insucesso,observacao_insucesso,tentativa_em").in("lista_id", ids).order("numero");
    ps = fallback.data as typeof ps; pe = fallback.error;
  }
  if (pe) throw pe;
  const pids = (ps ?? []).map((p) => p.id);
  const { data: fs, error: fe } = pids.length ? await db.from("fotos_entrega").select("id,pacote_id,storage_path,captured_at").in("pacote_id", pids).order("captured_at") : { data: [], error: null };
  if (fe) throw fe;
  const fotoMap = new Map<string, Foto[]>();
  // Uma chamada em lote reduz as requisições para recuperar fotos de todas as listas.
  const fotosRows = fs ?? [];
  for (let i = 0; i < fotosRows.length; i += 100) {
    const lote = fotosRows.slice(i, i + 100);
    let urlsPorCaminho = new Map<string, string>();
    try {
      const { data: assinadas, error: erroAssinatura } = await db.storage
        .from("fotos-entregas")
        .createSignedUrls(lote.map((f) => f.storage_path), 86400);
      if (!erroAssinatura) {
        const pares: [string, string][] = [];
        for (const assinada of assinadas ?? []) {
          if (assinada.path && assinada.signedUrl) pares.push([assinada.path, assinada.signedUrl]);
        }
        urlsPorCaminho = new Map(pares);
      }
    } catch {
      // Falha temporária ao assinar fotos não deve impedir o carregamento dos pacotes.
    }
    for (const f of lote) {
      const arr = fotoMap.get(f.pacote_id) ?? [];
      arr.push({ id: f.id, dataHora: f.captured_at, url: urlsPorCaminho.get(f.storage_path) ?? "", storagePath: f.storage_path });
      fotoMap.set(f.pacote_id, arr);
    }
  }

  // Agrupa os pacotes uma única vez, evitando filtrar todos eles para cada lista.
  const pacotesPorLista = new Map<string, NonNullable<typeof ps>[number][]>();
  for (const p of ps ?? []) {
    const arr = pacotesPorLista.get(p.lista_id) ?? [];
    arr.push(p);
    pacotesPorLista.set(p.lista_id, arr);
  }

  return rows.map((l) => ({
    id: l.id, data: l.data_baixas, quantidade: l.quantidade,
    pacotes: (pacotesPorLista.get(l.id) ?? []).map((p) => ({
      id: p.id, numero: p.numero, nome: p.nome_recebedor ?? "", destinatario: p.nome_destinatario ?? "",
      endereco: p.endereco ?? "", paradaRota: p.parada_rota ?? "", dataEntrega: p.data_entrega ?? "",
      horaEntrega: p.hora_entrega?.slice(0, 5) ?? "", fotos: fotoMap.get(p.id) ?? [],
      status: p.status as StatusPacote, registradoPor: p.registrado_por ?? "", conferidoEm: p.conferido_em ?? undefined, quantidadeConferida: Number(p.quantidade_conferida ?? 0),
      motivoInsucesso: p.motivo_insucesso ?? "", observacaoInsucesso: p.observacao_insucesso ?? "", tentativaEm: p.tentativa_em ?? undefined,
    })),
  }));
}

function Index() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [configuracaoVisualAberta, setConfiguracaoVisualAberta] = useState(false);
  const [corPersonalizada, setCorPersonalizada] = useState("#10b981");
  const [modoAparencia, setModoAparencia] = useState<"claro" | "escuro">("escuro");
  const [coresClarasUsuario, setCoresClarasUsuario] = useState<Record<Usuario, string>>({ Daniel: "#2563eb", Rafael: "#2563eb" });
  const [coresUsuario, setCoresUsuario] = useState<Record<Usuario, string>>({ Daniel: "#10b981", Rafael: "#3b82f6" });
  const [fontesUsuario, setFontesUsuario] = useState<Record<Usuario, string>>({ Daniel: "Poppins", Rafael: "Poppins" });
  const [preferenciasCarregadas, setPreferenciasCarregadas] = useState(false);
  const [fotosPerfil, setFotosPerfil] = useState<Record<Usuario, string | null>>({ Daniel: null, Rafael: null });
  const [fotoPerfilPendente, setFotoPerfilPendente] = useState<{ usuario: Usuario; arquivo: File; previa: string } | null>(null);
  const [salvandoFotoPerfil, setSalvandoFotoPerfil] = useState(false);
  const [salvandoPreferencias, setSalvandoPreferencias] = useState(false);
  const [erroPersonalizacao, setErroPersonalizacao] = useState("");

  useEffect(() => {
    try {
      const salvas = window.localStorage.getItem("baixas-sem-entrega-preferencias-visuais-v1");
      if (salvas) {
        const parsed = JSON.parse(salvas);
        setCoresUsuario({
          Daniel: /^#[0-9a-fA-F]{6}$/.test(parsed?.cores?.Daniel ?? "") ? parsed.cores.Daniel : "#10b981",
          Rafael: /^#[0-9a-fA-F]{6}$/.test(parsed?.cores?.Rafael ?? "") ? parsed.cores.Rafael : "#3b82f6",
        });
        setCoresClarasUsuario({
          Daniel: /^#[0-9a-fA-F]{6}$/.test(parsed?.coresClaras?.Daniel ?? "") ? parsed.coresClaras.Daniel : "#2563eb",
          Rafael: /^#[0-9a-fA-F]{6}$/.test(parsed?.coresClaras?.Rafael ?? "") ? parsed.coresClaras.Rafael : "#2563eb",
        });
        setModoAparencia(parsed?.modoAparencia === "claro" ? "claro" : "escuro");
        const fontesValidas = ["Poppins", "Inter", "Roboto", "Nunito Sans", "Lato", "Open Sans"];
        setFontesUsuario({ Daniel: fontesValidas.includes(parsed?.fontes?.Daniel) ? parsed.fontes.Daniel : "Poppins", Rafael: fontesValidas.includes(parsed?.fontes?.Rafael) ? parsed.fontes.Rafael : "Poppins" });
      }
    } catch { /* Preferências visuais são opcionais; mantém as cores padrão. */ }
    setPreferenciasCarregadas(true);
  }, []);

  useEffect(() => {
    if (!preferenciasCarregadas) return;
    try { window.localStorage.setItem("baixas-sem-entrega-preferencias-visuais-v1", JSON.stringify({ cores: coresUsuario, coresClaras: coresClarasUsuario, modoAparencia, fontes: fontesUsuario })); } catch {}
  }, [coresUsuario, coresClarasUsuario, modoAparencia, fontesUsuario, preferenciasCarregadas]);
  const db = useMemo(() => usuario ? criarSupabaseParaUsuario(usuario) : null, [usuario]);

  useEffect(() => {
    let ativo = true;
    const carregarFotosPerfil = async () => {
      const pares = await Promise.all((["Daniel", "Rafael"] as Usuario[]).map(async (u) => {
        const cliente = criarSupabaseParaUsuario(u);
        const { data, error } = await cliente.storage.from("fotos-entregas").createSignedUrl(u + "/profile/avatar", 604800);
        return [u, !error && data?.signedUrl ? data.signedUrl : null] as const;
      }));
      if (ativo) setFotosPerfil((atuais) => ({ ...atuais, ...Object.fromEntries(pares) }) as Record<Usuario, string | null>);
    };
    void carregarFotosPerfil();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!usuario || !db) return;
    let ativo = true;
    const carregarPreferenciasRemotas = async () => {
      try {
        const { data, error } = await db.storage.from("fotos-entregas").download(usuario + "/profile/preferences.json");
        if (error || !data) return;
        const config = JSON.parse(await data.text());
        const fontesValidas = ["Poppins", "Inter", "Roboto", "Nunito Sans", "Lato", "Open Sans"];
        if (!ativo) return;
        if (/^#[0-9a-fA-F]{6}$/.test(config?.cor ?? "")) setCoresUsuario((v) => ({ ...v, [usuario]: config.cor }));
        if (fontesValidas.includes(config?.fonte)) setFontesUsuario((v) => ({ ...v, [usuario]: config.fonte }));
      } catch {
        // Se ainda não existe preferência remota, mantém o padrão/cache local sem alterar dados.
      }
    };
    void carregarPreferenciasRemotas();
    return () => { ativo = false; };
  }, [usuario, db]);

  useEffect(() => {
    const fonte = usuario ? fontesUsuario[usuario] : null;
    if (!fonte || !("fonts" in document)) return;
    const family = '"' + fonte + '"';
    void document.fonts.load("400 16px " + family).catch(() => undefined);
    void document.fonts.load("600 16px " + family).catch(() => undefined);
    void document.fonts.load("700 16px " + family).catch(() => undefined);
  }, [usuario, fontesUsuario]);
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState<string | null>(null);
  const [pacote, setPacote] = useState<number | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [quantidadeConferida, setQuantidadeConferida] = useState("1");
  const [aba, setAba] = useState<"pendentes" | "entregues" | "insucessos" | "conferidos">("pendentes");
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
  const [cameraAberta, setCameraAberta] = useState(false);
  const [fotosRascunho, setFotosRascunho] = useState<{ id: string; file: File; url: string }[]>([]);
  const [ocrProcessando, setOcrProcessando] = useState(false);
  const [mostrarCampoEndereco, setMostrarCampoEndereco] = useState(false);
  const videoCameraRef = useRef<HTMLVideoElement | null>(null);
  const streamCameraRef = useRef<MediaStream | null>(null);
  const salvandoRegistroRef = useRef(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [excluindoListaId, setExcluindoListaId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"conectando" | "online" | "offline">("conectando");
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
  const [filtroPeriodoTipo, setFiltroPeriodoTipo] = useState<"todos" | "data" | "mes" | "ano">("todos");
  const [filtroPeriodoValor, setFiltroPeriodoValor] = useState("");

  const listasVisiveis = useMemo(() => {
    if (filtroPeriodoTipo === "todos" || !filtroPeriodoValor) return listas;
    return listas.filter((l) => {
      const data = (l.data ?? "").slice(0, 10);
      if (filtroPeriodoTipo === "data") return data === filtroPeriodoValor;
      if (filtroPeriodoTipo === "mes") return data.slice(0, 7) === filtroPeriodoValor;
      if (filtroPeriodoTipo === "ano") return data.slice(0, 4) === filtroPeriodoValor;
      return true;
    });
  }, [listas, filtroPeriodoTipo, filtroPeriodoValor]);

  const lista = useMemo(() => listas.find((l) => l.id === listaId) ?? null, [listas, listaId]);
  const detalhe = lista?.pacotes.find((p) => p.numero === detalheId) ?? null;
  const pendentes = lista?.pacotes.filter((p) => p.status === "pendente") ?? [];
  const entregues = lista?.pacotes.filter((p) => ehEntregue(p.status)) ?? [];
  const insucessos = lista?.pacotes.filter((p) => p.status === "sem_sucesso") ?? [];
  const conferidos = lista?.pacotes.filter((p) => p.status === "conferido") ?? [];
  // __NAVEGACAO_CONFERIDO_PACOTES__: impede o plugin antigo de inserir controles duplicados.
  const indiceDetalheConferido = aba === "conferidos" && detalheId !== null ? conferidos.findIndex((p) => p.numero === detalheId) : -1;
  const pacoteConferidoAnterior = indiceDetalheConferido > 0 ? conferidos[indiceDetalheConferido - 1] : null;
  const pacoteConferidoProximo = indiceDetalheConferido >= 0 && indiceDetalheConferido < conferidos.length - 1 ? conferidos[indiceDetalheConferido + 1] : null;
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

  const excluirLista = async (l: Lista) => {
    if (!db || !usuario || excluindoListaId) return;
    const confirmada = window.confirm(
      `Excluir a lista de ${dataBR(l.data)} de ${usuario}? Esta ação apagará somente esta lista, seus registros e as fotos vinculadas. Não é possível desfazer.`,
    );
    if (!confirmada) return;

    setExcluindoListaId(l.id);
    setErro("");
    try {
      const pacoteIds = l.pacotes.map((p) => p.id).filter((id): id is string => Boolean(id));
      let caminhosFotos: string[] = [];
      if (pacoteIds.length) {
        const { data: fotosLista, error: fotosError } = await db
          .from("fotos_entrega")
          .select("storage_path")
          .in("pacote_id", pacoteIds);
        if (fotosError) throw fotosError;
        caminhosFotos = (fotosLista ?? []).map((f) => f.storage_path).filter((path): path is string => Boolean(path));
      }

      for (let i = 0; i < caminhosFotos.length; i += 1000) {
        const lote = caminhosFotos.slice(i, i + 1000);
        const { data: removidas, error: storageError } = await db.storage.from("fotos-entregas").remove(lote);
        if (storageError) throw storageError;
        if ((removidas ?? []).length !== lote.length) {
          throw new Error("Nem todas as fotos puderam ser removidas por causa das permissões de armazenamento.");
        }
      }

      const { data: removida, error: deleteError } = await db
        .from("listas_baixas")
        .delete()
        .eq("id", l.id)
        .eq("usuario", usuario)
        .select("id");
      if (deleteError) throw deleteError;
      if (!removida?.length) throw new Error("A lista não foi excluída. Verifique as permissões do usuário.");

      setListas((atuais) => atuais.filter((item) => item.id !== l.id));
      if (listaId === l.id) setListaId(null);
      setDetalheId(null);
      setPacote(null);
    } catch (e: any) {
      setErro("Não foi possível excluir a lista de " + dataBR(l.data) + ": " + (e?.message || "erro desconhecido"));
    } finally {
      setExcluindoListaId(null);
    }
  };

  useEffect(() => {
    if (!db || !usuario) return;
    let ativo = true;
    let temporizador: number | undefined;
    let atualizandoAgora = false;
    let atualizarNovamente = false;
    const atualizarAoReceberEvento = async () => {
      if (!ativo) return;
      if (atualizandoAgora) {
        atualizarNovamente = true;
        return;
      }
      atualizandoAgora = true;
      try {
        do {
          atualizarNovamente = false;
          const dados = await carregarListas(db, usuario);
          if (ativo) {
            setListas(dados);
            setErro((atual) => atual.startsWith("Não foi possível sincronizar") ? "" : atual);
          }
        } while (ativo && atualizarNovamente);
      } catch (e: any) {
        if (ativo) setErro("Não foi possível sincronizar com o servidor: " + (e?.message || "erro desconhecido"));
      } finally {
        atualizandoAgora = false;
      }
    };
    // Agrupa eventos de fotos e pacote numa única recarga e impede recargas concorrentes.
    const agendarAtualizacao = () => {
      if (temporizador !== undefined) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => { void atualizarAoReceberEvento(); }, 300);
    };
    const canal = db
      .channel("gestao-entregas-" + usuario)
      .on("postgres_changes", { event: "*", schema: "public", table: "listas_baixas" }, agendarAtualizacao)
      .on("postgres_changes", { event: "*", schema: "public", table: "pacotes" }, agendarAtualizacao)
      .on("postgres_changes", { event: "*", schema: "public", table: "fotos_entrega" }, agendarAtualizacao)
      .subscribe((status) => {
        if (!ativo) return;
        if (status === "SUBSCRIBED") setSyncStatus("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setSyncStatus("offline");
        else setSyncStatus("conectando");
      });
    return () => {
      ativo = false;
      if (temporizador !== undefined) window.clearTimeout(temporizador);
      void db.removeChannel(canal);
    };
  }, [db, usuario]);

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

  const identificarEndereco = (texto: string) => {
    const linhas = texto.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const idx = linhas.findIndex((x) => /\b(rua|avenida|av\.?|travessa|alameda|estrada|rodovia|praça|largo|rod\.?|cep)\b/i.test(x) || /\b\d{5}-?\d{3}\b/.test(x));
    if (idx < 0) return "";
    const candidatas = linhas.slice(idx, Math.min(linhas.length, idx + 4));
    return candidatas.join(", ").slice(0, 400);
  };

  const reconhecerTexto = async (arquivo: File) => {
    try {
      let tesseract = (window as any).Tesseract;
      if (!tesseract) {
        await new Promise<void>((resolve, reject) => {
          const existente = document.querySelector<HTMLScriptElement>('script[data-ocr-tesseract="true"]');
          if (existente) {
            existente.addEventListener("load", () => resolve(), { once: true });
            existente.addEventListener("error", () => reject(new Error("Falha ao carregar OCR")), { once: true });
            if ((window as any).Tesseract) resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.async = true;
          script.dataset["ocrTesseract"] = "true";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Falha ao carregar OCR"));
          document.head.appendChild(script);
        });
        tesseract = (window as any).Tesseract;
      }
      if (!tesseract?.recognize) return;
      const resultado = await tesseract.recognize(arquivo, "por+eng");
      const texto = String(resultado?.data?.text || "").trim();
      if (!texto) return;
      setTextoOCR((atual) => atual ? atual + "\n\n" + texto : texto);
      const enderecoReconhecido = identificarEndereco(texto);
      if (enderecoReconhecido) {
        setEndereco((atual) => atual.trim() ? atual : enderecoReconhecido);
        setMostrarCampoEndereco(true);
      }
    } catch {
      // OCR é auxiliar: falha de rede ou navegador não bloqueia o registro.
    }
  };

  const addFotos = (files: FileList | File[] | null) => {
    if (!files) return;
    const novas: Foto[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 15 * 1024 * 1024) { setErro("Uma foto ultrapassa 15 MB. Escolha uma imagem menor."); return; }
      novas.push({ id: crypto.randomUUID(), dataHora: new Date().toISOString(), url: URL.createObjectURL(file), file });
    });
    if (novas.length) {
      setFotos((v) => [...v, ...novas]);
      setErro("");
      if (!endereco.trim()) {
        setOcrProcessando(true);
        void (async () => {
          try {
            for (const foto of novas) {
              if (foto.file) await reconhecerTexto(foto.file);
              if (endereco.trim()) break;
            }
          } finally {
            setOcrProcessando(false);
          }
        })();
      }
    }
  };

  const iniciarCamera = async () => {
    setErro("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não permite abrir a câmera diretamente.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamCameraRef.current = stream;
      setCameraAberta(true);
      window.setTimeout(() => {
        if (videoCameraRef.current) {
          videoCameraRef.current.srcObject = stream;
          void videoCameraRef.current.play().catch(() => undefined);
        }
      }, 80);
    } catch {
      setErro("Não foi possível abrir a câmera nesta sessão. Use “Selecionar fotos” para capturar pela câmera do dispositivo.");
    }
  };

  useEffect(() => {
    if (!cameraAberta || !streamCameraRef.current || !videoCameraRef.current) return;
    videoCameraRef.current.srcObject = streamCameraRef.current;
    void videoCameraRef.current.play().catch(() => undefined);
  }, [cameraAberta]);

  const encerrarCamera = () => {
    streamCameraRef.current?.getTracks().forEach((track) => track.stop());
    streamCameraRef.current = null;
    setCameraAberta(false);
  };

  const capturarFotoCamera = () => {
    const video = videoCameraRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setErro("A câmera ainda está iniciando. Tente novamente em instantes.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return setErro("Não foi possível capturar a imagem.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setErro("Não foi possível preparar a foto.");
      const file = new File([blob], "entrega-" + Date.now() + ".jpg", { type: "image/jpeg" });
      if (file.size > 15 * 1024 * 1024) return setErro("A foto ultrapassa 15 MB.");
      setFotosRascunho((v) => [...v, { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }]);
      setErro("");
    }, "image/jpeg", 0.92);
  };

  const usarFotosCamera = () => {
    const arquivos = fotosRascunho.map((f) => f.file);
    encerrarCamera();
    if (arquivos.length) addFotos(arquivos);
    fotosRascunho.forEach((f) => URL.revokeObjectURL(f.url));
    setFotosRascunho([]);
  };

  const salvar = async () => {
    if (!db || !usuario || !lista || pacote === null) return;
    if (tipoRegistro === "entregue" && !nome.trim()) return setErro("Informe quem recebeu a entrega.");
    if (tipoRegistro === "entregue" && !fotos.length) return setErro("Adicione pelo menos uma foto da entrega.");
    if (tipoRegistro === "sem_sucesso" && motivo === "Outro motivo" && !observacao.trim()) return setErro("Descreva o motivo da tentativa sem sucesso.");
    const atual = lista.pacotes.find((p) => p.numero === pacote);
    if (!atual?.id || atual.status !== "pendente") return setErro("Este pacote não está mais pendente.");
    // Bloqueia duplo toque no celular antes que o estado React seja atualizado.
    if (salvandoRegistroRef.current) return;
    salvandoRegistroRef.current = true;
    setSalvando(true);
    setErro("");
    const arquivosEnviados: string[] = [];
    const fotosInseridas: string[] = [];
    let registroConcluido = false;
    let resultadoDoBancoIncerto = false;
    const tentativaEm = new Date().toISOString();
    const arquivosNovos = fotos.filter((f) => !!f.file);
    try {
      // Limita a concorrência a 3 fotos para não sobrecarregar celulares ou conexões lentas.
      for (let i = 0; i < arquivosNovos.length; i += 3) {
        const lote = arquivosNovos.slice(i, i + 3);
        const resultados = await Promise.allSettled(lote.map(async (f, indice) => {
          const arquivo = f.file!;
          const ext = arquivo.type.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
          const path = usuario + "/" + lista.id + "/pacote-" + pacote + "-" + crypto.randomUUID() + "-" + (i + indice) + "." + ext;
          const { error: erroUpload } = await db.storage.from("fotos-entregas").upload(path, arquivo, { contentType: arquivo.type, upsert: false });
          if (erroUpload) throw erroUpload;
          return { path, captured_at: f.dataHora, pacote_id: atual.id };
        }));
        for (const resultado of resultados) {
          if (resultado.status === "fulfilled") arquivosEnviados.push(resultado.value.path);
        }
        const falha = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
        if (falha) throw falha.reason;
      }

      // Grava os metadados de todas as fotos em uma única operação.
      if (arquivosEnviados.length) {
        const metadados = arquivosNovos.map((f, i) => ({
          pacote_id: atual.id,
          storage_path: arquivosEnviados[i],
          captured_at: f.dataHora,
        }));
        const { data: linhasFotos, error: erroFotos } = await db.from("fotos_entrega").insert(metadados).select("id");
        if (erroFotos) throw erroFotos;
        if (!linhasFotos || linhasFotos.length !== metadados.length) throw new Error("Nem todas as fotos foram confirmadas pelo banco de dados.");
        fotosInseridas.push(...linhasFotos.map((f) => f.id));
      }

      const statusFinal = tipoRegistro === "sem_sucesso" ? "sem_sucesso" : "registrado";
      const patch = {
        nome_recebedor: tipoRegistro === "entregue" ? nome.trim() : null,
        nome_destinatario: destinatario.trim() || null,
        endereco: endereco.trim() || null,
        parada_rota: paradaRota.trim() || null,
        data_entrega: data || null,
        hora_entrega: hora || null,
        status: statusFinal,
        registrado_por: usuario,
        motivo_insucesso: tipoRegistro === "sem_sucesso" ? motivo : null,
        observacao_insucesso: tipoRegistro === "sem_sucesso" ? (observacao.trim() || null) : null,
        tentativa_em: tentativaEm,
      };
      const { data: atualizado, error: erroAtualizacao } = await db.from("pacotes")
        .update(patch).eq("id", atual.id).eq("status", "pendente").select("id").maybeSingle();

      if (erroAtualizacao || !atualizado) {
        // Uma queda de conexão pode ocorrer depois de o servidor efetivar o UPDATE.
        // Confere o estado real antes de apagar fotos ou orientar uma nova tentativa.
        const { data: estado, error: erroVerificacao } = await db.from("pacotes")
          .select("id,status,registrado_por,tentativa_em").eq("id", atual.id).maybeSingle();
        if (erroVerificacao) {
          resultadoDoBancoIncerto = true;
          throw new Error("A conexão caiu antes de confirmar o resultado. Atualize a lista quando a conexão voltar antes de tentar novamente.");
        }
        const mesmaOperacao = estado?.status === statusFinal
          && estado?.registrado_por === usuario
          && !!estado?.tentativa_em
          && Math.abs(Date.parse(estado.tentativa_em) - Date.parse(tentativaEm)) < 2000;
        if (mesmaOperacao) {
          registroConcluido = true;
        } else {
          throw erroAtualizacao || new Error("O pacote já foi alterado em outro aparelho ou não está mais pendente. Atualize a lista antes de tentar novamente.");
        }
      } else {
        registroConcluido = true;
      }

      fotos.forEach((f) => { if (f.file) URL.revokeObjectURL(f.url); });
      setPacote(null); setFotos([]); setNome(""); setDestinatario(""); setEndereco(""); setParadaRota(""); setObservacao(""); setTextoOCR("");
      await atualizar(lista.id);
    } catch (e: any) {
      if (!registroConcluido && !resultadoDoBancoIncerto) {
        if (fotosInseridas.length) {
          const { error: erroLimpezaBanco } = await db.from("fotos_entrega").delete().in("id", fotosInseridas);
          if (erroLimpezaBanco) console.error("Falha ao limpar metadados de fotos após erro:", erroLimpezaBanco.message);
        }
        if (arquivosEnviados.length) {
          const { error: erroLimpezaStorage } = await db.storage.from("fotos-entregas").remove(arquivosEnviados);
          if (erroLimpezaStorage) console.error("Falha ao limpar arquivos após erro:", erroLimpezaStorage.message);
        }
      }
      setErro(registroConcluido
        ? "A entrega foi salva no servidor, mas a lista não atualizou. Atualize a lista. Motivo: " + (e?.message || "erro desconhecido")
        : resultadoDoBancoIncerto
          ? "Não foi possível confirmar se a entrega foi salva. Atualize a lista quando a conexão voltar antes de tentar novamente. " + (e?.message || "")
          : "Não foi possível salvar a entrega: " + (e?.message || "erro desconhecido") + ". Verifique a conexão e tente novamente.");
    } finally {
      salvandoRegistroRef.current = false;
      setSalvando(false);
    }
  };

  const confirmar = async () => {
    if (!db || !lista || !detalhe?.id || detalhe.status !== "registrado") return;
    setSalvando(true);
    try {
      const quantidade = Number(quantidadeConferida);\n      if (!Number.isInteger(quantidade) || quantidade < 1) { setErro("Informe quantos pacotes foram entregues nesta parada (mínimo 1)."); setSalvando(false); return; }\n      const { error } = await db.from("pacotes").update({ status: "conferido", conferido_em: new Date().toISOString(), quantidade_conferida: quantidade }).eq("id", detalhe.id).eq("status", "registrado");
      if (error) throw error;
      await atualizar(lista.id); setDetalheId(null); setQuantidadeConferida("1"); setAba("conferidos");
    } catch (e: any) { setErro("Não foi possível confirmar: " + e.message); }
    finally { setSalvando(false); }
  };

  const salvarPreferenciasVisuais = async () => {
    if (!usuario || !db) return;
    setSalvandoPreferencias(true);
    setErroPersonalizacao("");
    try {
      const configuracao = { cor: coresUsuario[usuario], fonte: fontesUsuario[usuario] };
      const { error } = await db.storage.from("fotos-entregas").upload(
        usuario + "/profile/preferences.json",
        new Blob([JSON.stringify(configuracao)], { type: "application/json" }),
        { contentType: "application/json", upsert: true },
      );
      if (error) throw error;
      setConfiguracaoVisualAberta(false);
    } catch (e: any) {
      setErroPersonalizacao("Não foi possível salvar as preferências no servidor: " + (e?.message || "erro desconhecido"));
    } finally {
      setSalvandoPreferencias(false);
    }
  };

  const selecionarFotoPerfil = (u: Usuario, arquivo?: File) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setErroPersonalizacao("Escolha um arquivo de imagem.");
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErroPersonalizacao("A foto de perfil deve ter no máximo 5 MB.");
      return;
    }
    setErroPersonalizacao("");
    setFotoPerfilPendente({ usuario: u, arquivo, previa: URL.createObjectURL(arquivo) });
  };

  const confirmarFotoPerfil = async () => {
    if (!fotoPerfilPendente) return;
    setSalvandoFotoPerfil(true);
    setErroPersonalizacao("");
    try {
      const { usuario: u, arquivo } = fotoPerfilPendente;
      const cliente = criarSupabaseParaUsuario(u);
      const { error } = await cliente.storage.from("fotos-entregas").upload(
        u + "/profile/avatar",
        arquivo,
        { contentType: arquivo.type, upsert: true },
      );
      if (error) throw error;
      const { data, error: urlError } = await cliente.storage.from("fotos-entregas").createSignedUrl(u + "/profile/avatar", 604800);
      if (urlError || !data?.signedUrl) throw urlError || new Error("A foto foi enviada, mas não foi possível gerar a visualização.");
      setFotosPerfil((v) => ({ ...v, [u]: data.signedUrl }));
      URL.revokeObjectURL(fotoPerfilPendente.previa);
      setFotoPerfilPendente(null);
    } catch (e: any) {
      setErroPersonalizacao("Não foi possível salvar a foto de perfil: " + (e?.message || "erro desconhecido"));
    } finally {
      setSalvandoFotoPerfil(false);
    }
  };

  const limparFiltros = () => {
    setFiltroCliente(""); setFiltroEndereco(""); setFiltroParada(""); setFiltroDataInicio(""); setFiltroDataFim("");
    setFiltroEntregaInicio(""); setFiltroEntregaFim(""); setFiltroStatus(""); setFiltroMotivo(""); setMostrarResultados(false);
  };

  if (!usuario) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
    <section className="w-full max-w-md">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl">✓</div><h1 className="text-2xl font-bold">Gestão de Entregas</h1><p className="mt-2 text-sm text-slate-400">Selecione seu usuário para continuar</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{(["Daniel", "Rafael"] as Usuario[]).map((u) => <div key={u} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center">
        <button onClick={() => { limparFiltros(); setUsuario(u); }} className="w-full rounded-xl p-2 text-lg font-semibold transition hover:bg-slate-800">
          {fotosPerfil[u] ? <img src={fotosPerfil[u]!} alt={"Foto de " + u} className="mx-auto mb-3 h-20 w-20 rounded-full border-2 border-slate-600 object-cover" /> : <span className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-800 text-2xl">{u.slice(0,1)}</span>}
          {u}<span className="mt-2 block text-xs font-normal text-slate-400">Acessar painel →</span>
        </button>
        <label className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Escolher foto
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { selecionarFotoPerfil(u, e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
      </div>)}</div>
      {erroPersonalizacao && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{erroPersonalizacao}</p>}
    </section>
    {fotoPerfilPendente && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"><section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center"><h2 className="text-lg font-bold">Confirmar foto de {fotoPerfilPendente.usuario}</h2><img src={fotoPerfilPendente.previa} alt="Prévia da nova foto de perfil" className="mx-auto my-4 h-32 w-32 rounded-full object-cover" /><p className="text-sm text-slate-300">A foto atual só será substituída depois da confirmação.</p>{erroPersonalizacao && <p role="alert" className="mt-3 text-sm text-red-300">{erroPersonalizacao}</p>}<div className="mt-5 flex gap-3"><button disabled={salvandoFotoPerfil} onClick={() => { URL.revokeObjectURL(fotoPerfilPendente.previa); setFotoPerfilPendente(null); setErroPersonalizacao(""); }} className="flex-1 rounded-xl border border-slate-700 p-3">Cancelar</button><button disabled={salvandoFotoPerfil} onClick={confirmarFotoPerfil} className="flex-1 rounded-xl bg-emerald-600 p-3 font-semibold disabled:opacity-50">{salvandoFotoPerfil ? "Salvando..." : "Confirmar foto"}</button></div></section></div>}
  </main>;

  const corAtiva = modoAparencia === "claro" ? coresClarasUsuario[usuario] : coresUsuario[usuario];
  const alterarCorAtiva = (cor: string) => {
    if (modoAparencia === "claro") setCoresClarasUsuario((v) => ({ ...v, [usuario]: cor }));
    else setCoresUsuario((v) => ({ ...v, [usuario]: cor }));
  };
  const corTextoAtiva = luminanciaHex(corAtiva) > 0.42 ? "#020617" : "#ffffff";
  const fonteAtiva = fontesUsuario[usuario];

  return <main data-user-theme={usuario} style={{ "--user-accent": corAtiva, "--user-accent-foreground": corTextoAtiva, "--user-font": fonteAtiva } as React.CSSProperties} className={"user-themed min-h-screen " + (modoAparencia === "claro" ? "light-mode bg-white text-slate-900" : "dark-mode bg-black text-white")}>
    <header className="user-theme-header border-b border-slate-800 bg-slate-900 px-4 py-3"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><h1 className="text-xl font-bold">Gestão de Entregas</h1><p className="text-sm text-slate-300">Painel de {usuario}</p></div><div className="flex items-center gap-2"><button aria-label="Personalizar aparência" title="Personalizar aparência" onClick={() => { setCorPersonalizada(corAtiva); setConfiguracaoVisualAberta(true); }} className="rounded-lg border border-slate-600 bg-slate-950/40 px-3 py-2 text-sm transition hover:bg-slate-800">🎨 <span className="hidden sm:inline">Aparência</span></button><button onClick={() => { limparFiltros(); setConfiguracaoVisualAberta(false); setUsuario(null); setListas([]); setListaId(null); setPacote(null); setDetalheId(null); setFiltroAberto(false); setMostrarResultados(false); setErro(""); }} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Trocar usuário</button></div></div></header>
    <div className="mx-auto max-w-6xl px-4 py-5">
      {erro && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">{erro}</div>}
      {carregando && <p className="mb-4 text-sm text-slate-400">Carregando registros de {usuario}...</p>}
      {usuario && <p role="status" aria-live="polite" className={"mb-4 text-xs " + (syncStatus === "online" ? "text-emerald-400" : syncStatus === "offline" ? "text-amber-300" : "text-slate-400")}>{syncStatus === "online" ? "● Sincronização em tempo real conectada" : syncStatus === "offline" ? "● Conexão em tempo real indisponível; alterações podem demorar para aparecer" : "● Conectando à sincronização em tempo real..."}</p>}
      {!carregando && !lista && !mostrarResultados && <section>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Resumo por dia</h2><p className="text-sm text-slate-400">Selecione uma data para ver os pacotes.</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-slate-400">Filtrar por período:</span><select aria-label="Tipo de período" value={filtroPeriodoTipo} onChange={(e) => { setFiltroPeriodoTipo(e.target.value as "todos" | "data" | "mes" | "ano"); setFiltroPeriodoValor(""); }} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"><option value="todos">Todos</option><option value="data">Data</option><option value="mes">Mês</option><option value="ano">Ano</option></select>{filtroPeriodoTipo === "data" && <input aria-label="Selecionar data" type="date" value={filtroPeriodoValor} onChange={(e) => setFiltroPeriodoValor(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}{filtroPeriodoTipo === "mes" && <input aria-label="Selecionar mês" type="month" value={filtroPeriodoValor} onChange={(e) => setFiltroPeriodoValor(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}{filtroPeriodoTipo === "ano" && <input aria-label="Selecionar ano" type="number" min="2000" max="2100" inputMode="numeric" placeholder="2026" value={filtroPeriodoValor} onChange={(e) => setFiltroPeriodoValor(e.target.value.slice(0, 4))} className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />}{filtroPeriodoTipo !== "todos" && filtroPeriodoValor && <button onClick={() => setFiltroPeriodoValor("")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Limpar</button>}</div></div><div className="flex gap-2"><button onClick={() => setFiltroAberto(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><span aria-hidden="true">⏷</span> Filtro</button><button onClick={() => setNova(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">＋ Nova lista</button></div></div>
        {listasVisiveis.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><p className="text-slate-300">{listas.length === 0 ? `Ainda não há listas registradas para ${usuario}.` : "Nenhuma lista encontrada nesse período."}</p><button onClick={() => setNova(true)} className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 font-semibold">Criar primeira lista</button></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{listasVisiveis.map((l) => { const pacotesConferidosDia = l.pacotes.filter((p) => p.status === "conferido").reduce((total, p) => total + (p.quantidadeConferida || 0), 0); const valorDia = pacotesConferidosDia * 3; const semSucessoDia = l.pacotes.filter((p) => p.status === "sem_sucesso").length; const pendentesDia = l.pacotes.filter((p) => p.status === "pendente").length; return <article key={l.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-emerald-500"><div className="flex items-center justify-between gap-2"><button onClick={() => { setListaId(l.id); setDetalheId(null); setPacote(null); }} className="min-w-0 flex-1 text-left"><h3 className="text-lg font-semibold">{dataBR(l.data)}</h3><span className="text-xs text-emerald-400">Ver dia →</span></button><button disabled={!!excluindoListaId} onClick={() => void excluirLista(l)} className="shrink-0 rounded-lg border border-red-900 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60">{excluindoListaId === l.id ? "Excluindo..." : "Excluir lista"}</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Pacotes</p><b>{l.quantidade}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Paradas conferidas</p><b>{l.pacotes.filter((p) => p.status === "conferido").length}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Pacotes entregues</p><b>{pacotesConferidosDia}</b></div><div className="rounded-lg bg-emerald-950 p-2 col-span-2"><p className="text-emerald-300">Valor confirmado</p><b className="text-emerald-200">R$ {valorDia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><p className="text-xs text-emerald-300/80">Pacotes conferidos × R$ 3,00</p></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Pendentes</p><b>{pendentesDia}</b></div><div className="rounded-lg bg-slate-800 p-2"><p className="text-slate-400">Sem sucesso</p><b>{semSucessoDia}</b></div></div></article>; })}</div>}
      </section>}

      {mostrarResultados && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Resultados do filtro</h2><p className="text-sm text-slate-400">{resultadosPesquisa.length} registro(s) encontrado(s) para {usuario}</p></div><button onClick={() => setMostrarResultados(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Voltar à lista</button></div>{resultadosPesquisa.length === 0 ? <div className="rounded-xl bg-slate-900 p-5 text-sm text-slate-400">Nenhum registro corresponde aos filtros selecionados.</div> : <div className="grid gap-3 md:grid-cols-2">{resultadosPesquisa.map(({ lista: lr, pacote: p }) => <article key={lr.id + ":" + p.numero} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">{p.fotos[0]?.url ? <img src={p.fotos[0].url} alt="Foto do pacote" className="h-20 w-20 shrink-0 rounded-lg object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">Sem foto</div>}<div className="min-w-0 flex-1"><p className="font-semibold">Pacote {p.numero} · {p.destinatario || p.nome || "Sem nome"}</p><p className="text-sm text-slate-300">{p.endereco || "Endereço não informado"}</p><p className="mt-1 text-xs text-slate-400">Lista: {dataBR(lr.data)} · Entrega: {dataBR(p.dataEntrega)} · Parada: {p.paradaRota || "—"}</p><p className="text-xs text-slate-400">Status: {textoStatus(p.status)}{p.motivoInsucesso ? " · " + p.motivoInsucesso : ""}</p><button onClick={() => { setListaId(lr.id); setDetalheId(p.numero); setMostrarResultados(false); }} className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm">Ver registro</button></div></article>)}</div>}</section>}

      {lista && !mostrarResultados && detalheId === null && pacote === null && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><button onClick={() => setListaId(null)} className="mb-2 text-sm text-emerald-400">← Voltar às datas</button><h2 className="text-xl font-semibold">Registros de {dataBR(lista.data)}</h2><p className="text-sm text-slate-400">{lista.quantidade} pacotes · {entregues.length} entregues · {pendentes.length} pendentes · {insucessos.length} insucessos · {conferidos.length} conferidos</p></div><div className="flex gap-2"><button onClick={() => setFiltroAberto(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">⏷ Filtro</button><button onClick={() => setNova(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">＋ Nova lista</button></div></div><div className="mb-4 flex flex-wrap gap-2">{([{id:"pendentes",label:"Pendente",n:pendentes.length},{id:"entregues",label:"Entregue",n:entregues.length},{id:"insucessos",label:"Insucesso",n:insucessos.length},{id:"conferidos",label:"Conferido",n:conferidos.length}] as const).map((x) => <button key={x.id} onClick={() => setAba(x.id)} className={"rounded-lg px-3 py-2 text-sm " + (aba === x.id ? "bg-emerald-600" : "bg-slate-800")}>{x.label} ({x.n})</button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba === "pendentes" ? pendentes : aba === "entregues" ? entregues : aba === "insucessos" ? insucessos : conferidos).map((p) => <button key={p.id ?? p.numero} onClick={() => p.status === "pendente" ? abrirPacote(p.numero) : setDetalheId(p.numero)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-left hover:border-emerald-500"><b>Pacote {p.numero}</b><p className="mt-1 truncate text-sm text-slate-300">{p.destinatario || p.nome || "Sem nome"}</p><p className="mt-2 text-xs text-slate-400">{textoStatus(p.status)}</p>{p.motivoInsucesso && <p className="mt-1 text-xs text-amber-300">{p.motivoInsucesso}</p>}<p className="mt-1 text-xs text-slate-500">{p.fotos.length} foto(s)</p></button>)}</div></section>}

      {lista && detalheId !== null && detalhe && !mostrarResultados && <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><button onClick={() => setDetalheId(null)} className="mb-4 rounded-lg border border-slate-700 px-3 py-2 text-sm">← Voltar à lista</button>{(detalhe.status === "conferido" || detalhe.status === "registrado") ? <>{aba === "conferidos" && indiceDetalheConferido >= 0 && <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={() => pacoteConferidoAnterior && setDetalheId(pacoteConferidoAnterior.numero)} disabled={!pacoteConferidoAnterior} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">← Voltar</button><span className="text-sm text-slate-300">Pacote {indiceDetalheConferido + 1} de {conferidos.length}</span><button type="button" onClick={() => pacoteConferidoProximo && setDetalheId(pacoteConferidoProximo.numero)} disabled={!pacoteConferidoProximo} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">Próximo →</button></div>}<div className="grid gap-3 rounded-xl bg-slate-950/50 p-4"><div><small className="text-slate-400">Pessoa que recebeu</small><p>{detalhe.nome || "Não informado"}</p></div><div><small className="text-slate-400">Data e horário da entrega</small><p>{detalhe.dataEntrega ? dataBR(detalhe.dataEntrega) + (detalhe.horaEntrega ? " às " + detalhe.horaEntrega : "") : "Não informado"}</p></div><div><small className="text-slate-400">Data e horário da conferência</small><p>{detalhe.conferidoEm ? new Date(detalhe.conferidoEm).toLocaleString("pt-BR") : "Ainda não conferido"}</p></div><div><small className="text-slate-400">Status</small><p>{textoStatus(detalhe.status)}</p></div>{detalhe.status === "conferido" && <div><small className="text-slate-400">Pacotes confirmados</small><p>{detalhe.quantidadeConferida} × R$ 3,00 = R$ {(detalhe.quantidadeConferida * 3).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>}</div>{detalhe.status === "registrado" && <div className="mt-5 space-y-3"><label className="block text-sm font-medium" htmlFor="quantidade-conferida">Quantos pacotes foram entregues nesta parada?</label><input id="quantidade-conferida" type="number" min="1" step="1" inputMode="numeric" value={quantidadeConferida} onChange={(e) => setQuantidadeConferida(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /><p className="text-sm text-slate-300">Valor desta parada: <b>R$ {(Math.max(0, Number(quantidadeConferida) || 0) * 3).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> (R$ 3,00 por pacote)</p><button disabled={salvando} onClick={confirmar} className="w-full rounded-xl bg-emerald-600 p-3 font-semibold disabled:opacity-50">{salvando ? "Salvando..." : "Confirmar quantidade e entrega"}</button></div>}</> : <><p className="text-sm text-slate-400">Detalhes do registro</p><h2 className="mb-4 text-2xl font-bold">Pacote {detalhe.numero}</h2><div className="grid gap-3 rounded-xl bg-slate-950/50 p-4 sm:grid-cols-2"><div><small className="text-slate-400">Status</small><p>{textoStatus(detalhe.status)}</p></div><div><small className="text-slate-400">Destinatário</small><p>{detalhe.destinatario || "Não informado"}</p></div><div><small className="text-slate-400">Endereço</small><p>{detalhe.endereco || "Não informado"}</p></div><div><small className="text-slate-400">Quem recebeu</small><p>{detalhe.nome || "Não informado"}</p></div><div><small className="text-slate-400">Parada/rota</small><p>{detalhe.paradaRota || "Não informada"}</p></div><div><small className="text-slate-400">Data da lista</small><p>{dataBR(lista.data)}</p></div><div><small className="text-slate-400">Data da tentativa/entrega</small><p>{dataBR(detalhe.dataEntrega)} {detalhe.horaEntrega}</p></div>{detalhe.tentativaEm && <div><small className="text-slate-400">Tentativa registrada em</small><p>{new Date(detalhe.tentativaEm).toLocaleString("pt-BR")}</p></div>}{detalhe.motivoInsucesso && <div><small className="text-slate-400">Motivo do insucesso</small><p>{detalhe.motivoInsucesso}</p></div>}{detalhe.observacaoInsucesso && <div className="sm:col-span-2"><small className="text-slate-400">Observação</small><p>{detalhe.observacaoInsucesso}</p></div>}</div><h3 className="mb-3 mt-6 font-semibold">Fotos ({detalhe.fotos.length})</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{detalhe.fotos.map((f, i) => <button key={f.id} onClick={() => setZoom({fotos:detalhe.fotos,i})} className="overflow-hidden rounded-xl border border-slate-700 text-left">{f.url ? <img src={f.url} alt="Foto da entrega" className="h-36 w-full object-cover" /> : <div className="p-8 text-xs text-slate-400">Foto indisponível</div>}<p className="p-2 text-xs">{new Date(f.dataHora).toLocaleString("pt-BR")}</p></button>)}</div></>}</section>}

      {lista && pacote !== null && !mostrarResultados && <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Registrar pacote {pacote}</h2><button disabled={salvando} onClick={() => setPacote(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">← Voltar</button></div><div className="mb-4 grid grid-cols-2 gap-2"><button onClick={() => setTipoRegistro("entregue")} className={"rounded-lg p-3 text-sm font-semibold " + (tipoRegistro === "entregue" ? "bg-emerald-600" : "bg-slate-800")}>✓ Entregue</button><button onClick={() => setTipoRegistro("sem_sucesso")} className={"rounded-lg p-3 text-sm font-semibold " + (tipoRegistro === "sem_sucesso" ? "bg-amber-700" : "bg-slate-800")}>! Sem sucesso</button></div><label className="block text-sm">Nome de quem recebeu {tipoRegistro === "entregue" ? "(obrigatório)" : "(se disponível)"}<input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label>{(mostrarCampoEndereco || endereco.trim()) ? <label className="mt-3 block text-sm">Endereço identificado — confira e corrija se necessário<input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Confira o endereço reconhecido" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label> : <button type="button" onClick={() => setMostrarCampoEndereco(true)} className="mt-3 text-sm text-emerald-400 underline">Não foi possível identificar o endereço? Inserir manualmente</button>}<div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Data da tentativa/entrega<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Horário<input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label></div>{tipoRegistro === "sem_sucesso" && <div className="mt-4 rounded-xl border border-amber-900/70 bg-amber-950/30 p-3"><label className="block text-sm">Motivo da tentativa sem sucesso<select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3">{(["Destinatário ausente","Endereço não localizado","Imóvel não encontrado","Destinatário não localizado","Outro motivo"] as Motivo[]).map((m) => <option key={m}>{m}</option>)}</select></label>{motivo === "Outro motivo" && <label className="mt-3 block text-sm">Descreva o motivo<textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label>}<p className="mt-2 text-xs text-slate-400">Data e hora da tentativa serão salvas automaticamente junto com o motivo.</p></div>}<div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>Fotos</b><p className="text-xs text-slate-400">{tipoRegistro === "entregue" ? "Obrigatória para confirmar a entrega." : "Opcional para registrar o insucesso."}</p></div><button type="button" onClick={() => void iniciarCamera()} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">📷 Abrir câmera</button></div><label className="mt-3 inline-block cursor-pointer text-sm text-emerald-400">Selecionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFotos(e.target.files); e.currentTarget.value = ""; }} /></label><p className="mt-3 text-xs text-slate-400">{ocrProcessando ? "Tentando identificar o endereço pela foto…" : "O aplicativo tentará reconhecer automaticamente o endereço nas fotos."}</p>{textoOCR && <details className="mt-3 rounded-lg bg-slate-800 p-3"><summary className="cursor-pointer text-sm">Texto identificado — confira</summary><pre className="mt-2 whitespace-pre-wrap text-xs">{textoOCR}</pre></details>}{fotos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{fotos.map((f) => <div key={f.id} className="relative"><img src={f.url} alt="Prévia da foto" className="h-24 w-full rounded-lg object-cover" /><button onClick={() => setFotos((atual) => atual.filter((x) => x.id !== f.id))} className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs">×</button></div>)}</div>}</div>{cameraAberta && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3"><section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Capturar fotos</h3><button type="button" onClick={encerrarCamera} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Fechar câmera</button></div><video ref={videoCameraRef} autoPlay playsInline muted className="max-h-[52vh] w-full rounded-xl bg-black object-contain" /><div className="mt-3 flex gap-2"><button type="button" onClick={capturarFotoCamera} className="flex-1 rounded-xl bg-emerald-600 p-3 font-bold">Tirar foto</button><button type="button" disabled={!fotosRascunho.length} onClick={usarFotosCamera} className="flex-1 rounded-xl border border-emerald-600 p-3 font-bold disabled:opacity-40">Usar fotos ({fotosRascunho.length})</button></div><p className="mt-2 text-xs text-slate-400">Você pode capturar várias imagens sem fechar a câmera. Revise abaixo e confirme para anexá-las.</p>{fotosRascunho.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{fotosRascunho.map((f) => <div key={f.id} className="relative"><img src={f.url} alt="Foto capturada" className="h-24 w-full rounded-lg object-cover" /><button type="button" onClick={() => { setFotosRascunho((v) => v.filter((x) => x.id !== f.id)); URL.revokeObjectURL(f.url); }} className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs">Remover</button></div>)}</div>}</section></div>}<button disabled={salvando || !db} onClick={salvar} className="mt-4 w-full rounded-xl bg-emerald-600 p-4 font-bold disabled:opacity-50">{salvando ? "Salvando..." : tipoRegistro === "entregue" ? "Salvar entrega" : "Registrar insucesso"}</button></section>}
    </div>


    {configuracaoVisualAberta && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="aparencia-titulo" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--user-accent)" }}>Preferências deste painel</p><h2 id="aparencia-titulo" className="mt-1 text-xl font-bold">Personalizar aparência</h2><p className="mt-1 text-sm text-slate-400">As cores ficam salvas separadamente para {usuario}.</p></div><button onClick={() => setConfiguracaoVisualAberta(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Fechar</button></div><div className="mb-5 flex gap-2"><button type="button" onClick={() => setModoAparencia("claro")} aria-pressed={modoAparencia === "claro"} className={"flex-1 rounded-xl border p-3 font-semibold " + (modoAparencia === "claro" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-700 bg-slate-800 text-white")}>☀️ Modo claro</button><button type="button" onClick={() => setModoAparencia("escuro")} aria-pressed={modoAparencia === "escuro"} className={"flex-1 rounded-xl border p-3 font-semibold " + (modoAparencia === "escuro" ? "border-white bg-black text-white" : "border-slate-700 bg-slate-800 text-white")}>🌙 Modo escuro</button></div><div className="mb-5 rounded-xl border border-slate-700 bg-slate-950 p-4"><p className="mb-3 text-sm font-semibold">Cor dos detalhes — modo {modoAparencia === "claro" ? "claro" : "escuro"}</p><div className="mb-4 flex flex-wrap items-center gap-3"><span className="h-10 w-10 rounded-xl border border-white/20 shadow-inner" style={{ backgroundColor: corAtiva }} /><div><p className="font-medium">{corAtiva.toUpperCase()}</p><p className="text-xs text-slate-400">Prévia aplicada ao painel de {usuario}</p></div><button onClick={() => alterarCorAtiva(modoAparencia === "claro" ? "#2563eb" : (usuario === "Daniel" ? "#10b981" : "#3b82f6"))} className="ml-auto rounded-lg border border-slate-700 px-3 py-2 text-xs">Restaurar padrão</button></div><label className="mb-2 block text-sm text-slate-300">Código HEX personalizado</label><div className="mb-5 flex gap-2"><input value={corPersonalizada} onChange={(e) => setCorPersonalizada(e.target.value)} maxLength={7} placeholder="#10B981" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono uppercase" /><button onClick={() => { if (/^#[0-9a-fA-F]{6}$/.test(corPersonalizada)) alterarCorAtiva(corPersonalizada.toLowerCase()); }} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--user-accent)", color: "var(--user-accent-foreground)" }}>Aplicar HEX</button></div>{PALETA_CORES.map((grupo) => <div key={grupo.nome} className="mb-4"><p className="mb-2 text-xs font-medium text-slate-400">{grupo.nome}</p><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{grupo.tons.map((tom) => <button key={tom} type="button" title={tom.toUpperCase()} aria-label={grupo.nome + " " + tom} aria-pressed={corAtiva.toLowerCase() === tom.toLowerCase()} onClick={() => { alterarCorAtiva(tom); setCorPersonalizada(tom); }} className={"h-9 w-full rounded-lg border transition hover:scale-105 " + (corAtiva.toLowerCase() === tom.toLowerCase() ? "border-white ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "border-white/15")} style={{ backgroundColor: tom }} />)}</div></div>)}</div><div className="rounded-xl border border-slate-700 p-4"><h3 className="font-semibold">Tipografia de {usuario}</h3><p className="mt-1 text-sm text-slate-400">Esta escolha é independente e fica salva somente neste painel.</p><label htmlFor="fonte-painel" className="mt-3 mb-2 block text-sm text-slate-300">Fonte do aplicativo</label><select id="fonte-painel" value={fonteAtiva} onChange={(e) => setFontesUsuario((v) => ({ ...v, [usuario]: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"><option value="Poppins">Poppins</option><option value="Inter">Inter</option><option value="Roboto">Roboto</option><option value="Nunito Sans">Nunito Sans</option><option value="Lato">Lato</option><option value="Open Sans">Open Sans</option></select><div className="mt-3 rounded-lg bg-slate-800 p-3"><p style={{ fontFamily: fonteAtiva }} className="text-lg font-semibold">Prévia da fonte {fonteAtiva}</p><p style={{ fontFamily: fonteAtiva }} className="mt-1 text-sm text-slate-300">Entregas, endereços e registros — 12345</p></div></div>{erroPersonalizacao && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{erroPersonalizacao}</p>}<div className="mt-5 flex gap-3"><button disabled={salvandoPreferencias} onClick={() => { setConfiguracaoVisualAberta(false); setErroPersonalizacao(""); }} className="flex-1 rounded-xl border border-slate-700 p-3">Fechar</button><button disabled={salvandoPreferencias} onClick={salvarPreferenciasVisuais} className="flex-1 rounded-xl p-3 font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--user-accent)", color: "var(--user-accent-foreground)" }}>{salvandoPreferencias ? "Salvando..." : "Salvar alterações"}</button></div></section></div>}

    {nova && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl bg-slate-900 p-5"><h2 className="text-xl font-bold">Nova lista de baixas</h2><label className="mt-4 block text-sm">Data de referência<input type="date" value={dataLista} onChange={(e) => setDataLista(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><label className="mt-3 block text-sm">Quantidade de pacotes<input type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 p-3" /></label><div className="mt-5 flex gap-3"><button disabled={salvando} onClick={() => setNova(false)} className="flex-1 rounded-xl border border-slate-700 p-3">Cancelar</button><button disabled={salvando} onClick={criarLista} className="flex-1 rounded-xl bg-emerald-600 p-3 font-semibold">{salvando ? "Criando..." : "Criar lista"}</button></div></section></div>}

    {filtroAberto && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center"><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">⏷ Filtro</h2><p className="text-sm text-slate-400">Combine uma ou mais opções.</p></div><button onClick={() => setFiltroAberto(false)} className="rounded-lg border border-slate-700 px-3 py-2">Fechar</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Parada<input value={filtroParada} onChange={(e) => setFiltroParada(e.target.value)} placeholder="Ex.: 5" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Nome do cliente/destinatário<input value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Ex.: Luciana" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm sm:col-span-2">Endereço<input value={filtroEndereco} onChange={(e) => setFiltroEndereco(e.target.value)} placeholder="Rua, número, bairro..." className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da lista — de<input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da lista — até<input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da entrega — de<input type="date" value={filtroEntregaInicio} onChange={(e) => setFiltroEntregaInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Data da entrega — até<input type="date" value={filtroEntregaFim} onChange={(e) => setFiltroEntregaFim(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" /></label><label className="text-sm">Status<select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"><option value="">Todos</option><option value="entregue">Entregue</option><option value="pendente">Pendente</option><option value="sem_sucesso">Sem sucesso</option></select></label><label className="text-sm">Tipo de ocorrência<select value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3"><option value="">Todas</option>{(["Destinatário ausente","Endereço não localizado","Imóvel não encontrado","Destinatário não localizado","Outro motivo"] as Motivo[]).map((m) => <option key={m}>{m}</option>)}</select></label></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => { setMostrarResultados(true); setFiltroAberto(false); setListaId(null); setDetalheId(null); setPacote(null); }} className="flex-1 rounded-xl bg-emerald-600 p-3 font-semibold">Aplicar filtros</button><button onClick={limparFiltros} className="rounded-xl border border-slate-700 px-4 py-3">Limpar filtros</button></div></section></div>}

    {zoom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}><div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}><button onClick={() => setZoom((v) => v && ({ ...v, i: (v.i - 1 + v.fotos.length) % v.fotos.length }))} className="rounded-full bg-slate-800 px-4 py-3">‹</button><div className="text-center">{zoom.fotos[zoom.i]?.url ? <img src={zoom.fotos[zoom.i]!.url} alt="Foto ampliada" className="max-h-[80vh] max-w-[75vw] rounded-xl object-contain" /> : <div className="rounded-xl bg-slate-800 p-10">Imagem indisponível</div>}<p className="mt-2 text-sm">{new Date(zoom.fotos[zoom.i]!.dataHora).toLocaleString("pt-BR")}</p></div><button onClick={() => setZoom((v) => v && ({ ...v, i: (v.i + 1) % v.fotos.length }))} className="rounded-full bg-slate-800 px-4 py-3">›</button><button onClick={() => setZoom(null)} className="fixed right-5 top-5 rounded-lg bg-slate-800 px-3 py-2">Fechar</button></div></div>}
  </main>;
}
