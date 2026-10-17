"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { API, POLL_MS } from "@/lib/constants";
import type { StorefrontStatus } from "@/lib/types";

const StorefrontContext = createContext<StorefrontStatus | null>(null);

/**
 * One slow poll of /api/storefront (wait estimate, paused, sold out) shared by the whole page.
 * Also refreshes the moment the tab comes back into view.
 */
export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StorefrontStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(API.storefront, { cache: "no-store" });
        if (res.ok && alive) setStatus(await res.json());
      } catch {
        /* keep last value */
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS.storefront);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  return <StorefrontContext.Provider value={status}>{children}</StorefrontContext.Provider>;
}

export const useStats = () => useContext(StorefrontContext);

export function useSoldOut(): Set<string> {
  const status = useStats();
  return new Set(status?.soldOut ?? []);
}
