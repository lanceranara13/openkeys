import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDefinition } from '../src/core/definition';
import { resolveLayout } from '../src/core/kle';
import type { ValueRef } from '../src/core/menus';
import { drivers } from '../src/drivers';
import {
  keymapReports,
  memoryStore,
  RK_KEYMAP_BYTES,
  RkValue,
  RoyalKludgeDriver,
  royalKludgeDriver,
  type RkStore,
} from '../src/drivers/royal-kludge';
import type { Transport } from '../src/drivers/types';
import {
  createVirtualRoyalKludgeTransport,
  VirtualRoyalKludge,
} from '../src/transports/virtual-royal-kludge';

// The Royal Kludge driver against an in-memory keyboard. The real keyboard answers
// nothing, so what can be checked is the bytes: they have to be the ones Rangoli and
// Kludge Knight send. OpenKeys has not tried them on a real keyboard.

const folder = path.resolve(__dirname, '../keyboards/royal_kludge');
const read = (file: string) =>
  parseDefinition(JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')));
// A 60% board: the number row is row 1, there is no row 0.
const definition = read('rk61rgb-wired-004a.json');
const { cols } = definition.matrix;
const at = (row: number, col: number) => row * cols + col;
const position = (row: number, col: number) => col * 6 + row;

const ESC = 0x2900;
const CAPS_LOCK = 0x3900;
const LEFT_CTRL = 0x010000;
const LEFT_SHIFT = 0x020000;
const FN = 0xb000;
const VOLUME_UP = 0x010000e9;

function connect(store: RkStore = memoryStore()) {
  const sent: number[][] = [];
  const keyboard = new VirtualRoyalKludge();
  const virtual = createVirtualRoyalKludgeTransport(definition, keyboard);
  const transport: Transport = {
    ...virtual,
    sendFeature: async (report, reportId) => {
      sent.push([reportId ?? 0, ...report]);
      await virtual.sendFeature!(report, reportId);
    },
  };
  return { sent, keyboard, transport, driver: new RoyalKludgeDriver(transport, definition, store) };
}

const lightRef = (valueId: number): ValueRef => ({
  key: `0:${valueId}`,
  id: 'test',
  channel: 0,
  valueId,
  extra: [],
});

describe('Royal Kludge driver', () => {
  it('splits a keymap over nine reports the way Rangoli does', () => {
    const reports = keymapReports([0x11223344, 0, LEFT_CTRL]);

    expect(reports).toHaveLength(9);
    expect(reports.every((report) => report.length === 65)).toBe(true);
    // Report id, number of reports, which one; the first also carries 01 f8.
    expect([...reports[0].subarray(0, 9)]).toEqual([0x0a, 9, 1, 0x01, 0xf8, 0x11, 0x22, 0x33, 0x44]);
    expect([...reports[0].subarray(13, 17)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    expect([...reports[1].subarray(0, 3)]).toEqual([0x0a, 9, 2]);
    expect([...reports[8].subarray(0, 3)]).toEqual([0x0a, 9, 9]);
    // 60 key bytes in the first report, 62 in each of the other eight.
    expect(RK_KEYMAP_BYTES).toBe(556);
  });

  it('continues a key across the end of a report', () => {
    // Key 15 starts at byte 60, the first byte of the second report.
    const codes = Array<number>(16).fill(0);
    codes[15] = 0xa1b2c3d4;
    const reports = keymapReports(codes);
    expect([...reports[1].subarray(3, 7)]).toEqual([0xa1, 0xb2, 0xc3, 0xd4]);
  });

  it('shows the keys the keyboard shipped with, without sending anything', async () => {
    const { driver, sent } = connect();
    const info = await driver.connect();
    const [layer] = await driver.readKeymap();

    expect(info).toMatchObject({ protocolName: 'Royal Kludge', layerCount: 1, analog: null });
    expect(info.notice).toMatch(/cannot report what it holds/);
    expect(layer[at(1, 0)]).toBe(ESC);
    expect(layer[at(3, 0)]).toBe(CAPS_LOCK);
    expect(layer[at(4, 0)]).toBe(LEFT_SHIFT);
    expect(layer[at(5, 0)]).toBe(LEFT_CTRL);
    expect(layer[at(5, 13)]).toBe(FN);
    expect(info.catalog.describe(layer[at(2, 1)]).label).toBe('Q');
    expect(sent).toHaveLength(0);
  });

  it('sends every key when one is changed', async () => {
    const { driver, sent, keyboard } = connect();
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);

    expect(sent).toHaveLength(9);
    expect(sent.every((report) => report[0] === 0x0a && report.length === 65)).toBe(true);
    expect(sent.map((report) => report[2])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // The changed key, and its neighbours still at their defaults.
    expect(keyboard.codeAt(position(3, 0))).toBe(LEFT_CTRL);
    expect(keyboard.codeAt(position(1, 0))).toBe(ESC);
    expect(keyboard.codeAt(position(5, 13))).toBe(FN);
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(LEFT_CTRL);
  });

  it('sends the default of every key it draws, so no key is ever blanked', async () => {
    const { driver, keyboard } = connect();
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);

    for (const key of resolveLayout(definition.layout).keys) {
      expect(keyboard.codeAt(position(key.row, key.col)), `key ${key.row},${key.col}`).not.toBe(0);
    }
  });

  it('remembers what it sent, for the next visit', async () => {
    const store = memoryStore();
    const first = connect(store);
    await first.driver.connect();
    await first.driver.setKeycode(0, 3, 0, LEFT_CTRL);

    const second = connect(store);
    await second.driver.connect();
    expect((await second.driver.readKeymap())[0][at(3, 0)]).toBe(LEFT_CTRL);

    // The earlier change is still part of the next keymap that is sent.
    await second.driver.setKeycode(0, 1, 0, CAPS_LOCK);
    expect(second.keyboard.codeAt(position(3, 0))).toBe(LEFT_CTRL);
    expect(second.keyboard.codeAt(position(1, 0))).toBe(CAPS_LOCK);
  });

  it('does not mix the reports of two changes made at once', async () => {
    const { driver, sent, keyboard } = connect();
    await driver.connect();
    await Promise.all([driver.setKeycode(0, 3, 0, LEFT_CTRL), driver.setKeycode(0, 1, 0, CAPS_LOCK)]);

    expect(sent.map((report) => report[2])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(keyboard.codeAt(position(3, 0))).toBe(LEFT_CTRL);
    expect(keyboard.codeAt(position(1, 0))).toBe(CAPS_LOCK);
  });

  it('forgets a change the keyboard did not take', async () => {
    const store = memoryStore();
    const { transport } = connect(store);
    const failing: Transport = {
      ...transport,
      sendFeature: async () => {
        throw new Error('unplugged');
      },
    };
    const driver = new RoyalKludgeDriver(failing, definition, store);
    await driver.connect();

    await expect(driver.setKeycode(0, 3, 0, LEFT_CTRL)).rejects.toThrow('unplugged');
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(CAPS_LOCK);
    expect(store.load().keys).toEqual({});
  });

  it('puts every key back to its default', async () => {
    const store = memoryStore();
    const { driver, sent, keyboard } = connect(store);
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);
    await driver.resetKeymap();

    expect(sent).toHaveLength(18);
    expect(keyboard.codeAt(position(3, 0))).toBe(CAPS_LOCK);
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(CAPS_LOCK);
    expect(store.load().keys).toEqual({});
  });

  it('refuses a key outside the keymap', async () => {
    const { driver, sent } = connect();
    await driver.connect();
    await expect(driver.setKeycode(0, 6, 0, ESC)).rejects.toThrow(/outside/);
    expect(sent).toHaveLength(0);
  });

  it('sets the lighting with one report, colour as red, green and blue', async () => {
    const { driver, sent, keyboard } = connect();
    await driver.connect();

    // Before anything is sent: the first effect of this model's list, brightest, white.
    expect(await driver.readValue(lightRef(RkValue.Effect))).toEqual([1]);
    expect(await driver.readValue(lightRef(RkValue.Brightness))).toEqual([5]);
    expect(await driver.readValue({ ...lightRef(1), channel: 3 })).toBeNull();

    await driver.writeValue(lightRef(RkValue.Effect), [17]);
    // Hue 0 at full saturation is red.
    await driver.writeValue(lightRef(RkValue.Color), [0, 255]);

    expect(sent).toHaveLength(2);
    // 0a 01 01 02 29, effect, 00, speed, brightness, red, green, blue, random, sleep.
    expect(sent[1].slice(0, 14)).toEqual([0x0a, 1, 1, 0x02, 0x29, 17, 0, 3, 5, 255, 0, 0, 0, 2]);
    expect(keyboard.lighting?.[4]).toBe(17);
    expect(await driver.readValue(lightRef(RkValue.Effect))).toEqual([17]);
  });

  it('sends no colour while random colours are on', async () => {
    const { driver, sent } = connect();
    await driver.connect();
    await driver.writeValue(lightRef(RkValue.Color), [85, 255]);
    await driver.writeValue(lightRef(RkValue.Random), [1]);

    // Hue 85 of 255 is green.
    expect(sent[0].slice(9, 13)).toEqual([0, 255, 0, 0]);
    expect(sent[1].slice(9, 13)).toEqual([0, 0, 0, 1]);
  });

  it('names modifiers, media keys and shortcuts', async () => {
    const { driver } = connect();
    const { catalog } = await driver.connect();

    expect(catalog.parse('KC_A')).toBe(0x0400);
    expect(catalog.parse('KC_LCTL')).toBe(LEFT_CTRL);
    expect(catalog.parse('KC_RGUI')).toBe(0x800000);
    expect(catalog.parse('KC_VOLU')).toBe(VOLUME_UP);
    expect(catalog.parse('0x0000B000')).toBe(FN);
    expect(catalog.describe(FN).label).toBe('Fn');
    expect(catalog.describe(0x010600).label).toBe('Ctrl+C');
    expect(catalog.describe(0x09000100).label).toBe('0x09000100');
    // Keys neither source project lists are not offered.
    expect(catalog.parse('KC_F13')).toBeUndefined();
  });

  it('keeps a preview apart from what is remembered about the real keyboard', async () => {
    // No browser storage exists here: a preview must work without it.
    const driver = royalKludgeDriver.create(createVirtualRoyalKludgeTransport(definition), definition);
    await driver.connect();
    await driver.setKeycode(0, 3, 0, LEFT_CTRL);
    expect((await driver.readKeymap())[0][at(3, 0)]).toBe(LEFT_CTRL);
  });

  it('is registered under the protocol name the definitions use', () => {
    expect(drivers.map((driver) => driver.id)).toContain(definition.protocol);
  });
});

describe('keyboards/royal_kludge/', () => {
  const files = fs.readdirSync(folder).filter((file) => file.endsWith('.json'));

  it.each(files)('%s lists a default for every key it draws', (file) => {
    const board = read(file);
    const defaults = board.defaultKeymap!;

    expect(board.protocol).toBe('royal-kludge');
    expect(board.vendorId).toBe(0x258a);
    expect(board.matrix.rows).toBe(6);
    expect(defaults).toHaveLength(board.matrix.cols * 6);
    // Every key has to fit in the nine reports of a keymap.
    expect(defaults.length * 4).toBeLessThanOrEqual(RK_KEYMAP_BYTES);

    const seen = new Set<number>();
    for (const key of resolveLayout(board.layout).keys) {
      const spot = position(key.row, key.col);
      expect(defaults[spot], `key ${key.row},${key.col}`).toBeGreaterThan(0);
      expect(seen.has(spot), `key ${key.row},${key.col} drawn twice`).toBe(false);
      seen.add(spot);
    }
  });
});
