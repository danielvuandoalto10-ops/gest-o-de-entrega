// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const conferidoSwipePlugin = {
  name: "conferido-parada-swipe",
  transform(code: string, id: string) {
    if (!id.endsWith("/src/routes/index.tsx")) return null;
    const marker = `  const corAtiva = coresUsuario[usuario];`;
    const component = `
  function NavegacaoConferido({ pacotes, onAbrir }: { pacotes: Pacote[]; onAbrir: (numero: number) => void }) {
    const grupos = useMemo(() => {
      const mapa = new Map<string, Pacote[]>();
      for (const p of pacotes) {
        const chave = p.paradaRota.trim() || "Sem parada informada";
        const atual = mapa.get(chave) ?? [];
        atual.push(p);
        mapa.set(chave, atual);
      }
      return Array.from(mapa, ([nome, itens]) => ({ nome, itens }));
    }, [pacotes]);
    const [indice, setIndice] = useState(0);
    const inicioToque = useRef<number | null>(null);
    useEffect(() => { if (indice >= grupos.length) setIndice(Math.max(0, grupos.length - 1)); }, [indice, grupos.length]);
    if (!grupos.length) return <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">Nenhuma parada conferida.</div>;
    const parada = grupos[indice]!;
    const anterior = () => setIndice((v) => Math.max(0, v - 1));
    const proxima = () => setIndice((v) => Math.min(grupos.length - 1, v + 1));
    return <div>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <button onClick={anterior} disabled={indice === 0} aria-label="Parada anterior" className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-30">←</button>
        <div className="min-w-0 text-center"><p className="text-xs text-slate-400">Parada {indice + 1} de {grupos.length}</p><p className="truncate font-semibold">{parada.nome}</p></div>
        <button onClick={proxima} disabled={indice === grupos.length - 1} aria-label="Próxima parada" className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-30">→</button>
      </div>
      <div
        className="overflow-hidden touch-pan-y"
        onTouchStart={(e) => { inicioToque.current = e.changedTouches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const inicio = inicioToque.current;
          const fim = e.changedTouches[0]?.clientX ?? null;
          inicioToque.current = null;
          if (inicio === null || fim === null) return;
          const deslocamento = fim - inicio;
          if (Math.abs(deslocamento) >= 55) { if (deslocamento < 0) proxima(); else anterior(); }
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{parada.itens.map((p) => <button key={p.id ?? p.numero} onClick={() => onAbrir(p.numero)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-left hover:border-emerald-500"><b>Pacote {p.numero}</b><p className="mt-1 truncate text-sm text-slate-300">{p.destinatario || p.nome || "Sem nome"}</p><p className="mt-2 text-xs text-slate-400">{textoStatus(p.status)}</p>{p.motivoInsucesso && <p className="mt-1 text-xs text-amber-300">{p.motivoInsucesso}</p>}<p className="mt-1 text-xs text-slate-500">{p.fotos.length} foto(s)</p></button>)}</div>
      </div>
    </div>;
  }

`;
    if (!code.includes(marker)) return null;
    const withComponent = code.includes("function NavegacaoConferido") ? code : code.replace(marker, component + marker);
    const start = withComponent.indexOf('<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba === "pendentes"');
    if (start < 0) return { code: withComponent, map: null };
    const endMarker = '</div></section>}';
    const end = withComponent.indexOf(endMarker, start);
    if (end < 0) return { code: withComponent, map: null };
    const replacement = '<div>' +
      '{aba === "conferidos" ? <NavegacaoConferido pacotes={conferidos} onAbrir={(n) => setDetalheId(n)} /> : ' +
      '<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{(aba === "pendentes" ? pendentes : aba === "entregues" ? entregues : insucessos).map((p) => <button key={p.id ?? p.numero} onClick={() => p.status === "pendente" ? abrirPacote(p.numero) : setDetalheId(p.numero)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-left hover:border-emerald-500"><b>Pacote {p.numero}</b><p className="mt-1 truncate text-sm text-slate-300">{p.destinatario || p.nome || "Sem nome"}</p><p className="mt-2 text-xs text-slate-400">{textoStatus(p.status)}</p>{p.motivoInsucesso && <p className="mt-1 text-xs text-amber-300">{p.motivoInsucesso}</p>}<p className="mt-1 text-xs text-slate-500">{p.fotos.length} foto(s)</p></button>)}</div>}' +
      '</div></section>}';
    return { code: withComponent.slice(0, start) + replacement + withComponent.slice(end + endMarker.length), map: null };
  },
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: { plugins: [conferidoSwipePlugin] },
});
