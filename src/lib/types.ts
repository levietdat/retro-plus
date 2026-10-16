import type { OrderStatus, ServeMode, MenuSource } from "./constants";

export interface MenuVariant {
  /** Stable id used in orders. Static menu: slug; KiotViet: product id as string. */
  id: string;
  /** Size label shown to the customer ("L", "M"); empty for single-size items. */
  label: string;
  price: number;
  kiotvietProductId?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  tag?: string;
  image?: string;
  variants: MenuVariant[];
}

export interface MenuCategory {
  id: string;
  name: string;
}

export interface Menu {
  source: MenuSource;
  categories: MenuCategory[];
  items: MenuItem[];
  updatedAt: number;
}

/** What the browser sends. Prices are NOT trusted from the client. */
export interface CreateOrderLineInput {
  variantId: string;
  qty: number;
}

export interface CreateOrderInput {
  customer: string;
  mode: ServeMode;
  table?: string;
  note?: string;
  lines: CreateOrderLineInput[];
}

export interface OrderLine {
  variantId: string;
  name: string;
  size: string;
  price: number;
  qty: number;
  kiotvietProductId?: number;
}

export interface Order {
  /** `${day}-${seq}`, e.g. 2026-10-16-12 */
  id: string;
  code: string;
  customer: string;
  mode: ServeMode;
  table: string;
  note: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  kiotvietOrderCode: string | null;
  kiotvietError: string | null;
}

/** Public view of an order (no admin-only fields). */
export interface PublicOrder {
  code: string;
  customer: string;
  mode: ServeMode;
  table: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  createdAt: number;
  ahead: number;
}

export interface OrderStats {
  waiting: number;
  making: number;
  today: number;
}

export interface ApiError {
  error: string;
}

/** One blob per business day keeps reads cheap and writes atomic (ETag). */
export interface DayDoc {
  day: string;
  seq: number;
  orders: Order[];
}
