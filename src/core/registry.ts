import { deviceKey, parseDefinition, type KeyboardDefinition } from './definition';

/**
 * Finds the definition for a USB device. Definitions come from two places:
 *   - `keyboards/` in the repository, bundled with the app and loaded on demand;
 *   - files the user dropped into the app, kept in this browser's localStorage.
 */

const STORAGE_KEY = 'openkeys:definitions';

/** Fetches a chunk once. A fetch that failed (offline, a stale page) is tried again next time. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}

// The list of bundled keyboards and the table of their files are big, so each is
// fetched the first time it is needed.
const loadList = once(() => import('./bundled'));
const loadFiles = once(() => import('./definition-files'));

/** Starts fetching what recognising a keyboard needs, so it is there once one connects. */
export function preloadKeyboards(): void {
  // A failed fetch is reported by whoever needs it next.
  loadList().catch(() => undefined);
  loadFiles().catch(() => undefined);
}

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

/**
 * `modelId` is the model number a keyboard reported itself, on makers that ship many
 * models under one USB id; null for everything else.
 */
export async function findDefinition(
  vendorId: number,
  productId: number,
  modelId: number | null = null,
): Promise<KeyboardDefinition | null> {
  const sideloaded = readSideloaded()[deviceKey(vendorId, productId)];
  if (sideloaded) {
    try {
      return parseDefinition(sideloaded);
    } catch {
      // A stored file that no longer parses: fall back to the bundled one.
    }
  }

  const { bundledKeyboards } = await loadList();
  const candidates = bundledKeyboards.filter(
    (item) => item.vendorId === vendorId && item.productId === productId,
  );
  // A keyboard that reported a model only fits the definition written for that model.
  const entry =
    modelId === null
      ? candidates.find((item) => item.deviceId === undefined)
      : candidates.find((item) => item.deviceId === modelId);
  return entry ? loadBundled(entry.path) : null;
}

/** Loads one definition from `keyboards/` by its path in the index. */
export async function loadBundled(path: string): Promise<KeyboardDefinition> {
  const { loaders } = await loadFiles();
  const load = loaders[`/keyboards/${path}`];
  if (!load) throw new Error(`keyboards/${path} is not part of this build.`);
  return parseDefinition(await load());
}
