import { deviceKey } from './definition';

/** One line of the keyboard index that build/keyboard-index.ts generates from `keyboards/`. */
export interface KeyboardEntry {
  /** Path of the definition inside `keyboards/`, with forward slashes. */
  path: string;
  /** Full name from the definition, e.g. "Keychron Q1V2 ANSI". */
  name: string;
  /** Maker, e.g. "Keychron". Taken from the folder the definition is in. */
  brand: string;
  /** The name without the brand, e.g. "Q1V2 ANSI". */
  model: string;
  vendorId: number;
  productId: number;
  /** Model number the keyboard reports, for makers that reuse one USB id across models. */
  deviceId?: number;
}

export interface BrandGroup {
  brand: string;
  keyboards: KeyboardEntry[];
}

// A search word is compared with USB ids only when it looks like one ("3434",
// "3434:0100"). Otherwise the "6" of "iris 6" would match half the ids in the list.
const USB_ID_WORD = /^[0-9a-f:]{4,}$/;

/** Keeps the keyboards whose brand, name or USB id contain every word of the query. */
export function searchKeyboards(entries: readonly KeyboardEntry[], query: string): KeyboardEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];

  return entries.filter((entry) => {
    const text = `${entry.brand} ${entry.name}`.toLowerCase();
    const usbId = deviceKey(entry.vendorId, entry.productId);
    return words.every(
      (word) => text.includes(word) || (USB_ID_WORD.test(word) && usbId.includes(word)),
    );
  });
}

/** Puts keyboards under their brand. Relies on the index order: by brand, then by model. */
export function groupByBrand(entries: readonly KeyboardEntry[]): BrandGroup[] {
  const groups: BrandGroup[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.brand === entry.brand) last.keyboards.push(entry);
    else groups.push({ brand: entry.brand, keyboards: [entry] });
  }
  return groups;
}

/**
 * What the landing page says about the built-in keyboards. Small enough to ship up
 * front; build/keyboard-index.ts makes it from the same scan as the list.
 */
export interface KeyboardSummary {
  keyboards: number;
  brands: number;
  /** The brands with the most keyboards, largest first. */
  largest: { brand: string; keyboards: number }[];
}
