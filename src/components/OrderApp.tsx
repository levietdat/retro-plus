"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API, LIMITS, MESSAGES, ROUTES, SERVE_MODE_LABEL, ServeMode } from "@/lib/constants";
import {
  apiJson,
  HttpMethod,
  loadCustomer,
  loadLastOrder,
  saveCustomer,
  saveLastOrder,
  type StoredLastOrder,
} from "@/lib/client";
import { findVariantClient } from "@/lib/menu-client";
import { formatMoney } from "@/lib/format";
import { describeOptions, optionsKey } from "@/lib/options";
import type { CreateOrderInput, DrinkOptions, Menu, MenuItem, MenuVariant, PublicOrder } from "@/lib/types";
import type { ItemChoice } from "./ItemSheet";
import { LineLabel } from "./LineLabel";
import { MenuBrowser } from "./MenuBrowser";
import { useSoldOut, useStats } from "./StatsProvider";

interface CartLine {
  key: string;
  item: MenuItem;
  variant: MenuVariant;
  options?: DrinkOptions;
  note: string;
  qty: number;
}

const lineKey = (variantId: string, options: DrinkOptions | undefined, note: string) =>
  `${variantId}#${optionsKey(options)}#${note}`;

export function OrderApp({ menu, popularIds }: { menu: Menu; popularIds: string[] }) {
  const router = useRouter();
  const stats = useStats();
  const soldOut = useSoldOut();
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [mode, setMode] = useState<ServeMode>(ServeMode.Table);
  const [customer, setCustomer] = useState("");
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<StoredLastOrder | null>(null);

  useEffect(() => {
    const saved = loadCustomer();
    if (saved.customer) setCustomer(saved.customer);
    if (saved.table) setTable(saved.table);
    // Table number from a QR code: /?ban=5
    const fromQr = new URLSearchParams(window.location.search).get("ban");
    if (fromQr) setTable(fromQr.slice(0, LIMITS.table));
    setLast(loadLastOrder());
  }, []);

  const lines = [...cart.values()];
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.variant.price, 0);
  const paused = stats ? !stats.acceptingOrders : false;
  const hasSoldOut = lines.some((l) => soldOut.has(l.variant.id));

  /** Previous order mapped onto today's menu; lines that no longer exist are dropped. */
  const reorder = useMemo(() => {
    if (!last) return [];
    return last.lines
      .map((l) => {
        const found = findVariantClient(menu, l.variantId);
        return found ? { ...found, options: l.options, note: l.note ?? "", qty: l.qty } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [last, menu]);

  function add({ item, variant, options, note: lineNote, qty }: ItemChoice) {
    setError("");
    setCart((prev) => {
      const next = new Map(prev);
      const key = lineKey(variant.id, options, lineNote);
      const cur = next.get(key);
      next.set(key, { key, item, variant, options, note: lineNote, qty: Math.min((cur?.qty ?? 0) + qty, LIMITS.qtyPerLine) });
      return next;
    });
  }

  function step(key: string, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const cur = next.get(key);
      if (!cur) return prev;
      const qty = Math.min(cur.qty + delta, LIMITS.qtyPerLine);
      if (qty <= 0) next.delete(key);
      else next.set(key, { ...cur, qty });
      return next;
    });
  }

  function addReorder() {
    reorder.filter((r) => !soldOut.has(r.variant.id)).forEach((r) => add(r));
    setOpen(true);
  }

  async function submit() {
    if (!customer.trim()) return setError(MESSAGES.needName);
    if (mode === ServeMode.Table && !table.trim()) return setError(MESSAGES.needTable);
    setSending(true);
    setError("");
    const body: CreateOrderInput = {
      customer,
      mode,
      table,
      note,
      lines: lines.map((l) => ({ variantId: l.variant.id, qty: l.qty, options: l.options, note: l.note })),
    };
    try {
      const order = await apiJson<PublicOrder>(API.orders, HttpMethod.Post, body);
      saveCustomer({ customer, table });
      saveLastOrder(body.lines.map(({ variantId, qty, options, note: n }) => ({ variantId, qty, options: options as DrinkOptions | undefined, note: n })));
      router.push(ROUTES.order(order.code));
    } catch (e) {
      setError((e as Error).message || MESSAGES.sendFail);
      setSending(false);
    }
  }

  const qtyForItem = (itemId: string) => lines.filter((l) => l.item.id === itemId).reduce((s, l) => s + l.qty, 0);

  return (
    <>
      {reorder.length > 0 && (
        <section className="reorder" aria-label="Gọi lại">
          <div className="reorder-text">
            <strong>Gọi lại như lần trước?</strong>
            <span className="hint">
              {reorder.map((r) => `${r.qty} × ${r.item.name}${r.variant.label ? ` (${r.variant.label})` : ""}${describeOptions(r.options) ? ` – ${describeOptions(r.options)}` : ""}`).join(", ")}
            </span>
          </div>
          <button className="ghost strong" onClick={addReorder}>Thêm vào đơn</button>
        </section>
      )}

      <div className="layout">
        <MenuBrowser menu={menu} popularIds={popularIds} qtyForItem={qtyForItem} onAdd={add} />

        <aside className={`ticket${open ? " open" : ""}`} aria-label="Đơn của bạn">
          <div className="ticket-head">
            <h3>Đơn của bạn</h3>
            <button className="toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Thu gọn" : `Xem đơn${count ? ` (${count} · ${formatMoney(total)})` : ""}`}
            </button>
          </div>
          <div className="ticket-body">
            <div className="lines">
              {lines.length === 0 && <p className="hint">{MESSAGES.cartEmpty}</p>}
              {lines.map((l) => (
                <div className={`line${soldOut.has(l.variant.id) ? " out" : ""}`} key={l.key}>
                  <LineLabel name={l.item.name} size={l.variant.label} options={l.options} note={soldOut.has(l.variant.id) ? `vừa hết – bỏ ra giúp quán${l.note ? ` · ${l.note}` : ""}` : l.note} />
                  <span className="step">
                    <button aria-label="Bớt" onClick={() => step(l.key, -1)}>−</button>
                    <span>{l.qty}</span>
                    <button aria-label="Thêm" onClick={() => step(l.key, 1)}>+</button>
                  </span>
                  <span className="num">{formatMoney(l.qty * l.variant.price)}</span>
                </div>
              ))}
            </div>
            {count > 0 && (
              <div className="total">
                <span>Tổng ({count} món)</span>
                <span className="num">{formatMoney(total)}</span>
              </div>
            )}
            <div className="seg">
              {Object.values(ServeMode).map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {SERVE_MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <label className="label" htmlFor="customer">
              Tên của bạn
              <input id="customer" className="field" value={customer} maxLength={LIMITS.customerName}
                placeholder="vd: Anh Đạt" onChange={(e) => setCustomer(e.target.value)} />
            </label>
            {mode === ServeMode.Table && (
              <label className="label" htmlFor="table">
                Số bàn
                <input id="table" className="field" inputMode="numeric" value={table} maxLength={LIMITS.table}
                  placeholder="vd: 5" onChange={(e) => setTable(e.target.value)} />
              </label>
            )}
            <label className="label" htmlFor="note">
              Ghi chú chung
              <textarea id="note" className="field" value={note} maxLength={LIMITS.note}
                placeholder="vd: mang ra cùng lúc" onChange={(e) => setNote(e.target.value)} />
            </label>
            {paused && <p className="err">{MESSAGES.shopPaused}</p>}
            {error && <p className="err">{error}</p>}
            <button className="primary" disabled={!count || sending || paused || hasSoldOut} onClick={submit}>
              {sending ? "Đang gửi…" : `Gửi đơn${count ? ` · ${formatMoney(total)}` : ""}`}
            </button>
            <p className="hint">
              {stats && stats.waitMinutes > 0 ? `Hiện chờ khoảng ${stats.waitMinutes} phút. ` : ""}Thanh toán tại quầy hoặc chuyển khoản sau khi gửi.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
