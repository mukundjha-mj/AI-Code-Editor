import { useEffect, useState } from "react";
import type { RepositorySymbol } from "../../types/repository";
import {
  createDecision,
  listDecisions,
  getDecisionById,
  getHistory,
  decisionTypes,
  decisionEntityTypes,
} from "./decision-memory.api";
import type {
  DecisionRecord,
  DecisionType,
  DecisionEntityType,
  DecisionEntityLink,
  DecisionListFilters,
} from "./decision-memory.api";
import { editorEventBus } from "../editor-events/editor-events";

interface DecisionMemoryPanelProps {
  activeFilePath: string | null;
  symbols: RepositorySymbol[];
  onOpenFile: (path: string) => void;
}

export const DecisionMemoryPanel = ({
  activeFilePath,
  symbols,
  onOpenFile,
}: DecisionMemoryPanelProps) => {
  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DecisionType | "">("");
  const [filterActiveEntity, setFilterActiveEntity] = useState(false);

  // History Chain
  const [historyChain, setHistoryChain] = useState<DecisionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Create Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [decisionType, setDecisionType] = useState<DecisionType | "">("");
  const [author, setAuthor] = useState("mukundjha-mj");
  const [tradeOffs, setTradeOffs] = useState<string[]>([]);
  const [tradeOffInput, setTradeOffInput] = useState("");
  const [expectedBenefits, setExpectedBenefits] = useState<string[]>([]);
  const [benefitInput, setBenefitInput] = useState("");
  const [risks, setRisks] = useState<string[]>([]);
  const [riskInput, setRiskInput] = useState("");
  const [linkedEntities, setLinkedEntities] = useState<DecisionEntityLink[]>([]);

  // Links selectors in form
  const [newLinkType, setNewLinkType] = useState<DecisionEntityType>("file");
  const [newLinkValue, setNewLinkValue] = useState("");
  const [newLinkFilePath, setNewLinkFilePath] = useState("");

  // Dependencies
  const [followUpTo, setFollowUpTo] = useState("");
  const [replaces, setReplaces] = useState("");
  const [supersedes, setSupersedes] = useState("");

  // AI Assist
  const [aiCategorize, setAiCategorize] = useState(true);
  const [aiSummarize, setAiSummarize] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load decisions list
  const loadDecisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: DecisionListFilters = {};
      if (searchQuery.trim()) filters.query = searchQuery.trim();
      if (typeFilter) filters.type = typeFilter;

      if (filterActiveEntity) {
        if (activeFilePath) {
          filters.file = activeFilePath;
        }
      }

      const res = await listDecisions(filters);
      setDecisions(res.decisions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDecisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, typeFilter, filterActiveEntity, activeFilePath]);

  // Load history when decision detail is viewed
  useEffect(() => {
    if (!selectedDecisionId) {
      Promise.resolve().then(() => {
        setSelectedDecision(null);
        setHistoryChain([]);
      });
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getDecisionById(selectedDecisionId);
        setSelectedDecision(detail);

        // Fetch history chain
        setHistoryLoading(true);
        const historyRes = await getHistory({ id: selectedDecisionId });
        setHistoryChain(historyRes.chain);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load decision detail");
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    void fetchDetail();
  }, [selectedDecisionId]);

  // Listen to decisionPanelOpen events to open detail or focus filter
  useEffect(() => {
    const unsubscribe = editorEventBus.subscribe("decisionPanelOpen", async (payload) => {
      // Switch view to list first, update filters if needed, or open detail if we can search it
      setFilterActiveEntity(false);
      setSearchQuery("");
      setTypeFilter("");

      setLoading(true);
      try {
        // Look for existing decisions for this entity
        const filters: DecisionListFilters = {};
        if (payload.type === "file") filters.file = payload.value;
        else if (payload.type === "component") filters.component = payload.value;
        else if (payload.type === "route") filters.route = payload.value;
        else if (payload.type === "module") filters.module = payload.value;
        else if (payload.type && payload.value) filters.symbol = payload.value;

        const res = await listDecisions(filters);
        setDecisions(res.decisions);

        const firstDecision = res.decisions[0];
        if (firstDecision) {
          // Open the first matching decision
          setSelectedDecisionId(firstDecision.id);
          setView("detail");
        } else {
          // If no decisions found, go to create form and pre-fill entity link!
          setView("create");
          const initialLink: DecisionEntityLink = {
            type: payload.type || "file",
            value: payload.value || "",
            filePath: payload.filePath,
          };
          setLinkedEntities([initialLink]);
          setTitle(`Refactor decision for ${payload.value}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open linked decision");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !reason.trim() || !author.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (linkedEntities.length === 0) {
      setError("At least one linked repository entity is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim(),
        author: author.trim(),
        decisionType: decisionType ? decisionType : undefined,
        tradeOffs,
        expectedBenefits,
        risks,
        linkedEntities,
        followUpToDecisionId: followUpTo || undefined,
        replacesDecisionId: replaces || undefined,
        supersedesDecisionId: supersedes || undefined,
        aiAssist: {
          summarize: aiSummarize,
          categorize: aiCategorize,
        },
      };

      const record = await createDecision(input);
      // Success: refresh list, reset fields, go to details
      await loadDecisions();
      setSelectedDecisionId(record.id);
      setView("detail");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create decision");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setReason("");
    setDecisionType("");
    setTradeOffs([]);
    setExpectedBenefits([]);
    setRisks([]);
    setLinkedEntities([]);
    setFollowUpTo("");
    setReplaces("");
    setSupersedes("");
    setError(null);
  };

  const addLinkedEntity = () => {
    if (!newLinkValue.trim()) return;
    const link: DecisionEntityLink = {
      type: newLinkType,
      value: newLinkValue.trim(),
      filePath: newLinkFilePath.trim() || undefined,
    };
    // Avoid duplicates
    if (!linkedEntities.some((le) => le.type === link.type && le.value === link.value)) {
      setLinkedEntities([...linkedEntities, link]);
    }
    setNewLinkValue("");
    setNewLinkFilePath("");
  };

  const removeLinkedEntity = (index: number) => {
    setLinkedEntities(linkedEntities.filter((_, i) => i !== index));
  };

  const handleEntityNavigate = (link: DecisionEntityLink) => {
    if (link.type === "file" && link.value) {
      onOpenFile(link.value);
    } else if (link.filePath) {
      onOpenFile(link.filePath);
      if (
        link.type === "symbol" ||
        link.type === "component" ||
        link.type === "function" ||
        link.type === "class"
      ) {
        editorEventBus.emit("symbolSelected", {
          path: link.filePath,
          symbol: link.value,
        });
      }
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-800 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-3 bg-slate-900/60">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Decision Memory</h2>
          <p className="text-[10px] text-slate-400">
            Track architectural decisions & design rationale
          </p>
        </div>
        <div className="flex gap-1">
          {view !== "list" && (
            <button
              onClick={() => {
                setView("list");
                setError(null);
              }}
              className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 transition"
            >
              Back to List
            </button>
          )}
          {view !== "create" && (
            <button
              onClick={() => {
                resetForm();
                setView("create");
              }}
              className="rounded bg-cyan-600 border border-cyan-500/50 px-2 py-1 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-500 transition shadow-lg shadow-cyan-950/20"
            >
              Record Decision
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mt-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Main View Area */}
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        {view === "list" && (
          <div className="space-y-4 h-full flex flex-col">
            {/* Search and Filters */}
            <div className="space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search decisions or keywords..."
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
              />
              <div className="flex gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DecisionType | "")}
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-500"
                >
                  <option value="">All Types</option>
                  {decisionTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setFilterActiveEntity(!filterActiveEntity)}
                  disabled={!activeFilePath}
                  className={`rounded border px-2 py-1 text-xs transition duration-150 ${
                    filterActiveEntity
                      ? "border-cyan-500 bg-cyan-950/40 text-cyan-200"
                      : "border-slate-700 text-slate-400 disabled:opacity-40"
                  }`}
                  title={
                    activeFilePath
                      ? `Show only decisions linked to ${activeFilePath}`
                      : "Open a file to filter"
                  }
                >
                  Current File
                </button>
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-auto space-y-2">
              {loading ? (
                <div className="py-8 text-center text-slate-500">Loading decisions...</div>
              ) : decisions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded">
                  No decisions found. Record one to start tracking codebase rationale!
                </div>
              ) : (
                decisions.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDecisionId(d.id)}
                    className="group relative cursor-pointer rounded border border-slate-800 bg-slate-900/30 p-2.5 hover:border-slate-700 hover:bg-slate-900/60 transition"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-slate-200 group-hover:text-cyan-400 transition">
                        {d.title}
                      </span>
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300 border border-slate-700/60">
                        {d.decisionType}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-slate-400 text-[11px] leading-relaxed">
                      {d.reason}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>By {d.author}</span>
                      <span>{new Date(d.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "detail" && selectedDecision && (
          <div className="space-y-4">
            {/* Title Block */}
            <div className="rounded border border-slate-800 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-cyan-950/60 border border-cyan-800 text-cyan-300 px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest">
                  {selectedDecision.decisionType}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(selectedDecision.timestamp).toLocaleString()}
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-slate-100 leading-tight">
                {selectedDecision.title}
              </h3>
              <p className="mt-1.5 text-slate-400 text-[11px]">
                Recorded by <strong className="text-slate-300">{selectedDecision.author}</strong>
              </p>
            </div>

            {/* Description */}
            <section className="space-y-1">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                Description
              </h4>
              <p className="rounded border border-slate-800 bg-slate-950 p-2 text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedDecision.description}
              </p>
            </section>

            {/* Rationale */}
            <section className="space-y-1">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                Why was this decided?
              </h4>
              <p className="rounded border border-slate-800 bg-slate-950 p-2 text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedDecision.reason}
              </p>
            </section>

            {/* Impact Metrics */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* Expected Benefits */}
              {selectedDecision.expectedBenefits.length > 0 && (
                <section className="rounded border border-emerald-950/60 bg-emerald-950/10 p-2.5">
                  <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[9px]">
                    Expected Benefits
                  </h4>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    {selectedDecision.expectedBenefits.map((benefit, i) => (
                      <li key={i}>{benefit}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Trade Offs */}
              {selectedDecision.tradeOffs.length > 0 && (
                <section className="rounded border border-slate-800 bg-slate-900/20 p-2.5">
                  <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[9px]">
                    Trade-Offs Considered
                  </h4>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    {selectedDecision.tradeOffs.map((trade, i) => (
                      <li key={i}>{trade}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Risks */}
              {selectedDecision.risks.length > 0 && (
                <section className="rounded border border-rose-950/60 bg-rose-950/10 p-2.5">
                  <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[9px]">
                    Risks & Mitigation
                  </h4>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                    {selectedDecision.risks.map((risk, i) => (
                      <li key={i}>{risk}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Linked Entities */}
            <section className="space-y-1">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                Linked Codebase Entities
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedDecision.linkedEntities.map((link, i) => (
                  <button
                    key={i}
                    onClick={() => handleEntityNavigate(link)}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:border-cyan-500/80 hover:text-cyan-300 transition"
                    title={`Click to open linked ${link.type}`}
                  >
                    <span className="text-[9px] uppercase text-slate-500">{link.type}:</span>
                    <span className="font-mono text-[10px]">{link.value}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Decision History Chain */}
            <section className="space-y-2">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                Decision Relation History
              </h4>
              {historyLoading ? (
                <div className="text-slate-500 italic">Loading relationship chain...</div>
              ) : historyChain.length <= 1 ? (
                <div className="text-[11px] text-slate-500 border border-slate-800 rounded p-2 bg-slate-950/20 italic">
                  This decision stands standalone. No replaces, supersedes, or follow-ups defined.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-800 ml-1.5 pl-3.5 space-y-3 py-1">
                  {historyChain.map((node) => {
                    const isActive = node.id === selectedDecision.id;
                    return (
                      <div key={node.id} className="relative group/chain">
                        {/* Dot Indicator */}
                        <div
                          className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border transition ${
                            isActive
                              ? "bg-cyan-400 border-cyan-300 ring-4 ring-cyan-950/50"
                              : "bg-slate-800 border-slate-600 group-hover/chain:bg-cyan-500"
                          }`}
                        />
                        <button
                          onClick={() => setSelectedDecisionId(node.id)}
                          className={`block w-full text-left rounded p-2 border transition ${
                            isActive
                              ? "border-cyan-800/80 bg-cyan-950/20 text-slate-100"
                              : "border-slate-800/50 bg-slate-900/10 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`font-semibold text-[11px] ${isActive ? "text-cyan-200" : ""}`}
                            >
                              {node.title}
                            </span>
                            <span className="text-[9px] text-slate-600">
                              {new Date(node.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] line-clamp-1 opacity-70">
                            {node.reason}
                          </p>
                          {/* Relationship tags */}
                          {node.id === selectedDecision.followUpToDecisionId && (
                            <span className="mt-1 inline-block text-[8px] uppercase tracking-wider bg-slate-800 px-1 rounded text-slate-400">
                              Follows Up To
                            </span>
                          )}
                          {node.id === selectedDecision.replacesDecisionId && (
                            <span className="mt-1 inline-block text-[8px] uppercase tracking-wider bg-amber-950/50 border border-amber-900/40 px-1 rounded text-amber-300">
                              Replaces
                            </span>
                          )}
                          {node.id === selectedDecision.supersedesDecisionId && (
                            <span className="mt-1 inline-block text-[8px] uppercase tracking-wider bg-cyan-950/50 border border-cyan-900/40 px-1 rounded text-cyan-300">
                              Supersedes
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {view === "create" && (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
              Record Engineering Decision
            </h3>

            {/* Title */}
            <label className="block space-y-1">
              <span className="text-slate-300">Decision Title *</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Use Redux Toolkit for cache synchronization"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-cyan-500"
              />
            </label>

            {/* Author & Type */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-slate-300">Author *</span>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-cyan-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-300">Decision Type (or AI categorizes)</span>
                <select
                  value={decisionType}
                  onChange={(e) => setDecisionType(e.target.value as DecisionType)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-cyan-500"
                >
                  <option value="">AI Select / Other</option>
                  {decisionTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Reason */}
            <label className="block space-y-1">
              <span className="text-slate-300">Rationale (Why exists?) *</span>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What problem are we trying to solve? Constraints? Rationale..."
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-cyan-500 resize-y"
              />
            </label>

            {/* Description */}
            <label className="block space-y-1">
              <span className="text-slate-300">Description (What is the change?) *</span>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a detailed description of the design pattern, components created, or refactoring performed."
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-cyan-500 resize-y"
              />
            </label>

            {/* Linked Entities Selection */}
            <div className="space-y-2 rounded border border-slate-800 bg-slate-900/20 p-2.5">
              <h4 className="font-semibold text-slate-200">Link Repository Entities *</h4>

              {/* Show workspace entity hooks */}
              <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
                {activeFilePath && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !linkedEntities.some(
                          (le) => le.type === "file" && le.value === activeFilePath,
                        )
                      ) {
                        setLinkedEntities([
                          ...linkedEntities,
                          { type: "file", value: activeFilePath },
                        ]);
                      }
                    }}
                    className="rounded bg-slate-800/80 px-2 py-0.5 text-[9px] hover:bg-slate-700 text-slate-300"
                  >
                    + Link Current File
                  </button>
                )}
                {symbols.length > 0 && activeFilePath && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstComp = symbols.find(
                        (s) => s.sourceFile === activeFilePath && s.type === "component",
                      );
                      if (
                        firstComp &&
                        !linkedEntities.some(
                          (le) => le.type === "component" && le.value === firstComp.name,
                        )
                      ) {
                        setLinkedEntities([
                          ...linkedEntities,
                          { type: "component", value: firstComp.name, filePath: activeFilePath },
                        ]);
                      }
                    }}
                    className="rounded bg-slate-800/80 px-2 py-0.5 text-[9px] hover:bg-slate-700 text-slate-300"
                  >
                    + Link Component Symbol
                  </button>
                )}
              </div>

              {/* Custom manual link creator */}
              <div className="flex gap-1.5 items-end">
                <label className="block flex-[2]">
                  <span className="text-[10px] text-slate-400">Type</span>
                  <select
                    value={newLinkType}
                    onChange={(e) => setNewLinkType(e.target.value as DecisionEntityType)}
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[11px] outline-none"
                  >
                    {decisionEntityTypes.map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block flex-[4]">
                  <span className="text-[10px] text-slate-400">Value (e.g., path/name)</span>
                  <input
                    type="text"
                    value={newLinkValue}
                    onChange={(e) => setNewLinkValue(e.target.value)}
                    placeholder="Value..."
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] outline-none"
                  />
                </label>
                <label className="block flex-[3]">
                  <span className="text-[10px] text-slate-400">File Path (optional)</span>
                  <input
                    type="text"
                    value={newLinkFilePath}
                    onChange={(e) => setNewLinkFilePath(e.target.value)}
                    placeholder="File path..."
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={addLinkedEntity}
                  className="rounded bg-cyan-700 px-2 py-1 text-[11px] hover:bg-cyan-600 text-cyan-50 font-bold"
                >
                  Link
                </button>
              </div>

              {/* Render Linked Entities list */}
              {linkedEntities.length === 0 ? (
                <p className="text-[10px] italic text-rose-300 pt-1">
                  At least one entity must be linked.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {linkedEntities.map((le, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                    >
                      <span>
                        {le.type}:{le.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLinkedEntity(idx)}
                        className="rounded px-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* List Builders for arrays */}
            <div className="grid grid-cols-1 gap-3">
              {/* Expected Benefits */}
              <div className="space-y-1">
                <span className="text-slate-300">Expected Benefits</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    placeholder="e.g., Reduces render lag by 40%"
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (benefitInput.trim()) {
                        setExpectedBenefits([...expectedBenefits, benefitInput.trim()]);
                        setBenefitInput("");
                      }
                    }}
                    className="rounded bg-slate-800 border border-slate-700 px-2.5 text-xs hover:bg-slate-700"
                  >
                    Add
                  </button>
                </div>
                {expectedBenefits.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-slate-300">
                    {expectedBenefits.map((item, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpectedBenefits(expectedBenefits.filter((_, idx) => idx !== i))
                          }
                          className="text-rose-400 hover:text-rose-200 pl-2 font-bold"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Trade Offs */}
              <div className="space-y-1">
                <span className="text-slate-300">Trade-offs</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={tradeOffInput}
                    onChange={(e) => setTradeOffInput(e.target.value)}
                    placeholder="e.g., Adds 12kb extra package size"
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tradeOffInput.trim()) {
                        setTradeOffs([...tradeOffs, tradeOffInput.trim()]);
                        setTradeOffInput("");
                      }
                    }}
                    className="rounded bg-slate-800 border border-slate-700 px-2.5 text-xs hover:bg-slate-700"
                  >
                    Add
                  </button>
                </div>
                {tradeOffs.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-slate-300">
                    {tradeOffs.map((item, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => setTradeOffs(tradeOffs.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-200 pl-2 font-bold"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Risks */}
              <div className="space-y-1">
                <span className="text-slate-300">Risks & Mitigations</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={riskInput}
                    onChange={(e) => setRiskInput(e.target.value)}
                    placeholder="e.g., Devs need retraining on RTK Query"
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (riskInput.trim()) {
                        setRisks([...risks, riskInput.trim()]);
                        setRiskInput("");
                      }
                    }}
                    className="rounded bg-slate-800 border border-slate-700 px-2.5 text-xs hover:bg-slate-700"
                  >
                    Add
                  </button>
                </div>
                {risks.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-slate-300">
                    {risks.map((item, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => setRisks(risks.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-200 pl-2 font-bold"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Relationship Dependency Selectors */}
            <div className="rounded border border-slate-800 bg-slate-900/20 p-2.5 space-y-2">
              <h4 className="font-semibold text-slate-200">Relationships & Dependencies</h4>

              <label className="block space-y-0.5">
                <span className="text-[10px] text-slate-400">
                  Is this a follow up to an existing decision?
                </span>
                <select
                  value={followUpTo}
                  onChange={(e) => setFollowUpTo(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] outline-none"
                >
                  <option value="">No parent decision</option>
                  {decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-0.5">
                <span className="text-[10px] text-slate-400">
                  Does this replace a previous decision?
                </span>
                <select
                  value={replaces}
                  onChange={(e) => setReplaces(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] outline-none"
                >
                  <option value="">No replaced decision</option>
                  {decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-0.5">
                <span className="text-[10px] text-slate-400">
                  Does this supersede a previous decision?
                </span>
                <select
                  value={supersedes}
                  onChange={(e) => setSupersedes(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] outline-none"
                >
                  <option value="">No superseded decision</option>
                  {decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* AI Assistant Checkboxes */}
            <div className="rounded border border-cyan-800/30 bg-cyan-950/10 p-2.5 space-y-2">
              <h4 className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <span className="text-xs">✨</span> AI Assistance
              </h4>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={aiCategorize}
                    onChange={(e) => setAiCategorize(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Auto-categorize decision type using LLM</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={aiSummarize}
                    onChange={(e) => setAiSummarize(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Refine & summarize description using LLM</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded bg-cyan-600 border border-cyan-500/50 py-1.5 text-xs font-bold text-cyan-50 hover:bg-cyan-500 disabled:opacity-40 shadow-lg"
              >
                {submitting ? "Submitting to AI & Store..." : "Record Decision"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setError(null);
                }}
                className="rounded border border-slate-700 bg-slate-900 py-1.5 px-3 text-xs hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
};
