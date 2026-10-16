import "server-only";
import {
  ACTIVE_ORDER_STATUSES,
  ENV,
  LIMITS,
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
  CreateOrderInput,
  DrinkOptions,
  Menu,
  Order,
  OrderLine,
  OrderStats,
  PublicOrder,
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
}

/** Stores an order with already-priced lines; used by single and group orders. */
export async function insertOrder(base: NewOrderBase, lines: OrderLine[]): Promise<PublicOrder> {
  if (lines.length === 0) throw new OrderError(MESSAGES.invalidOrder);
  const now = Date.now();
  const day = dayKey(now);

  const order = await updateDay(day, (doc) => {
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
    };
    return { doc: { ...doc, seq, orders: [...doc.orders, created] }, result: created };
  });

  if (process.env[ENV.kvPushOrders] === "true" && isKiotVietConfigured()) {
    try {
      const kvCode = await pushOrderToKiotViet(order);
      await patchOrder(order.id, { kiotvietOrderCode: kvCode });
    } catch (err) {
      console.error("[orders] push to KiotViet failed", err);
      await patchOrder(order.id, { kiotvietError: String((err as Error).message).slice(0, 200) });
    }
  }

  return toPublic(order, (await readDay(day)).orders);
}

export async function createOrder(input: CreateOrderInput): Promise<PublicOrder> {
  const customer = clean(input.customer, LIMITS.customerName);
  if (!customer) throw new OrderError(MESSAGES.needName);
  if (!isServeMode(input.mode)) throw new OrderError(MESSAGES.invalidOrder);
  const table = input.mode === ServeMode.Table ? clean(input.table, LIMITS.table) : "";
  if (input.mode === ServeMode.Table && !table) throw new OrderError(MESSAGES.needTable);
  const lines = await buildLines(input, await getMenu());
  await assertCanOrder(lines.map((l) => l.variantId));
  return insertOrder({ customer, mode: input.mode, table, note: clean(input.note, LIMITS.note) }, lines);
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
    ahead: before.length,
    waitMinutes,
    paid: Boolean(order.paid),
    ...(order.groupCode ? { groupCode: order.groupCode } : {}),
  };
}

export async function getTodayOrders(): Promise<Order[]> {
  return (await readDay(dayKey())).orders;
}

export async function getStats(): Promise<OrderStats> {
  const [orders, settings] = await Promise.all([getTodayOrders(), getSettings()]);
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  return {
    waiting: active.length,
    making: orders.filter((o) => o.status === OrderStatus.Making).length,
    today: orders.filter((o) => o.status !== OrderStatus.Cancelled).length,
    waitMinutes: minutesFor(active.reduce((s, o) => s + cupsOf(o), 0)),
    acceptingOrders: settings.acceptingOrders,
    soldOut: settings.soldOut,
  };
}

/** Public lookup by today's code (codes reset each day). */
export async function getPublicOrder(code: string): Promise<PublicOrder | null> {
  const orders = await getTodayOrders();
  const order = orders.find((o) => o.code === code);
  return order ? toPublic(order, orders) : null;
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
  const days = Array.from({ length: POPULAR.days }, (_, i) => dayKey(Date.now() - i * 86_400_000));
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
