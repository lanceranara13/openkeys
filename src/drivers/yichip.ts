import type { KeyboardDefinition } from '../core/definition';
import { createQmkCatalog, type Keycode, type KeycodeCatalog } from '../core/keycodes';
import type { DriverInfo, DriverModule, KeyboardDriver, Transport } from './types';

/**
 * Driver for keyboards on RongYuan's YiChip firmware (YC500 and relatives): Akko and
 * MonsGeek boards that are configured with the "Akko Cloud" driver, not with VIA.
 *
 * Commands travel as 64-byte HID feature reports. Checked against a real Akko 5075B
 * Plus; the command numbers and layouts follow the vendor's web driver as documented
 * by github.com/echtzeit-solutions/monsgeek-akko-linux. See CREDITS.md.
 *
 * Careful: the magnetic RY5088 boards of the same makers number their commands
 * differently. Nothing here may be sent to them.
 */
export const YiChipCommand = {
  GetInfo: 0x8f,
  GetProfile: 0x85,
  GetKeymap: 0x89,
  SetKey: 0x13,
} as const;

export const YICHIP_REPORT_SIZE = 64;
/** The firmware always has room for 128 keys of four bytes each, sent 16 at a time. */
export const YICHIP_KEY_COUNT = 128;
const KEYS_PER_PAGE = 16;
/** Key positions run down the columns: position = column * 6 + row. */
const ROWS_PER_COLUMN = 6;

const AKKO_VENDOR_ID = 0x3151;
// The keyboard needs a moment between receiving a query and having the answer ready,
// and longer to store a remapped key.
const REPLY_DELAY_MS = 20;
const WRITE_SETTLE_MS = 150;
// The real keyboard was seen to skip about one message in two hundred. A reply is looked
// for a few times, then the message is sent again.
const POLLS = 3;
const ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A message as the firmware wants it: padded, with its checksum in byte 7. */
export function frame(message: number[]): Uint8Array {
  const report = new Uint8Array(YICHIP_REPORT_SIZE);
  report.set(message);
  const sum = report.subarray(0, 7).reduce((total, byte) => total + byte, 0);
  report[7] = 255 - (sum & 0xff);
  return report;
}

/** A key is stored as four bytes; OpenKeys carries them as one number. */
const toCode = (bytes: ArrayLike<number>, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const toBytes = (code: number) => [code >>> 24, (code >> 16) & 0xff, (code >> 8) & 0xff, code & 0xff];
/** A plain key is `00 00 <USB HID usage> 00`. */
const plainKey = (usage: number) => usage << 8;
/** A media key is `03 00 <USB consumer usage, low byte first>`. */
const mediaKey = (usage: number) => (0x03000000 | ((usage & 0xff) << 8) | (usage >> 8)) >>> 0;

/**
 * One entry of a definition's `defaultKeymap` as the key value the keyboard stores:
 * up to 255 is a plain key's HID usage, anything larger is already the stored value.
 */
export const defaultCode = (value: number) => (value > 0xff ? value : plainKey(value));

class Link {
  private readonly transport: Transport;
  private readonly pause: (ms: number) => Promise<unknown>;

  constructor(transport: Transport) {
    this.transport = transport;
    // The in-memory keyboard answers at once; waiting would only slow the tests.
    this.pause = transport.info.virtual ? () => Promise.resolve() : sleep;
  }

  /**
   * Sends a query and returns its reply. A keyboard that skipped the query goes on
   * showing its previous reply, so the reply only counts once `isAnswer` accepts it.
   */
  private async ask(message: number[], isAnswer: (reply: Uint8Array) => boolean): Promise<Uint8Array> {
    const { sendFeature, receiveFeature } = this.transport;
    if (!sendFeature || !receiveFeature) throw new Error('This connection cannot send feature reports.');
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      await sendFeature.call(this.transport, frame(message));
      for (let poll = 0; poll < POLLS; poll++) {
        await this.pause(REPLY_DELAY_MS);
        const reply = await receiveFeature.call(this.transport);
        if (isAnswer(reply)) return reply;
      }
    }
    throw new Error('The keyboard did not answer. Unplug it, plug it back in and reconnect.');
  }

  /** A query whose reply starts with the command it answers. */
  queryEchoed(message: number[]): Promise<Uint8Array> {
    return this.ask(message, (reply) => reply[0] === message[0]);
  }

  /**
   * A query whose reply is bare data, with nothing to tell it from the reply before it.
   * An identify query goes first: once the reply is no longer the identify answer, it
   * is the data that was asked for.
   */
  async queryData(message: number[]): Promise<Uint8Array> {
    const marker = await this.queryEchoed([YiChipCommand.GetInfo]);
    return this.ask(message, (reply) => reply.some((byte, index) => byte !== marker[index]));
  }

  /** Sends a command that changes something. The keyboard sends no reply to these. */
  async write(message: number[]): Promise<void> {
    if (!this.transport.sendFeature) throw new Error('This connection cannot send feature reports.');
    await this.transport.sendFeature(frame(message));
    await this.pause(WRITE_SETTLE_MS);
  }

  /** The model number the keyboard reports about itself. */
  async modelId(): Promise<number> {
    const reply = await this.queryEchoed([YiChipCommand.GetInfo]);
    return new DataView(reply.buffer, reply.byteOffset, reply.byteLength).getUint32(1, true);
  }
}

