"use client";
import type { Menu } from "@/lib/types";

interface Props {
  menu: Menu;
  soldOut: Set<string>;
  onToggle: (variantIds: string[], out: boolean) => void;
}

/** Tap a drink (or one size) to mark it sold out; customers see "Tạm hết" right away. */
export function SoldOutPanel({ menu, soldOut, onToggle }: Props) {
  return (
    <section className="soldout-panel" aria-label="Món tạm hết">
      <p className="hint">Bấm vào món để báo hết hoặc mở bán lại. Khách sẽ thấy “Tạm hết” trong vài giây.</p>
      {menu.categories.map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} className="soldout-cat">
            <h4>{c.name}</h4>
            <div className="soldout-grid">
              {items.map((item) =>
                item.variants.map((v) => {
                  const out = soldOut.has(v.id);
                  return (
                    <button
                      key={v.id}
                      className={`soldout-item${out ? " out" : ""}`}
                      aria-pressed={out}
                      onClick={() => onToggle([v.id], !out)}
                    >
                      <span>{item.name}{v.label ? ` (${v.label})` : ""}</span>
                      <small>{out ? "Đang hết" : "Còn"}</small>
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
