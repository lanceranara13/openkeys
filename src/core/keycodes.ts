/**
 * QMK keycodes as the VIA protocol sends them: one 16-bit number per key.
 *
 * Values come from quantum/keycodes.h in github.com/qmk/qmk_firmware. Everything
 * below 0x100 has always had the same number. The "quantum" ranges (layers,
 * lighting, bootloader) were renumbered in QMK 0.19, which is VIA protocol 11, so
 * those depend on the protocol version the keyboard reports. Which numbers go with
 * which version follows the key-to-byte tables of github.com/the-via/app.
 * See CREDITS.md.
 */

export interface Keycode {
  code: number;
  /** QMK name, e.g. "KC_ESC" or "MO(1)". */
  name: string;
  /** Short text shown on the keycap. */
  label: string;
  /** Longer explanation shown as a tooltip. */
  title: string;
}

export interface KeycodeGroup {
  id: string;
  label: string;
  hint?: string;
  keycodes: Keycode[];
}

export interface KeycodeCatalog {
  groups: KeycodeGroup[];
  /** Describes any keycode, including ones that are in no group. */
  describe(code: number): Keycode;
  /** Reads a QMK name ("KC_A", "MO(1)") or a hex value ("0x5221"). */
  parse(text: string): number | undefined;
}

export const KC_NO = 0x0000;
export const KC_TRNS = 0x0001;

const FIRST_MODERN_PROTOCOL = 11;
export const usesLegacyKeycodes = (protocolVersion: number) =>
  protocolVersion < FIRST_MODERN_PROTOCOL;

type Entry = [name: string, label: string, title?: string];

const key = (code: number, name: string, label: string, title = label): Keycode => ({
  code,
  name,
  label,
  title,
});
/** Consecutive keycodes starting at `first`. */
const run = (first: number, entries: Entry[]) =>
  entries.map(([name, label, title], index) => key(first + index, name, label, title));

const BASIC: Keycode[] = [
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((letter, i) => key(0x04 + i, `KC_${letter}`, letter)),
  ...[...'1234567890'].map((digit, i) => key(0x1e + i, `KC_${digit}`, digit)),
  ...run(0x28, [
    ['KC_ENT', 'Enter'],
    ['KC_ESC', 'Esc', 'Escape'],
    ['KC_BSPC', 'Bksp', 'Backspace'],
    ['KC_TAB', 'Tab'],
    ['KC_SPC', 'Space'],
    ['KC_MINS', '-'],
    ['KC_EQL', '='],
    ['KC_LBRC', '['],
    ['KC_RBRC', ']'],
    ['KC_BSLS', '\\'],
    ['KC_NUHS', 'ISO #', 'Non-US # and ~'],
    ['KC_SCLN', ';'],
    ['KC_QUOT', "'"],
    ['KC_GRV', '`'],
    ['KC_COMM', ','],
    ['KC_DOT', '.'],
    ['KC_SLSH', '/'],
    ['KC_CAPS', 'Caps', 'Caps Lock'],
  ]),
  key(0x64, 'KC_NUBS', 'ISO \\', 'Non-US \\ and |'),
];

const MODIFIERS: Keycode[] = [
  ...run(0xe0, [
    ['KC_LCTL', 'Ctrl', 'Left Control'],
    ['KC_LSFT', 'Shift', 'Left Shift'],
    ['KC_LALT', 'Alt', 'Left Alt (Option)'],
    ['KC_LGUI', 'Win', 'Left Windows / Command'],
    ['KC_RCTL', 'RCtrl', 'Right Control'],
    ['KC_RSFT', 'RShift', 'Right Shift'],
    ['KC_RALT', 'RAlt', 'Right Alt (AltGr)'],
    ['KC_RGUI', 'RWin', 'Right Windows / Command'],
  ]),
  key(0x65, 'KC_APP', 'Menu', 'Application (context menu)'),
];

