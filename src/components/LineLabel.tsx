import { describeOptions } from "@/lib/options";
import type { DrinkOptions } from "@/lib/types";

/** "Trà sữa Retro (L)" + "70% đường · Ít đá · thêm sữa" under it. */
export function LineLabel({ name, size, options, note }: { name: string; size?: string; options?: DrinkOptions; note?: string }) {
  const detail = [describeOptions(options), note].filter(Boolean).join(" · ");
  return (
    <span className="line-label">
      <span>
        {name}
        {size && <span className="hint"> ({size})</span>}
      </span>
      {detail && <span className="line-detail">{detail}</span>}
    </span>
  );
}
