import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { KeyboardEntry } from '../src/core/keyboard-list.ts';

const VIRTUAL_ID = 'virtual:keyboard-index';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

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

/**
 * Exposes `virtual:keyboard-index`: a small list of every keyboard in `keyboards/`.
 * The app ships this list up front and lazy-loads the full definition on connect,
 * so the folder can grow to thousands of boards without growing the first load.
 */
export function keyboardIndex(): Plugin {
  let dir = '';
  return {
    name: 'openkeys:keyboard-index',
    configResolved(config) {
      dir = path.resolve(config.root, 'keyboards');
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return `export default ${JSON.stringify(scanKeyboards(dir))};`;
    },
    configureServer(server) {
      server.watcher.add(dir);
      const refresh = (file: string) => {
        if (!file.endsWith('.json') || !path.resolve(file).startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('change', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}
