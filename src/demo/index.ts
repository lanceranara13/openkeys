import { parseDefinition } from '../core/definition';
import { createQmkCatalog } from '../core/keycodes';
import type { Transport } from '../drivers/types';
import { createVirtualTransport, VirtualKeyboard } from '../transports/virtual';
import rawDefinition from './demo65.json';

/** The keyboard behind "Try the demo": a 65% board that exists only in the browser. */
export const demoDefinition = parseDefinition(rawDefinition);

const PROTOCOL_VERSION = 12;
const LAYER_COUNT = 4;

// One row per matrix row, 16 columns each. "_" is a matrix position without a switch.
const BASE = `
  KC_ESC  KC_1    KC_2    KC_3 KC_4 KC_5 KC_6   KC_7 KC_8    KC_9   KC_0    KC_MINS KC_EQL  KC_BSPC KC_GRV  KC_DEL
  KC_TAB  KC_Q    KC_W    KC_E KC_R KC_T KC_Y   KC_U KC_I    KC_O   KC_P    KC_LBRC KC_RBRC KC_BSLS _       KC_PGUP
  KC_CAPS KC_A    KC_S    KC_D KC_F KC_G KC_H   KC_J KC_K    KC_L   KC_SCLN KC_QUOT _       KC_ENT  _       KC_PGDN
  KC_LSFT KC_Z    KC_X    KC_C KC_V KC_B KC_N   KC_M KC_COMM KC_DOT KC_SLSH _       _       KC_RSFT KC_UP   KC_END
  KC_LCTL KC_LGUI KC_LALT _    _    _    KC_SPC _    _       _      KC_RALT MO(1)   KC_RCTL KC_LEFT KC_DOWN KC_RGHT
`;

// Held with the MO(1) key. "." passes through to the base layer.
const FUNCTION = `
  KC_GRV  KC_F1   KC_F2    KC_F3   KC_F4   KC_F5   KC_F6   KC_F7   KC_F8   KC_F9   KC_F10  KC_F11  KC_F12  KC_DEL  .       KC_INS
  .       RGB_TOG RGB_MOD  RGB_HUI RGB_SAI RGB_VAI RGB_SPI .       .       .       KC_PSCR KC_SCRL KC_PAUS .       .       KC_HOME
  .       .       RGB_RMOD RGB_HUD RGB_SAD RGB_VAD RGB_SPD .       .       .       .       .       .       .       .       KC_END
  .       .       .        KC_CALC .       .       .       KC_MUTE KC_VOLD KC_VOLU .       .       .       .       KC_PGUP .
  .       .       .        .       .       .       KC_MPLY .       .       .       .       .       .       KC_MPRV KC_PGDN KC_MNXT
`;

const EMPTY = Array.from({ length: 5 }, () => Array(16).fill('.').join(' ')).join('\n');

const catalog = createQmkCatalog(PROTOCOL_VERSION, LAYER_COUNT);

function readLayer(source: string): number[] {
  const names = source.trim().split(/\s+/);
  const expected = demoDefinition.matrix.rows * demoDefinition.matrix.cols;
  if (names.length !== expected) {
    throw new Error(`Demo layer has ${names.length} keys, expected ${expected}`);
  }
  return names.map((name) => {
    const code = catalog.parse(name === '_' ? 'KC_NO' : name === '.' ? 'KC_TRNS' : name);
    if (code === undefined) throw new Error(`Demo keymap uses unknown keycode ${name}`);
    return code;
  });
}

/** The demo's base layer, for drawing the keyboard on the landing page. */
export const demoPreview = { keycodes: readLayer(BASE), describe: catalog.describe };

export function createDemoTransport(): Transport {
  const keyboard = new VirtualKeyboard({
    rows: demoDefinition.matrix.rows,
    cols: demoDefinition.matrix.cols,
    layers: [BASE, FUNCTION, EMPTY, EMPTY].map(readLayer),
    protocolVersion: PROTOCOL_VERSION,
    // The demo has magnetic switches, so the Switches tab can be tried without hardware.
    analog: true,
  });
  return createVirtualTransport(keyboard, {
    name: demoDefinition.name,
    vendorId: demoDefinition.vendorId,
    productId: demoDefinition.productId,
  });
}
