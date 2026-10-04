import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDefinition } from '../src/core/definition';
import { createDriver, identifyModel } from '../src/drivers';
import type { Transport } from '../src/drivers/types';
import { frame } from '../src/drivers/yichip';
import { createVirtualYiChipTransport } from '../src/transports/virtual-yichip';

// The YiChip driver against an in-memory keyboard that behaves the way the real Akko
// 5075B Plus was observed to. The byte sequences below are the ones that worked on it.

const file = path.resolve(__dirname, '../keyboards/akko/5075b_plus/5075b_plus.json');
const definition = parseDefinition(JSON.parse(fs.readFileSync(file, 'utf8')));
const { cols } = definition.matrix;
const at = (row: number, col: number) => row * cols + col;

const ESC = 0x2900;
const CAPS_LOCK = 0x3900;
const LEFT_CTRL = 0xe000;
// Read from the real keyboard: 03 00 ea 00 and 03 00 e9 00 on the knob, 0a 01 00 00 on Fn.
const VOLUME_DOWN = 0x0300ea00;
const VOLUME_UP = 0x0300e900;
const FN = 0x0a010000;
const FN_POSITION = 59;
const SET_KEY = 0x13;

/** `skips`: asked before each message; true makes the keyboard ignore that message. */
function connect(skips: () => boolean = () => false) {
  const sent: number[][] = [];
  const virtual = createVirtualYiChipTransport(definition);
  const transport: Transport = {
    ...virtual,
    sendFeature: async (report) => {
      sent.push([...report]);
      if (!skips()) await virtual.sendFeature!(report);
    },
  };
  return { sent, transport, driver: createDriver(transport, definition) };
}

/** True about one time in eight, in an order that is the same on every run. */
function nowAndThen(seed: number): () => boolean {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 16) % 8 === 0;
  };
}

const writes = (sent: number[][]) => sent.filter((report) => report[0] === SET_KEY);

