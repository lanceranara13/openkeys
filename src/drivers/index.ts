import type { KeyboardDefinition } from '../core/definition';
import type { DriverModule, KeyboardDriver, Transport } from './types';
import { viaDriver } from './via';
import { yichipDriver } from './yichip';

/** Every protocol OpenKeys can speak. Register new drivers here. */
export const drivers: DriverModule[] = [viaDriver, yichipDriver];

/**
 * Asks a keyboard which model it is. Some makers ship many models under one USB id,
 * so the id alone does not say which definition fits. Resolves to null when no
 * driver can tell.
 */
export async function identifyModel(transport: Transport): Promise<number | null> {
  for (const driver of drivers) {
    const model = await driver.identify?.(transport);
    if (model !== undefined && model !== null) return model;
  }
  return null;
}

/** Values a definition may give its optional "analog" field (magnetic switch settings). */
export const analogProtocols = ['keychron'];

/** WebHID filters for the browser's device picker, across all drivers. */
export const hidFilters = drivers.flatMap((driver) => driver.filters);

export function createDriver(transport: Transport, definition: KeyboardDefinition): KeyboardDriver {
  const driver = drivers.find((candidate) => candidate.id === definition.protocol);
  if (!driver) {
    throw new Error(`"${definition.name}" needs the "${definition.protocol}" driver, which OpenKeys does not have.`);
  }
  return driver.create(transport, definition);
}
