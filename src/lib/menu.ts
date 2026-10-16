import "server-only";
import { ENV, KIOTVIET, MenuSource } from "./constants";
import { fetchKiotVietMenu, isKiotVietConfigured } from "./kiotviet";
import { getStaticMenu } from "./menu-static";
import type { Menu, MenuItem, MenuVariant } from "./types";

let cached: Menu | null = null;

export function activeMenuSource(): MenuSource {
  return process.env[ENV.menuSource] === MenuSource.KiotViet && isKiotVietConfigured()
    ? MenuSource.KiotViet
    : MenuSource.Static;
}

export async function getMenu(): Promise<Menu> {
  if (activeMenuSource() === MenuSource.Static) return getStaticMenu();
  if (cached && Date.now() - cached.updatedAt < KIOTVIET.menuCacheMs) return cached;
  try {
    cached = await fetchKiotVietMenu();
    return cached;
  } catch (err) {
    console.error("[menu] KiotViet fetch failed, using cached/static menu", err);
    return cached ?? getStaticMenu();
  }
}

export interface FoundVariant {
  item: MenuItem;
  variant: MenuVariant;
  customizable: boolean;
}

export function findVariant(menu: Menu, variantId: string): FoundVariant | null {
  for (const item of menu.items) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (variant) {
      const customizable = menu.categories.find((c) => c.id === item.categoryId)?.customizable ?? false;
      return { item, variant, customizable };
    }
  }
  return null;
}
