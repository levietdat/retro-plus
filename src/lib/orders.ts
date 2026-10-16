import "server-only";
import { ACTIVE_ORDER_STATUSES, ENV, LIMITS, MESSAGES, OrderStatus, ServeMode, STORAGE } from "./constants";
import { dayKey } from "./format";
import { pushOrderToKiotViet, isKiotVietConfigured } from "./kiotviet";
import { findVariant, getMenu } from "./menu";
import { getDayStore, updateDay } from "./storage";
import type { CreateOrderInput, Order, OrderLine, OrderStats, PublicOrder } from "./types";

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isServeMode = (v: unknown): v is ServeMode => Object.values(ServeMode).includes(v as ServeMode);
export const isOrderStatus = (v: unknown): v is OrderStatus => Object.values(OrderStatus).includes(v as OrderStatus);

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function formatCode(seq: number): string {
  return STORAGE.orderCodePrefix + String(seq).padStart(STORAGE.orderCodeDigits, "0");
}

/** Validates input and prices every line from the server-side menu. */
async function buildLines(input: CreateOrderInput): Promise<OrderLine[]> {
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > LIMITS.linesPerOrder) {
    throw new OrderError(MESSAGES.invalidOrder);
  }
  const menu = await getMenu();
  return input.lines.map((l) => {
    const qty = Math.floor(Number(l.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > LIMITS.qtyPerLine) throw new OrderError(MESSAGES.invalidOrder);
    const found = findVariant(menu, String(l.variantId));
    if (!found) throw new OrderError(MESSAGES.itemUnavailable);
    return {
      variantId: found.variant.id,
      name: found.item.name,
      size: found.variant.label,
      price: found.variant.price,
      qty,
      kiotvietProductId: found.variant.kiotvietProductId,
    };
  });
}

export async function createOrder(input: CreateOrderInput): Promise<PublicOrder> {
  const customer = clean(input.customer, LIMITS.customerName);
  if (!customer) throw new OrderError(MESSAGES.needName);
  if (!isServeMode(input.mode)) throw new OrderError(MESSAGES.invalidOrder);
  const table = input.mode === ServeMode.Table ? clean(input.table, LIMITS.table) : "";
  if (input.mode === ServeMode.Table && !table) throw new OrderError(MESSAGES.needTable);

  const lines = await buildLines(input);
  const now = Date.now();
  const day = dayKey(now);

  const order = await updateDay(day, (doc) => {
    const seq = doc.seq + 1;
    const created: Order = {
      id: `${day}-${seq}`,
      code: formatCode(seq),
      customer,
      mode: input.mode,
      table,
      note: clean(input.note, LIMITS.note),
      lines,
      total: lines.reduce((s, l) => s + l.price * l.qty, 0),
      status: OrderStatus.New,
      createdAt: now,
      updatedAt: now,
      kiotvietOrderCode: null,
      kiotvietError: null,
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

  const { orders } = (await getDayStore().read(day)).doc;
  return toPublic(order, orders);
}

function toPublic(order: Order, sameDay: Order[]): PublicOrder {
  const ahead = sameDay.filter(
    (o) => ACTIVE_ORDER_STATUSES.includes(o.status) && o.createdAt < order.createdAt && o.id !== order.id,
  ).length;
  return {
    code: order.code,
    customer: order.customer,
    mode: order.mode,
    table: order.table,
    lines: order.lines.map(({ kiotvietProductId: _ignored, ...rest }) => rest),
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    ahead,
  };
}

export async function getTodayOrders(): Promise<Order[]> {
  return (await getDayStore().read(dayKey())).doc.orders;
}

export async function getStats(): Promise<OrderStats> {
  const orders = await getTodayOrders();
  return {
    waiting: orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length,
    making: orders.filter((o) => o.status === OrderStatus.Making).length,
    today: orders.filter((o) => o.status !== OrderStatus.Cancelled).length,
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
  patch: Partial<Pick<Order, "status" | "kiotvietOrderCode" | "kiotvietError">>,
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
  return (await getDayStore().read(day)).doc.orders;
}
