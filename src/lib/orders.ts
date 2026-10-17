import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  ACTIVE_ORDER_STATUSES,
  ENV,
  LIMITS,
  DAY_MS,
  MY_ORDERS_MAX,
  ORDER_KEY_BYTES,
  MESSAGES,
  OrderStatus,
  POPULAR,
  ServeMode,
  STORAGE,
  WAIT,
} from "./constants";
import { dayKey } from "./format";
import { pushOrderToKiotViet, isKiotVietConfigured } from "./kiotviet";
import { findVariant, getMenu } from "./menu";
import { InvalidOptionsError, normalizeOptions } from "./options";
import { getSettings } from "./settings";
import { readDay, updateDay } from "./storage";
import type {
  AdminOrderPatch,
  CreatedOrder,
  MyOrderLookup,
  MyOrderStatus,
  CreateOrderInput,
  DrinkOptions,
  Menu,
  Order,
  OrderLine,
  PublicOrder,
  StorefrontStatus,
} from "./types";

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const isServeMode = (v: unknown): v is ServeMode => Object.values(ServeMode).includes(v as ServeMode);
export const isOrderStatus = (v: unknown): v is OrderStatus => Object.values(OrderStatus).includes(v as OrderStatus);

export const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function cleanQty(v: unknown): number {
  const qty = Math.floor(Number(v));
  if (!Number.isFinite(qty) || qty < 1 || qty > LIMITS.qtyPerLine) throw new OrderError(MESSAGES.invalidOrder);
  return qty;
}

export function cleanOptions(input: Partial<DrinkOptions> | undefined, customizable: boolean): DrinkOptions | undefined {
  try {
    return normalizeOptions(input, customizable);
  } catch (err) {
    if (err instanceof InvalidOptionsError) throw new OrderError(MESSAGES.invalidOptions);
    throw err;
  }
}

/** Throws when the shop is paused or a variant is sold out. */
export async function assertCanOrder(variantIds: string[]): Promise<void> {
  const settings = await getSettings();
  if (!settings.acceptingOrders) throw new OrderError(MESSAGES.shopPaused, 409);
  if (variantIds.some((id) => settings.soldOut.includes(id))) throw new OrderError(MESSAGES.soldOut, 409);
}

function formatCode(seq: number): string {
  return STORAGE.orderCodePrefix + String(seq).padStart(STORAGE.orderCodeDigits, "0");
}

/** Validates input and prices every line from the server-side menu. */
async function buildLines(input: CreateOrderInput, menu: Menu): Promise<OrderLine[]> {
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > LIMITS.linesPerOrder) {
    throw new OrderError(MESSAGES.invalidOrder);
  }
  return input.lines.map((l) => {
    const found = findVariant(menu, String(l.variantId));
    if (!found) throw new OrderError(MESSAGES.itemUnavailable);
    const note = clean(l.note, LIMITS.lineNote);
    const options = cleanOptions(l.options, found.customizable);
    return {
      variantId: found.variant.id,
      name: found.item.name,
      size: found.variant.label,
      price: found.variant.price,
      qty: cleanQty(l.qty),
      ...(note ? { note } : {}),
      ...(options ? { options } : {}),
      kiotvietProductId: found.variant.kiotvietProductId,
    };
  });
}

export interface NewOrderBase {
  customer: string;
  mode: ServeMode;
  table: string;
  note: string;
  groupCode?: string;
  /** Client-made id for one checkout; a retry with the same id returns the first order. */
  requestId?: string;
}

/** Stores an order with already-priced lines; used by single and group orders. */
export async function insertOrder(base: NewOrderBase, lines: OrderLine[]): Promise<CreatedOrder> {
  if (lines.length === 0) throw new OrderError(MESSAGES.invalidOrder);
  const now = Date.now();
  const viewKey = randomBytes(ORDER_KEY_BYTES).toString("base64url");
  const day = dayKey(now);

  const { order, duplicate } = await updateDay(day, (doc) => {
    const existing = base.requestId ? doc.orders.find((o) => o.requestId === base.requestId) : undefined;
    if (existing) return { doc, result: { order: existing, duplicate: true } };
    const seq = doc.seq + 1;
    const created: Order = {
      id: `${day}-${seq}`,
      code: formatCode(seq),
      ...base,
      lines,
      total: lines.reduce((s, l) => s + l.price * l.qty, 0),
      status: OrderStatus.New,
      createdAt: now,
      updatedAt: now,
      kiotvietOrderCode: null,
      kiotvietError: null,
      paid: false,
      viewKey,
    };
    return { doc: { ...doc, seq, orders: [...doc.orders, created] }, result: { order: created, duplicate: false } };
  });

  if (!duplicate && process.env[ENV.kvPushOrders] === "true" && isKiotVietConfigured()) {
    try {
      const kvCode = await pushOrderToKiotViet(order);
      await patchOrder(order.id, { kiotvietOrderCode: kvCode });
    } catch (err) {
      console.error("[orders] push to KiotViet failed", err);
      await patchOrder(order.id, { kiotvietError: String((err as Error).message).slice(0, 200) });
    }
  }

  return { ...toPublic(order, (await readDay(day)).orders), viewKey: order.viewKey ?? viewKey };
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const customer = clean(input.customer, LIMITS.customerName);
  if (!customer) throw new OrderError(MESSAGES.needName);
  if (!isServeMode(input.mode)) throw new OrderError(MESSAGES.invalidOrder);
  const table = input.mode === ServeMode.Table ? clean(input.table, LIMITS.table) : "";
  if (input.mode === ServeMode.Table && !table) throw new OrderError(MESSAGES.needTable);
  const lines = await buildLines(input, await getMenu());
  await assertCanOrder(lines.map((l) => l.variantId));
  const requestId = clean(input.requestId, LIMITS.requestId) || undefined;
  return insertOrder({ customer, mode: input.mode, table, note: clean(input.note, LIMITS.note), requestId }, lines);
}

