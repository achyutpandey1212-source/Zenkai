/**
 * Zenkai Graph Checkpoint Manager
 *
 * Persists GraphState after major nodes (router, planning, execution, assembler).
 * Gives us a foundation for workflow resumability, debugging, and future observability.
 *
 * Storage strategy:
 *   - Dev / hackathon: in-memory cache with TTL (no MongoDB writes needed)
 *   - Production upgrade path: swap InMemoryCheckpointStore for MongoCheckpointStore
 *
 * LangGraph equivalents: MemorySaver / MongoSaver checkpointers
 */

import { dbConnect } from "@/lib/mongodb";

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint document shape
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointRecord {
  workflowId: string;
  workflowVersion: string;
  graphVersion: string;
  afterNode: string;
  checkpointedAt: string;
  /** Serialised GraphState (JSON string for MongoDB / plain object for in-memory) */
  snapshot: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Store (default — replaces easily with Mongo)
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  record: CheckpointRecord;
  expiresAt: number;
}

class InMemoryCheckpointStore {
  private cache: Map<string, CacheEntry> = new Map();

  async save(record: CheckpointRecord): Promise<string> {
    const key = `${record.workflowId}:${record.afterNode}`;
    this.cache.set(key, {
      record,
      expiresAt: Date.now() + TTL_MS,
    });
    this.evictExpired();
    return key;
  }

  async findByWorkflowId(workflowId: string): Promise<CheckpointRecord[]> {
    this.evictExpired();
    const results: CheckpointRecord[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(workflowId)) results.push(entry.record);
    }
    return results;
  }

  async listRecentWorkflows(): Promise<CheckpointRecord[]> {
    this.evictExpired();
    const latestMap: Map<string, CheckpointRecord> = new Map();
    for (const entry of this.cache.values()) {
      const rec = entry.record;
      const existing = latestMap.get(rec.workflowId);
      if (!existing || new Date(rec.checkpointedAt) > new Date(existing.checkpointedAt)) {
        latestMap.set(rec.workflowId, rec);
      }
    }
    return Array.from(latestMap.values()).sort(
      (a, b) => new Date(b.checkpointedAt).getTime() - new Date(a.checkpointedAt).getTime()
    );
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) this.cache.delete(key);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB Store (upgrade path — opt in via CHECKPOINT_STORE=mongo env var)
// ─────────────────────────────────────────────────────────────────────────────

class MongoCheckpointStore {
  private collectionName = "graph_checkpoints";

  async save(record: CheckpointRecord): Promise<string> {
    try {
      const mongoose = await dbConnect();
      const col = mongoose.connection.db!.collection(this.collectionName);
      const result = await col.insertOne({
        ...record,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + TTL_MS),
      });
      return result.insertedId.toString();
    } catch (err) {
      console.error("[CheckpointManager] MongoDB save failed:", err);
      return "mongo-error";
    }
  }

  async findByWorkflowId(workflowId: string): Promise<CheckpointRecord[]> {
    try {
      const mongoose = await dbConnect();
      const col = mongoose.connection.db!.collection(this.collectionName);
      return await col
        .find({ workflowId, expiresAt: { $gt: new Date() } })
        .sort({ checkpointedAt: 1 })
        .toArray() as unknown as CheckpointRecord[];
    } catch (err) {
      console.error("[CheckpointManager] MongoDB find failed:", err);
      return [];
    }
  }

  async listRecentWorkflows(): Promise<CheckpointRecord[]> {
    try {
      const mongoose = await dbConnect();
      const col = mongoose.connection.db!.collection(this.collectionName);
      const results = await col.aggregate([
        { $sort: { checkpointedAt: -1 } },
        {
          $group: {
            _id: "$workflowId",
            latest: { $first: "$$ROOT" }
          }
        },
        { $replaceRoot: { newRoot: "$latest" } },
        { $sort: { checkpointedAt: -1 } }
      ]).toArray();
      return results as unknown as CheckpointRecord[];
    } catch (err) {
      console.error("[CheckpointManager] MongoDB listRecentWorkflows failed:", err);
      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckpointManager — public API
// ─────────────────────────────────────────────────────────────────────────────

const useMongoStore = process.env.CHECKPOINT_STORE === "mongo";
const store: InMemoryCheckpointStore | MongoCheckpointStore = useMongoStore
  ? new MongoCheckpointStore()
  : new InMemoryCheckpointStore();

export class CheckpointManager {
  /**
   * Persist a snapshot of the graph state after a named node.
   * The streamController and encoder are stripped — they can't be serialised.
   */
  static async save(afterNode: string, state: Record<string, unknown>): Promise<void> {
    const workflowId = (state.workflowId as string) ?? "unknown";

    // Strip un-serialisable fields
    const snapshot: Record<string, unknown> = { ...state };
    delete snapshot.streamController;
    delete snapshot.encoder;

    const record: CheckpointRecord = {
      workflowId,
      workflowVersion: (state.workflowVersion as string) ?? "unknown",
      graphVersion: (state.graphVersion as string) ?? "unknown",
      afterNode,
      checkpointedAt: new Date().toISOString(),
      snapshot,
    };

    try {
      const id = await store.save(record);
      const checkpointIds = [...((state.checkpointIds as string[]) ?? []), id];
      // Mutate state array in place so the engine picks it up
      (state as Record<string, unknown>).checkpointIds = checkpointIds;
      console.log(`[Checkpoint] Saved after "${afterNode}" | id=${id} | wf=${workflowId.slice(0, 8)}`);
    } catch (err) {
      console.error("[CheckpointManager] Failed to save checkpoint:", err);
    }
  }

  /** Retrieve all checkpoints for a given workflowId (useful for debugging) */
  static async findByWorkflowId(workflowId: string): Promise<CheckpointRecord[]> {
    return store.findByWorkflowId(workflowId);
  }

  /** List all recent unique workflows, showing their latest checkpoint state */
  static async listRecentWorkflows(): Promise<CheckpointRecord[]> {
    return store.listRecentWorkflows();
  }
}
