import type { Pool } from "pg";
import type { DecisionRecord, DecisionType } from "./decision-memory.types";

export interface DecisionMemoryStore {
  create(record: DecisionRecord): Promise<DecisionRecord>;
  list(): Promise<DecisionRecord[]>;
  getById(id: string): Promise<DecisionRecord | null>;
}

export class InMemoryDecisionMemoryStore implements DecisionMemoryStore {
  private readonly recordsById = new Map<string, DecisionRecord>();

  async create(record: DecisionRecord): Promise<DecisionRecord> {
    this.recordsById.set(record.id, record);
    return record;
  }

  async list(): Promise<DecisionRecord[]> {
    return [...this.recordsById.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async getById(id: string): Promise<DecisionRecord | null> {
    return this.recordsById.get(id) ?? null;
  }
}

export class PostgresDecisionMemoryStore implements DecisionMemoryStore {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureTable(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            decision_type TEXT NOT NULL,
            reason TEXT NOT NULL,
            trade_offs JSONB NOT NULL,
            expected_benefits JSONB NOT NULL,
            risks JSONB NOT NULL,
            author TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            linked_entities JSONB NOT NULL,
            follow_up_to_decision_id TEXT,
            replaces_decision_id TEXT,
            supersedes_decision_id TEXT
          );
        `);
      })();
    }
    await this.initPromise;
  }

  async create(record: DecisionRecord): Promise<DecisionRecord> {
    await this.ensureTable();
    await this.pool.query(
      `INSERT INTO decisions (
        id, title, description, decision_type, reason, trade_offs,
        expected_benefits, risks, author, timestamp, linked_entities,
        follow_up_to_decision_id, replaces_decision_id, supersedes_decision_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        record.id,
        record.title,
        record.description,
        record.decisionType,
        record.reason,
        JSON.stringify(record.tradeOffs),
        JSON.stringify(record.expectedBenefits),
        JSON.stringify(record.risks),
        record.author,
        record.timestamp,
        JSON.stringify(record.linkedEntities),
        record.followUpToDecisionId,
        record.replacesDecisionId,
        record.supersedesDecisionId,
      ],
    );
    return record;
  }

  async list(): Promise<DecisionRecord[]> {
    await this.ensureTable();
    const res = await this.pool.query(`SELECT * FROM decisions ORDER BY timestamp DESC`);
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      decisionType: row.decision_type as DecisionType,
      reason: row.reason,
      tradeOffs: typeof row.trade_offs === "string" ? JSON.parse(row.trade_offs) : row.trade_offs,
      expectedBenefits:
        typeof row.expected_benefits === "string"
          ? JSON.parse(row.expected_benefits)
          : row.expected_benefits,
      risks: typeof row.risks === "string" ? JSON.parse(row.risks) : row.risks,
      author: row.author,
      timestamp: row.timestamp,
      linkedEntities:
        typeof row.linked_entities === "string"
          ? JSON.parse(row.linked_entities)
          : row.linked_entities,
      followUpToDecisionId: row.follow_up_to_decision_id,
      replacesDecisionId: row.replaces_decision_id,
      supersedesDecisionId: row.supersedes_decision_id,
    }));
  }

  async getById(id: string): Promise<DecisionRecord | null> {
    await this.ensureTable();
    const res = await this.pool.query(`SELECT * FROM decisions WHERE id = $1`, [id]);
    if (res.rows.length === 0) {
      return null;
    }
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      decisionType: row.decision_type as DecisionType,
      reason: row.reason,
      tradeOffs: typeof row.trade_offs === "string" ? JSON.parse(row.trade_offs) : row.trade_offs,
      expectedBenefits:
        typeof row.expected_benefits === "string"
          ? JSON.parse(row.expected_benefits)
          : row.expected_benefits,
      risks: typeof row.risks === "string" ? JSON.parse(row.risks) : row.risks,
      author: row.author,
      timestamp: row.timestamp,
      linkedEntities:
        typeof row.linked_entities === "string"
          ? JSON.parse(row.linked_entities)
          : row.linked_entities,
      followUpToDecisionId: row.follow_up_to_decision_id,
      replacesDecisionId: row.replaces_decision_id,
      supersedesDecisionId: row.supersedes_decision_id,
    };
  }
}