/* ---------- Wait estimate ---------- */
function waitConfig() {
  const perCup = Number(process.env[ENV.prepMinutesPerCup]) || WAIT.defaultMinutesPerCup;
  const baristas = Math.max(1, Number(process.env[ENV.baristas]) || WAIT.defaultBaristas);
  return { perCup, baristas };
}

const cupsOf = (o: Order) => o.lines.reduce((s, l) => s + l.qty, 0);

function minutesFor(cups: number): number {
  const { perCup, baristas } = waitConfig();
  return cups > 0 ? Math.max(1, Math.ceil((cups * perCup) / baristas)) : 0;
}

function toPublic(order: Order, sameDay: Order[]): PublicOrder {
  const active = sameDay.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const before = active.filter((o) => o.createdAt < order.createdAt && o.id !== order.id);
  const waitMinutes = ACTIVE_ORDER_STATUSES.includes(order.status)
    ? minutesFor(before.reduce((s, o) => s + cupsOf(o), 0) + cupsOf(order))
    : 0;
  return {
    code: order.code,
    customer: order.customer,
    mode: order.mode,
    table: order.table,
    lines: order.lines.map(({ kiotvietProductId: _ignored, ...rest }) => rest),
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    isNext: before.length === 0,
    waitMinutes,
    paid: Boolean(order.paid),
    ...(order.groupCode ? { groupCode: order.groupCode } : {}),
  };
}

export async function getTodayOrders(): Promise<Order[]> {
  return (await readDay(dayKey())).orders;
}

/** Shop-level info any visitor may see. Deliberately no order counts. */
export async function getStorefront(): Promise<StorefrontStatus> {
  const [orders, settings] = await Promise.all([getTodayOrders(), getSettings()]);
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  return {
    waitMinutes: minutesFor(active.reduce((s, o) => s + cupsOf(o), 0)),
    acceptingOrders: settings.acceptingOrders,
    soldOut: settings.soldOut,
  };
}

function keyMatches(order: Order, key: string): boolean {
  if (!order.viewKey) return false;
  const a = Buffer.from(order.viewKey);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lookup by today's code AND the private key from the customer's link.
 * A wrong or missing key looks exactly like a missing order, so codes can't be enumerated.
 */
export async function getPublicOrder(code: string, key: string): Promise<PublicOrder | null> {
  if (!key) return null;
  // Codes restart every day; also look at yesterday so a late-night order still opens after 00:00.
  for (const day of [dayKey(), dayKey(Date.now() - DAY_MS)]) {
    const orders = (await readDay(day)).orders;
    const order = orders.find((o) => o.code === code && keyMatches(o, key));
    if (order) return toPublic(order, orders);
  }
  return null;
}

/** Status of several of this device's own orders at once (header "Đơn của bạn"). */
export async function getMyOrders(refs: MyOrderLookup[]): Promise<MyOrderStatus[]> {
  const byDay = new Map<string, Order[]>();
  const out: MyOrderStatus[] = [];
  for (const ref of refs.slice(0, MY_ORDERS_MAX)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ref.day) || !ref.key) continue;
    if (!byDay.has(ref.day)) byDay.set(ref.day, (await readDay(ref.day)).orders);
    const order = byDay.get(ref.day)!.find((o) => o.code === ref.code && keyMatches(o, ref.key));
    if (order) out.push({ code: order.code, status: order.status, paid: Boolean(order.paid) });
  }
  return out;
}

function dayFromId(id: string): string {
  const day = id.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new OrderError(MESSAGES.orderNotFound, 404);
  return day;
}

export async function patchOrder(
  id: string,
  patch: AdminOrderPatch & Partial<Pick<Order, "kiotvietOrderCode" | "kiotvietError">>,
): Promise<Order> {
  return updateDay(dayFromId(id), (doc) => {
    const idx = doc.orders.findIndex((o) => o.id === id);
    if (idx < 0) throw new OrderError(MESSAGES.orderNotFound, 404);
    const updated: Order = { ...doc.orders[idx], ...patch, updatedAt: Date.now() };
    const orders = doc.orders.slice();
    orders[idx] = updated;
    return { doc: { ...doc, orders }, result: updated };
  });
}

export async function getOrdersForDay(day: string): Promise<Order[]> {
  return (await readDay(day)).orders;
}

/* ---------- Best sellers ---------- */
let popularCache: { at: number; ids: string[] } | null = null;

/** Menu item ids ordered most in the last few days (by cups). Empty until there is enough data. */
export async function getPopularItemIds(menu: Menu): Promise<string[]> {
  if (popularCache && Date.now() - popularCache.at < POPULAR.cacheMs) return popularCache.ids;
  const days = Array.from({ length: POPULAR.days }, (_, i) => dayKey(Date.now() - i * DAY_MS));
  const docs = await Promise.all(days.map((d) => readDay(d).catch(() => null)));
  const orders = docs.flatMap((d) => d?.orders ?? []).filter((o) => o.status !== OrderStatus.Cancelled);
  const cups = new Map<string, number>();
  for (const o of orders) {
    for (const l of o.lines) {
      const itemId = findVariant(menu, l.variantId)?.item.id;
      if (itemId) cups.set(itemId, (cups.get(itemId) ?? 0) + l.qty);
    }
  }
  const ids =
    orders.length >= POPULAR.minOrders
      ? [...cups.entries()].sort((a, b) => b[1] - a[1]).slice(0, POPULAR.limit).map(([id]) => id)
      : [];
  popularCache = { at: Date.now(), ids };
  return ids;
}