const NAVIGATION: Keycode[] = run(0x46, [
  ['KC_PSCR', 'PrtSc', 'Print Screen'],
  ['KC_SCRL', 'ScrLk', 'Scroll Lock'],
  ['KC_PAUS', 'Pause'],
  ['KC_INS', 'Ins', 'Insert'],
  ['KC_HOME', 'Home'],
  ['KC_PGUP', 'PgUp', 'Page Up'],
  ['KC_DEL', 'Del', 'Delete'],
  ['KC_END', 'End'],
  ['KC_PGDN', 'PgDn', 'Page Down'],
  ['KC_RGHT', '→', 'Right arrow'],
  ['KC_LEFT', '←', 'Left arrow'],
  ['KC_DOWN', '↓', 'Down arrow'],
  ['KC_UP', '↑', 'Up arrow'],
]);

const FUNCTION: Keycode[] = [
  ...Array.from({ length: 12 }, (_, i) => key(0x3a + i, `KC_F${i + 1}`, `F${i + 1}`)),
  ...Array.from({ length: 12 }, (_, i) => key(0x68 + i, `KC_F${i + 13}`, `F${i + 13}`)),
];

const NUMPAD: Keycode[] = [
  ...run(0x53, [
    ['KC_NUM', 'Num', 'Num Lock'],
    ['KC_PSLS', 'KP /', 'Numpad /'],
    ['KC_PAST', 'KP *', 'Numpad *'],
    ['KC_PMNS', 'KP -', 'Numpad -'],
    ['KC_PPLS', 'KP +', 'Numpad +'],
    ['KC_PENT', 'KP Ent', 'Numpad Enter'],
    ...[...'1234567890'].map((digit): Entry => [`KC_P${digit}`, `KP ${digit}`, `Numpad ${digit}`]),
    ['KC_PDOT', 'KP .', 'Numpad .'],
  ]),
  key(0x67, 'KC_PEQL', 'KP =', 'Numpad ='),
];

const MEDIA: Keycode[] = [
  key(0xa8, 'KC_MUTE', 'Mute'),
  key(0xaa, 'KC_VOLD', 'Vol −', 'Volume down'),
  key(0xa9, 'KC_VOLU', 'Vol +', 'Volume up'),
  key(0xac, 'KC_MPRV', 'Prev', 'Previous track'),
  key(0xae, 'KC_MPLY', 'Play', 'Play / pause'),
  key(0xab, 'KC_MNXT', 'Next', 'Next track'),
  key(0xad, 'KC_MSTP', 'Stop', 'Stop playback'),
  key(0xbc, 'KC_MRWD', 'Rewind'),
  key(0xbb, 'KC_MFFD', 'FFwd', 'Fast forward'),
  key(0xaf, 'KC_MSEL', 'Player', 'Open media player'),
  key(0xb0, 'KC_EJCT', 'Eject'),
  key(0xbe, 'KC_BRID', 'Bright −', 'Screen brightness down'),
  key(0xbd, 'KC_BRIU', 'Bright +', 'Screen brightness up'),
  key(0xb2, 'KC_CALC', 'Calc', 'Calculator'),
  key(0xb1, 'KC_MAIL', 'Mail'),
  key(0xb3, 'KC_MYCM', 'Files', 'File manager'),
  key(0xb4, 'KC_WSCH', 'Search', 'Browser search'),
  key(0xb5, 'KC_WHOM', 'Web Home', 'Browser home page'),
  key(0xb6, 'KC_WBAK', 'Back', 'Browser back'),
  key(0xb7, 'KC_WFWD', 'Forward', 'Browser forward'),
  key(0xb9, 'KC_WREF', 'Refresh', 'Browser refresh'),
  key(0xb8, 'KC_WSTP', 'Web Stop', 'Browser stop loading'),
  key(0xba, 'KC_WFAV', 'Favs', 'Browser favorites'),
  key(0xa6, 'KC_SLEP', 'Sleep', 'Put the computer to sleep'),
  key(0xa7, 'KC_WAKE', 'Wake', 'Wake the computer'),
  key(0xa5, 'KC_PWR', 'Power', 'System power'),
];

