/**
 * Where each bundled definition can be fetched from: one lazy chunk per file in
 * `keyboards/`, so only the connected keyboard is downloaded. The table itself has a
 * line per keyboard, so registry.ts fetches it on demand too.
 */
export const loaders = import.meta.glob<unknown>('/keyboards/**/*.json', { import: 'default' });
