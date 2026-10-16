"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  API,
  ORDER_NEXT_ACTION_LABEL,
  ORDER_NEXT_STATUS,
  ORDER_STATUS_LABEL,
  OrderStatus,
  POLL_MS,
  ROUTES,
  SERVE_MODE_LABEL,
  ServeMode,
  SHOP_NAME,
} from "@/lib/constants";
import { dayKey, formatMoney, formatTime } from "@/lib/format";
import type { AdminOrderPatch, Menu, Order, ShopSettings } from "@/lib/types";
import { SoldOutPanel } from "./SoldOutPanel";
import { OrderLines } from "./OrderLines";

const TABS: OrderStatus[] = [OrderStatus.New, OrderStatus.Making, OrderStatus.Ready, OrderStatus.Done, OrderStatus.Cancelled];
const FRESH_MS = 60_000;
const STORAGE_KEY_SOUND = "retro-admin-sound";

function prevStatus(s: OrderStatus): OrderStatus | undefined {
  return (Object.keys(ORDER_NEXT_STATUS) as OrderStatus[]).find((k) => ORDER_NEXT_STATUS[k] === s);
}

function beep(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.55);
}

export function AdminBoard({ menu }: { menu: Menu }) {
  const router = useRouter();
  const [day, setDay] = useState(dayKey());
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<OrderStatus>(OrderStatus.New);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const known = useRef<Set<string> | null>(null);
  const isToday = day === dayKey();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API.adminOrders}?day=${day}`, { cache: "no-store" });
      if (res.status === 401) return router.replace(ROUTES.adminLogin);
      if (!res.ok) return;
      const data = (await res.json()) as { orders: Order[] };
      if (known.current && audio.current && isToday) {
        const fresh = data.orders.some((o) => !known.current!.has(o.id));
        if (fresh) beep(audio.current);
      }
      known.current = new Set(data.orders.map((o) => o.id));
      setOrders(data.orders);
      setLoaded(true);
      setNow(Date.now());
    } catch {
      /* keep last state */
    }
  }, [day, isToday, router]);

  useEffect(() => {
    known.current = null;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS.adminBoard);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    fetch(API.adminSettings, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: ShopSettings | null) => s && setSettings(s))
      .catch(() => undefined);
  }, []);

  async function saveSettings(patch: Partial<Pick<ShopSettings, "acceptingOrders" | "soldOut">>) {
    if (settings) setSettings({ ...settings, ...patch });
    const res = await fetch(API.adminSettings, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }

  function toggleSoldOut(ids: string[], out: boolean) {
    const cur = new Set(settings?.soldOut ?? []);
    ids.forEach((id) => (out ? cur.add(id) : cur.delete(id)));
    saveSettings({ soldOut: [...cur] });
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY_SOUND) === "1") setSound(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSound() {
    const on = !sound;
    setSound(on);
    if (on) {
      audio.current = audio.current ?? new AudioContext();
      audio.current.resume();
      beep(audio.current);
    } else {
      audio.current = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  async function patch(o: Order, change: AdminOrderPatch) {
    setBusy(o.id);
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...change } : x)));
    try {
      await fetch(API.adminOrder(o.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
    } finally {
      setBusy(null);
      load();
    }
  }

  async function logout() {
    await fetch(API.adminLogout, { method: "POST" });
    router.replace(ROUTES.adminLogin);
  }

  const counts = Object.fromEntries(TABS.map((s) => [s, orders.filter((o) => o.status === s).length])) as Record<OrderStatus, number>;
  const valid = orders.filter((o) => o.status !== OrderStatus.Cancelled);
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const cups = valid.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
  const unpaid = valid.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0);
  const setStatus = (o: Order, status: OrderStatus) => patch(o, { status });
  const accepting = settings?.acceptingOrders ?? true;
  const soldOutSet = new Set(settings?.soldOut ?? []);
  const list = orders
    .filter((o) => o.status === tab)
    .sort((a, b) =>
      tab === OrderStatus.Done || tab === OrderStatus.Cancelled
        ? b.updatedAt - a.updatedAt
        : a.createdAt - b.createdAt || a.code.localeCompare(b.code),
    );

  return (
    <>
      <header className="header">
        <div className="brand">
          <h1>{SHOP_NAME}</h1>
          <p>Quầy pha chế · quản lý đơn</p>
        </div>
        <div className="live">
          <div className="pill"><span className={`dot${counts[OrderStatus.New] ? "" : " ok"}`} /><span><b>{counts[OrderStatus.New]}</b> đơn mới</span></div>
          <div className="pill"><span className="dot ok" /><span><b>{counts[OrderStatus.Making]}</b> đang pha</span></div>
        </div>
      </header>

      <div className="admin-bar">
        <div className="chips" role="tablist">
          {TABS.map((s) => (
            <button key={s} className="chip" role="tab" aria-pressed={tab === s} onClick={() => setTab(s)}>
              {ORDER_STATUS_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="right">
          <button
            className={`ghost toggle-accept${accepting ? "" : " off"}`}
            aria-pressed={!accepting}
            onClick={() => saveSettings({ acceptingOrders: !accepting })}
          >
            {accepting ? "Đang nhận đơn" : "Đã tạm ngưng nhận đơn"}
          </button>
          <button className="ghost" aria-expanded={showSoldOut} onClick={() => setShowSoldOut((v) => !v)}>
            Món hết ({soldOutSet.size})
          </button>
          <input id="day" type="date" className="field" value={day} max={dayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <button className="ghost" onClick={toggleSound} aria-pressed={sound}>{sound ? "🔔 Chuông: bật" : "🔕 Chuông: tắt"}</button>
          <button className="ghost" onClick={logout}>Đăng xuất</button>
        </div>
      </div>

      <div className="summary">
        <span>{isToday ? "Hôm nay" : day}: <b>{valid.length}</b> đơn</span>
        <span><b>{cups}</b> món</span>
        <span>Doanh thu <b>{formatMoney(revenue)}</b></span>
        <span>Chưa thu <b>{formatMoney(unpaid)}</b></span>
      </div>

      {!accepting && <p className="banner warn">Khách đang thấy thông báo tạm ngưng và không gửi được đơn online.</p>}
      {showSoldOut && <SoldOutPanel menu={menu} soldOut={soldOutSet} onToggle={toggleSoldOut} />}

      <div className="board">
        {!loaded && <p className="board-empty">Đang tải đơn…</p>}
        {loaded && list.length === 0 && <p className="board-empty">Chưa có đơn nào ở mục này.</p>}
        {list.map((o) => {
          const next = ORDER_NEXT_STATUS[o.status];
          const back = prevStatus(o.status);
          const fresh = o.status === OrderStatus.New && now - o.createdAt < FRESH_MS;
          return (
            <article key={o.id} className={`order ${o.status}${fresh ? " fresh" : ""}`}>
              <div className="order-top">
                <span className="code">{o.code}</span>
                <time>{formatTime(o.createdAt)}</time>
              </div>
              <div className="who">
                {o.customer} · {o.mode === ServeMode.Table ? `Bàn ${o.table}` : SERVE_MODE_LABEL[ServeMode.Takeaway]} ·{" "}
                <span className="num">{formatMoney(o.total)}</span>
                {o.status !== OrderStatus.Cancelled && (
                  <button
                    className={`paid-toggle${o.paid ? " on" : ""}`}
                    aria-pressed={Boolean(o.paid)}
                    disabled={busy === o.id}
                    onClick={() => patch(o, { paid: !o.paid })}
                  >
                    {o.paid ? "Đã thu" : "Chưa thu"}
                  </button>
                )}
              </div>
              {o.groupCode && <div className="kv">Đơn nhóm {o.groupCode} · {o.lines.reduce((s, l) => s + l.qty, 0)} ly</div>}
              <OrderLines lines={o.lines} />
              {o.note && <div className="note">{o.note}</div>}
              {o.kiotvietOrderCode && <div className="kv">KiotViet: {o.kiotvietOrderCode}</div>}
              {o.kiotvietError && <div className="kv bad">Chưa đẩy được lên KiotViet</div>}
              <div className="acts">
                {back && <button disabled={busy === o.id} onClick={() => setStatus(o, back)}>Lùi lại</button>}
                {next && <button className="go" disabled={busy === o.id} onClick={() => setStatus(o, next)}>{ORDER_NEXT_ACTION_LABEL[o.status]}</button>}
                {o.status === OrderStatus.New && <button className="danger" disabled={busy === o.id} onClick={() => setStatus(o, OrderStatus.Cancelled)}>Huỷ</button>}
                {o.status === OrderStatus.Cancelled && <button disabled={busy === o.id} onClick={() => setStatus(o, OrderStatus.New)}>Khôi phục</button>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
