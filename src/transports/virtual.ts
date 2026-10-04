import {
  AnalogCommand,
  DEFAULT_ACTUATION,
  DEFAULT_SENSITIVITY,
  FEATURE_ANALOG_MATRIX,
  KEY_CONFIG_SIZE,
  KeychronCommand,
  KeyMode,
  packKeyConfig,
  profileSize,
  unpackKeyConfig,
} from '../drivers/keychron-analog';
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
  /** Pretend to have magnetic switches, answering Keychron's switch commands. */
  analog?: boolean;
}

// What Keychron's firmware is built with (analog_matrix_eeconfig.h).
const ANALOG_VERSION = 0x04;
const ANALOG_PROFILE_COUNT = 3;
const ANALOG_DKS_COUNT = 20;
const ANALOG_SOCD_COUNT = 20;
const ANALOG_MAX_ACTUATION = 39;
const FEATURE_DEFAULT_LAYER = 1 << 0;

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
  /** Switch profiles, laid out byte for byte as in the firmware. null: no magnetic switches. */
  private readonly profiles: Uint8Array[] | null;
  private currentProfile = 0;
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

    this.profiles = options.analog
      ? Array.from({ length: ANALOG_PROFILE_COUNT }, (_, index) => this.factoryProfile(index))
      : null;
  }

  /** A profile as the keyboard ships: every key follows the keyboard-wide settings. */
  private factoryProfile(index: number): Uint8Array {
    const size = profileSize(this.rows * this.cols, ANALOG_DKS_COUNT, ANALOG_SOCD_COUNT);
    const profile = new Uint8Array(size);
    profile.set(
      packKeyConfig({
        // The second profile ships with rapid trigger on, so there is one to try.
        mode: index === 1 ? KeyMode.RapidTrigger : KeyMode.Regular,
        actuation: DEFAULT_ACTUATION,
        pressSensitivity: DEFAULT_SENSITIVITY,
        releaseSensitivity: DEFAULT_SENSITIVITY,
        advancedMode: 0,
        advancedData: 0,
      }),
    );
    return profile;
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

      case KeychronCommand.GetSupportedFeatures:
        if (this.profiles) reply[2] = FEATURE_DEFAULT_LAYER | FEATURE_ANALOG_MATRIX;
        else unhandled();
        break;

      case KeychronCommand.AnalogMatrix:
        if (this.profiles) this.handleAnalog(reply, this.profiles);
        else unhandled();
        break;

      default:
        unhandled();
    }
    return reply;
  }

  /** Keychron's switch commands, as analog_matrix_rx() in the firmware answers them. */
  private handleAnalog(reply: Uint8Array, profiles: Uint8Array[]) {
    const done = (success: boolean) => {
      reply[2] = success ? 0 : 1;
    };

    switch (reply[1]) {
      case AnalogCommand.GetVersion:
        reply[2] = ANALOG_VERSION;
        break;

      case AnalogCommand.GetProfilesInfo: {
        const size = profiles[0].length;
        reply[2] = this.currentProfile;
        reply[3] = profiles.length;
        reply[4] = size & 0xff;
        reply[5] = size >> 8;
        reply[6] = ANALOG_DKS_COUNT;
        reply[7] = ANALOG_SOCD_COUNT;
        break;
      }

      case AnalogCommand.SelectProfile: {
        const valid = reply[2] < profiles.length;
        if (valid) this.currentProfile = reply[2];
        done(valid);
        break;
      }

      case AnalogCommand.GetProfileRaw: {
        const profile = profiles[reply[2]];
        const offset = reply[3] | (reply[4] << 8);
        const size = reply[5];
        if (!profile || 6 + size > reply.length) break;
        reply.fill(0, 6, 6 + size);
        reply.set(profile.subarray(offset, offset + size), 6);
        break;
      }

      case AnalogCommand.SetTravel: {
        const [, , index, mode, actuation, press, release, everyKey] = reply;
        const profile = profiles[index];
        const valid =
          profile !== undefined &&
          mode <= KeyMode.RapidTrigger &&
          actuation <= ANALOG_MAX_ACTUATION &&
          !(everyKey && mode === KeyMode.Global);
        if (valid) {
          const apply = (at: number) => {
            const config = unpackKeyConfig(profile, at);
            profile.set(
              packKeyConfig({
                ...config,
                mode,
                actuation,
                pressSensitivity: press,
                releaseSensitivity: release,
              }),
              at,
            );
          };
          if (everyKey) {
            apply(0);
          } else {
            for (let row = 0; row < this.rows; row++) {
              for (let col = 0; col < this.cols; col++) {
                const mask = reply[8 + row * 3 + (col >> 3)];
                if (mask & (1 << (col & 7))) {
                  apply(KEY_CONFIG_SIZE * (1 + row * this.cols + col));
                }
              }
            }
          }
        }
        done(valid);
        break;
      }

      case AnalogCommand.ResetProfile: {
        const valid = reply[2] < profiles.length;
        if (valid) profiles[reply[2]] = this.factoryProfile(reply[2]);
        done(valid);
        break;
      }

      case AnalogCommand.SaveProfile:
        done(reply[2] < profiles.length);
        break;
    }
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
