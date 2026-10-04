import type { KeyboardDefinition } from '../core/definition';
import type { KeycodeCatalog } from '../core/keycodes';
import type { ValueRef } from '../core/menus';

export interface TransportInfo {
  name: string;
  vendorId: number;
  productId: number;
  /** True for the built-in demo keyboard. */
  virtual: boolean;
}

/** A raw two-way channel to one keyboard. Drivers never touch WebHID directly. */
export interface Transport {
  readonly info: TransportInfo;
  send(report: Uint8Array): Promise<void>;
  /** Returns a function that removes the listener. */
  onReport(listener: (report: Uint8Array) => void): () => void;
  onDisconnect(listener: () => void): () => void;
  close(): Promise<void>;
}

/** How one magnetic switch behaves. Distances are in tenths of a millimetre. */
export interface TravelSettings {
  /** Rapid trigger: the key lets go as soon as it moves back up, wherever it is. */
  rapidTrigger: boolean;
  /** How far down the key registers. */
  actuation: number;
  /** Rapid trigger only: how far down the key has to move to register again. */
  pressSensitivity: number;
  /** Rapid trigger only: how far up the key has to move to let go. */
  releaseSensitivity: number;
}

export interface AnalogState {
  profile: number;
  profileCount: number;
  /** The settings of every key that has none of its own. */
  global: TravelSettings;
  /** Per key, indexed by `row * cols + col`. null: the key follows `global`. */
  keys: (TravelSettings | null)[];
}

/** Magnetic (Hall effect) switch settings, on keyboards that have them. */
export interface AnalogSupport {
  /** Smallest and largest value to offer, in tenths of a millimetre. */
  limits: { actuation: [number, number]; sensitivity: [number, number] };
  read(): Promise<AnalogState>;
  setGlobal(settings: TravelSettings): Promise<void>;
  /** `settings: null` makes the keys follow the keyboard-wide settings again. */
  setKeys(keys: { row: number; col: number }[], settings: TravelSettings | null): Promise<void>;
  selectProfile(profile: number): Promise<void>;
  /** Makes the current profile survive a power cycle. */
  save(): Promise<void>;
  /** Puts the current profile back to how the keyboard shipped. */
  reset(): Promise<void>;
}

export interface DriverInfo {
  protocolName: string;
  protocolVersion: number;
  layerCount: number;
  /** Whether the firmware can read and write the definition's menus (lighting, ...). */
  supportsMenus: boolean;
  /** The keycodes this keyboard understands. */
  catalog: KeycodeCatalog;
  /** Present on keyboards with magnetic switches OpenKeys can configure. */
  analog: AnalogSupport | null;
}

/**
 * Everything the UI needs from a keyboard, independent of how the keyboard is
 * spoken to. Add a protocol by implementing this (see docs/adding-a-driver.md).
 */
export interface KeyboardDriver {
  connect(): Promise<DriverInfo>;
  /** One list of keycodes per layer, indexed by `row * cols + col`. */
  readKeymap(): Promise<number[][]>;
  setKeycode(layer: number, row: number, col: number, keycode: number): Promise<void>;
  resetKeymap(): Promise<void>;
  /** Resolves to null when the firmware does not know the value. */
  readValue(ref: ValueRef, size: number): Promise<number[] | null>;
  writeValue(ref: ValueRef, bytes: number[]): Promise<void>;
  /** Makes written values survive a power cycle. */
  saveValues(channel: number): Promise<void>;
}

export interface DriverModule {
  /** Matched against the optional "protocol" field of a keyboard definition. */
  id: string;
  /** WebHID filters that find keyboards speaking this protocol. */
  filters: HIDDeviceFilter[];
  create(transport: Transport, definition: KeyboardDefinition): KeyboardDriver;
}