const LEFT_SHIFT = 0x0200;
const SYMBOLS: Keycode[] = (
  [
    [0x1e, 'KC_EXLM', '!'],
    [0x1f, 'KC_AT', '@'],
    [0x20, 'KC_HASH', '#'],
    [0x21, 'KC_DLR', '$'],
    [0x22, 'KC_PERC', '%'],
    [0x23, 'KC_CIRC', '^'],
    [0x24, 'KC_AMPR', '&'],
    [0x25, 'KC_ASTR', '*'],
    [0x26, 'KC_LPRN', '('],
    [0x27, 'KC_RPRN', ')'],
    [0x2d, 'KC_UNDS', '_'],
    [0x2e, 'KC_PLUS', '+'],
    [0x2f, 'KC_LCBR', '{'],
    [0x30, 'KC_RCBR', '}'],
    [0x31, 'KC_PIPE', '|'],
    [0x33, 'KC_COLN', ':'],
    [0x34, 'KC_DQUO', '"'],
    [0x35, 'KC_TILD', '~'],
    [0x36, 'KC_LT', '<'],
    [0x37, 'KC_GT', '>'],
    [0x38, 'KC_QUES', '?'],
  ] as const
).map(([base, name, label]) => key(LEFT_SHIFT | base, name, label, `Shift + key (types ${label})`));

const BACKLIGHT: Record<string, Entry> = {
  on: ['BL_ON', 'BL On', 'Backlight on'],
  off: ['BL_OFF', 'BL Off', 'Backlight off'],
  toggle: ['BL_TOGG', 'BL Tog', 'Backlight on/off'],
  down: ['BL_DOWN', 'BL −', 'Backlight dimmer'],
  up: ['BL_UP', 'BL +', 'Backlight brighter'],
  step: ['BL_STEP', 'BL Step', 'Cycle backlight levels'],
  breathe: ['BL_BRTG', 'BL Breathe', 'Backlight breathing on/off'],
};

const RGB: Entry[] = [
  ['RGB_TOG', 'RGB Tog', 'RGB lighting on/off'],
  ['RGB_MOD', 'RGB Mode +', 'Next RGB effect'],
  ['RGB_RMOD', 'RGB Mode −', 'Previous RGB effect'],
  ['RGB_HUI', 'Hue +', 'RGB hue up'],
  ['RGB_HUD', 'Hue −', 'RGB hue down'],
  ['RGB_SAI', 'Sat +', 'RGB saturation up'],
  ['RGB_SAD', 'Sat −', 'RGB saturation down'],
  ['RGB_VAI', 'RGB Bri +', 'RGB brighter'],
  ['RGB_VAD', 'RGB Bri −', 'RGB dimmer'],
  ['RGB_SPI', 'RGB Spd +', 'RGB effect faster'],
  ['RGB_SPD', 'RGB Spd −', 'RGB effect slower'],
];

const RGB_MATRIX: Entry[] = [
  ['RM_ON', 'Matrix On', 'RGB matrix on'],
  ['RM_OFF', 'Matrix Off', 'RGB matrix off'],
  ['RM_TOGG', 'Matrix Tog', 'RGB matrix on/off'],
  ['RM_NEXT', 'Matrix Mode +', 'Next RGB matrix effect'],
  ['RM_PREV', 'Matrix Mode −', 'Previous RGB matrix effect'],
  ['RM_HUEU', 'Matrix Hue +', 'RGB matrix hue up'],
  ['RM_HUED', 'Matrix Hue −', 'RGB matrix hue down'],
  ['RM_SATU', 'Matrix Sat +', 'RGB matrix saturation up'],
  ['RM_SATD', 'Matrix Sat −', 'RGB matrix saturation down'],
  ['RM_VALU', 'Matrix Bri +', 'RGB matrix brighter'],
  ['RM_VALD', 'Matrix Bri −', 'RGB matrix dimmer'],
  ['RM_SPDU', 'Matrix Spd +', 'RGB matrix effect faster'],
  ['RM_SPDD', 'Matrix Spd −', 'RGB matrix effect slower'],
];

interface LayerOp {
  prefix: string;
  base: number;
  /** How many layers the range can address. */
  span: number;
  /** First layer worth offering in the picker. */
  from: number;
  title: (layer: number) => string;
}

interface Quantum {
  layerOps: LayerOp[];
  modTap: [number, number];
  macro: { base: number; count: number };
  custom: { base: number; count: number };
  boot: number;
  graveEscape: number;
  lighting: Keycode[];
}

