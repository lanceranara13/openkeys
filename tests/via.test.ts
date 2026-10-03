import { describe, expect, it } from 'vitest';
import { parseDefinition } from '../src/core/definition';
import { createDemoTransport, demoDefinition } from '../src/demo';
import { createDriver } from '../src/drivers';
import { createVirtualTransport, VirtualKeyboard } from '../src/transports/virtual';

// The driver talks to an in-memory keyboard that answers like QMK firmware does.

const lighting = demoDefinition.menus[0].sections[0].controls;
const control = (id: string) => lighting.find((item) => item.ref.id === id)!.ref;

async function connectDemo() {
  const driver = createDriver(createDemoTransport(), demoDefinition);
  const info = await driver.connect();
  return { driver, info };
}

describe('VIA driver', () => {
  it('reports the protocol version and layer count', async () => {
    const { info } = await connectDemo();
    expect(info).toMatchObject({
      protocolName: 'VIA',
      protocolVersion: 12,
      layerCount: 4,
      supportsMenus: true,
    });
  });

  it('reads the whole keymap, across many reports', async () => {
    const { driver, info } = await connectDemo();
    const keymap = await driver.readKeymap();
    const at = (row: number, col: number) => row * demoDefinition.matrix.cols + col;

    expect(keymap).toHaveLength(4);
    expect(keymap.every((layer) => layer.length === 80)).toBe(true);
    expect(keymap[0][at(0, 0)]).toBe(info.catalog.parse('KC_ESC'));
    expect(keymap[0][at(4, 11)]).toBe(info.catalog.parse('MO(1)'));
    expect(keymap[0][at(4, 15)]).toBe(info.catalog.parse('KC_RGHT'));
    expect(keymap[1][at(0, 1)]).toBe(info.catalog.parse('KC_F1'));
    expect(keymap[3][at(4, 15)]).toBe(info.catalog.parse('KC_TRNS'));
  });

  it('writes a key and can restore the factory keymap', async () => {
    const { driver, info } = await connectDemo();
    const capsIndex = 2 * demoDefinition.matrix.cols;

    await driver.setKeycode(0, 2, 0, info.catalog.parse('KC_LCTL')!);
    expect((await driver.readKeymap())[0][capsIndex]).toBe(0xe0);

    await driver.resetKeymap();
    expect((await driver.readKeymap())[0][capsIndex]).toBe(info.catalog.parse('KC_CAPS'));
  });

  it('reads and writes lighting values', async () => {
    const { driver } = await connectDemo();
    const brightness = control('id_qmk_rgb_matrix_brightness');
    const color = control('id_qmk_rgb_matrix_color');

    expect(await driver.readValue(brightness, 1)).toEqual([200]);
    await driver.writeValue(brightness, [64]);
    await driver.writeValue(color, [10, 20]);
    await driver.saveValues(brightness.channel);

    expect(await driver.readValue(brightness, 1)).toEqual([64]);
    expect(await driver.readValue(color, 2)).toEqual([10, 20]);
  });

  it('answers null for values the firmware does not have', async () => {
    const { driver } = await connectDemo();
    const audio = { key: '4:1', id: 'id_qmk_audio_enable', channel: 4, valueId: 1, extra: [] };
    expect(await driver.readValue(audio, 1)).toBeNull();
  });

  it('can preview a keyboard whose settings are not emulated', async () => {
    const { rows, cols } = demoDefinition.matrix;
    const keyboard = new VirtualKeyboard({
      rows,
      cols,
      layers: [Array<number>(rows * cols).fill(0)],
      acceptAnyValue: true,
    });
    const transport = createVirtualTransport(keyboard, {
      name: demoDefinition.name,
      vendorId: demoDefinition.vendorId,
      productId: demoDefinition.productId,
    });
    const driver = createDriver(transport, demoDefinition);
    await driver.connect();

    const audio = { key: '4:1', id: 'id_qmk_audio_enable', channel: 4, valueId: 1, extra: [] };
    expect(await driver.readValue(audio, 1)).toEqual([0]);
    await expect(driver.writeValue(audio, [1])).resolves.toBeUndefined();
  });

  it('skips menus on firmware older than protocol 11', async () => {
    const definition = parseDefinition({
      name: 'Old board',
      vendorId: '0x1234',
      productId: '0x0001',
      matrix: { rows: 1, cols: 2 },
      layouts: { keymap: [['0,0', '0,1']] },
    });
    const keyboard = new VirtualKeyboard({
      rows: 1,
      cols: 2,
      layers: [
        [0x04, 0x05],
        [0x5101, 0x01],
      ],
      protocolVersion: 9,
    });
    const transport = createVirtualTransport(keyboard, {
      name: definition.name,
      vendorId: definition.vendorId,
      productId: definition.productId,
    });
    const driver = createDriver(transport, definition);
    const info = await driver.connect();

    expect(info).toMatchObject({ protocolVersion: 9, layerCount: 2, supportsMenus: false });
    expect(await driver.readKeymap()).toEqual([
      [0x04, 0x05],
      [0x5101, 0x01],
    ]);
    expect(info.catalog.describe(0x5101).label).toBe('MO(1)');
    expect(await driver.readValue(control('id_qmk_rgb_matrix_brightness'), 1)).toBeNull();
  });

  it('refuses definitions that need a driver it does not have', () => {
    const definition = { ...demoDefinition, protocol: 'made-up' };
    expect(() => createDriver(createDemoTransport(), definition)).toThrow(/"made-up" driver/);
  });
});
