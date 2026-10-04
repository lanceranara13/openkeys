// Builds the Royal Kludge definitions in keyboards/royal_kludge/.
//
//   node scripts/import-royal-kludge.mjs <path to kludgeknight>/public/rk
//
// The source is the set of per-model configuration files of the RK Windows software, as
// collected by Kludge Knight (github.com/vinc3m1/kludgeknight, GPL-3.0): one KB.ini per
// USB product id with where each key sits in a picture, which key it is, and where it
// lives in the buffer the keyboard is sent. The key table below follows Kludge Knight's
// src/types/keycode.ts, which follows Rangoli's src/keycode.h
// (github.com/rnayabed/rangoli, GPL-3.0). See CREDITS.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'keyboards', 'royal_kludge');

const VENDOR_ID = '0x258A';
/** Buffer positions run down the columns: position = column * 6 + row. */
const ROWS = 6;
/** The nine reports of a keymap carry 60 + 8 * 62 bytes, four per key. */
const MAX_KEYS = Math.floor((60 + 8 * 62) / 4);

/** Models Rangoli's keyboards-list.md reports as not working, by USB product id. */
const BROKEN = new Map([
  ['0057', 'Rangoli: key map does not work (issue 16)'],
  ['0059', 'Rangoli: not supported (issue 19)'],
  ['00a9', 'Rangoli: not supported (issue 11)'],
  ['0102', 'Rangoli: not supported (issue 17)'],
]);

const ALPHA = '#cccccc';
const MOD = '#aaaaaa';
const ACCENT = '#777777';

/** A plain key is its USB HID usage in the third byte. */
const plain = (usage) => usage << 8;
/** A media key is 01 00 followed by its USB consumer usage. */
const media = (usage) => 0x01000000 + usage;
const span = (firstVk, firstUsage, count) =>
  Array.from({ length: count }, (_, i) => [firstVk + i, plain(firstUsage + i)]);

/** Windows virtual key code, as the RK files name keys, to the value the keyboard stores. */
const CODES = new Map([
  ...span(0x41, 0x04, 26), // A to Z
  ...span(0x31, 0x1e, 9), // 1 to 9
  [0x30, plain(0x27)],
  ...span(0x70, 0x3a, 12), // F1 to F12
  [0x08, plain(0x2a)], // Backspace
  [0x09, plain(0x2b)], // Tab
  [0x0d, plain(0x28)], // Enter
  [0x13, plain(0x48)], // Pause
  [0x14, plain(0x39)], // Caps Lock
  [0x1b, plain(0x29)], // Esc
  [0x20, plain(0x2c)], // Space
  [0xe0, plain(0x2c)], // Right half of a split space bar
  [0x21, plain(0x4b)], // Page Up
  [0x22, plain(0x4e)], // Page Down
  [0x23, plain(0x4d)], // End
  [0x24, plain(0x4a)], // Home
  [0x25, plain(0x50)], // Left
  [0x26, plain(0x52)], // Up
  [0x27, plain(0x4f)], // Right
  [0x28, plain(0x51)], // Down
  [0x2c, plain(0x46)], // Print Screen
  [0x2d, plain(0x49)], // Insert
  [0x2e, plain(0x4c)], // Delete
  [0x91, plain(0x47)], // Scroll Lock
  [0xba, plain(0x33)], // ;
  [0xbb, plain(0x2e)], // =
  [0xbc, plain(0x36)], // ,
  [0xbd, plain(0x2d)], // -
  [0xbe, plain(0x37)], // .
  [0xbf, plain(0x38)], // /
  [0xc0, plain(0x35)], // `
  [0xdb, plain(0x2f)], // [
  [0xdc, plain(0x31)], // \
  [0xdd, plain(0x30)], // ]
  [0xde, plain(0x34)], // '
  [0xe2, plain(0x64)], // ISO \
  // Modifiers are one bit each in the second byte.
  [0xa2, 0x010000], // Left Ctrl
  [0xa0, 0x020000], // Left Shift
  [0xa4, 0x040000], // Left Alt
  [0x5b, 0x080000], // Left Win
  [0xa3, 0x100000], // Right Ctrl
  [0xa1, 0x200000], // Right Shift
  [0xa5, 0x400000], // Right Alt
  [0x5c, 0x800000], // Right Win
  [0x5d, plain(0x65)], // Menu
  [0x60, plain(0x62)], // Numpad 0
  ...span(0x61, 0x59, 9), // Numpad 1 to 9
  [0x6a, plain(0x55)], // Numpad *
  [0x6b, plain(0x57)], // Numpad +
  [0x6d, plain(0x56)], // Numpad -
  [0x6e, plain(0x63)], // Numpad .
  [0x6f, plain(0x54)], // Numpad /
  [0x90, plain(0x53)], // Num Lock
  [0xfd, plain(0x58)], // Numpad Enter
  [0xfa, 0xb000], // Fn
  // Shortcut keys of the split models: a modifier bit plus a key.
  [0xd9, 0x010400], // Ctrl+A
  [0xb9, 0x010600], // Ctrl+C
  [0xb8, 0x011b00], // Ctrl+X
  [0xc1, 0x011d00], // Ctrl+Z
  [0xc6, 0x011900], // Ctrl+V
  [0xc7, 0x011600], // Ctrl+S
  [0xd8, 0x003200],
  [0xda, 0x008a00],
  [0xad, media(0xe2)], // Mute
  [0xae, media(0xea)], // Volume down
  [0xaf, media(0xe9)], // Volume up
  [0xb0, media(0xb5)], // Next track
  [0xb1, media(0xb6)], // Previous track
  [0xb2, media(0xb7)], // Stop
  [0xb3, media(0xcd)], // Play / pause
  // The same media keys under the numbers older models use.
  [0x89, media(0xcd)],
  [0x8a, media(0xb7)],
  [0x8b, media(0xb6)],
  [0x8c, media(0xb5)],
  [0x8d, media(0xe9)],
  [0x8e, media(0xea)],
  [0x8f, media(0xe2)],
  [0x99, media(0x192)], // Calculator
]);

