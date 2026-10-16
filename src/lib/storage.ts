import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV, STORAGE, StorageDriver } from "./constants";
import type { DayDoc } from "./types";

/**
 * Small JSON document store with optimistic concurrency:
 * read a doc with its version, write only if the version is unchanged, retry on conflict.
 * Netlify Blobs on Netlify, JSON files elsewhere.
 */
export interface Versioned<T> {
  doc: T | null;
  version: string | null; // null = document does not exist yet
}

export interface DocStore {
  read<T>(key: string): Promise<Versioned<T>>;
  /** Returns false when someone else wrote first (caller retries). */
  write<T>(key: string, doc: T, expectedVersion: string | null): Promise<boolean>;
}

/* ---------- Netlify Blobs ---------- */
class NetlifyDocStore implements DocStore {
  private async store() {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: STORAGE.blobStoreName, consistency: "strong" });
  }

  async read<T>(key: string): Promise<Versioned<T>> {
    const store = await this.store();
    const res = await store.getWithMetadata(key, { type: "json" });
    if (!res) return { doc: null, version: null };
    return { doc: res.data as T, version: res.etag ?? null };
  }

  async write<T>(key: string, doc: T, expectedVersion: string | null): Promise<boolean> {
    const store = await this.store();
    const result = expectedVersion
      ? await store.setJSON(key, doc, { onlyIfMatch: expectedVersion })
      : await store.setJSON(key, doc, { onlyIfNew: true });
    return result.modified;
  }
}

/* ---------- Local JSON files (dev / VPS) ---------- */
class FileDocStore implements DocStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private dir: string) {}

  private file(key: string) {
    // keys look like "day/2026-10-16" or "group/AB12CD"
    return path.join(this.dir, key.replace(/[^A-Za-z0-9/_-]/g, "_") + ".json");
  }

  async read<T>(key: string): Promise<Versioned<T>> {
    try {
      const raw = await fs.readFile(this.file(key), "utf8");
      return { doc: JSON.parse(raw) as T, version: createHash("sha1").update(raw).digest("hex") };
    } catch {
      return { doc: null, version: null };
    }
  }

  write<T>(key: string, doc: T, expectedVersion: string | null): Promise<boolean> {
    // Serialise writes inside this process so the version check and the write are atomic.
    const run = async () => {
      const current = await this.read<T>(key);
      if (current.version !== expectedVersion) return false;
      const file = this.file(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(doc));
      await fs.rename(tmp, file);
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

let instance: DocStore | null = null;

export function getStoreInstance(): DocStore {
  if (instance) return instance;
  instance =
    resolveDriver() === StorageDriver.Netlify
      ? new NetlifyDocStore()
      : new FileDocStore(path.resolve(process.env[ENV.dataDir] || STORAGE.defaultDataDir));
  return instance;
}

export async function readDoc<T>(key: string): Promise<T | null> {
  return (await getStoreInstance().read<T>(key)).doc;
}

/**
 * Read-modify-write with retries. `mutate` gets a private copy (or null when missing)
 * and must be pure, since it may run more than once.
 */
export async function updateDoc<T, R>(key: string, mutate: (doc: T | null) => { doc: T; result: R }): Promise<R> {
  const store = getStoreInstance();
  for (let attempt = 0; attempt < STORAGE.writeRetries; attempt++) {
    const { doc, version } = await store.read<T>(key);
    const { doc: nextDoc, result } = mutate(doc === null ? null : structuredClone(doc));
    if (await store.write(key, nextDoc, version)) return result;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (attempt + 1)));
  }
  throw new Error("STORAGE_CONFLICT");
}

/* ---------- Day documents (orders) ---------- */
const dayKeyOf = (day: string) => STORAGE.dayKeyPrefix + day;
const emptyDay = (day: string): DayDoc => ({ day, seq: 0, orders: [] });

export async function readDay(day: string): Promise<DayDoc> {
  return (await readDoc<DayDoc>(dayKeyOf(day))) ?? emptyDay(day);
}

export function updateDay<R>(day: string, mutate: (doc: DayDoc) => { doc: DayDoc; result: R }): Promise<R> {
  return updateDoc<DayDoc, R>(dayKeyOf(day), (doc) => mutate(doc ?? emptyDay(day)));
}
