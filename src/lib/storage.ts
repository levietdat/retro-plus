import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV, STORAGE, StorageDriver } from "./constants";
import type { DayDoc } from "./types";

/**
 * Orders are grouped into one document per business day.
 * Writes are optimistic: read with a version, write only if the version is unchanged, retry on conflict.
 */
export interface VersionedDoc {
  doc: DayDoc;
  version: string | null; // null = document does not exist yet
}

export interface DayStore {
  read(day: string): Promise<VersionedDoc>;
  /** Returns false when someone else wrote first (caller retries). */
  write(day: string, doc: DayDoc, expectedVersion: string | null): Promise<boolean>;
}

const emptyDoc = (day: string): DayDoc => ({ day, seq: 0, orders: [] });

/* ---------- Netlify Blobs ---------- */
class NetlifyDayStore implements DayStore {
  private async store() {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: STORAGE.blobStoreName, consistency: "strong" });
  }

  async read(day: string): Promise<VersionedDoc> {
    const store = await this.store();
    const res = await store.getWithMetadata(STORAGE.dayKeyPrefix + day, { type: "json" });
    if (!res) return { doc: emptyDoc(day), version: null };
    return { doc: res.data as DayDoc, version: res.etag ?? null };
  }

  async write(day: string, doc: DayDoc, expectedVersion: string | null): Promise<boolean> {
    const store = await this.store();
    const key = STORAGE.dayKeyPrefix + day;
    const result = expectedVersion
      ? await store.setJSON(key, doc, { onlyIfMatch: expectedVersion })
      : await store.setJSON(key, doc, { onlyIfNew: true });
    return result.modified;
  }
}

/* ---------- Local JSON files (dev / VPS) ---------- */
class FileDayStore implements DayStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private dir: string) {}

  private file(day: string) {
    return path.join(this.dir, `${day}.json`);
  }

  async read(day: string): Promise<VersionedDoc> {
    try {
      const raw = await fs.readFile(this.file(day), "utf8");
      const doc = JSON.parse(raw) as DayDoc;
      return { doc, version: String(doc.seq) + ":" + raw.length };
    } catch {
      return { doc: emptyDoc(day), version: null };
    }
  }

  write(day: string, doc: DayDoc, expectedVersion: string | null): Promise<boolean> {
    // Serialise writes inside this process so the version check and the write are atomic.
    const run = async () => {
      const current = await this.read(day);
      if (current.version !== expectedVersion) return false;
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = this.file(day) + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(doc));
      await fs.rename(tmp, this.file(day));
      return true;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

function resolveDriver(): StorageDriver {
  const forced = process.env[ENV.storageDriver];
  if (forced === StorageDriver.File || forced === StorageDriver.Netlify) return forced;
  const onNetlify = Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.SITE_ID);
  return onNetlify ? StorageDriver.Netlify : StorageDriver.File;
}

let instance: DayStore | null = null;

export function getDayStore(): DayStore {
  if (instance) return instance;
  instance =
    resolveDriver() === StorageDriver.Netlify
      ? new NetlifyDayStore()
      : new FileDayStore(path.resolve(process.env[ENV.dataDir] || STORAGE.defaultDataDir));
  return instance;
}

/** Read-modify-write with retries. `mutate` must be pure (it may run more than once). */
export async function updateDay<T>(day: string, mutate: (doc: DayDoc) => { doc: DayDoc; result: T }): Promise<T> {
  const store = getDayStore();
  for (let attempt = 0; attempt < STORAGE.writeRetries; attempt++) {
    const { doc, version } = await store.read(day);
    const copy: DayDoc = structuredClone(doc);
    const { doc: nextDoc, result } = mutate(copy);
    if (await store.write(day, nextDoc, version)) return result;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (attempt + 1)));
  }
  throw new Error("STORAGE_CONFLICT");
}
