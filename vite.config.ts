// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const conferidoPacoteNavegacaoPlugin = {
  name: "conferido-pacote-navegacao",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.endsWith("/src/routes/index.tsx")) return null;

    // Inject only into the existing route component. No database fields or existing
    // package data are changed; navigation only changes the selected detalheId.
    if (code.includes("__NAVEGACAO_CONFERIDO_PACOTES__")) return null;

    const stateMarker = '  const [erro, setErro] = useState("");';
    if (!code.includes(stateMarker)) return null;
    let result = code.replace(
      stateMarker,
      stateMarker + '\n  const inicioSwipeConferidoRef = useRef<number | null>(null);\n'
    );

    const derivedMarker = '  const conferidos = lista?.pacotes.filter((p) => p.status === "conferido") ?? [];';
    if (!result.includes(derivedMarker)) return null;
    result = result.replace(
      derivedMarker,
      derivedMarker + '\n  const indiceConferidoAtual = aba === "conferidos" && detalheId !== null ? conferidos.findIndex((p) => p.numero === detalheId) : -1;\n  const pacoteConferidoAnterior = indiceConferidoAtual > 0 ? conferidos[indiceConferidoAtual - 1] : null;\n  const pacoteConferidoProximo = indiceConferidoAtual >= 0 && indiceConferidoAtual < conferidos.length - 1 ? conferidos[indiceConferidoAtual + 1] : null;'
    );

    const detailMarker = '<section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5">';
    if (!result.includes(detailMarker)) return null;
    result = result.replace(
      detailMarker,
      '<section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5" data-conferido-package-navigation="__NAVEGACAO_CONFERIDO_PACOTES__" onTouchStart={(e) => { if (aba === "conferidos") inicioSwipeConferidoRef.current = e.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(e) => { if (aba !== "conferidos") return; const inicio = inicioSwipeConferidoRef.current; const fim = e.changedTouches[0]?.clientX ?? null; inicioSwipeConferidoRef.current = null; if (inicio === null || fim === null || Math.abs(fim - inicio) < 55) return; if (fim < inicio && pacoteConferidoProximo) setDetalheId(pacoteConferidoProximo.numero); if (fim > inicio && pacoteConferidoAnterior) setDetalheId(pacoteConferidoAnterior.numero); }}>'
    );

    const titleMarker = '<h2 className="mb-4 text-2xl font-bold">Pacote {detalhe.numero}</h2>';
    if (!result.includes(titleMarker)) return null;
    result = result.replace(
      titleMarker,
      '<h2 className="mb-3 text-2xl font-bold">Pacote {detalhe.numero}</h2>\n          {aba === "conferidos" && indiceConferidoAtual >= 0 && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3" aria-label="Navegação entre pacotes conferidos"><button type="button" onClick={() => pacoteConferidoAnterior && setDetalheId(pacoteConferidoAnterior.numero)} disabled={!pacoteConferidoAnterior} aria-label="Pacote anterior" className="rounded-lg border border-slate-700 px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-30">←</button><p className="text-center text-sm text-slate-300"><span className="font-semibold">Pacote {indiceConferidoAtual + 1} de {conferidos.length}</span><br /><span className="text-xs text-slate-500">Deslize para trocar de pacote</span></p><button type="button" onClick={() => pacoteConferidoProximo && setDetalheId(pacoteConferidoProximo.numero)} disabled={!pacoteConferidoProximo} aria-label="Próximo pacote" className="rounded-lg border border-slate-700 px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-30">→</button></div>}'
    );

    return { code: result, map: null };
  },
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: { plugins: [conferidoPacoteNavegacaoPlugin] },
});
