import { DEFAULT_ICE, DEFAULT_SUGAR, ICE_LABEL, IceLevel, SUGAR_LABEL, SugarLevel } from "./constants";
import type { DrinkOptions } from "./types";

const isSugar = (v: unknown): v is SugarLevel => Object.values(SugarLevel).includes(v as SugarLevel);
const isIce = (v: unknown): v is IceLevel => Object.values(IceLevel).includes(v as IceLevel);

export class InvalidOptionsError extends Error {}

/**
 * Returns the options to store, or undefined when they are the defaults
 * (or the item is not customizable). Throws on unknown values.
 */
export function normalizeOptions(input: Partial<DrinkOptions> | undefined, customizable: boolean): DrinkOptions | undefined {
  if (!input || !customizable) return undefined;
  const sugar = input.sugar ?? DEFAULT_SUGAR;
  const ice = input.ice ?? DEFAULT_ICE;
  if (!isSugar(sugar) || !isIce(ice)) throw new InvalidOptionsError();
  return sugar === DEFAULT_SUGAR && ice === DEFAULT_ICE ? undefined : { sugar, ice };
}

/** "70% đường · Ít đá"; empty string for defaults. */
export function describeOptions(o: DrinkOptions | undefined): string {
  if (!o) return "";
  const parts: string[] = [];
  if (o.sugar !== DEFAULT_SUGAR) parts.push(o.sugar === SugarLevel.None ? "Không đường" : `${SUGAR_LABEL[o.sugar]} đường`);
  if (o.ice !== DEFAULT_ICE) parts.push(ICE_LABEL[o.ice]);
  return parts.join(" · ");
}

export const optionsKey = (o: DrinkOptions | undefined) => (o ? `${o.sugar}|${o.ice}` : "");
