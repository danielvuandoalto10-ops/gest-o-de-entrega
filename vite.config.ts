// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const conferidoPacoteSwipePlugin = {
  name: "conferido-pacote-navegacao",
  transform(code: string, id: string) {
    if (!id.endsWith("/src/routes/index.tsx")) return null;

    const stateMarker = "  const [erro, setErro] = useState(\"\");";
    const stateInjection = `  const inicioSwipeDetalheRef = useRef<number | null>(null);\n`;
    const withSwipeState = code.includes("inicioSwipeDetalheRef")
      ? code
      : code.replace(stateMarker, stateMarker + "\n" + stateInjection);

    const helperMarker = `  const corAtiva = coresUsuario[usuario];`;
    const helper = `  const indicePacoteConferido = aba === "conferidos" && detalheId !== null ? conferidos.findIndex((p) => p.numero === detalheId) : -1;\n  const pacoteAnteriorConferido = indicePacoteConferido > 0 ? conferidos[indicePacoteConferido - 1] : null;\n  const proximoPacoteConferido = indicePacoteConferido >= 0 && indicePacoteConferido < conferidos.length - 1 ? conferidos[indicePacoteConferido + 1] : null;\n\n`;
    const withHelpers = withSwipeState.includes("indicePacoteConferido")
      ? withSwipeState
      : withSwipeState.replace(helperMarker, helper + helperMarker);

    const sectionMarker = '<section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5">';
    const sectionReplacement = `<section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-5"\n        onTouchStart={(e) => { if (aba === "conferidos") inicioSwipeDetalheRef.current = e.changedTouches[0]?.clientX ?? null; }}\n        onTouchEnd={(e) => {\n          if (aba !== "conferidos") return;\n          const inicio = inicioSwipeDetalheRef.current;\n          const fim = e.changedTouches[0]?.clientX ?? null;\n          inicioSwipeDetalheRef.current = null;\n          if (inicio === null || fim === null) return;\n          const deslocamento = fim - inicio;\n          if (Math.abs(deslocamento) < 55) return;\n          if (deslocamento < 0 && proximoPacoteConferido) setDetalheId(proximoPacoteConferido.numero);\n          if (deslocamento > 0 && pacoteAnteriorConferido) setDetalheId(pacoteAnteriorConferido.numero);\n        }}>`;
    const withSection = withHelpers.replace(sectionMarker, sectionReplacement);

    const titleMarker = '<h2 className="mb-4 text-2xl font-bold">Pacote {detalhe.numero}</h2>';
    const navigation = `<h2 className="mb-3 text-2xl font-bold">Pacote {detalhe.numero}</h2>\n          {aba === "conferidos" && indicePacoteConferido >= 0 && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3" aria-label="Navegação entre pacotes conferidos">\n            <button type="button" onClick={() => pacoteAnteriorConferido && setDetalheId(pacoteAnteriorConferido.numero)} disabled={!pacoteAnteriorConferido} aria-label="Pacote anterior" className="rounded-lg border border-slate-700 px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-30">←</button>\n            <p className="text-center text-sm text-slate-300"><span className="font-semibold">Pacote {indicePacoteConferido + 1} de {conferidos.length}</span><br /><span className="text-xs text-slate-500">Deslize para trocar de pacote</span></p>\n            <button type="button" onClick={() => proximoPacoteConferido && setDetalheId(proximoPacoteConferido.numero)} disabled={!proximoPacoteConferido} aria-label="Próximo pacote" className="rounded-lg border border-slate-700 px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-30">→</button>\n          </div>`;
    const finalCode = withSection.replace(titleMarker, navigation);
    if (finalCode === code) return null;
    return { code: finalCode, map: null };
  },
};

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: { plugins: [conferidoPacoteSwipePlugin] },
});
