export const SHOP_NAME = "Retro Huế";
export const SHOP_TAGLINE = "Gọi món tại quán · mang đi";
export const LOCALE = "vi-VN";
export const CURRENCY_SUFFIX = "đ";
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export enum OrderStatus {
  New = "new",
  Making = "making",
  Ready = "ready",
  Done = "done",
  Cancelled = "cancelled",
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.New]: "Mới",
  [OrderStatus.Making]: "Đang pha",
  [OrderStatus.Ready]: "Xong – chờ lấy",
  [OrderStatus.Done]: "Đã giao",
  [OrderStatus.Cancelled]: "Đã huỷ",
};

/** Next step in the normal flow; absent = final state. */
export const ORDER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.New]: OrderStatus.Making,
  [OrderStatus.Making]: OrderStatus.Ready,
  [OrderStatus.Ready]: OrderStatus.Done,
};

export const ORDER_NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.New]: "Bắt đầu pha",
  [OrderStatus.Making]: "Báo xong",
  [OrderStatus.Ready]: "Đã giao khách",
};

/** Orders counted as "đang chờ" in the public counter. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.New, OrderStatus.Making];

export enum ServeMode {
  Table = "table",
  Takeaway = "takeaway",
}

export const SERVE_MODE_LABEL: Record<ServeMode, string> = {
  [ServeMode.Table]: "Uống tại quán",
  [ServeMode.Takeaway]: "Mang đi",
};

/* ---------- Drink options (like the big VN tea/coffee chains) ---------- */
export enum SugarLevel {
  Full = "100",
  Less = "70",
  Half = "50",
  Little = "30",
  None = "0",
}

export const SUGAR_LABEL: Record<SugarLevel, string> = {
  [SugarLevel.Full]: "100%",
  [SugarLevel.Less]: "70%",
  [SugarLevel.Half]: "50%",
  [SugarLevel.Little]: "30%",
  [SugarLevel.None]: "Không",
};

export enum IceLevel {
  Normal = "normal",
  Less = "less",
  None = "none",
  Separate = "separate",
}

export const ICE_LABEL: Record<IceLevel, string> = {
  [IceLevel.Normal]: "Bình thường",
  [IceLevel.Less]: "Ít đá",
  [IceLevel.None]: "Không đá",
  [IceLevel.Separate]: "Đá riêng",
};

export const DEFAULT_SUGAR = SugarLevel.Full;
export const DEFAULT_ICE = IceLevel.Normal;

export enum MenuSource {
  Static = "static",
  KiotViet = "kiotviet",
}

export enum GroupStatus {
  Open = "open",
  Submitted = "submitted",
  Closed = "closed",
}

export const GROUP = {
  keyPrefix: "group/",
  codeLength: 6,
  /** No 0/O/1/I so codes are easy to read aloud. */
  codeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  tokenBytes: 18,
  maxItems: 60,
  maxMembers: 20,
  ttlHours: 6,
  memberHeader: "x-member-id",
  hostHeader: "x-host-token",
  memberIdMaxLength: 64,
} as const;

/** Query param carrying an order's private view key. */
export const ORDER_KEY_PARAM = "k";
export const ORDER_KEY_BYTES = 9;
export const DAY_MS = 86_400_000;

export const ROUTES = {
  home: "/",
  group: (code: string) => `/g/${encodeURIComponent(code)}`,
  order: (code: string, key: string) => `/order/${encodeURIComponent(code)}?${ORDER_KEY_PARAM}=${encodeURIComponent(key)}`,
  admin: "/admin",
  adminLogin: "/admin/login",
} as const;

export const API = {
  menu: "/api/menu",
  orders: "/api/orders",
  storefront: "/api/storefront",
  myOrders: "/api/orders/mine",
  orderByCode: (code: string, key: string) =>
    `/api/orders/${encodeURIComponent(code)}?${ORDER_KEY_PARAM}=${encodeURIComponent(key)}`,
  groups: "/api/groups",
  group: (code: string) => `/api/groups/${encodeURIComponent(code)}`,
  groupItems: (code: string) => `/api/groups/${encodeURIComponent(code)}/items`,
  groupItem: (code: string, itemId: string) =>
    `/api/groups/${encodeURIComponent(code)}/items/${encodeURIComponent(itemId)}`,
  groupSubmit: (code: string) => `/api/groups/${encodeURIComponent(code)}/submit`,
  adminLogin: "/api/admin/login",
  adminLogout: "/api/admin/logout",
  adminOrders: "/api/admin/orders",
  adminOrder: (id: string) => `/api/admin/orders/${id}`,
  adminSettings: "/api/admin/settings",
} as const;

export const ADMIN_COOKIE = "retro_admin";
export const ADMIN_SESSION_HOURS = 12;

export const POLL_MS = {
  /** Wait estimate, paused, sold out: changes slowly, also refreshed when the tab regains focus. */
  storefront: 30000,
  orderStatus: 4000,
  /** Status page slows down after a while so idle phones don't hammer the server. */
  orderStatusSlow: 10000,
  orderStatusSlowAfterMs: 10 * 60 * 1000,
  /** Header "Đơn của bạn" status while one of them is still being made. */
  myOrders: 15000,
  adminBoard: 3000,
  group: 2500,
} as const;

export const LIMITS = {
  customerName: 40,
  table: 6,
  note: 200,
  linesPerOrder: 30,
  qtyPerLine: 20,
  lineNote: 80,
  requestId: 64,
} as const;

