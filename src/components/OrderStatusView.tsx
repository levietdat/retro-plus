"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  API,
  MESSAGES,
  ORDER_STATUS_LABEL,
  OrderStatus,
  POLL_MS,
  ROUTES,
  SERVE_MODE_LABEL,
  ServeMode,
  SHOP_NAME,
  VIETQR,
} from "@/lib/constants";
import { formatMoney, formatTime } from "@/lib/format";
import type { PaymentInfo, PublicOrder } from "@/lib/types";
import { OrderLines } from "./OrderLines";

const STEPS: OrderStatus[] = [OrderStatus.New, OrderStatus.Making, OrderStatus.Ready];
const FINAL: OrderStatus[] = [OrderStatus.Done, OrderStatus.Cancelled];
const READY_TITLE = "🔔 Món đã xong!";
const VIBRATE_PATTERN = [250, 120, 250, 120, 400];

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

/** Vibrate, flash the tab title and show a system notification (if allowed) when the order is ready. */
function alertReady(code: string) {
  try {
    navigator.vibrate?.(VIBRATE_PATTERN);
  } catch {
    /* not supported */
  }
  const original = document.title;
  let on = false;
  const timer = setInterval(() => {
    document.title = on ? original : READY_TITLE;
    on = !on;
  }, 900);
  const stop = () => {
    if (document.visibilityState !== "visible") return;
    setTimeout(() => {
      clearInterval(timer);
      document.title = original;
    }, 4000);
    document.removeEventListener("visibilitychange", stop);
  };
  document.addEventListener("visibilitychange", stop);
  stop();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(`${SHOP_NAME}: đơn ${code} đã xong`, { body: "Mời bạn ra quầy lấy món." });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

function PaymentBox({ order, payment }: { order: PublicOrder; payment: PaymentInfo }) {
  const content = `${VIETQR.transferPrefix} ${order.code}`;
  const qs = new URLSearchParams({ amount: String(order.total), addInfo: content, accountName: payment.accountName });
  return (
    <div className="pay">
      <p><strong>Chuyển khoản {formatMoney(order.total)}</strong></p>
      <img className="qr" src={`${VIETQR.imageUrl(payment.bankId, payment.accountNo)}?${qs}`} alt="Mã VietQR thanh toán" width={220} height={220} />
      <p className="hint">
        Quét bằng app ngân hàng bất kỳ. Nội dung: <strong>{content}</strong>
        {payment.accountName && <><br />{payment.accountName} · {payment.accountNo}</>}
      </p>
      <p className="hint">Hoặc trả tiền mặt tại quầy.</p>
    </div>
  );
}

export function OrderStatusView({ code, payment }: { code: string; payment: PaymentInfo | null }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [notifyState, setNotifyState] = useState<NotificationPermission | "unsupported">("unsupported");
  const lastStatus = useRef<OrderStatus | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifyState(Notification.permission);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(API.orderByCode(code), { cache: "no-store" });
        if (res.status === 404) return alive && setMissing(true);
        if (res.ok && alive) {
          const data = (await res.json()) as PublicOrder;
          if (lastStatus.current && lastStatus.current !== OrderStatus.Ready && data.status === OrderStatus.Ready) alertReady(data.code);
          lastStatus.current = data.status;
          setOrder(data);
          if (FINAL.includes(data.status) && data.paid) return;
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

  async function askNotify() {
    try {
      setNotifyState(await Notification.requestPermission());
    } catch {
      setNotifyState("denied");
    }
  }

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
  const waiting = order.status === OrderStatus.New || order.status === OrderStatus.Making;

  return (
    <div className={`status-card${order.status === OrderStatus.Ready ? " ready" : ""}`} aria-live="polite">
      <p className="hint">Mã đơn của bạn · {formatTime(order.createdAt)}</p>
      <div className="big-code">{order.code}</div>
      <p><strong>{headline(order)}</strong></p>
      {waiting && order.waitMinutes > 0 && <p className="wait">Dự kiến khoảng <strong>{order.waitMinutes} phút</strong></p>}
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
      {waiting && notifyState === "default" && (
        <button className="ghost strong" onClick={askNotify}>Báo cho tôi khi món xong</button>
      )}
      {waiting && notifyState !== "default" && (
        <p className="hint">Giữ trang này mở: điện thoại sẽ rung khi món xong.</p>
      )}

      <div className="receipt">
        <OrderLines lines={order.lines} withPrice />
        <div><strong>Tổng</strong><strong className="num">{formatMoney(order.total)}</strong></div>
        <p className="hint">
          {order.customer} · {order.mode === ServeMode.Table ? `Bàn ${order.table}` : SERVE_MODE_LABEL[ServeMode.Takeaway]}
        </p>
      </div>

      {order.paid ? (
        <p className="paid-badge">Đã thanh toán ✓</p>
      ) : (
        order.status !== OrderStatus.Cancelled && payment && <PaymentBox order={order} payment={payment} />
      )}
      {!order.paid && !payment && order.status !== OrderStatus.Cancelled && <p className="hint">Thanh toán tại quầy khi nhận món.</p>}

      <Link className="ghost strong as-button" href={ROUTES.home}>Gọi thêm món</Link>
    </div>
  );
}
