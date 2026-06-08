import { randomUUID } from "node:crypto";
import type { RepositoryIntelligenceService } from "../repository/repository-intelligence.service";
import type { DecisionMemoryAiService } from "./decision-memory.ai";
import type { DecisionMemoryStore } from "./decision-memory.store";
import type {
  CreateDecisionInput,
  DecisionEntityContextResponse,
  DecisionEntityLink,
  DecisionEntityType,
  DecisionHistoryResponse,
  DecisionListFilters,
  DecisionRecord,
  ExplainDecisionSummary,
} from "./decision-memory.types";

const uniqueSorted = (values: Iterable<string>) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

const entityKey = (type: DecisionEntityType, value: string) => `${type}:${value}`;

const normalizeText = (value: string) => value.trim().toLowerCase();

const splitModuleFromPath = (pathValue: string) => pathValue.split("/").filter(Boolean)[0] ?? "";

const recordMatchesQuery = (record: DecisionRecord, queryTerms: string[]) => {
  if (queryTerms.length === 0) {
    return true;
  }

  const haystack = [
    record.title,
    record.description,
    record.reason,
    record.tradeOffs.join(" "),
    record.expectedBenefits.join(" "),
    record.risks.join(" "),
    ...record.linkedEntities.map((entry) => `${entry.type}:${entry.value}`),
  ]
    .join(" ")
    .toLowerCase();

  return queryTerms.some((term) => haystack.includes(term));
};

const compactList = (items: string[], maxItems: number) =>
  uniqueSorted(items.map((value) => value.trim()).filter((value) => value.length > 0)).slice(
    0,
    maxItems,
  );

export interface DecisionMemoryService {
  createDecision(input: CreateDecisionInput): Promise<DecisionRecord>;
  listDecisions(filters?: DecisionListFilters): Promise<DecisionRecord[]>;
  getDecisionById(id: string): Promise<DecisionRecord | null>;
  getByEntity(entity: DecisionEntityLink): Promise<DecisionEntityContextResponse>;
  getHistory(input: {
    decisionId?: string;
    entity?: DecisionEntityLink;
  }): Promise<DecisionHistoryResponse>;
  getEntityDecisionIndex(): Promise<Record<string, string[]>>;
  getExplainSummaries(input: {
    filePath?: string;
    symbol?: string;
    route?: string;
    moduleName?: string;
  }): Promise<ExplainDecisionSummary[]>;
}

interface DecisionMemoryServiceDeps {
  store: DecisionMemoryStore;
  repository: RepositoryIntelligenceService;
  ai?: DecisionMemoryAiService;
}

