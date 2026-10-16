"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  API,
  MESSAGES,
  ORDER_STATUS_LABEL,
  OrderStatus,
  POLL_MS,
  ROUTES,
  SERVE_MODE_LABEL,
  ServeMode,
} from "@/lib/constants";
import { formatMoney, formatTime } from "@/lib/format";
import type { PublicOrder } from "@/lib/types";

const STEPS: OrderStatus[] = [OrderStatus.New, OrderStatus.Making, OrderStatus.Ready];
const FINAL: OrderStatus[] = [OrderStatus.Done, OrderStatus.Cancelled];

function headline(o: PublicOrder): string {
  switch (o.status) {
    case OrderStatus.New:
      return o.ahead ? `Có ${o.ahead} đơn trước bạn` : "Bạn là đơn tiếp theo";
    case OrderStatus.Making:
      return "Quán đang pha món của bạn";
    case OrderStatus.Ready:
      return "Món đã xong, mời bạn ra quầy lấy";
    case OrderStatus.Done:
      return "Đã giao. Chúc bạn ngon miệng!";
    case OrderStatus.Cancelled:
      return "Đơn đã bị huỷ. Hỏi quầy nếu cần.";
  }
}

export function OrderStatusView({ code }: { code: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(API.orderByCode(code), { cache: "no-store" });
        if (res.status === 404) return alive && setMissing(true);
        if (res.ok && alive) {
          const data = (await res.json()) as PublicOrder;
          setOrder(data);
          if (FINAL.includes(data.status)) return;
        }
      } catch {
        /* retry */
      }
      if (alive) timer = setTimeout(load, POLL_MS.orderStatus);
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code]);

  if (missing) {
    return (
      <div className="status-card">
        <p>{MESSAGES.orderNotFound}</p>
        <Link href={ROUTES.home}>Về thực đơn</Link>
      </div>
    );
  }
  if (!order) return <div className="status-card"><p className="hint">Đang tải đơn…</p></div>;

  const stepIndex = STEPS.indexOf(order.status);
  const reached = stepIndex < 0 ? (order.status === OrderStatus.Done ? STEPS.length : 0) : stepIndex + 1;

  return (
    <div className="status-card" aria-live="polite">
      <p className="hint">Mã đơn của bạn · {formatTime(order.createdAt)}</p>
      <div className="big-code">{order.code}</div>
      <p><strong>{headline(order)}</strong></p>
      {order.status !== OrderStatus.Cancelled && (
        <>
          <div className="progress">
            {STEPS.map((s, i) => <span key={s} className={i < reached ? "on" : ""} />)}
          </div>
          <div className="progress-labels">
            {STEPS.map((s) => <span key={s}>{ORDER_STATUS_LABEL[s]}</span>)}
          </div>
        </>
      )}
      <div className="receipt">
        {order.lines.map((l) => (
          <div key={l.variantId}>
            <span>{l.qty} × {l.name}{l.size ? ` (${l.size})` : ""}</span>
            <span className="num">{formatMoney(l.qty * l.price)}</span>
          </div>
        ))}
        <div><strong>Tổng</strong><strong className="num">{formatMoney(order.total)}</strong></div>
        <p className="hint">
          {order.customer} · {order.mode === ServeMode.Table ? `Bàn ${order.table}` : SERVE_MODE_LABEL[ServeMode.Takeaway]} · thanh toán tại quầy
        </p>
      </div>
      <p className="hint">Giữ trang này mở, trạng thái tự cập nhật.</p>
      <Link href={ROUTES.home}>Đặt thêm món</Link>
    </div>
  );
}
