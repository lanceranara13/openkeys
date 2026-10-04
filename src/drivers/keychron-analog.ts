import type { AnalogState, AnalogSupport, TravelSettings } from './types';

/**
 * Magnetic (Hall effect) switch settings of Keychron HE keyboards: per-key actuation
 * point and rapid trigger. These boards speak VIA for the keymap and add the commands
 * below for the switches.
 *
 * Written from Keychron's published firmware: keychron_raw_hid.c and analog_matrix/
 * under keyboards/keychron/common in github.com/Keychron/qmk_firmware. See CREDITS.md.
 *
 * Distances are in tenths of a millimetre, as in the firmware.
 */
export const KeychronCommand = {
  GetSupportedFeatures: 0xa2,
  AnalogMatrix: 0xa9,
} as const;

/** Second byte of an AnalogMatrix report. */
export const AnalogCommand = {
  GetVersion: 0x01,
  GetProfilesInfo: 0x10,
  SelectProfile: 0x11,
  GetProfileRaw: 0x12,
  SetTravel: 0x14,
  ResetProfile: 0x1e,
  SaveProfile: 0x1f,
} as const;

/** Bit of the GetSupportedFeatures answer that says the keyboard has magnetic switches. */
export const FEATURE_ANALOG_MATRIX = 1 << 3;

/** How a key decides when it is pressed. `Global` means "whatever the keyboard-wide setting is". */
export const KeyMode = { Global: 0, Regular: 1, RapidTrigger: 2 } as const;

/** What the firmware falls back to when a profile holds no value. */
export const DEFAULT_ACTUATION = 20;
export const DEFAULT_SENSITIVITY = 4;

export const KEY_CONFIG_SIZE = 4;
const REPORT_SIZE = 32;
// A profile is read in pieces that fit one report after its 6-byte header.
const READ_CHUNK = 24;
// SetTravel carries one 3-byte column mask per matrix row after its 8-byte header.
const MASK_OFFSET = 8;
const MASK_SIZE = 3;

export interface KeyConfig {
  mode: number;
  actuation: number;
  pressSensitivity: number;
  releaseSensitivity: number;
  /** Dynamic keystroke, gamepad and toggle modes. Not edited by OpenKeys, only preserved. */
  advancedMode: number;
  advancedData: number;
}

/**
 * Reads the firmware's `analog_key_config_t`: four bytes holding packed bit fields
 * (mode:2, actuation:6, press:6, release:6, advanced mode:4, then one data byte).
 */
export function unpackKeyConfig(bytes: ArrayLike<number>, at = 0): KeyConfig {
  const bits = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
  return {
    mode: bits & 0x03,
    actuation: (bits >> 2) & 0x3f,
    pressSensitivity: (bits >> 8) & 0x3f,
    releaseSensitivity: (bits >> 14) & 0x3f,
    advancedMode: (bits >> 20) & 0x0f,
    advancedData: bytes[at + 3],
  };
}

export function packKeyConfig(config: KeyConfig): number[] {
  const bits =
    (config.mode & 0x03) |
    ((config.actuation & 0x3f) << 2) |
    ((config.pressSensitivity & 0x3f) << 8) |
    ((config.releaseSensitivity & 0x3f) << 14) |
    ((config.advancedMode & 0x0f) << 20);
  return [bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, config.advancedData & 0xff];
}

/** Size of one profile in the firmware (PROFILE_SIZE in analog_matrix_eeconfig.h). */
export function profileSize(keyCount: number, dksCount: number, socdCount: number): number {
  const checksum = 2;
  const name = 30;
  return checksum + KEY_CONFIG_SIZE * (keyCount + 1) + name + 19 * dksCount + 3 * socdCount;
}

type Request = (bytes: number[]) => Promise<Uint8Array>;
type OptionalRequest = (bytes: number[]) => Promise<Uint8Array | null>;

class KeychronAnalog implements AnalogSupport {
  // The firmware accepts 0.1 to 3.9 mm. Its own constants (MIN_ACTUATION,
  // BOTTOM_DEAD_ZONE) put the usable travel between 0.5 and 3.8 mm.
  readonly limits = {
    actuation: [5, 38] as [number, number],
    sensitivity: [1, 38] as [number, number],
  };

  private readonly request: Request;
  private readonly rows: number;
  private readonly cols: number;
  private profile = 0;

  constructor(request: Request, matrix: { rows: number; cols: number }) {
    this.request = request;
    this.rows = matrix.rows;
    this.cols = matrix.cols;
  }

