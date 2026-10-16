import type { Menu, MenuItem, MenuVariant } from "./types";

/** Browser-side lookup (the server version in menu.ts also reports `customizable`). */
export function findVariantClient(menu: Menu, variantId: string): { item: MenuItem; variant: MenuVariant } | null {
  for (const item of menu.items) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (variant) return { item, variant };
  }
  return null;
}
