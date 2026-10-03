/**
 * Reads the KLE (keyboard-layout-editor.com) rows that VIA definitions use to say
 * where each key sits and which matrix position it is wired to.
 *
 * Every key string carries its data in fixed legend slots:
 *   top-left      "row,col"       matrix position
 *   bottom-right  "group,option"  only on keys that belong to a layout option
 *   center        "e0"            rotary encoder index
 *
 * These rules, and how layout options are placed, follow VIA's own reader
 * (github.com/the-via/reader, GPL-3.0) so definitions draw the way they do in VIA.
 * See CREDITS.md.
 */

export type KeyColor = 'alpha' | 'mod' | 'accent';

export interface KeyGeometry {
  id: string;
  /** Matrix position, or -1/-1 for an encoder that has no switch. */
  row: number;
  col: number;
  /** Position and size in key units (1 = one regular key). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Second rectangle of stepped and ISO-enter keys, relative to x/y. */
  x2: number;
  y2: number;
  w2: number;
  h2: number;
  /** Rotation in degrees around the point (rx, ry). */
  r: number;
  rx: number;
  ry: number;
  color: KeyColor;
  encoder?: number;
}

export interface ParsedLayout {
  /** Keys that are always present. */
  keys: KeyGeometry[];
  /** Keys that depend on a layout option: group -> option -> keys. */
  options: Record<number, Record<number, KeyGeometry[]>>;
}

export interface ResolvedLayout {
  keys: KeyGeometry[];
  width: number;
  height: number;
}

interface RawKey extends Omit<KeyGeometry, 'color'> {
  swatch: string;
  group: number;
  option: number;
  /** A blank spot. Inside a layout option it marks where the option sits; it is never drawn. */
  decal: boolean;
}

// Where the n-th legend of a serialized KLE key lands on the keycap, per alignment
// flag. Copied from github.com/ijprest/kle-serial, (c) 2013-2019 Ian Prest, MIT.
// The license text is in CREDITS.md.
const LEGEND_SLOTS = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
];
const SLOT_MATRIX = 0;
const SLOT_ENCODER = 4;
const SLOT_OPTION = 8;

const freshKey = () => ({
  w: 1,
  h: 1,
  x2: 0,
  y2: 0,
  w2: undefined as number | undefined,
  h2: undefined as number | undefined,
  decal: false,
});

function readLegends(text: string, align: number): string[] {
  const slots = LEGEND_SLOTS[align] ?? LEGEND_SLOTS[0];
  const legends: string[] = [];
  text.split('\n').forEach((legend, index) => {
    const slot = slots[index];
    if (slot !== undefined && slot >= 0) legends[slot] = legend.trim();
  });
  return legends;
}

