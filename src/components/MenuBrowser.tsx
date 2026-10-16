"use client";
import { useMemo, useState } from "react";
import { MESSAGES } from "@/lib/constants";
import { formatMoney, searchKey } from "@/lib/format";
import type { Menu, MenuItem, MenuVariant } from "@/lib/types";

const ALL = "all";

interface Props {
  menu: Menu;
  /** How many of this variant are already picked (shown as a badge). */
  qtyFor: (variantId: string) => number;
  onAdd: (item: MenuItem, variant: MenuVariant) => void;
  disabled?: boolean;
}

export function MenuBrowser({ menu, qtyFor, onAdd, disabled }: Props) {
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = searchKey(query.trim());
    return menu.categories
      .filter((c) => category === ALL || c.id === category)
      .map((c) => ({
        category: c,
        items: menu.items.filter((i) => i.categoryId === c.id && (!q || searchKey(i.name).includes(q))),
      }))
      .filter((s) => s.items.length > 0);
  }, [menu, category, query]);

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
      {sections.map(({ category: c, items }) => (
        <div className="section" key={c.id}>
          <h2>
            {c.name} <small>{items.length} món</small>
          </h2>
          {items.map((item) => (
            <div className={`item${item.image ? "" : " noimg"}`} key={item.id}>
              {item.image && <img src={item.image} alt="" loading="lazy" />}
              <div>
                <div className="name">{item.name}</div>
                {item.tag && <div className="meta">{item.tag}</div>}
              </div>
              <div className="opts">
                {item.variants.map((v) => {
                  const picked = qtyFor(v.id);
                  return (
                    <button
                      key={v.id}
                      className="add"
                      disabled={disabled}
                      onClick={() => onAdd(item, v)}
                      aria-label={`Thêm ${item.name} ${v.label}`}
                    >
                      + <span className="num">{v.label ? `${v.label} · ` : ""}{formatMoney(v.price)}</span>
                      {picked > 0 && <span className="q">{picked}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
