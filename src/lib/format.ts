import { CURRENCY_SUFFIX, LOCALE, TIME_ZONE } from "./constants";

export const formatMoney = (n: number) => n.toLocaleString(LOCALE) + CURRENCY_SUFFIX;

export const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

/** Business day in Vietnam time, e.g. "2026-10-16". */
export function dayKey(ms: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return parts; // en-CA formats as YYYY-MM-DD
}

/** Accent-insensitive search key for Vietnamese text. */
export const searchKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