/** The files are UTF-16 with or without a byte order mark, or plain 8-bit text. */
function decode(bytes) {
  const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes[1] === 0x00 || bytes[3] === 0x00;
  const text = utf16 ? new TextDecoder('utf-16le').decode(bytes) : bytes.toString('latin1');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Section name -> key -> value. Comments start with ";". */
function parseIni(text) {
  const sections = new Map();
  let section = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      section = sections.get(header[1]) ?? new Map();
      sections.set(header[1], section);
      continue;
    }
    const at = line.indexOf('=');
    if (at > 0) section.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  return sections;
}

/** Names of the lighting effects: "tc_led_mode1" -> "Neon Stream". */
function readEffectNames(file) {
  const names = new Map();
  if (!fs.existsSync(file)) return names;
  for (const [, tag, name] of decode(fs.readFileSync(file)).matchAll(/<(tc_[a-z_]+\d+)>([^<]*)</g)) {
    names.set(tag, name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return names;
}

const round4 = (value) => Math.round(value * 4) / 4;

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** The average of the values near the middle one: a step size to a fraction of a pixel. */
function typical(values, fallback) {
  if (values.length === 0) return fallback;
  const middle = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const near = values.filter((value) => Math.abs(value - middle) <= 2);
  return near.reduce((sum, value) => sum + value, 0) / near.length;
}

function colourOf(code) {
  if (code === plain(0x29) || code === plain(0x28)) return ACCENT; // Esc, Enter
  if (code > 0xffff || (code & 0xff) !== 0) return MOD;
  const usage = code >> 8;
  const letterOrDigit = usage >= 0x04 && usage <= 0x27;
  const punctuation = (usage >= 0x2c && usage <= 0x38) || usage === 0x64;
  const numpadDigit = usage >= 0x59 && usage <= 0x63;
  return letterOrDigit || punctuation || numpadDigit ? ALPHA : MOD;
}

/**
 * Turns the rectangles drawn over the vendor's picture into key units. Returns the rows
 * of a KLE layout and the largest distance a key had to be moved to sit next to its
 * neighbour, as a measure of how well the picture fitted.
 */
function buildLayout(keys) {
  const capWidth = mostCommon(keys.map((key) => key.right - key.left));
  const capHeight = mostCommon(keys.map((key) => key.bottom - key.top));

  // Rows of the picture: keys whose tops are close together.
  const rows = [];
  for (const key of [...keys].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const row = rows.at(-1);
    if (row && key.top - row[0].top < capHeight * 0.6) row.push(key);
    else rows.push([key]);
  }
  for (const row of rows) row.sort((a, b) => a.left - b.left);

  // One key unit in pixels: the step between two ordinary keys side by side. Steps
  // across a gap are longer, so only the short ones count.
  const ordinary = (key) => Math.abs(key.right - key.left - capWidth) <= 2;
  const steps = [];
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) {
      const step = row[i].left - row[i - 1].left;
      if (ordinary(row[i]) && ordinary(row[i - 1]) && step > capWidth) steps.push(step);
    }
  }
  steps.sort((a, b) => a - b);
  const shortest = steps[Math.floor(steps.length / 10)] ?? capWidth * 1.5;
  const pitchX = typical(
    steps.filter((step) => step <= shortest * 1.2),
    shortest,
  );
  const drops = [];
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i][0].top - rows[i - 1][0].top;
    if (drop > pitchX * 0.8 && drop < pitchX * 1.3) drops.push(drop);
  }
  const pitchY = typical(drops, pitchX);

  const gapX = pitchX - capWidth;
  const gapY = pitchY - capHeight;
  const left = Math.min(...keys.map((key) => key.left));
  const top = Math.min(...keys.map((key) => key.top));

  let moved = 0;
  let cursorY = 0;
  let colour = ALPHA;
  const kle = [];
  for (const row of rows) {
    const items = [];
    let cursorX = 0;
    let previous = null;
    for (const key of row) {
      const w = Math.max(0.5, round4((key.right - key.left + gapX) / pitchX));
      const h = Math.max(1, round4((key.bottom - key.top + gapY) / pitchY));
      const measured = round4((key.left - left) / pitchX);
      const y = round4((key.top - top) / pitchY);
      let x = measured;
      if (previous) {
        const end = previous.x + previous.w;
        const space = key.left - previous.key.right;
        // Caps drawn side by side are neighbours, whatever the rounding says.
        if (x < end || Math.abs(space - gapX) < pitchX * 0.15) x = end;
      }
      moved = Math.max(moved, Math.abs(x - measured));

      const props = {};
      if (y !== cursorY) props.y = y - cursorY;
      if (x !== cursorX) props.x = x - cursorX;
      if (key.colour !== colour) props.c = key.colour;
      if (w !== 1) props.w = w;
      if (h !== 1) props.h = h;
      if (Object.keys(props).length > 0) items.push(props);
      items.push(`${key.position % ROWS},${Math.floor(key.position / ROWS)}`);

      cursorY = y;
      cursorX = x + w;
      colour = key.colour;
      previous = { key, x, w };
    }
    kle.push(items);
    cursorY += 1;
  }
  return { kle, moved };
}