export const STORAGE_KEY_CUSTOMER = "retro-customer";
export const STORAGE_KEY_MEMBER_ID = "retro-member-id";
export const STORAGE_KEY_HOST_TOKEN = (code: string) => `retro-host-${code}`;
export const STORAGE_KEY_LAST_ORDER = "retro-last-order";
export const STORAGE_KEY_MY_ORDERS = "retro-my-orders";
export const MY_ORDERS_MAX = 10;

export const ENV = {
  adminPassword: "ADMIN_PASSWORD",
  sessionSecret: "SESSION_SECRET",
  storageDriver: "STORAGE_DRIVER",
  dataDir: "DATA_DIR",
  menuSource: "MENU_SOURCE",
  kvRetailer: "KIOTVIET_RETAILER",
  kvClientId: "KIOTVIET_CLIENT_ID",
  kvClientSecret: "KIOTVIET_CLIENT_SECRET",
  kvBranchId: "KIOTVIET_BRANCH_ID",
  kvPushOrders: "KIOTVIET_PUSH_ORDERS",
  prepMinutesPerCup: "PREP_MINUTES_PER_CUP",
  baristas: "BARISTAS",
  bankId: "BANK_ID",
  bankAccountNo: "BANK_ACCOUNT_NO",
  bankAccountName: "BANK_ACCOUNT_NAME",
} as const;

export const WAIT = {
  defaultMinutesPerCup: 2,
  defaultBaristas: 1,
} as const;

export const POPULAR = {
  days: 7,
  limit: 6,
  cacheMs: 10 * 60 * 1000,
  minOrders: 3,
} as const;

/** VietQR quick-link image (https://www.vietqr.io). */
export const VIETQR = {
  imageUrl: (bankId: string, accountNo: string) =>
    `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-compact2.png`,
  transferPrefix: "RETRO",
} as const;

export const SETTINGS_KEY = "settings/shop";

/** Short CDN cache for the public storefront status (seconds). */
export const STOREFRONT_CACHE = { sMaxAge: 15, staleWhileRevalidate: 30 } as const;

/**
 * Best-effort spam guard per IP and serverless instance.
 * Generous on purpose: every guest on the shop's Wi-Fi shares one public IP.
 */
export const RATE_LIMIT = {
  windowMs: 60_000,
  orders: 20,
  groupWrites: 150,
  ipHeaders: ["x-nf-client-connection-ip", "x-forwarded-for", "x-real-ip"],
} as const;

export enum StorageDriver {
  File = "file",
  Netlify = "netlify",
}

export const STORAGE = {
  defaultDataDir: "./data",
  blobStoreName: "retro-orders",
  dayKeyPrefix: "day/",
  writeRetries: 6,
  orderCodePrefix: "R",
  orderCodeDigits: 3,
} as const;

export const KIOTVIET = {
  tokenUrl: "https://id.kiotviet.vn/connect/token",
  baseUrl: "https://publicfnb.kiotapi.com",
  scope: "PublicApi.Access.FNB",
  grantType: "client_credentials",
  pageSize: 100,
  menuCacheMs: 5 * 60 * 1000,
  tokenSafetyMs: 60 * 60 * 1000,
  path: {
    categories: "/categories",
    products: "/products",
    orders: "/orders",
  },
  header: {
    retailer: "Retailer",
    authorization: "Authorization",
  },
} as const;

export const MESSAGES = {
  cartEmpty: "Chưa có món nào. Bấm + cạnh món để thêm.",
  needName: "Nhập tên để quán gọi khi xong món.",
  needTable: "Nhập số bàn.",
  sendFail: "Không gửi được đơn. Kiểm tra mạng rồi thử lại.",
  invalidOrder: "Đơn không hợp lệ. Tải lại trang rồi chọn món lại.",
  itemUnavailable: "Có món không còn trong thực đơn. Tải lại trang rồi chọn lại.",
  orderNotFound: "Không tìm thấy đơn.",
  unauthorized: "Cần đăng nhập quản trị.",
  wrongPassword: "Sai mật khẩu.",
  adminNotConfigured: "Chưa đặt ADMIN_PASSWORD trên server.",
  invalidStatus: "Trạng thái không hợp lệ.",
  menuLoadFail: "Không tải được thực đơn.",
  noResult: "Không thấy món nào khớp.",
  boardEmpty: "Chưa có đơn nào ở mục này.",
  groupNotFound: "Không tìm thấy nhóm. Kiểm tra lại mã hoặc link.",
  groupClosed: "Nhóm này đã gửi đơn hoặc đã hết hạn.",
  groupFull: "Nhóm đã đủ món tối đa. Gửi đơn này rồi tạo nhóm mới.",
  groupTooManyMembers: "Nhóm đã đủ người.",
  groupEmpty: "Nhóm chưa có món nào.",
  notHost: "Chỉ người tạo nhóm mới gửi được đơn.",
  notYourItem: "Bạn chỉ sửa được món của mình.",
  needMemberName: "Nhập tên của bạn trước khi chọn món.",
  shopPaused: "Quán đang tạm ngưng nhận đơn online. Vui lòng gọi món tại quầy.",
  soldOut: "Có món vừa hết. Bỏ món đó ra rồi gửi lại.",
  invalidOptions: "Tuỳ chọn đường/đá không hợp lệ.",
  tooMany: "Bạn gửi hơi nhanh. Đợi một chút rồi thử lại.",
} as const;