function createCatalog(): KeycodeCatalog {
  // Plain keys are USB HID usages, which is what QMK's basic keycodes are too.
  const hidGroups = ['basic', 'modifiers', 'navigation', 'function', 'numpad'];
  const groups = createQmkCatalog(12, 1)
    .groups.filter((group) => hidGroups.includes(group.id))
    .map((group) => ({
      ...group,
      keycodes: group.keycodes.map((key) => ({ ...key, code: plainKey(key.code) })),
    }));
  groups.push(
    {
      id: 'media',
      label: 'Media',
      // Volume down and up are what the knob holds as shipped.
      keycodes: [
        { code: mediaKey(0xe2), name: 'KC_MUTE', label: 'Mute', title: 'Mute' },
        { code: mediaKey(0xea), name: 'KC_VOLD', label: 'Vol −', title: 'Volume down' },
        { code: mediaKey(0xe9), name: 'KC_VOLU', label: 'Vol +', title: 'Volume up' },
        { code: mediaKey(0xb6), name: 'KC_MPRV', label: 'Prev', title: 'Previous track' },
        { code: mediaKey(0xcd), name: 'KC_MPLY', label: 'Play', title: 'Play / pause' },
        { code: mediaKey(0xb5), name: 'KC_MNXT', label: 'Next', title: 'Next track' },
        { code: mediaKey(0xb7), name: 'KC_MSTP', label: 'Stop', title: 'Stop playback' },
      ],
    },
    {
      id: 'special',
      label: 'Special',
      keycodes: [{ code: 0, name: 'OFF', label: '✕', title: 'Disabled: the key does nothing' }],
    },
  );

  const all = groups.flatMap((group) => group.keycodes);
  const byCode = new Map(all.map((key) => [key.code, key]));
  const byName = new Map(all.map((key) => [key.name.toUpperCase(), key.code]));
  const hex = (code: number) => `0x${code.toString(16).toUpperCase().padStart(8, '0')}`;

  return {
    groups,
    describe(code): Keycode {
      return (
        byCode.get(code) ?? {
          code,
          name: hex(code),
          label: hex(code),
          title: `${hex(code)} (a macro, mouse or media action OpenKeys cannot edit yet)`,
        }
      );
    },
    parse(text) {
      const value = text.trim();
      if (/^0x[0-9a-f]{1,8}$/i.test(value)) return Number.parseInt(value, 16);
      return byName.get(value.toUpperCase());
    },
  };
}

class YiChipDriver implements KeyboardDriver {
  private readonly link: Link;
  private readonly definition: KeyboardDefinition;
  private profile = 0;

  constructor(transport: Transport, definition: KeyboardDefinition) {
    this.link = new Link(transport);
    this.definition = definition;
  }