describe('YiChip driver', () => {
  it('frames a message with the checksum the firmware expects', () => {
    // 255 - 0x8f = 0x70: the identify query that the real keyboard answered.
    expect([...frame([0x8f]).subarray(0, 9)]).toEqual([0x8f, 0, 0, 0, 0, 0, 0, 0x70, 0]);
    expect(frame([0x89, 0, 1])[7]).toBe(255 - (0x89 + 1));
  });

  it('asks the keyboard which model it is', async () => {
    const { transport } = connect();
    expect(await identifyModel(transport)).toBe(1042);
  });

  it('leaves keyboards of other makers alone', async () => {
    const { transport, sent } = connect();
    const other = { ...transport, info: { ...transport.info, vendorId: 0x1234 } };
    expect(await identifyModel(other)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('reads the base layer, turning column-major positions into rows and columns', async () => {
    const { driver } = connect();
    const info = await driver.connect();
    const [layer] = await driver.readKeymap();

    expect(info).toMatchObject({ protocolName: 'Akko', layerCount: 1, analog: null });
    expect(layer[at(0, 0)]).toBe(ESC);
    expect(layer[at(3, 0)]).toBe(CAPS_LOCK);
    expect(layer[at(5, 0)]).toBe(LEFT_CTRL);
    expect(info.catalog.describe(layer[at(2, 1)]).label).toBe('Q');
    expect(info.catalog.describe(layer[at(1, 13)]).label).toBe('Bksp');
  });

  it('remaps a key with the bytes that worked on the real keyboard', async () => {
    const { driver, sent } = connect();
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);

    // 13 = set key, profile 0, position 3 (Caps Lock), checksum, then 00 00 e0 00.
    expect(writes(sent)).toHaveLength(1);
    expect(writes(sent)[0].slice(0, 12)).toEqual([0x13, 0, 3, 0, 0, 0, 0, 0xe9, 0, 0, 0xe0, 0]);
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(LEFT_CTRL);
  });

  // Seen on the real keyboard: about 1 message in 200 is ignored, and the reply to the
  // one before it is still there. Unnoticed, that put one page's keys on another page.
  it.each([1, 2, 3, 4, 5])('reads the right keys when messages are skipped (run %i)', async (seed) => {
    let skipped = 0;
    const skips = nowAndThen(seed);
    const { driver } = connect(() => skips() && ++skipped > 0);
    await driver.connect();
    const [layer] = await driver.readKeymap();

    expect(skipped).toBeGreaterThan(0);
    definition.defaultKeymap!.forEach((value, position) => {
      const index = at(position % 6, Math.floor(position / 6));
      expect(layer[index], `position ${position}`).toBe(value > 0xff ? value : value << 8);
    });
  });

  it('sends a remap again when the keyboard skipped it', async () => {
    let skipNext = false;
    const { driver, sent } = connect(() => skipNext && !(skipNext = false));
    await driver.connect();
    skipNext = true;
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);

    expect(writes(sent)).toHaveLength(2);
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(LEFT_CTRL);
  });

  it.each([1, 2, 3, 4, 5])('stores remaps when messages are skipped (run %i)', async (seed) => {
    const { driver } = connect(nowAndThen(seed));
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);
    await driver.setKeycode(0, 0, 15, ESC);
    await driver.setKeycode(0, 5, 14, CAPS_LOCK);

    const [layer] = await driver.readKeymap();
    expect(layer[at(3, 0)]).toBe(LEFT_CTRL);
    expect(layer[at(0, 15)]).toBe(ESC);
    expect(layer[at(5, 14)]).toBe(CAPS_LOCK);
  });

  it('says so when the keyboard never stores a key', async () => {
    const { transport } = connect();
    const deaf: Transport = {
      ...transport,
      sendFeature: async (report) => {
        if (report[0] !== SET_KEY) await transport.sendFeature!(report);
      },
    };
    const driver = createDriver(deaf, definition);
    await driver.connect();
    await expect(driver.setKeycode(0, 3, 0, LEFT_CTRL)).rejects.toThrow(/did not store/);
  });

  it('puts changed keys back to the keyboard’s defaults', async () => {
    const { driver } = connect();
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);
    await driver.setKeycode(0, 0, 0, CAPS_LOCK);

    await driver.resetKeymap();
    const [layer] = await driver.readKeymap();
    expect(layer[at(3, 0)]).toBe(CAPS_LOCK);
    expect(layer[at(0, 0)]).toBe(ESC);
  });

  it('names what the knob sends', async () => {
    const { driver } = connect();
    const { catalog } = await driver.connect();
    const [layer] = await driver.readKeymap();

    expect(layer[at(0, 15)]).toBe(VOLUME_DOWN);
    expect(layer[at(1, 15)]).toBe(VOLUME_UP);
    expect(catalog.describe(layer[at(0, 15)]).label).toBe('Vol −');
    expect(catalog.describe(layer[at(1, 15)]).label).toBe('Vol +');
  });

  it('resets a keyboard that was never changed without writing to it', async () => {
    const { driver, sent } = connect();
    await driver.connect();
    await driver.resetKeymap();
    expect(writes(sent)).toHaveLength(0);
  });

  it('puts the knob back as a media key, not as a plain key', async () => {
    const { driver, sent } = connect();
    await driver.connect();
    await driver.setKeycode(0, 0, 15, ESC);
    await driver.resetKeymap();

    expect(writes(sent).at(-1)!.slice(8, 12)).toEqual([0x03, 0, 0xea, 0]);
    expect((await driver.readKeymap())[0][at(0, 15)]).toBe(VOLUME_DOWN);
  });

  it('never resets a key it does not show, such as Fn', async () => {
    const { transport, sent } = connect();
    // A default list that is wrong about Fn, the way the community database is.
    const defaultKeymap = definition.defaultKeymap!.with(FN_POSITION, 0);
    const driver = createDriver(transport, { ...definition, defaultKeymap });
    await driver.connect();
    await driver.resetKeymap();

    expect(writes(sent)).toHaveLength(0);
    const fnRow = FN_POSITION % 6;
    const fnCol = Math.floor(FN_POSITION / 6);
    expect((await driver.readKeymap())[0][at(fnRow, fnCol)]).toBe(FN);
  });

  it('refuses a definition written for another model', async () => {
    const { transport } = connect();
    const wrong = { ...definition, deviceId: 7 };
    await expect(createDriver(transport, wrong).connect()).rejects.toThrow(/reports model 1042/);
  });

  it('names keys and reads raw values', async () => {
    const { driver } = connect();
    const { catalog } = await driver.connect();
    expect(catalog.parse('KC_A')).toBe(0x0400);
    expect(catalog.parse('KC_MUTE')).toBe(0x0300e200);
    expect(catalog.parse('0x0300E900')).toBe(VOLUME_UP);
    expect(catalog.describe(0x09000100).label).toBe('0x09000100');
  });
});