export const createDecisionMemoryService = (
  deps: DecisionMemoryServiceDeps,
): DecisionMemoryService => {
  const service: DecisionMemoryService = {
    createDecision: async (input: CreateDecisionInput): Promise<DecisionRecord> => {
      const linkedEntities = uniqueSorted(
        input.linkedEntities
          .map((entity) => ({
            ...entity,
            value: entity.value.trim(),
            filePath: entity.filePath?.trim() || undefined,
          }))
          .filter((entity) => entity.value.length > 0)
          .map((entity) => JSON.stringify(entity)),
      ).map((value) => JSON.parse(value) as DecisionEntityLink);

      if (linkedEntities.length === 0) {
        throw new Error("At least one linked entity is required.");
      }

      const snapshot = deps.repository.getSnapshot();
      if (snapshot.rootPath) {
        for (const entity of linkedEntities) {
          if (entity.type === "file") {
            const exists = snapshot.files.some((file) => file.path === entity.value);
            if (!exists) {
              throw new Error(`Linked file not found in repository index: ${entity.value}`);
            }
          }
          if (entity.type === "route") {
            const exists = snapshot.routes.routes.some((route) => route.route === entity.value);
            if (!exists) {
              throw new Error(`Linked route not found in repository index: ${entity.value}`);
            }
          }
        }
      }

      let decisionType = input.decisionType ?? "other";
      if (!input.decisionType && input.aiAssist?.categorize && deps.ai) {
        try {
          decisionType = await deps.ai.categorize({
            title: input.title,
            description: input.description,
            reason: input.reason,
          });
        } catch {
          decisionType = "other";
        }
      }

      let description = input.description.trim();
      if (input.aiAssist?.summarize && deps.ai) {
        try {
          description = await deps.ai.summarize({
            title: input.title,
            description: input.description,
            reason: input.reason,
          });
        } catch {
          description = input.description.trim();
        }
      }

      const record: DecisionRecord = {
        id: randomUUID(),
        title: input.title.trim(),
        description,
        decisionType,
        reason: input.reason.trim(),
        tradeOffs: compactList(input.tradeOffs ?? [], 20),
        expectedBenefits: compactList(input.expectedBenefits ?? [], 20),
        risks: compactList(input.risks ?? [], 20),
        author: input.author.trim(),
        timestamp: new Date().toISOString(),
        linkedEntities,
        followUpToDecisionId: input.followUpToDecisionId ?? null,
        replacesDecisionId: input.replacesDecisionId ?? null,
        supersedesDecisionId: input.supersedesDecisionId ?? null,
      };

      for (const dependencyId of [
        record.followUpToDecisionId,
        record.replacesDecisionId,
        record.supersedesDecisionId,
      ]) {
        if (!dependencyId) {
          continue;
        }
        if (!(await deps.store.getById(dependencyId))) {
          throw new Error(`Linked decision does not exist: ${dependencyId}`);
        }
      }

      return deps.store.create(record);
    },

    listDecisions: async (filters: DecisionListFilters = {}): Promise<DecisionRecord[]> => {
      const queryText = filters.query?.trim().toLowerCase() ?? "";
      let queryTerms = queryText.length > 0 ? [queryText] : [];

      if (queryText.length > 0 && deps.ai) {
        try {
          const enhanced = await deps.ai.enhanceSearch({ query: queryText, filters });
          queryTerms = uniqueSorted([
            ...queryTerms,
            ...enhanced.map((term) => normalizeText(term)),
          ]).filter((term) => term.length > 0);
        } catch {
          queryTerms = queryTerms.filter((term) => term.length > 0);
        }
      }

      const allRecords = await deps.store.list();
      return allRecords.filter((record) => {
        if (filters.type && record.decisionType !== filters.type) {
          return false;
        }
        if (filters.author && normalizeText(record.author) !== normalizeText(filters.author)) {
          return false;
        }
        if (
          filters.file &&
          !record.linkedEntities.some(
            (entry) => entry.type === "file" && entry.value === filters.file,
          )
        ) {
          return false;
        }
        if (
          filters.symbol &&
          !record.linkedEntities.some(
            (entry) =>
              (entry.type === "symbol" || entry.type === "function" || entry.type === "class") &&
              entry.value === filters.symbol,
          )
        ) {
          return false;
        }
        if (
          filters.component &&
          !record.linkedEntities.some(
            (entry) => entry.type === "component" && entry.value === filters.component,
          )
        ) {
          return false;
        }
        if (
          filters.route &&
          !record.linkedEntities.some(
            (entry) => entry.type === "route" && entry.value === filters.route,
          )
        ) {
          return false;
        }
        if (
          filters.module &&
          !record.linkedEntities.some(
            (entry) => entry.type === "module" && entry.value === filters.module,
          )
        ) {
          return false;
        }
        return recordMatchesQuery(record, queryTerms);
      });
    },

    getDecisionById: (id: string): Promise<DecisionRecord | null> => deps.store.getById(id),

    getByEntity: async (entity: DecisionEntityLink): Promise<DecisionEntityContextResponse> => {
      const decisions = (await service.listDecisions()).filter((decision: DecisionRecord) =>
        decision.linkedEntities.some(
          (link: DecisionEntityLink) => link.type === entity.type && link.value === entity.value,
        ),
      );

      return {
        entity,
        decisions,
        answers: {
          whyExists: compactList(
            decisions.map((decision: DecisionRecord) => decision.reason),
            12,
          ),
          whyChanged: compactList(
            decisions
              .filter(
                (decision: DecisionRecord) =>
                  decision.decisionType === "code-modified" ||
                  decision.decisionType === "refactor" ||
                  decision.decisionType === "bugfix",
              )
              .map((decision: DecisionRecord) => decision.reason),
            12,
          ),
          performanceOptimizations: compactList(
            decisions
              .filter((decision: DecisionRecord) => decision.decisionType === "performance")
              .map((decision: DecisionRecord) => `${decision.title}: ${decision.reason}`),
            12,
          ),
          architecturalDecisions: compactList(
            decisions
              .filter((decision: DecisionRecord) => decision.decisionType === "architecture")
              .map((decision: DecisionRecord) => `${decision.title}: ${decision.reason}`),
            12,
          ),
        },
      };
    },

    getHistory: async (input: {
      decisionId?: string;
      entity?: DecisionEntityLink;
    }): Promise<DecisionHistoryResponse> => {
      const all = await deps.store.list();
      const byId = new Map(all.map((decision: DecisionRecord) => [decision.id, decision] as const));
      const related = new Set<string>();

      const enqueue = (id: string | null | undefined) => {
        if (!id || related.has(id) || !byId.has(id)) {
          return;
        }
        related.add(id);
        const decision = byId.get(id);
        if (!decision) {
          return;
        }
        enqueue(decision.followUpToDecisionId);
        enqueue(decision.replacesDecisionId);
        enqueue(decision.supersedesDecisionId);
        for (const candidate of all) {
          if (
            candidate.followUpToDecisionId === decision.id ||
            candidate.replacesDecisionId === decision.id ||
            candidate.supersedesDecisionId === decision.id
          ) {
            enqueue(candidate.id);
          }
        }
      };

      if (input.decisionId) {
        enqueue(input.decisionId);
      } else if (input.entity) {
        for (const decision of all) {
          if (
            decision.linkedEntities.some(
              (entity: DecisionEntityLink) =>
                entity.type === input.entity?.type && entity.value === input.entity?.value,
            )
          ) {
            enqueue(decision.id);
          }
        }
      }

      const chain = [...related]
        .map((id) => byId.get(id))
        .filter((value): value is DecisionRecord => Boolean(value))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      return {
        rootDecisionId: input.decisionId ?? chain[0]?.id ?? "",
        chain,
      };
    },

    getEntityDecisionIndex: async (): Promise<Record<string, string[]>> => {
      const index = new Map<string, Set<string>>();
      const all = await deps.store.list();
      for (const decision of all) {
        for (const entity of decision.linkedEntities) {
          const key = entityKey(entity.type, entity.value);
          if (!index.has(key)) {
            index.set(key, new Set());
          }
          index.get(key)?.add(decision.id);
        }
      }

      const result: Record<string, string[]> = {};
      for (const [key, ids] of index.entries()) {
        result[key] = [...ids].sort((a, b) => a.localeCompare(b));
      }
      return result;
    },

    getExplainSummaries: async (input: {
      filePath?: string;
      symbol?: string;
      route?: string;
      moduleName?: string;
    }): Promise<ExplainDecisionSummary[]> => {
      const all = await deps.store.list();
      const selected = all.filter((decision: DecisionRecord) =>
        decision.linkedEntities.some((entity: DecisionEntityLink) => {
          if (input.filePath && entity.type === "file" && entity.value === input.filePath) {
            return true;
          }
          if (
            input.symbol &&
            (entity.type === "symbol" ||
              entity.type === "component" ||
              entity.type === "function" ||
              entity.type === "class") &&
            entity.value === input.symbol
          ) {
            return true;
          }
          if (input.route && entity.type === "route" && entity.value === input.route) {
            return true;
          }
          if (input.moduleName && entity.type === "module" && entity.value === input.moduleName) {
            return true;
          }
          if (
            input.filePath &&
            input.moduleName &&
            entity.type === "module" &&
            entity.value === splitModuleFromPath(input.filePath)
          ) {
            return true;
          }
          return false;
        }),
      );

      return selected.slice(0, 20).map((decision: DecisionRecord) => ({
        id: decision.id,
        title: decision.title,
        decisionType: decision.decisionType,
        reason: decision.reason,
        timestamp: decision.timestamp,
      }));
    },
  };
  return service;
};
