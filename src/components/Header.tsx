"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ACTIVE_ORDER_STATUSES,
  API,
  MESSAGES,
  ORDER_STATUS_LABEL,
  OrderStatus,
  POLL_MS,
  ROUTES,
  SHOP_NAME,
  SHOP_TAGLINE,
} from "@/lib/constants";
import { apiJson, HttpMethod, loadMyOrders } from "@/lib/client";
import { dayKey, formatMoney, formatTime } from "@/lib/format";
import type { MyOrderLookup, MyOrderRef, MyOrderStatus } from "@/lib/types";
import { useStats } from "./StatsProvider";

const isActive = (s: OrderStatus | undefined) => s === undefined || ACTIVE_ORDER_STATUSES.includes(s) || s === OrderStatus.Ready;

function dotClass(s: OrderStatus | undefined): string {
  if (s === OrderStatus.Ready) return "dot ready";
  if (s === OrderStatus.Done || s === OrderStatus.Cancelled) return "dot ok";
  return "dot";
}

/** Only this device's own (and its groups') orders today: customers never see anyone else's. */
function MyOrders() {
  const pathname = usePathname();
  const [orders, setOrders] = useState<MyOrderRef[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MyOrderStatus>>({});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOrders(loadMyOrders(dayKey())), [pathname]);

  // Poll only while one of my orders is still being made.
  useEffect(() => {
    if (!orders.length) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const refs: MyOrderLookup[] = orders.map(({ code, key, day }) => ({ code, key, day }));
        const list = await apiJson<MyOrderStatus[]>(API.myOrders, HttpMethod.Post, { refs });
        if (!alive) return;
        const next = Object.fromEntries(list.map((s) => [s.code, s]));
        setStatuses(next);
        if (!orders.some((o) => isActive(next[o.code]?.status))) return;
      } catch {
        /* retry later */
      }
      if (alive) timer = setTimeout(load, POLL_MS.myOrders);
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [orders]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  if (!orders.length) return null;
  const label = (o: MyOrderRef) => {
    const s = statuses[o.code]?.status;
    return s ? ORDER_STATUS_LABEL[s] : "";
  };

  if (orders.length === 1) {
    const o = orders[0];
    const s = statuses[o.code]?.status;
    return (
      <Link className="pill my-orders" href={ROUTES.order(o.code, o.key)}>
        <span className={dotClass(s)} />
        <span>
          Đơn của bạn <b>{o.code}</b>
          {s && <span className="hint"> · {label(o)}</span>}
        </span>
      </Link>
    );
  }
  const anyReady = orders.some((o) => statuses[o.code]?.status === OrderStatus.Ready);
  return (
    <div className="my-orders-wrap" ref={ref}>
      <button className="pill my-orders" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={anyReady ? "dot ready" : "dot"} />
        <span>Đơn của bạn <b>{orders.length}</b></span>
      </button>
      {open && (
        <div className="my-orders-menu" role="menu">
          {orders.map((o) => (
            <Link key={o.code} role="menuitem" href={ROUTES.order(o.code, o.key)} onClick={() => setOpen(false)}>
              <b>{o.code}</b>
              <span className="hint">
                {label(o) || formatTime(o.at)} · {o.cups} ly · {formatMoney(o.total)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const status = useStats();
  return (
    <>
      <header className="header">
        <div className="brand">
          <h1>
            <Link href={ROUTES.home}>{SHOP_NAME}</Link>
          </h1>
          <p>{SHOP_TAGLINE}</p>
        </div>
        <div className="live" aria-live="polite">
          <MyOrders />
        </div>
      </header>
      {status && !status.acceptingOrders && <p className="banner warn">{MESSAGES.shopPaused}</p>}
    </>
  );
}