/** The "Lighting" menu of one model, or null for a keyboard without lighting. */
function buildLightingMenu(options, names) {
  const rgb = options.get('RGBKb') === '1';
  const tag = options.has('MaxEftKeyIndex') ? 'tc_eft' : rgb ? 'tc_led_mode' : 'tc_led';

  const effects = [];
  for (let number = 1; number <= 21; number++) {
    // animation, speed, brightness, direction, random, colour picker
    const flags = options.get(`LedOpt${number}`)?.split(',').map((flag) => flag.trim());
    if (flags?.length !== 6) continue;
    effects.push({
      number,
      name: names.get(`${tag}${number}`) || `Effect ${number}`,
      speed: flags[1] === '1',
      brightness: flags[2] === '1',
      random: flags[4] === '1',
      colour: flags[5] === '1',
    });
  }
  if (effects.length === 0) return null;

  /** A control that only some effects have. Returns nothing when no effect has it. */
  const control = (feature, entry) => {
    const having = effects.filter((effect) => effect[feature]);
    if (having.length === 0) return [];
    if (having.length === effects.length) return [entry];
    const showIf = having.map((effect) => `{id_rk_effect_number} == ${effect.number}`).join(' || ');
    return [{ ...entry, showIf }];
  };

  return {
    label: 'Lighting',
    content: [
      {
        label: rgb ? 'RGB lighting' : 'Backlight',
        content: [
          {
            label: 'Effect',
            type: 'dropdown',
            options: effects.map((effect) => [effect.name, effect.number]),
            content: ['id_rk_effect_number', 0, 1],
          },
          ...control('brightness', {
            label: 'Brightness',
            type: 'range',
            options: [0, 5],
            content: ['id_rk_level', 0, 2],
          }),
          ...control('speed', {
            label: 'Effect speed',
            type: 'range',
            options: [1, 5],
            content: ['id_rk_speed', 0, 3],
          }),
          ...control('colour', { label: 'Color', type: 'color', content: ['id_rk_color', 0, 4] }),
          ...control('random', {
            label: 'Random colors',
            type: 'toggle',
            content: ['id_rk_random', 0, 5],
          }),
          ...(options.get('ShowSleepTime') === '1'
            ? [
                {
                  label: 'Lights sleep after',
                  type: 'dropdown',
                  options: [
                    ['5 minutes', 1],
                    ['10 minutes', 2],
                    ['20 minutes', 3],
                    ['30 minutes', 4],
                    ['Never', 5],
                  ],
                  content: ['id_rk_sleep', 0, 6],
                },
              ]
            : []),
        ],
      },
    ],
  };
}

