"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API, LIMITS, MESSAGES, ROUTES, SERVE_MODE_LABEL, ServeMode } from "@/lib/constants";
import { apiJson, HttpMethod, loadCustomer, saveCustomer } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { CreateOrderInput, Menu, MenuItem, MenuVariant, PublicOrder } from "@/lib/types";
import { MenuBrowser } from "./MenuBrowser";

interface CartLine {
  variant: MenuVariant;
  item: MenuItem;
  qty: number;
}

export function OrderApp({ menu }: { menu: Menu }) {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [mode, setMode] = useState<ServeMode>(ServeMode.Table);
  const [customer, setCustomer] = useState("");
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = loadCustomer();
    if (saved.customer) setCustomer(saved.customer);
    if (saved.table) setTable(saved.table);
    // Table number from a QR code: /?ban=5
    const fromQr = new URLSearchParams(window.location.search).get("ban");
    if (fromQr) setTable(fromQr.slice(0, LIMITS.table));
  }, []);

  const lines = [...cart.values()];
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.variant.price, 0);

  function change(item: MenuItem, variant: MenuVariant, delta: number) {
    setError("");
    setCart((prev) => {
      const next = new Map(prev);
      const qty = Math.min((next.get(variant.id)?.qty ?? 0) + delta, LIMITS.qtyPerLine);
      if (qty <= 0) next.delete(variant.id);
      else next.set(variant.id, { item, variant, qty });
      return next;
    });
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
      lines: lines.map((l) => ({ variantId: l.variant.id, qty: l.qty })),
    };
    try {
      const order = await apiJson<PublicOrder>(API.orders, HttpMethod.Post, body);
      saveCustomer({ customer, table });
      router.push(ROUTES.order(order.code));
    } catch (e) {
      setError((e as Error).message || MESSAGES.sendFail);
      setSending(false);
    }
  }

  return (
    <div className="layout">
      <MenuBrowser menu={menu} qtyFor={(id) => cart.get(id)?.qty ?? 0} onAdd={(item, v) => change(item, v, 1)} />

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
              <div className="line" key={l.variant.id}>
                <span>
                  {l.item.name}
                  {l.variant.label && <span className="hint"> ({l.variant.label})</span>}
                </span>
                <span className="step">
                  <button aria-label="Bớt" onClick={() => change(l.item, l.variant, -1)}>−</button>
                  <span>{l.qty}</span>
                  <button aria-label="Thêm" onClick={() => change(l.item, l.variant, 1)}>+</button>
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
            Ghi chú
            <textarea id="note" className="field" value={note} maxLength={LIMITS.note}
              placeholder="vd: ít đường, nhiều đá" onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="err">{error}</p>}
          <button className="primary" disabled={!count || sending} onClick={submit}>
            {sending ? "Đang gửi…" : `Gửi đơn${count ? ` · ${formatMoney(total)}` : ""}`}
          </button>
          <p className="hint">Thanh toán tại quầy khi nhận món.</p>
        </div>
      </aside>
    </div>
  );
}
