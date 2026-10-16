"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { API, POLL_MS } from "@/lib/constants";
import type { OrderStats } from "@/lib/types";

const StatsContext = createContext<OrderStats | null>(null);

/** One poll of /api/orders/stats shared by the header, the menu (sold out) and the cart (paused). */
export function StatsProvider({ children }: { children: React.ReactNode }) {
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
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS.publicStats);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return <StatsContext.Provider value={stats}>{children}</StatsContext.Provider>;
}

export const useStats = () => useContext(StatsContext);

export function useSoldOut(): Set<string> {
  const stats = useStats();
  return new Set(stats?.soldOut ?? []);
}
