import "server-only";
import { ENV, KIOTVIET, MenuSource } from "./constants";
import type { Menu, MenuCategory, MenuItem, Order } from "./types";

/**
 * KiotViet FnB Public API client.
 * Docs: https://www.kiotviet.vn/public-api-fnb/
 * Field names follow the public docs; verify against your shop's real responses
 * the first time you enable MENU_SOURCE=kiotviet.
 */

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface KvCategory {
  categoryId: number;
  categoryName: string;
  parentId?: number | null;
  children?: KvCategory[];
}

interface KvProduct {
  id: number;
  name: string;
  fullName?: string;
  categoryId?: number;
  basePrice?: number;
  isActive?: boolean;
  allowsSale?: boolean;
  images?: (string | { Image?: string; image?: string })[];
}

interface KvPage<T> {
  total: number;
  pageSize: number;
  data: T[];
}

let tokenCache: TokenCache | null = null;

function config() {
  const retailer = process.env[ENV.kvRetailer];
  const clientId = process.env[ENV.kvClientId];
  const clientSecret = process.env[ENV.kvClientSecret];
  if (!retailer || !clientId || !clientSecret) throw new Error("KIOTVIET_NOT_CONFIGURED");
  return { retailer, clientId, clientSecret };
}

export function isKiotVietConfigured(): boolean {
  return Boolean(process.env[ENV.kvRetailer] && process.env[ENV.kvClientId] && process.env[ENV.kvClientSecret]);
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const { clientId, clientSecret } = config();
  const body = new URLSearchParams({
    scopes: KIOTVIET.scope,
    grant_type: KIOTVIET.grantType,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(KIOTVIET.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KIOTVIET_TOKEN_${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000 - KIOTVIET.tokenSafetyMs,
  };
  return json.access_token;
}

async function kvFetch<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const { retailer } = config();
  const token = await getToken();
  const res = await fetch(KIOTVIET.baseUrl + pathname, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      [KIOTVIET.header.retailer]: retailer,
      [KIOTVIET.header.authorization]: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KIOTVIET_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

async function fetchAll<T>(pathname: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let current = 0; ; current += KIOTVIET.pageSize) {
    const qs = new URLSearchParams({ ...params, pageSize: String(KIOTVIET.pageSize), currentItem: String(current) });
    const page = await kvFetch<KvPage<T>>(`${pathname}?${qs}`);
    out.push(...page.data);
    if (page.data.length < KIOTVIET.pageSize || out.length >= page.total) break;
  }
  return out;
}

function flatten(cats: KvCategory[]): KvCategory[] {
  return cats.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

function firstImage(p: KvProduct): string | undefined {
  const img = p.images?.[0];
  if (!img) return undefined;
  return typeof img === "string" ? img : img.Image || img.image;
}

export async function fetchKiotVietMenu(): Promise<Menu> {
  const [cats, products] = await Promise.all([
    fetchAll<KvCategory>(KIOTVIET.path.categories, { hierachicalData: "true" }),
    fetchAll<KvProduct>(KIOTVIET.path.products, { isActive: "true" }),
  ]);
  const categories: MenuCategory[] = flatten(cats).map((c) => ({ id: String(c.categoryId), name: c.categoryName, customizable: true }));
  const items: MenuItem[] = products
    .filter((p) => p.isActive !== false && p.allowsSale !== false && typeof p.basePrice === "number")
    .map((p) => ({
      id: `kv-${p.id}`,
      name: p.fullName || p.name,
      categoryId: String(p.categoryId ?? ""),
      image: firstImage(p),
      variants: [{ id: `kv-${p.id}`, label: "", price: p.basePrice as number, kiotvietProductId: p.id }],
    }));
  const used = new Set(items.map((i) => i.categoryId));
  return {
    source: MenuSource.KiotViet,
    categories: categories.filter((c) => used.has(c.id)),
    items,
    updatedAt: Date.now(),
  };
}

/** Pushes an order to KiotViet so it shows up on the POS. Returns the KiotViet order code. */
export async function pushOrderToKiotViet(order: Order): Promise<string> {
  const branchId = Number(process.env[ENV.kvBranchId]);
  if (!branchId) throw new Error("KIOTVIET_BRANCH_ID_MISSING");
  const where = order.table ? `Bàn ${order.table}` : "Mang đi";
  const payload = {
    branchId,
    purchaseDate: new Date(order.createdAt).toISOString(),
    description: `[Web ${order.code}] ${order.customer} · ${where}${order.note ? ` · ${order.note}` : ""}`,
    orderDetails: order.lines
      .filter((l) => l.kiotvietProductId)
      .map((l) => ({ productId: l.kiotvietProductId, quantity: l.qty, price: l.price })),
  };
  const res = await kvFetch<{ code: string }>(KIOTVIET.path.orders, { method: "POST", body: JSON.stringify(payload) });
  return res.code;
}
