import type { Transport, TransportInfo } from '../drivers/types';
import { ViaCommand, VIA_BUFFER_CHUNK } from '../drivers/via';

export interface VirtualKeyboardOptions {
  rows: number;
  cols: number;
  /** Factory keymap: one list of keycodes per layer, indexed by `row * cols + col`. */
  layers: number[][];
  protocolVersion?: number;
  /**
   * Answer zero for settings this class does not emulate instead of "unknown
   * command", so every control of a definition shows up when previewing it.
   */
  acceptAnyValue?: boolean;
}

const RGB_MATRIX_CHANNEL = 3;
const LightingValue = { Brightness: 1, Effect: 2, Speed: 3, Color: 4 } as const;

/**
 * A keyboard that exists only in memory and answers VIA reports the way QMK
 * firmware does (modelled on quantum/via.c in github.com/qmk/qmk_firmware). It
 * powers the demo and lets the tests exercise the real driver without hardware.
 */
export class VirtualKeyboard {
  private readonly rows: number;
  private readonly cols: number;
  private readonly layerCount: number;
  private readonly protocolVersion: number;
  private readonly acceptAnyValue: boolean;
  private readonly factory: Uint8Array;
  private keymap: Uint8Array;
  private layoutOptions = 0;
  private lighting = { brightness: 200, effect: 3, speed: 110, hue: 190, sat: 255 };
  private readonly startedAt = Date.now();

  constructor(options: VirtualKeyboardOptions) {
    this.rows = options.rows;
    this.cols = options.cols;
    this.layerCount = options.layers.length;
    this.protocolVersion = options.protocolVersion ?? 12;
    this.acceptAnyValue = options.acceptAnyValue ?? false;

    this.factory = new Uint8Array(this.layerCount * this.rows * this.cols * 2);
    options.layers.forEach((layer, layerIndex) => {
      layer.forEach((keycode, index) => {
        const at = (layerIndex * this.rows * this.cols + index) * 2;
        this.factory[at] = keycode >> 8;
        this.factory[at + 1] = keycode & 0xff;
      });
    });
    this.keymap = this.factory.slice();
  }

  /** Takes a report from the host and returns the firmware's reply. */
  handle(report: Uint8Array): Uint8Array {
    const reply = report.slice();
    const unhandled = () => {
      reply[0] = ViaCommand.Unhandled;
    };
    const writeUint32 = (value: number) => {
      reply[2] = (value >>> 24) & 0xff;
      reply[3] = (value >>> 16) & 0xff;
      reply[4] = (value >>> 8) & 0xff;
      reply[5] = value & 0xff;
    };

    switch (reply[0]) {
      case ViaCommand.GetProtocolVersion:
        reply[1] = this.protocolVersion >> 8;
        reply[2] = this.protocolVersion & 0xff;
        break;

      case ViaCommand.GetKeyboardValue:
        if (reply[1] === 0x01) writeUint32(Date.now() - this.startedAt);
        else if (reply[1] === 0x02) writeUint32(this.layoutOptions);
        else unhandled();
        break;

      case ViaCommand.SetKeyboardValue:
        if (reply[1] === 0x02) {
          this.layoutOptions =
            ((reply[2] << 24) | (reply[3] << 16) | (reply[4] << 8) | reply[5]) >>> 0;
        } else {
          unhandled();
        }
        break;

      case ViaCommand.GetKeycode:
      case ViaCommand.SetKeycode: {
        const [, layer, row, col] = reply;
        if (layer >= this.layerCount || row >= this.rows || col >= this.cols) break;
        const at = ((layer * this.rows + row) * this.cols + col) * 2;
        if (reply[0] === ViaCommand.SetKeycode) this.keymap.set(reply.subarray(4, 6), at);
        else reply.set(this.keymap.subarray(at, at + 2), 4);
        break;
      }

      case ViaCommand.ResetKeymap:
        this.keymap = this.factory.slice();
        break;

      case ViaCommand.GetLayerCount:
        reply[1] = this.layerCount;
        break;

      case ViaCommand.GetKeymapBuffer:
      case ViaCommand.SetKeymapBuffer: {
        const offset = (reply[1] << 8) | reply[2];
        const size = Math.min(reply[3], VIA_BUFFER_CHUNK, Math.max(0, this.keymap.length - offset));
        if (reply[0] === ViaCommand.SetKeymapBuffer) this.keymap.set(reply.subarray(4, 4 + size), offset);
        else reply.set(this.keymap.subarray(offset, offset + size), 4);
        break;
      }

      case ViaCommand.GetValue:
      case ViaCommand.SetValue:
      case ViaCommand.SaveValues:
        if (this.protocolVersion < 11) unhandled();
        else if (reply[1] !== RGB_MATRIX_CHANNEL) {
          // The echoed request already reads as "value is zero".
          if (!this.acceptAnyValue) unhandled();
        } else if (reply[0] === ViaCommand.GetValue) this.readLighting(reply);
        else if (reply[0] === ViaCommand.SetValue) this.writeLighting(reply);
        break;

      default:
        unhandled();
    }
    return reply;
  }

  private readLighting(reply: Uint8Array) {
    switch (reply[2]) {
      case LightingValue.Brightness:
        reply[3] = this.lighting.brightness;
        break;
      case LightingValue.Effect:
        reply[3] = this.lighting.effect;
        break;
      case LightingValue.Speed:
        reply[3] = this.lighting.speed;
        break;
      case LightingValue.Color:
        reply[3] = this.lighting.hue;
        reply[4] = this.lighting.sat;
        break;
    }
  }

  private writeLighting(report: Uint8Array) {
    switch (report[2]) {
      case LightingValue.Brightness:
        this.lighting.brightness = report[3];
        break;
      case LightingValue.Effect:
        this.lighting.effect = report[3];
        break;
      case LightingValue.Speed:
        this.lighting.speed = report[3];
        break;
      case LightingValue.Color:
        this.lighting.hue = report[3];
        this.lighting.sat = report[4];
        break;
    }
  }
}

export function createVirtualTransport(keyboard: VirtualKeyboard, info: Omit<TransportInfo, 'virtual'>): Transport {
  const listeners = new Set<(report: Uint8Array) => void>();
  return {
    info: { ...info, virtual: true },
    async send(report) {
      const reply = keyboard.handle(report);
      queueMicrotask(() => listeners.forEach((listener) => listener(reply)));
    },
    onReport(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDisconnect: () => () => undefined,
    async close() {
      listeners.clear();
    },
  };
}
