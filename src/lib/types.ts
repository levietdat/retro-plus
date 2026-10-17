import type { GroupStatus, IceLevel, OrderStatus, ServeMode, MenuSource, SugarLevel } from "./constants";

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
  /** Drinks made at the bar get sugar/ice options; bottled drinks don't. */
  customizable: boolean;
}

export interface DrinkOptions {
  sugar: SugarLevel;
  ice: IceLevel;
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
  note?: string;
  options?: Partial<DrinkOptions>;
}

export interface CreateOrderInput {
  /** Same id on retries of one checkout so a double tap never makes two orders. */
  requestId?: string;
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
  /** Per-cup note, e.g. "ít đường". */
  note?: string;
  /** Who in a group ordered this line. */
  member?: string;
  /** Only set when different from the default (100% đường, đá bình thường). */
  options?: DrinkOptions;
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
  groupCode?: string;
  paid?: boolean;
  /** Secret part of the customer's order link; without it the order cannot be looked up. */
  viewKey?: string;
  requestId?: string;
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
  /** True when no earlier order is still waiting (no shop-wide counts are exposed). */
  isNext: boolean;
  /** Rough minutes until this order is ready (0 once it is). */
  waitMinutes: number;
  groupCode?: string;
  paid: boolean;
}

/** What every visitor may see about the shop: no order counts, nobody else's orders. */
export interface StorefrontStatus {
  waitMinutes: number;
  acceptingOrders: boolean;
  soldOut: string[];
}

/** Returned once, to whoever placed the order. */
export interface CreatedOrder extends PublicOrder {
  viewKey: string;
}

export interface MyOrderLookup {
  code: string;
  key: string;
  day: string;
}

export interface MyOrderStatus {
  code: string;
  status: OrderStatus;
  paid: boolean;
}

/** Saved on this device so the customer can reopen their own orders. */
export interface MyOrderRef {
  code: string;
  key: string;
  day: string;
  at: number;
  total: number;
  cups: number;
}

export interface ShopSettings {
  acceptingOrders: boolean;
  /** Variant ids that are sold out right now. */
  soldOut: string[];
  updatedAt: number;
}

export interface PaymentInfo {
  bankId: string;
  accountNo: string;
  accountName: string;
}

export interface AdminOrderPatch {
  status?: OrderStatus;
  paid?: boolean;
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

/* ---------- Group orders ---------- */
export interface GroupItem {
  id: string;
  memberId: string;
  member: string;
  variantId: string;
  name: string;
  size: string;
  price: number;
  qty: number;
  note: string;
  options?: DrinkOptions;
  addedAt: number;
  kiotvietProductId?: number;
}

export interface GroupDoc {
  code: string;
  hostToken: string;
  hostMemberId: string;
  host: string;
  mode: ServeMode;
  table: string;
  note: string;
  status: GroupStatus;
  items: GroupItem[];
  createdAt: number;
  updatedAt: number;
  orderCode: string | null;
  orderKey?: string | null;
}

/** What the group page receives: no tokens or other members' ids. */
export interface PublicGroupItem extends Omit<GroupItem, "memberId" | "kiotvietProductId"> {
  mine: boolean;
}

export interface PublicGroup {
  code: string;
  host: string;
  mode: ServeMode;
  table: string;
  note: string;
  status: GroupStatus;
  items: PublicGroupItem[];
  total: number;
  createdAt: number;
  expiresAt: number;
  orderCode: string | null;
  /** Shared with group members so everyone can follow the order. */
  orderKey: string | null;
  isHost: boolean;
}

export interface CreateGroupInput {
  host: string;
  memberId: string;
  mode: ServeMode;
  table?: string;
}

export interface CreateGroupResult {
  code: string;
  hostToken: string;
}

export interface AddGroupItemInput {
  memberId: string;
  member: string;
  variantId: string;
  qty?: number;
  note?: string;
  options?: Partial<DrinkOptions>;
}

export interface UpdateGroupItemInput {
  qty?: number;
  note?: string;
}

export interface UpdateGroupInput {
  mode?: ServeMode;
  table?: string;
  note?: string;
}
