import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:keyboard-index';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export interface KeyboardIndexEntry {
  /** Path of the definition inside `keyboards/`, with forward slashes. */
  path: string;
  name: string;
  vendorId: number;
  productId: number;
}

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

/** Reads just enough of every definition in `keyboards/` to match a USB device to its file. */
export function scanKeyboards(dir: string): KeyboardIndexEntry[] {
  const seen = new Map<number, string>();
  const entries = listJson(dir).map((full) => {
    const file = path.relative(dir, full).split(path.sep).join('/');
    let raw: { name?: unknown; vendorId?: unknown; productId?: unknown };
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

    const usb = vendorId * 0x10000 + productId;
    const other = seen.get(usb);
    if (other) {
      throw new Error(`keyboards/${file}: same vendorId/productId as keyboards/${other}`);
    }
    seen.set(usb, file);
    return { path: file, name, vendorId, productId };
  });
  return entries.sort((a, b) => a.name.localeCompare(b.name));
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
