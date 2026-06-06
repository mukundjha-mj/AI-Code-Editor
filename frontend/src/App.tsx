function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">AI Code Editor</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Frontend Foundation Ready</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            This React + Vite + TypeScript setup is structured for Monaco, auth, explorer, graph,
            chat, explanations, and decision-memory features.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-medium text-cyan-300">Prepared Feature Domains</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>`features/editor` for Monaco integration</li>
              <li>`features/auth` for authentication flows</li>
              <li>`features/explorer` for project tree and workspace state</li>
              <li>`features/graph` for graph visualization modules</li>
              <li>`features/chat` for AI assistant panel</li>
              <li>`features/explanations` for code explanation views</li>
              <li>`features/decision-memory` for persistent decision traces</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-medium text-cyan-300">Project Defaults</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Tailwind v4 via Vite plugin</li>
              <li>TypeScript strict mode and typecheck script</li>
              <li>ESLint with zero-warnings policy</li>
              <li>Prettier formatting workflow</li>
              <li>No business logic included</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}

export default App;
