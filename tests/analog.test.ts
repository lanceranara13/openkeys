import { describe, expect, it } from 'vitest';
import { parseDefinition } from '../src/core/definition';
import { createDemoTransport, demoDefinition } from '../src/demo';
import { createDriver } from '../src/drivers';
import { packKeyConfig, profileSize, unpackKeyConfig } from '../src/drivers/keychron-analog';
import type { Transport, TravelSettings } from '../src/drivers/types';
import { createVirtualTransport, VirtualKeyboard } from '../src/transports/virtual';

// Magnetic switch settings, exercised against the in-memory keyboard that answers
// Keychron's switch commands the way their firmware does.

const { cols } = demoDefinition.matrix;
const at = (row: number, col: number) => row * cols + col;

const FACTORY: TravelSettings = {
  rapidTrigger: false,
  actuation: 20,
  pressSensitivity: 4,
  releaseSensitivity: 4,
};
const FAST: TravelSettings = {
  rapidTrigger: true,
  actuation: 15,
  pressSensitivity: 3,
  releaseSensitivity: 5,
};

/** Keeps a copy of every report the driver sends, to check the bytes on the wire. */
function recording(transport: Transport) {
  const sent: number[][] = [];
  const recorded: Transport = {
    ...transport,
    send: (report) => {
      sent.push([...report]);
      return transport.send(report);
    },
  };
  return { sent, transport: recorded };
}

async function connectDemo() {
  const { sent, transport } = recording(createDemoTransport());
  const info = await createDriver(transport, demoDefinition).connect();
  return { sent, transport, analog: info.analog! };
}

function plainKeyboard(options: { vendorId: number; analog?: string; hasSwitches: boolean }) {
  const definition = parseDefinition({
    name: 'Test board',
    vendorId: `0x${options.vendorId.toString(16)}`,
    productId: '0x0001',
    matrix: { rows: 1, cols: 2 },
    layouts: { keymap: [['0,0', '0,1']] },
    ...(options.analog && { analog: options.analog }),
  });
  const keyboard = new VirtualKeyboard({
    rows: 1,
    cols: 2,
    layers: [[0x04, 0x05]],
    analog: options.hasSwitches,
  });
  const { sent, transport } = recording(
    createVirtualTransport(keyboard, {
      name: definition.name,
      vendorId: definition.vendorId,
      productId: definition.productId,
    }),
  );
  return { sent, driver: createDriver(transport, definition) };
}

describe('key config bytes', () => {
  it('follow the bit fields of the firmware struct', () => {
    // mode:2 | actuation:6 | press:6 | release:6 | advanced:4, then one data byte.
    const config = {
      mode: 2,
      actuation: 15,
      pressSensitivity: 3,
      releaseSensitivity: 5,
      advancedMode: 0,
      advancedData: 0,
    };
    expect(packKeyConfig(config)).toEqual([0x3e, 0x43, 0x01, 0x00]);
    expect(unpackKeyConfig([0x3e, 0x43, 0x01, 0x00])).toEqual(config);
  });

  it('survive a round trip at the extremes', () => {
    const config = {
      mode: 1,
      actuation: 39,
      pressSensitivity: 38,
      releaseSensitivity: 1,
      advancedMode: 3,
      advancedData: 7,
    };
    expect(unpackKeyConfig(packKeyConfig(config))).toEqual(config);
  });

  it('add up to the profile size the firmware reports', () => {
    // 2 checksum + 4 * (80 keys + keyboard-wide) + 30 name + 19 * 20 + 3 * 20
    expect(profileSize(80, 20, 20)).toBe(796);
  });
});

