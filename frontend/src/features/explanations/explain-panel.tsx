import { useEffect, useMemo, useState } from "react";
import { editorEventBus } from "../editor-events/editor-events";
import type { RepositorySymbol } from "../../types/repository";
import type { ExplainMode, ExplainResponse, ExplainTarget } from "./explanations.api";
import { explainEntity, streamEntityExplanation } from "./explanations.api";

interface ExplainPanelProps {
  activeFilePath: string | null;
  symbols: RepositorySymbol[];
  routes: Array<{ file: string; route: string }>;
}

const isSymbolTarget = (target: ExplainTarget) =>
  target === "component" || target === "function" || target === "class";

const needsPath = (target: ExplainTarget) => target === "file" || target === "module";

const needsRoute = (target: ExplainTarget) => target === "route";

export const ExplainPanel = ({ activeFilePath, symbols, routes }: ExplainPanelProps) => {
  const [target, setTarget] = useState<ExplainTarget>("file");
  const [mode, setMode] = useState<ExplainMode>("quick");
  const [symbol, setSymbol] = useState<string>("");
  const [route, setRoute] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResponse | null>(null);
  const [streamText, setStreamText] = useState("");

  const visibleSymbols = useMemo(() => {
    const filtered = activeFilePath
      ? symbols.filter((entry) => entry.sourceFile === activeFilePath)
      : symbols;
    return filtered.slice(0, 200);
  }, [activeFilePath, symbols]);

  useEffect(() => {
    const unsubscribe = editorEventBus.subscribe("symbolSelected", ({ path, symbol: selectedSymbol }) => {
      if (path !== activeFilePath) {
        return;
      }
      const candidate = symbols.find((entry) => entry.sourceFile === path && entry.name === selectedSymbol);
      if (!candidate) {
        return;
      }

      setSymbol(candidate.name);
      if (candidate.type === "component") {
        setTarget("component");
      } else if (candidate.type === "function") {
        setTarget("function");
      } else if (candidate.type === "class") {
        setTarget("class");
      }
    });
    return unsubscribe;
  }, [activeFilePath, symbols]);

  const canRun = useMemo(() => {
    if (needsPath(target)) {
      return Boolean(activeFilePath);
    }
    if (isSymbolTarget(target)) {
      return symbol.trim().length > 0;
    }
    if (needsRoute(target)) {
      return route.trim().length > 0;
    }
    return false;
  }, [activeFilePath, route, symbol, target]);

  const buildPayload = () => ({
    mode,
    ...(needsPath(target) && activeFilePath ? { path: activeFilePath } : {}),
    ...(isSymbolTarget(target) && symbol.trim().length > 0 ? { symbol: symbol.trim() } : {}),
    ...(needsRoute(target) && route.trim().length > 0 ? { route: route.trim() } : {}),
  });

  const handleExplain = async () => {
    setLoading(true);
    setError(null);
    setStreamText("");
    try {
      const response = await explainEntity(target, buildPayload());
      setExplainResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to explain entity.");
    } finally {
      setLoading(false);
    }
  };

  const handleStream = async () => {
    setStreaming(true);
    setError(null);
    setStreamText("");
    try {
      await streamEntityExplanation(target, buildPayload(), (token) => {
        setStreamText((current) => `${current}${token}`);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to stream explanation.");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-3">
        <h2 className="text-sm font-semibold text-slate-100">Explain Codebase</h2>
        <p className="mt-1 text-xs text-slate-400">Repository-aware Quick/Deep explanations.</p>
      </div>
      <div className="space-y-2 border-b border-slate-800 p-3">
        <label className="block text-xs text-slate-400">
          Target
          <select
            value={target}
            onChange={(event) => {
              setTarget(event.target.value as ExplainTarget);
              setExplainResult(null);
              setStreamText("");
              setError(null);
            }}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="file">File</option>
            <option value="component">Component</option>
            <option value="function">Function</option>
            <option value="class">Class</option>
            <option value="module">Module</option>
            <option value="route">Route</option>
          </select>
        </label>

        <label className="block text-xs text-slate-400">
          Mode
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as ExplainMode);
            }}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="quick">Quick Explain</option>
            <option value="deep">Deep Explain</option>
          </select>
        </label>

        {isSymbolTarget(target) ? (
          <label className="block text-xs text-slate-400">
            Symbol
            <select
              value={symbol}
              onChange={(event) => {
                setSymbol(event.target.value);
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
            >
              <option value="">Select a symbol</option>
              {visibleSymbols
                .filter((entry) =>
                  target === "component"
                    ? entry.type === "component"
                    : target === "function"
                      ? entry.type === "function"
                      : entry.type === "class",
                )
                .map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name} ({entry.sourceFile})
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        {needsRoute(target) ? (
          <label className="block text-xs text-slate-400">
            Route
            <select
              value={route}
              onChange={(event) => {
                setRoute(event.target.value);
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
            >
              <option value="">Select a route</option>
              {routes.map((entry) => (
                <option key={`${entry.file}:${entry.route}`} value={entry.route}>
                  {entry.route} ({entry.file})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canRun || loading || streaming}
            onClick={() => {
              void handleExplain();
            }}
            className="rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 disabled:opacity-40"
          >
            {loading ? "Explaining..." : "Explain"}
          </button>
          <button
            type="button"
            disabled={!canRun || loading || streaming}
            onClick={() => {
              void handleStream();
            }}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200 disabled:opacity-40"
          >
            {streaming ? "Streaming..." : "Stream"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs text-slate-200">
        {error ? <div className="mb-3 rounded border border-rose-700 bg-rose-950/40 p-2 text-rose-200">{error}</div> : null}

        {explainResult ? (
          <div className="space-y-3">
            <section>
              <h3 className="font-semibold text-slate-100">Summary</h3>
              <p className="mt-1 whitespace-pre-wrap text-slate-300">{explainResult.summary}</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Responsibilities</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.responsibilities.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Dependencies</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.dependencies.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Relationships</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.relationships.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Risks</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.risks.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Suggested Reading Order</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.suggestedReadingOrder.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-100">Related Files</h3>
              <ul className="mt-1 space-y-1 text-slate-300">
                {explainResult.relatedFiles.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <p className="text-slate-500">Run an explanation request to see structured output.</p>
        )}

        {streamText.length > 0 ? (
          <section className="mt-4 border-t border-slate-800 pt-3">
            <h3 className="font-semibold text-slate-100">Streaming Output</h3>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-300">{streamText}</pre>
          </section>
        ) : null}
      </div>
    </aside>
  );
};
