"use client";
import { useMemo, useState } from "react";
import { MESSAGES } from "@/lib/constants";
import { formatMoney, searchKey } from "@/lib/format";
import type { Menu, MenuItem } from "@/lib/types";
import { ItemSheet, type ItemChoice } from "./ItemSheet";
import { useSoldOut } from "./StatsProvider";

const ALL = "all";
const POPULAR_SECTION = "__popular";

interface Props {
  menu: Menu;
  popularIds: string[];
  /** Cups of this menu item already picked (badge). */
  qtyForItem: (itemId: string) => number;
  onAdd: (choice: ItemChoice) => void;
  disabled?: boolean;
}

export function MenuBrowser({ menu, popularIds, qtyForItem, onAdd, disabled }: Props) {
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const soldOut = useSoldOut();

  const customizable = (item: MenuItem) =>
    menu.categories.find((c) => c.id === item.categoryId)?.customizable ?? false;
  const allOut = (item: MenuItem) => item.variants.every((v) => soldOut.has(v.id));

  const sections = useMemo(() => {
    const q = searchKey(query.trim());
    const byCat = menu.categories
      .filter((c) => category === ALL || c.id === category)
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: menu.items.filter((i) => i.categoryId === c.id && (!q || searchKey(i.name).includes(q))),
      }))
      .filter((s) => s.items.length > 0);
    const popular = popularIds
      .map((id) => menu.items.find((i) => i.id === id))
      .filter((i): i is MenuItem => Boolean(i));
    return category === ALL && !q && popular.length
      ? [{ id: POPULAR_SECTION, name: "Bán chạy tuần này", items: popular }, ...byCat]
      : byCat;
  }, [menu, category, query, popularIds]);

  function open(item: MenuItem) {
    // Bottled drinks with one size go straight into the order: no options to pick.
    if (!customizable(item) && item.variants.length === 1) {
      onAdd({ item, variant: item.variants[0], note: "", qty: 1 });
      return;
    }
    setSheetItem(item);
  }

  return (
    <div>
      <div className="tools">
        <input
          id="search"
          className="search"
          type="search"
          placeholder="Tìm món… (vd: muối, matcha, chanh)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <div className="chips">
          {[{ id: ALL, name: "Tất cả" }, ...menu.categories].map((c) => (
            <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 && <p className="empty">{MESSAGES.noResult}</p>}
      {sections.map((sec) => (
        <div className={`section${sec.id === POPULAR_SECTION ? " popular" : ""}`} key={sec.id}>
          <h2>
            {sec.name} <small>{sec.items.length} món</small>
          </h2>
          {sec.items.map((item) => {
            const picked = qtyForItem(item.id);
            const out = allOut(item);
            const prices = item.variants.map((v) => v.price);
            const from = Math.min(...prices);
            return (
              <div className={`item${item.image ? "" : " noimg"}${out ? " out" : ""}`} key={item.id}>
                {item.image && <img src={item.image} alt="" loading="lazy" />}
                <button className="item-main" onClick={() => !out && open(item)} disabled={disabled || out}>
                  <span className="name">{item.name}</span>
                  <span className="meta">
                    {out ? "Tạm hết" : [item.tag, item.variants.length > 1 ? item.variants.map((v) => v.label).join(" / ") : ""].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button
                  className="add"
                  disabled={disabled || out}
                  onClick={() => open(item)}
                  aria-label={`Chọn ${item.name}`}
                >
                  + <span className="num">{prices.length > 1 ? `từ ${formatMoney(from)}` : formatMoney(from)}</span>
                  {picked > 0 && <span className="q">{picked}</span>}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {sheetItem && (
        <ItemSheet
          item={sheetItem}
          customizable={customizable(sheetItem)}
          soldOut={soldOut}
          onClose={() => setSheetItem(null)}
          onConfirm={(choice) => {
            onAdd(choice);
            setSheetItem(null);
          }}
        />
      )}
    </div>
  );
}
