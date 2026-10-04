import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { KeyboardEntry, KeyboardSummary } from '../src/core/keyboard-list.ts';

const INDEX_ID = 'virtual:keyboard-index';
const SUMMARY_ID = 'virtual:keyboard-summary';
const VIRTUAL_IDS = [INDEX_ID, SUMMARY_ID];
const resolved = (id: string) => '\0' + id;

// How many brands the landing page names.
const SUMMARY_BRANDS = 12;
// Folders of the VIA collection for boards without a maker: not brands worth naming.
const CATCH_ALL_BRANDS = new Set(['Other', 'Handwired']);

// Brand of definitions that sit directly in keyboards/, outside any folder.
const NO_BRAND = 'Other';

// Sorts "Q2" before "Q10" and ignores case.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJson(full);
    return entry.name.endsWith('.json') ? [full] : [];
  });
}

function readId(value: unknown, field: string, file: string): number {
  const id = typeof value === 'string' ? parseInt(value, 16) : value;
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id > 0xffff) {
    throw new Error(`keyboards/${file}: "${field}" must look like "0x3434"`);
  }
  return id;
}

/**
 * The brand of a folder, spelled the way its own keyboards spell it:
 * "ergodox_ez" + "ErgoDox EZ" -> "ErgoDox EZ", "gmmk" + "GMMK Pro" -> "GMMK".
 * When no keyboard name starts with the folder name, the folder name is tidied up:
 * "keebio" -> "Keebio".
 */
export function brandName(folder: string, names: readonly string[]): string {
  const wanted = folder.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const name of names) {
    let seen = '';
    for (let index = 0; index < name.length && wanted.startsWith(seen); index++) {
      const char = name[index].toLowerCase();
      if (/[a-z0-9]/.test(char)) seen += char;
      const atWordEnd = index + 1 === name.length || /[^a-z0-9]/i.test(name[index + 1]);
      if (wanted && seen === wanted && atWordEnd) return name.slice(0, index + 1).trim();
    }
  }

  const tidy = folder
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
  return tidy || folder;
}

/** The keyboard name without its brand: "Keychron Q1V2 ANSI" -> "Q1V2 ANSI". */
export function modelName(brand: string, name: string): string {
  const startsWithBrand = name.toLowerCase().startsWith(`${brand.toLowerCase()} `);
  return (startsWithBrand && name.slice(brand.length).trim()) || name;
}

/**
 * Reads just enough of every definition in `keyboards/` to list it and to match a USB
 * device to its file. The result is sorted by brand, then by model.
 */
export function scanKeyboards(dir: string): KeyboardEntry[] {
  const seen = new Map<string, string>();
  const found = listJson(dir).map((full) => {
    const file = path.relative(dir, full).split(path.sep).join('/');
    let raw: { name?: unknown; vendorId?: unknown; productId?: unknown; deviceId?: unknown };
    try {
      raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (error) {
      throw new Error(`keyboards/${file}: not valid JSON (${(error as Error).message})`, {
        cause: error,
      });
    }
    // A few definitions list one name per board variant; index them under the first.
    const name =
      typeof raw.name === 'string' ? raw.name : (raw.name as { options?: unknown[] })?.options?.[0];
    if (typeof name !== 'string' || !name) {
      throw new Error(`keyboards/${file}: missing "name"`);
    }
    const vendorId = readId(raw.vendorId, 'vendorId', file);
    const productId = readId(raw.productId, 'productId', file);

    // Makers that reuse one USB id across models tell them apart by "deviceId".
    const deviceId = typeof raw.deviceId === 'number' ? raw.deviceId : undefined;
    const usb = `${vendorId}:${productId}:${deviceId ?? ''}`;
    const other = seen.get(usb);
    if (other) {
      throw new Error(`keyboards/${file}: same vendorId/productId as keyboards/${other}`);
    }
    seen.set(usb, file);

    // The first folder is the maker: keyboards/<brand>/.../<board>.json
    const folder = file.includes('/') ? file.slice(0, file.indexOf('/')) : '';
    return { path: file, name, folder, vendorId, productId, deviceId };
  });

  const namesByFolder = new Map<string, string[]>();
  for (const { folder, name } of found) {
    namesByFolder.set(folder, [...(namesByFolder.get(folder) ?? []), name]);
  }
  const brands = new Map<string, string>();
  for (const [folder, names] of namesByFolder) {
    brands.set(folder, folder ? brandName(folder, names) : NO_BRAND);
  }

  return found
    .map(({ folder, ...entry }) => {
      const brand = brands.get(folder)!;
      return { ...entry, brand, model: modelName(brand, entry.name) };
    })
    .sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.model, b.model));
}

/** Counts the keyboards and names the `count` largest brands. */
export function summarizeKeyboards(entries: readonly KeyboardEntry[], count: number): KeyboardSummary {
  const sizes = new Map<string, number>();
  for (const { brand } of entries) sizes.set(brand, (sizes.get(brand) ?? 0) + 1);
  return {
    keyboards: entries.length,
    brands: sizes.size,
    largest: [...sizes]
      .filter(([brand]) => !CATCH_ALL_BRANDS.has(brand))
      .map(([brand, keyboards]) => ({ brand, keyboards }))
      // The sort is stable: brands of the same size keep the order of the list, A to Z.
      .sort((a, b) => b.keyboards - a.keyboards)
      .slice(0, count),
  };
}

/**
 * Exposes two modules made from `keyboards/`:
 *   - `virtual:keyboard-index`: one line per keyboard. With thousands of boards it is
 *     too big for the first load; the app fetches it when the list is needed.
 *   - `virtual:keyboard-summary`: the few numbers the landing page shows, shipped up front.
 * The full definitions are chunks of their own, loaded on connect, so the folder can
 * keep growing without growing the first load.
 */
export function keyboardIndex(): Plugin {
  let dir = '';
  // Both modules come from one pass over the folder.
  let scanned: KeyboardEntry[] | null = null;
  const scan = () => (scanned ??= scanKeyboards(dir));

  return {
    name: 'openkeys:keyboard-index',
    configResolved(config) {
      dir = path.resolve(config.root, 'keyboards');
    },
    resolveId(id) {
      return VIRTUAL_IDS.includes(id) ? resolved(id) : undefined;
    },
    load(id) {
      if (id === resolved(INDEX_ID)) return `export default ${JSON.stringify(scan())};`;
      if (id === resolved(SUMMARY_ID)) {
        return `export default ${JSON.stringify(summarizeKeyboards(scan(), SUMMARY_BRANDS))};`;
      }
      return undefined;
    },
    configureServer(server) {
      server.watcher.add(dir);
      const refresh = (file: string) => {
        if (!file.endsWith('.json') || !path.resolve(file).startsWith(dir)) return;
        scanned = null;
        for (const id of VIRTUAL_IDS) {
          const mod = server.moduleGraph.getModuleById(resolved(id));
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('change', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}
