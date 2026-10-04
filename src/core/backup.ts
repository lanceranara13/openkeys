import type { KeyboardDefinition } from './definition';
import { usesLegacyKeycodes } from './keycodes';

/** The file "Export backup" saves and "Import backup" reads. */
export interface Backup {
  app: 'openkeys';
  version: 1;
  keyboard: { name: string; vendorId: number; productId: number };
  protocolVersion: number;
  /** One list of keycodes per layer, indexed by `row * cols + col`. */
  layers: number[][];
}

export function createBackup(
  definition: KeyboardDefinition,
  protocolVersion: number,
  keymap: number[][],
): Backup {
  return {
    app: 'openkeys',
    version: 1,
    keyboard: {
      name: definition.name,
      vendorId: definition.vendorId,
      productId: definition.productId,
    },
    protocolVersion,
    layers: keymap,
  };
}

/** Reads a backup file and checks that it fits the connected keyboard. */
export function readBackup(
  text: string,
  definition: KeyboardDefinition,
  protocolVersion: number,
  layerCount: number,
): number[][] {
  let backup: Partial<Backup>;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (backup?.app !== 'openkeys' || !Array.isArray(backup.layers)) {
    throw new Error('That file is not an OpenKeys backup.');
  }
  if (
    backup.keyboard?.vendorId !== definition.vendorId ||
    backup.keyboard?.productId !== definition.productId
  ) {
    throw new Error(
      `That backup is for "${backup.keyboard?.name ?? 'another keyboard'}", not "${definition.name}".`,
    );
  }

  const keysPerLayer = definition.matrix.rows * definition.matrix.cols;
  const valid =
    backup.layers.length <= layerCount &&
    backup.layers.every(
      (layer) =>
        Array.isArray(layer) &&
        layer.length === keysPerLayer &&
        // 16 bits for VIA keycodes, 32 for protocols that store four bytes per key.
        layer.every((code) => Number.isInteger(code) && code >= 0 && code <= 0xffffffff),
    );
  if (!valid) throw new Error('That backup does not match the layout of this keyboard.');

  // Layer and lighting keys have different numbers before and after VIA protocol 11.
  if (
    typeof backup.protocolVersion !== 'number' ||
    usesLegacyKeycodes(backup.protocolVersion) !== usesLegacyKeycodes(protocolVersion)
  ) {
    throw new Error('That backup was made with a different firmware generation and cannot be restored.');
  }
  return backup.layers;
}
