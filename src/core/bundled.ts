import index from 'virtual:keyboard-index';
import type { KeyboardEntry } from './keyboard-list';

/**
 * The keyboards that ship with the app, one line each. That is big, so nothing the
 * landing page needs may import this module. registry.ts fetches it on demand, and the
 * Keyboards page is a lazy chunk of its own.
 */

/** Every keyboard that ships with the app, sorted by brand, then by model. */
export const bundledKeyboards: readonly KeyboardEntry[] = index;