  async connect(): Promise<DriverInfo> {
    const model = await this.link.modelId();
    if (this.definition.deviceId !== null && model !== this.definition.deviceId) {
      throw new Error(`This keyboard reports model ${model}, not "${this.definition.name}".`);
    }
    this.profile = (await this.link.queryEchoed([YiChipCommand.GetProfile]))[1];

    return {
      protocolName: 'Akko',
      protocolVersion: model,
      // The base layer. The Fn layer is a separate table OpenKeys does not edit yet.
      layerCount: 1,
      supportsMenus: false,
      catalog: createCatalog(),
      analog: null,
    };
  }

  /** One page of the keymap: 16 keys of four bytes each. */
  private readPage(page: number): Promise<Uint8Array> {
    return this.link.queryData([YiChipCommand.GetKeymap, this.profile, page]);
  }

  async readKeymap(): Promise<number[][]> {
    const stored = new Uint8Array(YICHIP_KEY_COUNT * 4);
    for (let page = 0; page < YICHIP_KEY_COUNT / KEYS_PER_PAGE; page++) {
      const reply = await this.readPage(page);
      stored.set(reply.subarray(0, KEYS_PER_PAGE * 4), page * KEYS_PER_PAGE * 4);
    }

    const { rows, cols } = this.definition.matrix;
    const layer = new Array<number>(rows * cols).fill(0);
    for (let position = 0; position < YICHIP_KEY_COUNT; position++) {
      const row = position % ROWS_PER_COLUMN;
      const col = Math.floor(position / ROWS_PER_COLUMN);
      if (row < rows && col < cols) layer[row * cols + col] = toCode(stored, position * 4);
    }
    return [layer];
  }

  async setKeycode(_layer: number, row: number, col: number, keycode: number): Promise<void> {
    const position = col * ROWS_PER_COLUMN + row;
    if (row >= ROWS_PER_COLUMN || position >= YICHIP_KEY_COUNT) {
      throw new Error('That key is outside what this keyboard can store.');
    }
    // The keyboard does not confirm a remap, so the key is read back, and sent again
    // when the keyboard skipped it.
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      // Byte 7 is the checksum; the four key bytes follow it.
      await this.link.write([YiChipCommand.SetKey, this.profile, position, 0, 0, 0, 0, 0, ...toBytes(keycode)]);
      const page = await this.readPage(Math.floor(position / KEYS_PER_PAGE));
      if (toCode(page, (position % KEYS_PER_PAGE) * 4) === keycode) return;
    }
    throw new Error('The keyboard did not store that key. Try again.');
  }

  /** Puts changed keys back to what the definition says the keyboard shipped with. */
  async resetKeymap(): Promise<void> {
    const defaults = this.definition.defaultKeymap;
    if (!defaults) throw new Error(`"${this.definition.name}" does not list its default keys.`);

    const { cols } = this.definition.matrix;
    const [current] = await this.readKeymap();
    // Only the keys OpenKeys shows can have been changed here. The same table holds
    // things it does not show (the Fn key, the knob's second mode); those are left alone.
    for (const { row, col } of this.definition.layout.keys) {
      const value = defaults[col * ROWS_PER_COLUMN + row];
      if (row < 0 || value === undefined) continue;
      const code = defaultCode(value);
      if (current[row * cols + col] !== code) await this.setKeycode(0, row, col, code);
    }
  }

  // No menus yet: lighting on this firmware is not implemented.
  async readValue(): Promise<number[] | null> {
    return null;
  }
  async writeValue(): Promise<void> {}
  async saveValues(): Promise<void> {}
}

export const yichipDriver: DriverModule = {
  id: 'yichip',
  // The vendor's config interface. Many models share one USB id; see `identify`.
  filters: [{ vendorId: AKKO_VENDOR_ID, usagePage: 0xffff, usage: 0x02 }],
  create: (transport, definition) => new YiChipDriver(transport, definition),
  async identify(transport) {
    if (transport.info.vendorId !== AKKO_VENDOR_ID || !transport.sendFeature) return null;
    return new Link(transport).modelId();
  },
};
