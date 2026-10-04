import type { KeyboardDefinition } from '../core/definition';
import type { DriverModule, KeyboardDriver, Transport } from './types';
import { viaDriver } from './via';

/** Every protocol OpenKeys can speak. Register new drivers here. */
export const drivers: DriverModule[] = [viaDriver];

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