function layerOps(bases: Record<'MO' | 'TG' | 'TT' | 'OSL' | 'TO' | 'DF', number>, toSpan: number): LayerOp[] {
  return [
    { prefix: 'MO', base: bases.MO, span: 32, from: 1, title: (n) => `Layer ${n} while held` },
    { prefix: 'TG', base: bases.TG, span: 32, from: 1, title: (n) => `Turn layer ${n} on or off` },
    {
      prefix: 'TT',
      base: bases.TT,
      span: 32,
      from: 1,
      title: (n) => `Layer ${n} while held, tap repeatedly to toggle`,
    },
    {
      prefix: 'OSL',
      base: bases.OSL,
      span: 32,
      from: 1,
      title: (n) => `Layer ${n} for the next key only`,
    },
    { prefix: 'TO', base: bases.TO, span: toSpan, from: 0, title: (n) => `Switch to layer ${n}` },
    { prefix: 'DF', base: bases.DF, span: 32, from: 0, title: (n) => `Make layer ${n} the base layer` },
  ];
}

function quantumFor(protocolVersion: number): Quantum {
  if (usesLegacyKeycodes(protocolVersion)) {
    return {
      layerOps: layerOps(
        { MO: 0x5100, TG: 0x5300, TT: 0x5800, OSL: 0x5400, TO: 0x5010, DF: 0x5200 },
        16,
      ),
      modTap: [0x6000, 0x7fff],
      macro: { base: 0x5f12, count: 16 },
      custom: { base: 0x5f80, count: 16 },
      boot: 0x5c00,
      graveEscape: 0x5c16,
      lighting: [
        ...run(0x5cbb, [
          BACKLIGHT.on,
          BACKLIGHT.off,
          BACKLIGHT.down,
          BACKLIGHT.up,
          BACKLIGHT.toggle,
          BACKLIGHT.step,
          BACKLIGHT.breathe,
        ]),
        ...run(0x5cc2, RGB),
      ],
    };
  }

  const v11 = protocolVersion === 11;
  return {
    layerOps: layerOps(
      { MO: 0x5220, TG: 0x5260, TT: 0x52c0, OSL: 0x5280, TO: 0x5200, DF: 0x5240 },
      32,
    ),
    modTap: [0x2000, 0x3fff],
    macro: v11 ? { base: 0x7702, count: 16 } : { base: 0x7700, count: 128 },
    custom: v11 ? { base: 0x7f00, count: 256 } : { base: 0x7e00, count: 64 },
    boot: 0x7c00,
    graveEscape: 0x7c16,
    lighting: [
      ...run(0x7800, [
        BACKLIGHT.on,
        BACKLIGHT.off,
        BACKLIGHT.toggle,
        BACKLIGHT.down,
        BACKLIGHT.up,
        BACKLIGHT.step,
        BACKLIGHT.breathe,
      ]),
      ...run(0x7820, RGB),
      ...(v11 ? [] : run(0x7840, RGB_MATRIX)),
    ],
  };
}

function modifierNames(bits: number): string {
  const side = bits & 0x10 ? 'R' : '';
  return [
    bits & 0x01 && 'Ctrl',
    bits & 0x02 && 'Shift',
    bits & 0x04 && 'Alt',
    bits & 0x08 && 'Win',
  ]
    .filter(Boolean)
    .map((name) => side + name)
    .join('+');
}

const hex = (code: number) => `0x${code.toString(16).toUpperCase().padStart(4, '0')}`;

export interface CustomKeycodeInfo {
  name: string;
  title: string;
  shortName: string;
}

