import { formatMoney } from "@/lib/format";
import { describeOptions } from "@/lib/options";
import type { OrderLine } from "@/lib/types";

interface Props {
  lines: OrderLine[];
  /** Show the price of each line (receipt) or just the drinks (barista card). */
  withPrice?: boolean;
}

/** Drinks of an order; group orders are split by who ordered each cup. */
export function OrderLines({ lines, withPrice }: Props) {
  const byMember = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const k = l.member ?? "";
    byMember.set(k, [...(byMember.get(k) ?? []), l]);
  }
  return (
    <div className="olines">
      {[...byMember.entries()].map(([member, ls]) => (
        <div key={member || "_"} className="ogroup">
          {member && <div className="omember">{member}</div>}
          {ls.map((l, i) => (
            <div key={`${l.variantId}-${i}`} className="oline">
              <span>
                {l.qty} × {l.name}
                {l.size ? ` (${l.size})` : ""}
                {(l.options || l.note) && (
                  <em className="onote"> · {[describeOptions(l.options), l.note].filter(Boolean).join(" · ")}</em>
                )}
              </span>
              {withPrice && <span className="num">{formatMoney(l.qty * l.price)}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