  async read(): Promise<AnalogState> {
    const info = await this.request([KeychronCommand.AnalogMatrix, AnalogCommand.GetProfilesInfo]);
    this.profile = info[2];
    const profileCount = info[3];

    // A profile starts with the keyboard-wide settings, followed by one entry per matrix position.
    const total = KEY_CONFIG_SIZE * (this.rows * this.cols + 1);
    const bytes = new Uint8Array(total);
    for (let offset = 0; offset < total; offset += READ_CHUNK) {
      const size = Math.min(READ_CHUNK, total - offset);
      const reply = await this.request([
        KeychronCommand.AnalogMatrix,
        AnalogCommand.GetProfileRaw,
        this.profile,
        offset & 0xff,
        offset >> 8,
        size,
      ]);
      bytes.set(reply.subarray(6, 6 + size), offset);
    }

    const stored = unpackKeyConfig(bytes);
    const pressSensitivity = stored.pressSensitivity || DEFAULT_SENSITIVITY;
    const global: TravelSettings = {
      rapidTrigger: stored.mode === KeyMode.RapidTrigger,
      actuation: stored.actuation || DEFAULT_ACTUATION,
      pressSensitivity,
      releaseSensitivity: stored.releaseSensitivity || pressSensitivity,
    };

    const keys = Array.from({ length: this.rows * this.cols }, (_, index) => {
      const key = unpackKeyConfig(bytes, KEY_CONFIG_SIZE * (index + 1));
      const followsGlobal =
        key.mode === KeyMode.Global &&
        key.actuation === 0 &&
        key.pressSensitivity === 0 &&
        key.releaseSensitivity === 0;
      if (followsGlobal) return null;

      // A zero in any single field means "as the keyboard-wide setting" for that field.
      const rapidTrigger =
        key.mode === KeyMode.Global ? global.rapidTrigger : key.mode === KeyMode.RapidTrigger;
      return {
        rapidTrigger,
        actuation: key.actuation || global.actuation,
        pressSensitivity: key.pressSensitivity || global.pressSensitivity,
        releaseSensitivity: key.releaseSensitivity || global.releaseSensitivity,
      };
    });

    return { profile: this.profile, profileCount, global, keys };
  }

  async setGlobal(settings: TravelSettings): Promise<void> {
    await this.command([AnalogCommand.SetTravel, this.profile, ...travelBytes(settings), 1]);
  }

  async setKeys(
    keys: { row: number; col: number }[],
    settings: TravelSettings | null,
  ): Promise<void> {
    if (keys.length === 0) return;
    const masks = new Array<number>(this.rows * MASK_SIZE).fill(0);
    for (const { row, col } of keys) {
      masks[row * MASK_SIZE + (col >> 3)] |= 1 << (col & 7);
    }
    // All zeros hands the keys back to the keyboard-wide settings.
    const travel = settings ? travelBytes(settings) : [KeyMode.Global, 0, 0, 0];
    await this.command([AnalogCommand.SetTravel, this.profile, ...travel, 0, ...masks]);
  }

  async selectProfile(profile: number): Promise<void> {
    await this.command([AnalogCommand.SelectProfile, profile]);
    this.profile = profile;
  }

  async save(): Promise<void> {
    await this.command([AnalogCommand.SaveProfile, this.profile]);
  }

  async reset(): Promise<void> {
    await this.command([AnalogCommand.ResetProfile, this.profile]);
  }

  /** Sends a command the keyboard answers with 0 for "done" in its third byte. */
  private async command(bytes: number[]): Promise<void> {
    const reply = await this.request([KeychronCommand.AnalogMatrix, ...bytes]);
    if (reply[2] !== 0) throw new Error('The keyboard did not accept those switch settings.');
  }
}

function travelBytes(settings: TravelSettings): number[] {
  return [
    settings.rapidTrigger ? KeyMode.RapidTrigger : KeyMode.Regular,
    settings.actuation,
    settings.pressSensitivity,
    settings.releaseSensitivity,
  ];
}

/**
 * Asks a keyboard whether it has Keychron's magnetic switch commands. Resolves to null
 * when it has not, or when its matrix is not the one the definition describes.
 */
export async function detectKeychronAnalog(
  request: Request,
  requestOptional: OptionalRequest,
  matrix: { rows: number; cols: number },
): Promise<AnalogSupport | null> {
  const features = await requestOptional([KeychronCommand.GetSupportedFeatures]);
  if (!features || !(features[2] & FEATURE_ANALOG_MATRIX)) return null;

  // The column masks of SetTravel have to fit in one report.
  if (matrix.cols > MASK_SIZE * 8 || MASK_OFFSET + matrix.rows * MASK_SIZE > REPORT_SIZE) {
    return null;
  }

  const info = await requestOptional([KeychronCommand.AnalogMatrix, AnalogCommand.GetProfilesInfo]);
  if (!info || info[3] === 0) return null;

  // Reading a profile with the wrong matrix size would show other keys' settings.
  const size = info[4] | (info[5] << 8);
  if (size !== profileSize(matrix.rows * matrix.cols, info[6], info[7])) return null;

  return new KeychronAnalog(request, matrix);
}