/**
 * Reads one KB.ini. Returns the definition, or the reason there cannot be one.
 *
 * Only the plain form of a key entry is accepted: eight fields and a key named by a
 * code from the table above. Newer models add fields and number some keys instead of
 * naming them; neither open project has confirmed what those mean, and a wrong guess
 * would be written into a keyboard. Such models are left out.
 */
function buildDefinition(pid, name, ini, names) {
  const entries = [...(ini.get('KEY') ?? [])].filter(([key]) => /^K\d+$/i.test(key));
  if (entries.length === 0) return { skipped: 'no keys listed' };

  const keys = [];
  for (const [label, value] of entries) {
    const parts = value.split(',').map((part) => part.trim());
    if (parts.length !== 8) return { skipped: `${label} has ${parts.length} fields, not 8` };
    const [left, top, right, bottom] = parts.slice(0, 4).map((part) => Number.parseInt(part, 10));
    const vk = Number.parseInt(parts[5], 16);
    const position = Number.parseInt(parts[7], 10);

    const code = CODES.get(vk);
    if (code === undefined) {
      return { skipped: `${label} is a key OpenKeys has no code for (0x${vk.toString(16)})` };
    }
    if (![left, top, right, bottom, position].every(Number.isInteger)) {
      return { skipped: `${label} is not all numbers` };
    }
    if (position < 0 || position >= MAX_KEYS) return { skipped: `${label} is outside the keymap` };
    if (keys.some((key) => key.position === position)) {
      return { skipped: `two keys share position ${position}` };
    }
    // A knob's turns are keys of the keymap that the picture does not show: their
    // rectangle is all zeros. They keep their default and are not drawn.
    const drawn = right > left && bottom > top;
    if (!drawn && [left, top, right, bottom].some((edge) => edge !== 0)) {
      return { skipped: `${label} has no usable rectangle` };
    }
    keys.push({ left, top, right, bottom, position, code, drawn, colour: colourOf(code) });
  }

  const cols = Math.floor(Math.max(...keys.map((key) => key.position)) / ROWS) + 1;
  const defaultKeymap = Array(cols * ROWS).fill(0);
  for (const key of keys) {
    // A plain key is listed by its USB HID usage, anything else by the stored value.
    const usage = key.code >> 8;
    defaultKeymap[key.position] = key.code === plain(usage) && usage <= 0xff ? usage : key.code;
  }

  const { kle, moved } = buildLayout(keys.filter((key) => key.drawn));
  const menu = buildLightingMenu(ini.get('OPT') ?? new Map(), names);
  return {
    moved,
    keys: keys.length,
    definition: {
      name,
      vendorId: VENDOR_ID,
      productId: `0x${pid.toUpperCase()}`,
      protocol: 'royal-kludge',
      matrix: { rows: ROWS, cols },
      defaultKeymap,
      ...(menu ? { menus: [menu] } : {}),
      layouts: { keymap: kle },
    },
  };
}

