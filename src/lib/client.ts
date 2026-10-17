"use client";
import {
  GROUP,
  MESSAGES,
  STORAGE_KEY_CUSTOMER,
  STORAGE_KEY_HOST_TOKEN,
  STORAGE_KEY_LAST_ORDER,
  MY_ORDERS_MAX,
  STORAGE_KEY_MEMBER_ID,
  STORAGE_KEY_MY_ORDERS,
} from "./constants";
import type { ApiError, CreatedOrder, DrinkOptions, MyOrderRef } from "./types";

export interface SavedCustomer {
  customer: string;
  table: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

/** One id per checkout attempt; the server returns the same order if it sees it twice. */
export const newRequestId = () => randomHex(12);

let memoryMemberId = "";

/** Random id for this browser, so a person can edit only their own drinks in a group. */
export function getMemberId(): string {
  const saved = safeGet(STORAGE_KEY_MEMBER_ID);
  if (saved) return saved;
  if (!memoryMemberId) memoryMemberId = randomHex(12);
  safeSet(STORAGE_KEY_MEMBER_ID, memoryMemberId);
  return memoryMemberId;
}

export const getHostToken = (code: string) => safeGet(STORAGE_KEY_HOST_TOKEN(code)) || "";
export const saveHostToken = (code: string, token: string) => safeSet(STORAGE_KEY_HOST_TOKEN(code), token);

export function loadCustomer(): Partial<SavedCustomer> {
  try {
    return JSON.parse(safeGet(STORAGE_KEY_CUSTOMER) || "{}") as Partial<SavedCustomer>;
  } catch {
    return {};
  }
}

export function saveCustomer(patch: Partial<SavedCustomer>) {
  safeSet(STORAGE_KEY_CUSTOMER, JSON.stringify({ ...loadCustomer(), ...patch }));
}

export function groupHeaders(code: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [GROUP.memberHeader]: getMemberId(),
    [GROUP.hostHeader]: getHostToken(code),
  };
}

export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Patch = "PATCH",
  Delete = "DELETE",
}

/** fetch + JSON with the server's Vietnamese error message surfaced as an Error. */
export async function apiJson<T>(url: string, method: HttpMethod, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({ error: MESSAGES.sendFail }))) as T | ApiError;
  if (!res.ok) throw Object.assign(new Error((data as ApiError).error || MESSAGES.sendFail), { status: res.status });
  return data as T;
}

/* ---------- Last order, for one-tap reorder ---------- */
export interface StoredLine {
  variantId: string;
  qty: number;
  options?: DrinkOptions;
  note?: string;
}

export interface StoredLastOrder {
  at: number;
  lines: StoredLine[];
}

export function loadLastOrder(): StoredLastOrder | null {
  try {
    const raw = safeGet(STORAGE_KEY_LAST_ORDER);
    return raw ? (JSON.parse(raw) as StoredLastOrder) : null;
  } catch {
    return null;
  }
}

export function saveLastOrder(lines: StoredLine[]) {
  safeSet(STORAGE_KEY_LAST_ORDER, JSON.stringify({ at: Date.now(), lines } satisfies StoredLastOrder));
}

/* ---------- This device's own orders (the only orders a customer can see) ---------- */
export function loadMyOrders(today: string): MyOrderRef[] {
  try {
    const all = JSON.parse(safeGet(STORAGE_KEY_MY_ORDERS) || "[]") as MyOrderRef[];
    return all.filter((o) => o.day === today);
  } catch {
    return [];
  }
}

export function saveMyOrderRef(ref: MyOrderRef) {
  const rest = loadMyOrders(ref.day).filter((o) => o.code !== ref.code);
  safeSet(STORAGE_KEY_MY_ORDERS, JSON.stringify([ref, ...rest].slice(0, MY_ORDERS_MAX)));
}

export function saveMyOrder(order: CreatedOrder, day: string) {
  saveMyOrderRef({
    code: order.code,
    key: order.viewKey,
    day,
    at: order.createdAt,
    total: order.total,
    cups: order.lines.reduce((s, l) => s + l.qty, 0),
  });
}