describe('magnetic switch settings', () => {
  it('are found on a keyboard that has them, with factory values', async () => {
    const { analog } = await connectDemo();
    const state = await analog.read();

    expect(state.profile).toBe(0);
    expect(state.profileCount).toBe(3);
    expect(state.global).toEqual(FACTORY);
    expect(state.keys).toHaveLength(80);
    expect(state.keys.every((key) => key === null)).toBe(true);
  });

  it('change for every key at once', async () => {
    const { analog, sent } = await connectDemo();
    await analog.setGlobal(FAST);

    // [analog matrix, set travel, profile, rapid trigger mode, 1.5 mm, 0.3 mm, 0.5 mm, every key]
    expect(sent.at(-1)!.slice(0, 9)).toEqual([0xa9, 0x14, 0, 2, 15, 3, 5, 1, 0]);
    const state = await analog.read();
    expect(state.global).toEqual(FAST);
    expect(state.keys.every((key) => key === null)).toBe(true);
  });

  it('change for chosen keys only, addressed by one column mask per row', async () => {
    const { analog, sent } = await connectDemo();
    const shallow = { ...FACTORY, actuation: 10 };
    await analog.setKeys(
      [
        { row: 0, col: 0 },
        { row: 0, col: 2 },
        { row: 1, col: 9 },
      ],
      shallow,
    );

    expect(sent.at(-1)!.slice(0, 15)).toEqual([
      ...[0xa9, 0x14, 0, 1, 10, 4, 4, 0],
      ...[0b101, 0, 0], // row 0: columns 0 and 2
      ...[0, 0b10, 0], // row 1: column 9
      0,
    ]);

    const { keys, global } = await analog.read();
    expect(global).toEqual(FACTORY);
    expect(keys[at(0, 0)]).toEqual(shallow);
    expect(keys[at(0, 2)]).toEqual(shallow);
    expect(keys[at(1, 9)]).toEqual(shallow);
    expect(keys.filter((key) => key !== null)).toHaveLength(3);
  });

  it('hand keys back to the keyboard-wide settings', async () => {
    const { analog } = await connectDemo();
    const key = [{ row: 2, col: 3 }];

    await analog.setKeys(key, FAST);
    expect((await analog.read()).keys[at(2, 3)]).toEqual(FAST);

    await analog.setKeys(key, null);
    expect((await analog.read()).keys[at(2, 3)]).toBeNull();
  });

  it('fill a key’s missing values from the keyboard-wide settings', async () => {
    const { analog, transport } = await connectDemo();

    // Another tool can turn rapid trigger on for a key and leave the distances at zero.
    const report = new Uint8Array(32);
    report.set([0xa9, 0x14, 0, 2, 0, 0, 0, 0, 0b1]);
    await transport.send(report);

    expect((await analog.read()).keys[at(0, 0)]).toEqual({ ...FACTORY, rapidTrigger: true });
  });

  it('keep profiles apart', async () => {
    const { analog } = await connectDemo();
    await analog.setKeys([{ row: 0, col: 0 }], FAST);

    await analog.selectProfile(1);
    const second = await analog.read();
    expect(second.profile).toBe(1);
    expect(second.global.rapidTrigger).toBe(true);
    expect(second.keys[at(0, 0)]).toBeNull();

    await analog.selectProfile(0);
    expect((await analog.read()).keys[at(0, 0)]).toEqual(FAST);
  });

  it('reset to factory and can be saved', async () => {
    const { analog, sent } = await connectDemo();
    await analog.setGlobal(FAST);
    await analog.setKeys([{ row: 0, col: 0 }], FAST);

    await analog.save();
    expect(sent.at(-1)!.slice(0, 3)).toEqual([0xa9, 0x1f, 0]);

    await analog.reset();
    const state = await analog.read();
    expect(state.global).toEqual(FACTORY);
    expect(state.keys[at(0, 0)]).toBeNull();
  });

  it('report it when the keyboard refuses a value', async () => {
    const { analog } = await connectDemo();
    await expect(analog.setGlobal({ ...FACTORY, actuation: 60 })).rejects.toThrow(/did not accept/);
    expect((await analog.read()).global).toEqual(FACTORY);
  });
});

describe('finding magnetic switches', () => {
  const asked = (sent: number[][]) => sent.some((report) => report[0] === 0xa2);

  it('does not ask keyboards of other makers', async () => {
    const { driver, sent } = plainKeyboard({ vendorId: 0x1234, hasSwitches: true });
    expect((await driver.connect()).analog).toBeNull();
    expect(asked(sent)).toBe(false);
  });

  it('asks Keychron and Lemokey keyboards, by their USB vendor id', async () => {
    const withSwitches = plainKeyboard({ vendorId: 0x3434, hasSwitches: true });
    expect((await withSwitches.driver.connect()).analog).not.toBeNull();

    const lemokey = plainKeyboard({ vendorId: 0x362d, hasSwitches: true });
    expect((await lemokey.driver.connect()).analog).not.toBeNull();

    const without = plainKeyboard({ vendorId: 0x3434, hasSwitches: false });
    expect((await without.driver.connect()).analog).toBeNull();
    expect(asked(without.sent)).toBe(true);
  });

  it('asks any keyboard whose definition says so', async () => {
    const { driver } = plainKeyboard({ vendorId: 0x1234, analog: 'keychron', hasSwitches: true });
    expect((await driver.connect()).analog).not.toBeNull();
  });

  it('gives up when the definition’s matrix is not the keyboard’s', async () => {
    const narrower = { ...demoDefinition, matrix: { rows: 5, cols: 15 } };
    const info = await createDriver(createDemoTransport(), narrower).connect();
    expect(info.analog).toBeNull();
  });
});
