import index from 'virtual:keyboard-index';
import { deviceKey, parseDefinition, type KeyboardDefinition } from './definition';
import type { KeyboardEntry } from './keyboard-list';

/**
 * Finds the definition for a USB device. Definitions come from two places:
 *   - `keyboards/` in the repository, bundled with the app and loaded on demand;
 *   - files the user dropped into the app, kept in this browser's localStorage.
 */

const STORAGE_KEY = 'openkeys:definitions';

// One lazy chunk per definition, so only the connected keyboard is downloaded.
const loaders = import.meta.glob<unknown>('/keyboards/**/*.json', { import: 'default' });

/** Every keyboard that ships with the app, sorted by brand, then by model. */
export const bundledKeyboards: readonly KeyboardEntry[] = index;

function readSideloaded(): Record<string, unknown> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof stored === 'object' && stored !== null ? stored : {};
  } catch {
    // Unreadable or blocked storage just means there is nothing sideloaded.
    return {};
  }
}

/** Remembers a definition file the user provided, for the next time the keyboard connects. */
export function rememberDefinition(raw: unknown, definition: KeyboardDefinition): void {
  const stored = readSideloaded();
  stored[deviceKey(definition.vendorId, definition.productId)] = raw;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage is full or blocked: the definition still works for this session.
  }
}

export async function findDefinition(
  vendorId: number,
  productId: number,
): Promise<KeyboardDefinition | null> {
  const sideloaded = readSideloaded()[deviceKey(vendorId, productId)];
  if (sideloaded) {
    try {
      return parseDefinition(sideloaded);
    } catch {
      // A stored file that no longer parses: fall back to the bundled one.
    }
  }

  const entry = index.find((item) => item.vendorId === vendorId && item.productId === productId);
  return entry ? loadBundled(entry.path) : null;
}

/** Loads one definition from `keyboards/` by its path in the index. */
export async function loadBundled(path: string): Promise<KeyboardDefinition> {
  const load = loaders[`/keyboards/${path}`];
  if (!load) throw new Error(`keyboards/${path} is not part of this build.`);
  return parseDefinition(await load());
}