/** Builds the keycodes a QMK/VIA keyboard understands for its protocol version. */
export function createQmkCatalog(
  protocolVersion: number,
  layerCount: number,
  customKeycodes: CustomKeycodeInfo[] = [],
): KeycodeCatalog {
  const quantum = quantumFor(protocolVersion);

  const layers = quantum.layerOps.flatMap((op) => {
    const keycodes: Keycode[] = [];
    for (let layer = op.from; layer < Math.min(layerCount, op.span); layer++) {
      keycodes.push(key(op.base + layer, `${op.prefix}(${layer})`, `${op.prefix}(${layer})`, op.title(layer)));
    }
    return keycodes;
  });

  const custom = customKeycodes
    .slice(0, quantum.custom.count)
    .map((entry, index) =>
      key(quantum.custom.base + index, `CUSTOM(${index})`, entry.shortName, entry.title),
    );

  const groups: KeycodeGroup[] = [
    { id: 'basic', label: 'Letters & numbers', keycodes: BASIC },
    { id: 'modifiers', label: 'Modifiers', keycodes: MODIFIERS },
    { id: 'navigation', label: 'Navigation', keycodes: NAVIGATION },
    { id: 'function', label: 'Function', keycodes: FUNCTION },
    { id: 'numpad', label: 'Numpad', keycodes: NUMPAD },
    { id: 'media', label: 'Media & system', keycodes: MEDIA },
    { id: 'symbols', label: 'Symbols', hint: 'Types the shifted symbol in one press.', keycodes: SYMBOLS },
    {
      id: 'layers',
      label: 'Layers',
      hint: 'MO = while held · TG = toggle · TT = hold or tap-toggle · OSL = next key only · TO = switch · DF = set base layer',
      keycodes: layers,
    },
    {
      id: 'lighting',
      label: 'Lighting',
      hint: 'Only does something on keyboards that have the matching lighting.',
      keycodes: quantum.lighting,
    },
    {
      id: 'special',
      label: 'Special',
      keycodes: [
        key(KC_NO, 'KC_NO', '✕', 'Nothing: the key does nothing'),
        key(KC_TRNS, 'KC_TRNS', '▽', 'Transparent: use the key from the layer below'),
        key(quantum.graveEscape, 'QK_GESC', 'Esc `', 'Escape, or ` while Shift or Win is held'),
        key(quantum.boot, 'QK_BOOT', 'Boot', 'Put the keyboard into bootloader mode for flashing'),
      ],
    },
    ...(custom.length > 0
      ? [{ id: 'custom', label: 'This keyboard', hint: 'Keys only this keyboard has.', keycodes: custom }]
      : []),
  ].filter((group) => group.keycodes.length > 0);

  const byCode = new Map<number, Keycode>();
  const byName = new Map<string, number>();
  for (const keycode of groups.flatMap((group) => group.keycodes)) {
    if (!byCode.has(keycode.code)) byCode.set(keycode.code, keycode);
    byName.set(keycode.name.toUpperCase(), keycode.code);
  }

  const describe = (code: number): Keycode => {
    const known = byCode.get(code);
    if (known) return known;

    for (const op of quantum.layerOps) {
      if (code >= op.base && code < op.base + op.span) {
        const layer = code - op.base;
        const name = `${op.prefix}(${layer})`;
        return key(code, name, name, op.title(layer));
      }
    }
    if (code >= quantum.macro.base && code < quantum.macro.base + quantum.macro.count) {
      const index = code - quantum.macro.base;
      return key(code, `MACRO(${index})`, `M${index}`, `Macro ${index}`);
    }
    if (code >= quantum.custom.base && code < quantum.custom.base + quantum.custom.count) {
      const index = code - quantum.custom.base;
      return key(code, `CUSTOM(${index})`, `Custom ${index}`, `Keyboard-specific key ${index}`);
    }

    const tap = () => describe(code & 0xff).label;
    if (code >= 0x4000 && code <= 0x4fff) {
      const layer = (code >> 8) & 0x0f;
      return key(code, hex(code), `LT${layer} ${tap()}`, `${tap()} when tapped, layer ${layer} while held`);
    }
    if (code >= quantum.modTap[0] && code <= quantum.modTap[1]) {
      const mods = modifierNames((code >> 8) & 0x1f);
      return key(code, hex(code), `${tap()} / ${mods}`, `${tap()} when tapped, ${mods} while held`);
    }
    if (code >= 0x0100 && code <= 0x1fff) {
      const mods = modifierNames((code >> 8) & 0x1f);
      return key(code, hex(code), `${mods}+${tap()}`, `${mods} + ${tap()}`);
    }
    return key(code, hex(code), hex(code), `Keycode ${hex(code)} (not recognised by OpenKeys)`);
  };

  const parse = (text: string): number | undefined => {
    const value = text.trim();
    if (/^0x[0-9a-f]{1,4}$/i.test(value)) return Number.parseInt(value, 16);
    return byName.get(value.toUpperCase());
  };

  return { groups, describe, parse };
}
