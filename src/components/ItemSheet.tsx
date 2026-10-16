"use client";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ICE,
  DEFAULT_SUGAR,
  ICE_LABEL,
  IceLevel,
  LIMITS,
  SUGAR_LABEL,
  SugarLevel,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { DrinkOptions, MenuItem, MenuVariant } from "@/lib/types";

export interface ItemChoice {
  item: MenuItem;
  variant: MenuVariant;
  options?: DrinkOptions;
  note: string;
  qty: number;
}

interface Props {
  item: MenuItem;
  customizable: boolean;
  soldOut: Set<string>;
  onConfirm: (choice: ItemChoice) => void;
  onClose: () => void;
}

/** Bottom sheet (phone) / dialog (desktop) to pick size, sugar, ice, note and quantity. */
export function ItemSheet({ item, customizable, soldOut, onConfirm, onClose }: Props) {
  const firstAvailable = item.variants.find((v) => !soldOut.has(v.id)) ?? item.variants[0];
  const [variant, setVariant] = useState<MenuVariant>(firstAvailable);
  const [sugar, setSugar] = useState<SugarLevel>(DEFAULT_SUGAR);
  const [ice, setIce] = useState<IceLevel>(DEFAULT_ICE);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isOut = soldOut.has(variant.id);

  function confirm() {
    if (isOut) return;
    const options = customizable && (sugar !== DEFAULT_SUGAR || ice !== DEFAULT_ICE) ? { sugar, ice } : undefined;
    onConfirm({ item, variant, options, note: note.trim(), qty });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h3 id="sheet-title">{item.name}</h3>
            {item.tag && <p className="hint">{item.tag}</p>}
          </div>
          <button className="sheet-close" aria-label="Đóng" onClick={onClose}>×</button>
        </div>

        {item.variants.length > 1 && (
          <fieldset className="opt">
            <legend>Size</legend>
            <div className="seg">
              {item.variants.map((v) => (
                <button key={v.id} aria-pressed={variant.id === v.id} disabled={soldOut.has(v.id)} onClick={() => setVariant(v)}>
                  {v.label} · {formatMoney(v.price)}{soldOut.has(v.id) ? " · hết" : ""}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {customizable && (
          <>
            <fieldset className="opt">
              <legend>Đường</legend>
              <div className="seg seg-wrap">
                {Object.values(SugarLevel).map((s) => (
                  <button key={s} aria-pressed={sugar === s} onClick={() => setSugar(s)}>{SUGAR_LABEL[s]}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="opt">
              <legend>Đá</legend>
              <div className="seg seg-wrap">
                {Object.values(IceLevel).map((i) => (
                  <button key={i} aria-pressed={ice === i} onClick={() => setIce(i)}>{ICE_LABEL[i]}</button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <label className="label" htmlFor="sheet-note">
          Ghi chú cho ly này
          <input id="sheet-note" className="field" value={note} maxLength={LIMITS.lineNote}
            placeholder="vd: thêm sữa, ly to" onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()} />
        </label>

        <div className="sheet-foot">
          <span className="step big">
            <button aria-label="Bớt" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button aria-label="Thêm" onClick={() => setQty((q) => Math.min(LIMITS.qtyPerLine, q + 1))}>+</button>
          </span>
          <button ref={confirmRef} className="primary grow" disabled={isOut} onClick={confirm}>
            {isOut ? "Món này đang hết" : `Thêm vào đơn · ${formatMoney(variant.price * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
