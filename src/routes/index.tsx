import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

type Photo = {
  id: string;
  dataUrl: string;
  capturedAt: string;
};

type Delivery = {
  id: string;
  user: string;
  packageNumber: string;
  recipient: string;
  createdAt: string;
  photos: Photo[];
};

const STORAGE_KEY = "baixa-de-entregas-registros";

function readDeliveries(): Delivery[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function Index() {
  const [usuario, setUsuario] = useState<string | null>(() => localStorage.getItem("usuario"));
  const [deliveries, setDeliveries] = useState<Delivery[]>(readDeliveries);
  const [packageNumber, setPackageNumber] = useState("");
  const [recipient, setRecipient] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries));
  }, [deliveries]);

  const entrar = (nome: string) => {
    localStorage.setItem("usuario", nome);
    setUsuario(nome);
  };

  const sair = () => {
    localStorage.removeItem("usuario");
    setUsuario(null);
    setPhotos([]);
    setPackageNumber("");
    setRecipient("");
  };

  const filteredDeliveries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deliveries
      .filter((item) => item.user === usuario)
      .filter((item) => !term || item.packageNumber.toLowerCase().includes(term) || item.recipient.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [deliveries, search, usuario]);

  const handlePhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const newPhotos: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newPhotos.push({
        id: crypto.randomUUID(),
        dataUrl,
        capturedAt: new Date().toISOString(),
      });
    }
    setPhotos((current) => [...current, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const salvarEntrega = () => {
    if (!usuario || !packageNumber.trim() || !recipient.trim() || photos.length === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    const record: Delivery = {
      id: crypto.randomUUID(),
      user: usuario,
      packageNumber: packageNumber.trim(),
      recipient: recipient.trim(),
      createdAt: now,
      photos,
    };
    setDeliveries((current) => [record, ...current]);
    setPackageNumber("");
    setRecipient("");
    setPhotos([]);
    setSaving(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-bold text-emerald-500 ring-1 ring-slate-700">BE</div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Baixa de Entregas</h1>
            <p className="mt-3 text-slate-400">Escolha seu usuário para acessar o aplicativo.</p>
            <p className="mt-1 text-sm text-slate-500">Acesso rápido, sem senha.</p>
          </div>
          <div className="space-y-3">
            {["Rafael", "Rangel"].map((nome) => (
              <button key={nome} type="button" onClick={() => entrar(nome)} className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-left transition hover:border-emerald-500 hover:bg-slate-800 active:scale-[0.99]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">{nome.charAt(0)}</span>
                <span><strong className="block text-lg text-white">{nome}</strong><span className="text-sm text-slate-400">Entrar sem senha</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Baixa de Entregas</p><h1 className="text-xl font-bold sm:text-2xl">Olá, {usuario}</h1></div>
          <button type="button" onClick={sair} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Sair</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
          <div className="mb-6"><h2 className="text-xl font-bold">Registrar entrega</h2><p className="mt-1 text-sm text-slate-400">Preencha os dados e adicione quantas fotos forem necessárias.</p></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">Número do pacote
              <input value={packageNumber} onChange={(e) => setPackageNumber(e.target.value)} placeholder="Ex.: 27" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-500" />
            </label>
            <label className="text-sm font-medium text-slate-300">Nome de quem recebeu
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Nome do destinatário" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-500" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-semibold">Fotos da entrega</h3><p className="text-sm text-slate-400">{photos.length} {photos.length === 1 ? "foto adicionada" : "fotos adicionadas"}. Cada foto recebe data e horário automaticamente.</p></div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 active:scale-95">
                📷 Tirar / adicionar fotos
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void handlePhotos(e.target.files)} />
              </label>
            </div>

            {photos.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"><img src={photo.dataUrl} alt={`Foto ${index + 1} da entrega`} className="aspect-square w-full object-cover" /><div className="p-2 text-[11px] text-slate-400">Foto {index + 1}<br />{new Date(photo.capturedAt).toLocaleString("pt-BR")}</div></div>)}
            </div>}
          </div>

          <button type="button" disabled={!packageNumber.trim() || !recipient.trim() || photos.length === 0 || saving} onClick={salvarEntrega} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Salvando..." : "Salvar baixa de entrega"}</button>
          <p className="mt-3 text-center text-xs text-slate-500">É possível adicionar 1, 3 ou quantas fotos forem necessárias antes de salvar.</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
          <div className="mb-5"><h2 className="text-xl font-bold">Entregas registradas</h2><p className="mt-1 text-sm text-slate-400">Pesquise pelo número do pacote ou pelo nome de quem recebeu.</p></div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Pesquisar pacote ou destinatário" className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />

          <div className="space-y-4">
            {filteredDeliveries.length === 0 ? <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">Nenhuma entrega encontrada.</div> : filteredDeliveries.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3"><div><span className="text-xs uppercase tracking-wider text-emerald-500">Pacote</span><h3 className="text-2xl font-bold text-white">#{item.packageNumber}</h3><p className="text-sm text-slate-300">Recebido por: <strong>{item.recipient}</strong></p></div><span className="text-right text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("pt-BR")}</span></div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{item.photos.map((photo, index) => <img key={photo.id} src={photo.dataUrl} alt={`Entrega ${item.packageNumber}, foto ${index + 1}`} className="aspect-square rounded-lg object-cover" />)}</div>
                <p className="mt-3 text-xs text-slate-500">{item.photos.length} {item.photos.length === 1 ? "foto" : "fotos"} • Todas agrupadas neste registro</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-30 sm:hidden"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-bold text-white shadow-2xl shadow-emerald-950/60 active:scale-[0.98]">📷 Registrar entrega<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => void handlePhotos(e.target.files)} /></label></div>
    </main>
  );
}
