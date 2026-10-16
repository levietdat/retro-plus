"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API, POLL_MS, ROUTES, SHOP_NAME, SHOP_TAGLINE } from "@/lib/constants";
import type { OrderStats } from "@/lib/types";

export function useStats(intervalMs: number = POLL_MS.publicStats) {
  const [stats, setStats] = useState<OrderStats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(API.orderStats, { cache: "no-store" });
        if (res.ok && alive) setStats(await res.json());
      } catch {
        /* keep last value */
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);
  return stats;
}

export function Header({ children }: { children?: React.ReactNode }) {
  const stats = useStats();
  const waiting = stats?.waiting ?? null;
  return (
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
            <b>{stats?.today ?? "–"}</b> đơn hôm nay
          </span>
        </div>
        {children}
      </div>
    </header>
  );
}
