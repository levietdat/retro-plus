"use client";
import Link from "next/link";
import { MESSAGES, ROUTES, SHOP_NAME, SHOP_TAGLINE } from "@/lib/constants";
import { useStats } from "./StatsProvider";

export function Header() {
  const stats = useStats();
  const waiting = stats?.waiting ?? null;
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
          <div className="pill">
            <span className={`dot${waiting === 0 ? " ok" : ""}`} />
            <span>
              <b>{waiting ?? "–"}</b> đơn đang chờ
            </span>
          </div>
          <div className="pill">
            <span className="dot ok" />
            <span>
              {stats && stats.waitMinutes > 0 ? (
                <>chờ khoảng <b>{stats.waitMinutes}</b> phút</>
              ) : (
                <><b>{stats ? "Không" : "–"}</b> phải chờ</>
              )}
            </span>
          </div>
        </div>
      </header>
      {stats && !stats.acceptingOrders && <p className="banner warn">{MESSAGES.shopPaused}</p>}
    </>
  );
}