function readPair(text: string, what: string): [number, number] {
  const parts = text.split(/[,，]/).map((part) => Number.parseInt(part, 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    throw new Error(`"${text}" is not a valid ${what} (expected two numbers like "0,1")`);
  }
  return [parts[0], parts[1]];
}

function readKeyData(
  text: string,
  align: number,
  matrix: { rows: number; cols: number },
  decal: boolean,
) {
  const legends = readLegends(text, align);
  const encoderLegend = legends[SLOT_ENCODER];
  const encoder =
    encoderLegend && /^e\d+$/i.test(encoderLegend) ? Number(encoderLegend.slice(1)) : undefined;

  let row = -1;
  let col = -1;
  if (decal) {
    // Decals are not wired to anything, whatever their legend says.
  } else if (legends[SLOT_MATRIX]) {
    [row, col] = readPair(legends[SLOT_MATRIX], 'matrix position');
    if (row < 0 || row >= matrix.rows || col < 0 || col >= matrix.cols) {
      throw new Error(
        `key "${row},${col}" is outside the ${matrix.rows}x${matrix.cols} matrix`,
      );
    }
  } else if (encoder === undefined) {
    throw new Error('every key needs a "row,col" legend in its top-left slot');
  }

  const [group, option] = legends[SLOT_OPTION]
    ? readPair(legends[SLOT_OPTION], 'layout option')
    : [-1, 0];
  return { row, col, encoder, group, option, decal };
}

type Box = Pick<KeyGeometry, 'x' | 'y' | 'x2' | 'y2'>;

/** Top-left corner of a key, taking the second rectangle of ISO-style keys into account. */
function corner(key: Box) {
  const useSecond = key.y2 === 0 ? key.x2 < 0 : key.y2 < 0;
  return useSecond ? { x: key.x + key.x2, y: key.y + key.y2 } : { x: key.x, y: key.y };
}

function anchor(keys: Box[]) {
  const first = [...keys].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return corner(first);
}

export function parseKle(keymap: unknown, matrix: { rows: number; cols: number }): ParsedLayout {
  if (!Array.isArray(keymap)) throw new Error('"layouts.keymap" must be a list of rows');

  const raw: RawKey[] = [];
  let y = 0;
  let r = 0;
  let rx = 0;
  let ry = 0;
  let align = 0;
  let cap = '#cccccc';
  let legend = '#000000';

  for (const row of keymap) {
    if (!Array.isArray(row)) continue; // KLE metadata block, not a row of keys
    let x = 0;
    let next = freshKey();

    for (const item of row) {
      if (typeof item === 'string') {
        const data = readKeyData(item, align, matrix, next.decal);
        // A decal outside a layout option is only a printed label: nothing to draw.
        if (!data.decal || data.group >= 0) {
          raw.push({
            id: `k${raw.length}`,
            ...data,
            x: x + rx,
            y,
            w: next.w,
            h: next.h,
            x2: next.x2,
            y2: next.y2,
            w2: next.w2 ?? next.w,
            h2: next.h2 ?? next.h,
            r,
            rx,
            ry,
            swatch: `${cap}:${legend}`,
          });
        }
        x += next.w;
        next = freshKey();
        continue;
      }
      if (typeof item !== 'object' || item === null) continue;

      const props = item as Record<string, unknown>;
      const num = (name: string) =>
        typeof props[name] === 'number' ? (props[name] as number) : undefined;

      r = num('r') ?? r;
      rx = num('rx') ?? rx;
      ry = num('ry') ?? ry;
      if (num('rx') !== undefined || num('ry') !== undefined) y = ry;
      y += num('y') ?? 0;
      x += num('x') ?? 0;
      next.w = num('w') ?? next.w;
      next.h = num('h') ?? next.h;
      next.x2 = num('x2') ?? next.x2;
      next.y2 = num('y2') ?? next.y2;
      next.w2 = num('w2') ?? next.w2;
      next.h2 = num('h2') ?? next.h2;
      if (typeof props.d === 'boolean') next.decal = props.d;
      align = num('a') ?? align;
      if (typeof props.c === 'string') cap = props.c;
      if (typeof props.t === 'string') legend = props.t;
    }
    y += 1;
  }

  if (!raw.some((key) => !key.decal)) throw new Error('"layouts.keymap" has no keys');

  // The most common keycap colour is the alphas, the next one the modifiers, the rest accents.
  const counts = new Map<string, number>();
  for (const key of raw) {
    if (!key.decal) counts.set(key.swatch, (counts.get(key.swatch) ?? 0) + 1);
  }
  const ranked = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  const toKey = (key: RawKey): KeyGeometry => ({
    id: key.id,
    row: key.row,
    col: key.col,
    x: key.x,
    y: key.y,
    w: key.w,
    h: key.h,
    x2: key.x2,
    y2: key.y2,
    w2: key.w2,
    h2: key.h2,
    r: key.r,
    rx: key.rx,
    ry: key.ry,
    color: (['alpha', 'mod'] as const)[ranked.indexOf(key.swatch)] ?? 'accent',
    encoder: key.encoder,
  });

  const grouped: Record<number, Record<number, RawKey[]>> = {};
  for (const key of raw) {
    if (key.group >= 0) ((grouped[key.group] ??= {})[key.option] ??= []).push(key);
  }

  const layout: ParsedLayout = {
    keys: raw.filter((key) => key.group < 0).map(toKey),
    options: {},
  };

  // Alternative options are drawn off to the side in the definition. Move each one
  // onto the spot its default option occupies.
  for (const [group, options] of Object.entries(grouped)) {
    if (!options[0]) throw new Error(`layout option ${group} has no default (option 0) keys`);
    const origin = anchor(options[0]);
    const placed: Record<number, KeyGeometry[]> = {};
    for (const [option, keys] of Object.entries(options)) {
      const from = anchor(keys);
      const dx = from.x - origin.x;
      const dy = from.y - origin.y;
      placed[Number(option)] = keys
        .filter((key) => !key.decal)
        .map((key) => ({
          ...toKey(key),
          x: key.x - dx,
          y: key.y - dy,
          rx: key.rx - dx,
          ry: key.ry - dy,
        }));
    }
    layout.options[Number(group)] = placed;
  }

  return layout;
}

function bounds(key: KeyGeometry) {
  const left = Math.min(key.x, key.x + key.x2);
  const top = Math.min(key.y, key.y + key.y2);
  const right = Math.max(key.x + key.w, key.x + key.x2 + key.w2);
  const bottom = Math.max(key.y + key.h, key.y + key.y2 + key.h2);
  if (key.r === 0) return { left, top, right, bottom };

  const angle = (key.r * Math.PI) / 180;
  const corners = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ].map(([px, py]) => {
    const dx = px - key.rx;
    const dy = py - key.ry;
    return {
      x: key.rx + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: key.ry + dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  });
  return {
    left: Math.min(...corners.map((p) => p.x)),
    top: Math.min(...corners.map((p) => p.y)),
    right: Math.max(...corners.map((p) => p.x)),
    bottom: Math.max(...corners.map((p) => p.y)),
  };
}

/** Picks one option per layout group and returns the keys to draw, starting at 0,0. */
export function resolveLayout(layout: ParsedLayout, selection: readonly number[] = []): ResolvedLayout {
  const keys = [...layout.keys];
  for (const [group, options] of Object.entries(layout.options)) {
    keys.push(...(options[selection[Number(group)] ?? 0] ?? options[0]));
  }
  if (keys.length === 0) return { keys, width: 0, height: 0 };

  const boxes = keys.map(bounds);
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  return {
    keys: keys.map((key) => ({
      ...key,
      x: key.x - left,
      y: key.y - top,
      rx: key.rx - left,
      ry: key.ry - top,
    })),
    width: Math.max(...boxes.map((box) => box.right)) - left,
    height: Math.max(...boxes.map((box) => box.bottom)) - top,
  };
}
