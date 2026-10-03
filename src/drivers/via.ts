import type { KeyboardDefinition } from '../core/definition';
import { createQmkCatalog } from '../core/keycodes';
import type { ValueRef } from '../core/menus';
import type { DriverInfo, DriverModule, KeyboardDriver, Transport } from './types';

/**
 * Driver for keyboards running QMK firmware with VIA enabled.
 * Protocol reference: quantum/via.h and quantum/via.c in
 * github.com/qmk/qmk_firmware. See CREDITS.md.
 *
 * Every exchange is one 32-byte report out and one 32-byte report back. The reply
 * echoes the request with the answer filled in, or starts with 0xFF when the
 * firmware does not know the command.
 */
export const ViaCommand = {
  GetProtocolVersion: 0x01,
  GetKeyboardValue: 0x02,
  SetKeyboardValue: 0x03,
  GetKeycode: 0x04,
  SetKeycode: 0x05,
  ResetKeymap: 0x06,
  SetValue: 0x07,
  GetValue: 0x08,
  SaveValues: 0x09,
  GetLayerCount: 0x11,
  GetKeymapBuffer: 0x12,
  SetKeymapBuffer: 0x13,
  Unhandled: 0xff,
} as const;

export const VIA_REPORT_SIZE = 32;
/** Most keymap bytes one report can carry after its 4-byte header. */
export const VIA_BUFFER_CHUNK = 28;

const TIMEOUT_MS = 1500;
const DEFAULT_LAYER_COUNT = 4;
// Protocol 11 introduced the channel-based custom values that menus are built on.
const FIRST_MENU_PROTOCOL = 11;

class UnhandledCommandError extends Error {}

class ViaDriver implements KeyboardDriver {
  private readonly transport: Transport;
  private readonly definition: KeyboardDefinition;
  private queue: Promise<unknown> = Promise.resolve();
  private protocolVersion = 0;
  private layerCount = DEFAULT_LAYER_COUNT;

  constructor(transport: Transport, definition: KeyboardDefinition) {
    this.transport = transport;
    this.definition = definition;
  }

  async connect(): Promise<DriverInfo> {
    const version = await this.request([ViaCommand.GetProtocolVersion]);
    this.protocolVersion = (version[1] << 8) | version[2];

    // Very old firmware has no layer-count command and always has four layers.
    const layers = await this.requestOptional([ViaCommand.GetLayerCount]);
    if (layers && layers[1] > 0) this.layerCount = layers[1];

    return {
      protocolName: 'VIA',
      protocolVersion: this.protocolVersion,
      layerCount: this.layerCount,
      supportsMenus: this.protocolVersion >= FIRST_MENU_PROTOCOL,
      catalog: createQmkCatalog(
        this.protocolVersion,
        this.layerCount,
        this.definition.customKeycodes,
      ),
    };
  }

  async readKeymap(): Promise<number[][]> {
    const keysPerLayer = this.definition.matrix.rows * this.definition.matrix.cols;
    const total = this.layerCount * keysPerLayer * 2;
    const bytes = new Uint8Array(total);

    for (let offset = 0; offset < total; offset += VIA_BUFFER_CHUNK) {
      const size = Math.min(VIA_BUFFER_CHUNK, total - offset);
      const reply = await this.request([
        ViaCommand.GetKeymapBuffer,
        offset >> 8,
        offset & 0xff,
        size,
      ]);
      bytes.set(reply.subarray(4, 4 + size), offset);
    }

    return Array.from({ length: this.layerCount }, (_, layer) =>
      Array.from({ length: keysPerLayer }, (_, index) => {
        const at = (layer * keysPerLayer + index) * 2;
        return (bytes[at] << 8) | bytes[at + 1];
      }),
    );
  }

  async setKeycode(layer: number, row: number, col: number, keycode: number): Promise<void> {
    await this.request([ViaCommand.SetKeycode, layer, row, col, keycode >> 8, keycode & 0xff]);
  }

  async resetKeymap(): Promise<void> {
    await this.request([ViaCommand.ResetKeymap]);
  }

  async readValue(ref: ValueRef, size: number): Promise<number[] | null> {
    if (this.protocolVersion < FIRST_MENU_PROTOCOL) return null;
    const header = [ViaCommand.GetValue, ref.channel, ref.valueId, ...ref.extra];
    const reply = await this.requestOptional(header);
    return reply ? Array.from(reply.subarray(header.length, header.length + size)) : null;
  }

  async writeValue(ref: ValueRef, bytes: number[]): Promise<void> {
    await this.request([ViaCommand.SetValue, ref.channel, ref.valueId, ...ref.extra, ...bytes]);
  }

  async saveValues(channel: number): Promise<void> {
    await this.request([ViaCommand.SaveValues, channel]);
  }

  /** Like `request`, but resolves to null when the firmware does not know the command. */
  private async requestOptional(bytes: number[]): Promise<Uint8Array | null> {
    try {
      return await this.request(bytes);
    } catch (error) {
      if (error instanceof UnhandledCommandError) return null;
      throw error;
    }
  }

  /** Sends one command and waits for its reply. Commands never overlap. */
  private request(bytes: number[]): Promise<Uint8Array> {
    const result = this.queue.then(() => this.exchange(bytes));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private exchange(bytes: number[]): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const report = new Uint8Array(VIA_REPORT_SIZE);
      report.set(bytes);

      const stopListening = this.transport.onReport((reply) => {
        clearTimeout(timer);
        stopListening();
        if (reply[0] === ViaCommand.Unhandled) {
          reject(new UnhandledCommandError(`The keyboard does not support command ${bytes[0]}`));
        } else {
          resolve(reply);
        }
      });
      const timer = setTimeout(() => {
        stopListening();
        reject(new Error('The keyboard did not answer. Unplug it, plug it back in and reconnect.'));
      }, TIMEOUT_MS);

      this.transport.send(report).catch((error: unknown) => {
        clearTimeout(timer);
        stopListening();
        reject(error);
      });
    });
  }
}

export const viaDriver: DriverModule = {
  id: 'via',
  // The raw HID interface QMK exposes for VIA.
  filters: [{ usagePage: 0xff60, usage: 0x61 }],
  create: (transport, definition) => new ViaDriver(transport, definition),
};