/** Like JSON.stringify with two spaces, but with one line per row of keys. */
function format(definition) {
  const { defaultKeymap, layouts } = definition;
  const rows = layouts.keymap.map((row) => `      ${JSON.stringify(row)}`).join(',\n');
  return (
    JSON.stringify({ ...definition, defaultKeymap: '@defaults', layouts: { keymap: '@rows' } }, null, 2)
      .replace('"@defaults"', () => JSON.stringify(defaultKeymap))
      .replace('"@rows"', () => `[\n${rows}\n    ]`) + '\n'
  );
}

function main() {
  const source = process.argv[2];
  if (!source || !fs.existsSync(path.join(source, 'Cfg.ini'))) {
    console.log('Usage: node scripts/import-royal-kludge.mjs <path to kludgeknight>/public/rk');
    process.exitCode = 1;
    return;
  }

  const modelNames = new Map();
  for (const line of decode(fs.readFileSync(path.join(source, 'Cfg.ini'))).split(/\r?\n/)) {
    const match = line.match(/^DevName\d+\s*=\s*([0-9a-f]+)\s*,\s*(.+)$/i);
    if (match) modelNames.set(match[1].toLowerCase().padStart(4, '0'), match[2].trim());
  }
  const sharedEffectNames = readEffectNames(path.join(source, 'Dev', 'en', 'led.xml'));

  const written = [];
  const skipped = [];
  const rough = [];
  const folders = fs
    .readdirSync(path.join(source, 'Dev'))
    .filter((folder) => /^[0-9a-f]{4}$/i.test(folder))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  fs.mkdirSync(OUT, { recursive: true });
  for (const folder of folders) {
    const pid = folder.toLowerCase();
    const file = path.join(source, 'Dev', folder, 'KB.ini');
    if (!fs.existsSync(file)) {
      skipped.push(`${pid}: no KB.ini`);
      continue;
    }
    if (BROKEN.has(pid)) {
      skipped.push(`${pid}: ${BROKEN.get(pid)}`);
      continue;
    }
    const model = (modelNames.get(pid) ?? `RK ${pid.toUpperCase()}`)
      .replace(/（/g, ' (')
      .replace(/）/g, ')')
      .replace(/\s*Keyboa[re]d\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const ownEffectNames = readEffectNames(path.join(source, 'Dev', folder, 'en', 'led.xml'));
    const result = buildDefinition(
      pid,
      `Royal Kludge ${model}`,
      parseIni(decode(fs.readFileSync(file))),
      ownEffectNames.size > 0 ? ownEffectNames : sharedEffectNames,
    );
    if (result.skipped) {
      skipped.push(`${pid} ${model}: ${result.skipped}`);
      continue;
    }

    const slug = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const target = `${slug}-${pid}.json`;
    fs.writeFileSync(path.join(OUT, target), format(result.definition));
    written.push(target);
    if (result.moved > 0.5) rough.push(`${target}: a key moved ${result.moved} units to fit`);
  }

  const stale = fs.readdirSync(OUT).filter((file) => file.endsWith('.json') && !written.includes(file));
  console.log(`${written.length} definitions written to keyboards/royal_kludge/`);
  for (const [title, list] of [
    ['Skipped', skipped],
    ['Check the picture of', rough],
    ['Not from this run (delete if the model is gone)', stale],
  ]) {
    if (list.length === 0) continue;
    console.log(`\n${title}:`);
    for (const line of list) console.log(`  ${line}`);
  }
}

main();
