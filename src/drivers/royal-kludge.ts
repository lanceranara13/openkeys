import { deviceKey, type KeyboardDefinition } from '../core/definition';
import { createQmkCatalog, type Keycode, type KeycodeCatalog } from '../core/keycodes';
import type { ValueRef } from '../core/menus';
import type { DriverInfo, DriverModule, KeyboardDriver, Transport } from './types';

/**
 * Driver for the Royal Kludge keyboards that are configured with the "RK Keyboard"
 * Windows software (USB vendor 258A), not with VIA.
 *
 * Commands are 65-byte HID feature reports with report id 0x0A. The keyboard takes its
 * whole keymap in nine of them and its lighting in one, and it answers nothing: there is
 * no way to ask what it holds. So OpenKeys shows the keys the keyboard shipped with, or
 * what it last sent from this browser, and every change sends everything again.
 *
 * The reports and the key values follow Rangoli and Kludge Knight, which send these same
 * bytes (see CREDITS.md). OpenKeys has not tried them on a real keyboard yet.
 */
export const RK_VENDOR_ID = 0x258a;
export const RK_REPORT_ID = 0x0a;
/** A report as the sources count it: the report id, then 64 bytes. */
export const RK_REPORT_SIZE = 65;
export const RK_KEYMAP_REPORTS = 9;
/** Where the key bytes start: the first report of a keymap has a longer header. */
export const RK_FIRST_DATA_AT = 5;
export const RK_DATA_AT = 3;
/** Room for keys in nine reports, four bytes per key. */
export const RK_KEYMAP_BYTES =
  RK_REPORT_SIZE - RK_FIRST_DATA_AT + (RK_KEYMAP_REPORTS - 1) * (RK_REPORT_SIZE - RK_DATA_AT);
/** Key positions run down the columns: position = column * 6 + row. */
const ROWS_PER_COLUMN = 6;

/** The value ids of the lighting controls in a Royal Kludge definition's menu. */
export const RkValue = {
  Effect: 1,
  Brightness: 2,
  Speed: 3,
  Color: 4,
  Random: 5,
  Sleep: 6,
} as const;

// What a keyboard is assumed to be set to before OpenKeys has sent it anything:
// brightest, medium speed, white, lights off after ten minutes.
const DEFAULT_VALUES: Record<number, number[]> = {
  [RkValue.Brightness]: [5],
  [RkValue.Speed]: [3],
  [RkValue.Color]: [0, 0],
  [RkValue.Random]: [0],
  [RkValue.Sleep]: [2],
};

const NOTICE =
  'This keyboard cannot report what it holds. OpenKeys shows the keys it shipped with, or ' +
  'what it last stored from this browser. A change sends every key and the lighting again, ' +
  'which replaces settings made with other software.';

/** A plain key is `00 00 <USB HID usage> 00`. */
const plainKey = (usage: number) => usage << 8;
/** A modifier is one bit of the second byte, in the order of the USB modifier byte. */
const modifierKey = (usage: number) => 1 << (16 + usage - 0xe0);
/** A media key is `01 00 <USB consumer usage>`. */
const mediaKey = (usage: number) => 0x01000000 + usage;
const FN_KEY = 0xb000;

/**
 * One entry of a definition's `defaultKeymap` as the value the keyboard stores: up to
 * 255 is a plain key's HID usage, anything larger is already the stored value.
 */
const defaultCode = (value: number) => (value > 0xff ? value : plainKey(value));

/** The nine reports that carry a whole keymap. `codes` is indexed by key position. */
export function keymapReports(codes: readonly number[]): Uint8Array[] {
  const keys = new Uint8Array(RK_KEYMAP_BYTES);
  const view = new DataView(keys.buffer);
  codes.forEach((code, position) => {
    if (position * 4 + 4 <= keys.length) view.setUint32(position * 4, code);
  });

  const reports: Uint8Array[] = [];
  let taken = 0;
  for (let index = 0; index < RK_KEYMAP_REPORTS; index++) {
    const report = new Uint8Array(RK_REPORT_SIZE);
    report.set([RK_REPORT_ID, RK_KEYMAP_REPORTS, index + 1]);
    if (index === 0) report.set([0x01, 0xf8], 3);
    const dataAt = index === 0 ? RK_FIRST_DATA_AT : RK_DATA_AT;
    const room = RK_REPORT_SIZE - dataAt;
    report.set(keys.subarray(taken, taken + room), dataAt);
    taken += room;
    reports.push(report);
  }
  return reports;
}

