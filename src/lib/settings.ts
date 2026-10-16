import "server-only";
import { ENV, SETTINGS_KEY } from "./constants";
import { readDoc, updateDoc } from "./storage";
import type { PaymentInfo, ShopSettings } from "./types";

const DEFAULT_SETTINGS: ShopSettings = { acceptingOrders: true, soldOut: [], updatedAt: 0 };

export async function getSettings(): Promise<ShopSettings> {
  return { ...DEFAULT_SETTINGS, ...((await readDoc<ShopSettings>(SETTINGS_KEY)) ?? {}) };
}

export interface SettingsPatch {
  acceptingOrders?: boolean;
  soldOut?: string[];
}

export function updateSettings(patch: SettingsPatch): Promise<ShopSettings> {
  return updateDoc<ShopSettings, ShopSettings>(SETTINGS_KEY, (doc) => {
    const cur = { ...DEFAULT_SETTINGS, ...(doc ?? {}) };
    const next: ShopSettings = {
      acceptingOrders: typeof patch.acceptingOrders === "boolean" ? patch.acceptingOrders : cur.acceptingOrders,
      soldOut: Array.isArray(patch.soldOut) ? [...new Set(patch.soldOut.map(String))].slice(0, 200) : cur.soldOut,
      updatedAt: Date.now(),
    };
    return { doc: next, result: next };
  });
}

/** Bank details for VietQR; null when not configured. Not secret (it is printed on the QR). */
export function getPaymentInfo(): PaymentInfo | null {
  const bankId = process.env[ENV.bankId];
  const accountNo = process.env[ENV.bankAccountNo];
  if (!bankId || !accountNo) return null;
  return { bankId, accountNo, accountName: process.env[ENV.bankAccountName] || "" };
}