/** A colour control holds hue and saturation; the keyboard wants red, green and blue. */
function toRgb(hue: number, saturation: number): number[] {
  const turn = (hue / 255) * 6;
  const strength = saturation / 255;
  const channel = (offset: number) => {
    const k = (offset + turn) % 6;
    return Math.round(255 * (1 - strength * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

/** The one report that sets the lighting. `values` holds the bytes of each control. */
export function lightingReport(values: Record<number, number[]>): Uint8Array {
  const value = (id: number) => values[id]?.[0] ?? 0;
  const random = value(RkValue.Random) !== 0;
  const [hue = 0, saturation = 0] = values[RkValue.Color] ?? [];

  const report = new Uint8Array(RK_REPORT_SIZE);
  report.set([RK_REPORT_ID, 0x01, 0x01, 0x02, 0x29, value(RkValue.Effect), 0x00]);
  report[7] = value(RkValue.Speed);
  report[8] = value(RkValue.Brightness);
  if (!random) report.set(toRgb(hue, saturation), 9);
  report[12] = random ? 1 : 0;
  report[13] = value(RkValue.Sleep);
  return report;
}

/** What OpenKeys last sent to one keyboard. The keyboard itself cannot be asked. */
export interface RkMemory {
  /** Key position -> stored value, for the keys that differ from the default. */
  keys: Record<number, number>;
  /** Lighting value id -> the bytes of that control. */
  values: Record<number, number[]>;
}

export interface RkStore {
  load(): RkMemory;
  save(memory: RkMemory): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readMemory(raw: unknown): RkMemory {
  const memory: RkMemory = { keys: {}, values: {} };
  if (!isRecord(raw)) return memory;
  if (isRecord(raw.keys)) {
    for (const [position, code] of Object.entries(raw.keys)) {
      if (typeof code === 'number' && Number.isInteger(code) && code >= 0) memory.keys[Number(position)] = code;
    }
  }
  if (isRecord(raw.values)) {
    for (const [id, bytes] of Object.entries(raw.values)) {
      if (Array.isArray(bytes) && bytes.every((byte) => typeof byte === 'number')) {
        memory.values[Number(id)] = bytes as number[];
      }
    }
  }
  return memory;
}

/** Keeps what was sent in memory only: for tests and for previews of a keyboard. */
export function memoryStore(initial?: RkMemory): RkStore {
  let stored = JSON.stringify(initial ?? null);
  return {
    load: () => readMemory(JSON.parse(stored)),
    save: (memory) => {
      stored = JSON.stringify(memory);
    },
  };
}

/** Keeps what was sent in this browser, per keyboard model. */
function browserStore(definition: KeyboardDefinition): RkStore {
  const key = `openkeys:royal-kludge:${deviceKey(definition.vendorId, definition.productId)}`;
  return {
    load() {
      try {
        return readMemory(JSON.parse(localStorage.getItem(key) ?? 'null'));
      } catch {
        // Unreadable or blocked storage: start from the keyboard's defaults.
        return readMemory(null);
      }
    },
    save(memory) {
      try {
        localStorage.setItem(key, JSON.stringify(memory));
      } catch {
        // Storage is full or blocked: the change still holds until the page is closed.
      }
    },
  };
}

function createCatalog(): KeycodeCatalog {
  const qmk = createQmkCatalog(12, 1);
  const group = (id: string) => qmk.groups.find((item) => item.id === id)!;
  // The codes both source projects list stop at the Menu key (usage 0x65).
  const plain = (id: string) => ({
    ...group(id),
    keycodes: group(id)
      .keycodes.filter((key) => key.code <= 0x65)
      .map((key) => ({ ...key, code: plainKey(key.code) })),
  });

  const groups = [
    plain('basic'),
    {
      ...group('modifiers'),
      keycodes: group('modifiers').keycodes.map((key) => ({
        ...key,
        code: key.code >= 0xe0 ? modifierKey(key.code) : plainKey(key.code),
      })),
    },
    plain('navigation'),
    plain('function'),
    plain('numpad'),
    {
      id: 'media',
      label: 'Media',
      keycodes: [
        { code: mediaKey(0xe2), name: 'KC_MUTE', label: 'Mute', title: 'Mute' },
        { code: mediaKey(0xea), name: 'KC_VOLD', label: 'Vol −', title: 'Volume down' },
        { code: mediaKey(0xe9), name: 'KC_VOLU', label: 'Vol +', title: 'Volume up' },
        { code: mediaKey(0xb6), name: 'KC_MPRV', label: 'Prev', title: 'Previous track' },
        { code: mediaKey(0xcd), name: 'KC_MPLY', label: 'Play', title: 'Play / pause' },
        { code: mediaKey(0xb5), name: 'KC_MNXT', label: 'Next', title: 'Next track' },
        { code: mediaKey(0xb7), name: 'KC_MSTP', label: 'Stop', title: 'Stop playback' },
        { code: mediaKey(0x192), name: 'KC_CALC', label: 'Calc', title: 'Calculator' },
      ],
    },
    {
      id: 'special',
      label: 'Special',
      keycodes: [{ code: FN_KEY, name: 'FN', label: 'Fn', title: 'The keyboard’s own Fn key' }],
    },
  ];

  const all = groups.flatMap((item) => item.keycodes);
  const byCode = new Map(all.map((key) => [key.code, key]));
  const byName = new Map(all.map((key) => [key.name.toUpperCase(), key.code]));
  const hex = (code: number) => `0x${code.toString(16).toUpperCase().padStart(8, '0')}`;

  return {
    groups,
    describe(code): Keycode {
      const known = byCode.get(code);
      if (known) return known;

      // A shortcut is modifier bits and a key in one value, such as Ctrl+C.
      const key = byCode.get(code & 0xff00);
      const modifiers = [0, 1, 2, 3, 4, 5, 6, 7]
        .filter((bit) => code & (1 << (16 + bit)))
        .map((bit) => byCode.get(1 << (16 + bit))!.label);
      if (code <= 0xffffff && (code & 0xff) === 0 && key && modifiers.length > 0) {
        const label = `${modifiers.join('+')}+${key.label}`;
        return { code, name: hex(code), label, title: `${label} in one press` };
      }
      return {
        code,
        name: hex(code),
        label: hex(code),
        title: `${hex(code)} (an action OpenKeys cannot edit yet)`,
      };
    },
    parse(text) {
      const value = text.trim();
      if (/^0x[0-9a-f]{1,8}$/i.test(value)) return Number.parseInt(value, 16);
      return byName.get(value.toUpperCase());
    },
  };
}

export class RoyalKludgeDriver implements KeyboardDriver {
  private readonly transport: Transport;
  private readonly definition: KeyboardDefinition;
  private readonly store: RkStore;
  /** What each key holds as shipped, by key position. */
  private readonly defaults: number[];
  private memory: RkMemory = { keys: {}, values: {} };
  // Two changes made in quick succession must not mix their reports.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(transport: Transport, definition: KeyboardDefinition, store: RkStore) {
    this.transport = transport;
    this.definition = definition;
    this.store = store;
    this.defaults = (definition.defaultKeymap ?? []).map(defaultCode);
  }

  async connect(): Promise<DriverInfo> {
    if (!this.transport.sendFeature) throw new Error('This connection cannot send feature reports.');
    if (this.defaults.length === 0) {
      throw new Error(`"${this.definition.name}" does not list its default keys.`);
    }
    // Nothing is sent here: the keyboard has no question it answers.
    this.memory = this.store.load();

    return {
      protocolName: 'Royal Kludge',
      protocolVersion: 1,
      // The base layer. The Fn layer cannot be changed with these commands.
      layerCount: 1,
      supportsMenus: true,
      catalog: createCatalog(),
      analog: null,
      notice: NOTICE,
    };
  }

  async readKeymap(): Promise<number[][]> {
    const { rows, cols } = this.definition.matrix;
    const layer = new Array<number>(rows * cols).fill(0);
    this.defaults.forEach((code, position) => {
      const row = position % ROWS_PER_COLUMN;
      const col = Math.floor(position / ROWS_PER_COLUMN);
      if (row < rows && col < cols) layer[row * cols + col] = this.memory.keys[position] ?? code;
    });
    return [layer];
  }

  setKeycode(_layer: number, row: number, col: number, keycode: number): Promise<void> {
    return this.exclusive(async () => {
      const position = col * ROWS_PER_COLUMN + row;
      if (row >= ROWS_PER_COLUMN || position >= this.defaults.length) {
        throw new Error('That key is outside what this keyboard can store.');
      }
      const keys = { ...this.memory.keys };
      if (keycode === this.defaults[position]) delete keys[position];
      else keys[position] = keycode;
      await this.sendKeymap(keys);
      this.remember({ ...this.memory, keys });
    });
  }

  resetKeymap(): Promise<void> {
    return this.exclusive(async () => {
      await this.sendKeymap({});
      this.remember({ ...this.memory, keys: {} });
    });
  }

  async readValue(ref: ValueRef): Promise<number[] | null> {
    if (ref.channel !== 0) return null;
    return this.values()[ref.valueId] ?? null;
  }

  writeValue(ref: ValueRef, bytes: number[]): Promise<void> {
    return this.exclusive(async () => {
      const values = { ...this.memory.values, [ref.valueId]: bytes };
      await this.send(lightingReport({ ...this.values(), ...values }));
      this.remember({ ...this.memory, values });
    });
  }

  // The keyboard keeps what it is sent; there is no separate save.
  async saveValues(): Promise<void> {}

  /** Every lighting value: what was last sent, or what a new keyboard is assumed to hold. */
  private values(): Record<number, number[]> {
    // The first effect of the definition's own list, since the numbers differ per model.
    const effect = this.definition.menus
      .flatMap((menu) => menu.sections.flatMap((section) => section.controls))
      .find((control) => control.ref.channel === 0 && control.ref.valueId === RkValue.Effect);
    const first = effect?.type === 'dropdown' ? effect.choices[0].value : 1;
    return { ...DEFAULT_VALUES, [RkValue.Effect]: [first], ...this.memory.values };
  }

  /** Sends the whole keymap: the defaults with `keys` on top. */
  private async sendKeymap(keys: Record<number, number>): Promise<void> {
    const codes = this.defaults.map((code, position) => keys[position] ?? code);
    for (const report of keymapReports(codes)) await this.send(report);
  }

  private async send(report: Uint8Array): Promise<void> {
    if (!this.transport.sendFeature) throw new Error('This connection cannot send feature reports.');
    await this.transport.sendFeature(report.subarray(1), report[0]);
  }

  /** Only what the keyboard accepted is remembered. */
  private remember(memory: RkMemory): void {
    this.memory = memory;
    this.store.save(memory);
  }

  /** Runs one change after the other. */
  private exclusive<T>(change: () => Promise<T>): Promise<T> {
    const result = this.queue.then(change);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

export const royalKludgeDriver: DriverModule = {
  id: 'royal-kludge',
  // The interface the vendor software opens. The vendor id is the chip maker's and other
  // brands use it too: their keyboards are listed in the picker, and have no definition.
  filters: [{ vendorId: RK_VENDOR_ID, usagePage: 0x01, usage: 0x80 }],
  create: (transport, definition) =>
    new RoyalKludgeDriver(
      transport,
      definition,
      // A preview must not change what is remembered about the real keyboard.
      transport.info.virtual ? memoryStore() : browserStore(definition),
    ),
};
