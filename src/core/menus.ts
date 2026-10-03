/**
 * Settings a keyboard exposes besides its keymap (lighting, audio, vendor extras).
 * Read from the "menus" field of a VIA definition and flattened into
 * menu -> sections -> controls so the UI can render them without special cases.
 */

export interface ValueRef {
  /** Unique storage key: "channel:valueId[:extra...]". */
  key: string;
  /** Name `showIf` expressions refer to, e.g. "id_qmk_rgb_matrix_effect". */
  id: string;
  channel: number;
  valueId: number;
  /** Extra index bytes some keyboards put after the value id. */
  extra: number[];
}

interface ControlBase {
  label: string;
  ref: ValueRef;
  showIf?: string;
}

export type MenuControl =
  | (ControlBase & { type: 'range'; min: number; max: number })
  | (ControlBase & { type: 'dropdown'; choices: { label: string; value: number }[] })
  | (ControlBase & { type: 'toggle'; off: number; on: number })
  | (ControlBase & { type: 'color' });

export interface MenuSection {
  label: string;
  showIf?: string;
  controls: MenuControl[];
}

export interface Menu {
  label: string;
  sections: MenuSection[];
}

/** How many bytes the keyboard stores for a control. */
export function valueSize(control: MenuControl): number {
  if (control.type === 'color') return 2;
  if (control.type === 'range') return control.max > 0xff ? 2 : 1;
  return 1;
}

export function bytesToNumber(bytes: readonly number[]): number {
  return bytes.reduce((value, byte) => (value << 8) | byte, 0);
}

export function numberToBytes(value: number, size: number): number[] {
  return size === 2 ? [(value >> 8) & 0xff, value & 0xff] : [value & 0xff];
}

const brightness = (id: string, channel: number) => ({
  label: 'Brightness',
  type: 'range',
  options: [0, 255],
  content: [id, channel, 1],
});

// QMK numbers its effects by which ones a firmware was built with, so the stock
// menus can only offer the effect number. Definitions that list their effects by
// name (an inline "menus" entry) get a proper dropdown instead.
const effects = (prefix: string, channel: number, withColor: boolean) => [
  brightness(`${prefix}_brightness`, channel),
  {
    label: 'Effect number (0 = off)',
    type: 'range',
    options: [0, 48],
    content: [`${prefix}_effect`, channel, 2],
  },
  {
    label: 'Effect speed',
    type: 'range',
    options: [0, 255],
    content: [`${prefix}_effect_speed`, channel, 3],
    showIf: `{${prefix}_effect} != 0`,
  },
  ...(withColor
    ? [
        {
          label: 'Color',
          type: 'color',
          content: [`${prefix}_color`, channel, 4],
          showIf: `{${prefix}_effect} != 0`,
        },
      ]
    : []),
];

const BACKLIGHT = {
  label: 'Backlight',
  content: [
    brightness('id_qmk_backlight_brightness', 1),
    { label: 'Breathing', type: 'toggle', content: ['id_qmk_backlight_effect', 1, 2] },
  ],
};
const UNDERGLOW = { label: 'Underglow', content: effects('id_qmk_rgblight', 2, true) };

/** The menus a definition can ask for by name instead of spelling them out. */
const BUILT_IN: Record<string, unknown> = {
  qmk_backlight: { label: 'Lighting', content: [BACKLIGHT] },
  qmk_rgblight: { label: 'Lighting', content: [UNDERGLOW] },
  qmk_backlight_rgblight: { label: 'Lighting', content: [BACKLIGHT, UNDERGLOW] },
  qmk_rgb_matrix: {
    label: 'Lighting',
    content: [{ label: 'RGB matrix', content: effects('id_qmk_rgb_matrix', 3, true) }],
  },
  qmk_led_matrix: {
    label: 'Lighting',
    content: [{ label: 'LED matrix', content: effects('id_qmk_led_matrix', 5, false) }],
  },
  qmk_audio: {
    label: 'Audio',
    content: [
      {
        label: 'Audio',
        content: [
          { label: 'Sound', type: 'toggle', content: ['id_qmk_audio_enable', 4, 1] },
          { label: 'Key clicks', type: 'toggle', content: ['id_qmk_audio_clicky_enable', 4, 2] },
        ],
      },
    ],
  },
};

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null;
const text = (value: unknown, fallback: string) =>
  typeof value === 'string' && value ? value : fallback;
const optionalText = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

function readRef(content: unknown): ValueRef | null {
  if (!Array.isArray(content) || typeof content[0] !== 'string') return null;
  const numbers = content.slice(1);
  if (numbers.length < 2 || numbers.some((n) => typeof n !== 'number')) return null;
  const [channel, valueId, ...extra] = numbers as number[];
  return { key: numbers.join(':'), id: content[0], channel, valueId, extra };
}

function readControl(node: Node): MenuControl | null {
  const ref = readRef(node.content);
  if (!ref) return null;
  const base = { label: text(node.label, ref.id), ref, showIf: optionalText(node.showIf) };
  const options = Array.isArray(node.options) ? node.options : [];

  switch (node.type) {
    case 'range':
      return {
        ...base,
        type: 'range',
        min: typeof options[0] === 'number' ? options[0] : 0,
        max: typeof options[1] === 'number' ? options[1] : 255,
      };
    case 'dropdown': {
      const choices = options.flatMap((option, index) => {
        if (typeof option === 'string') return [{ label: option, value: index }];
        if (Array.isArray(option) && typeof option[1] === 'number') {
          return [{ label: String(option[0]), value: option[1] }];
        }
        return [];
      });
      return choices.length > 0 ? { ...base, type: 'dropdown', choices } : null;
    }
    case 'toggle':
      return {
        ...base,
        type: 'toggle',
        off: typeof options[0] === 'number' ? options[0] : 0,
        on: typeof options[1] === 'number' ? options[1] : 1,
      };
    case 'color':
      return { ...base, type: 'color' };
    default:
      // "keycode" and "button" controls are not supported yet; leave them out.
      return null;
  }
}

function readMenu(node: unknown): Menu | null {
  if (!isNode(node) || !Array.isArray(node.content)) return null;
  const label = text(node.label, 'Settings');
  const sections: MenuSection[] = [];

  const visit = (group: Node, groupLabel: string) => {
    const section: MenuSection = {
      label: groupLabel,
      showIf: optionalText(group.showIf),
      controls: [],
    };
    sections.push(section);
    for (const child of group.content as unknown[]) {
      if (!isNode(child)) continue;
      if (typeof child.type === 'string') {
        const control = readControl(child);
        if (control) section.controls.push(control);
      } else if (Array.isArray(child.content)) {
        visit(child, text(child.label, groupLabel));
      }
    }
  };
  visit(node, label);

  const filled = sections.filter((section) => section.controls.length > 0);
  return filled.length > 0 ? { label, sections: filled } : null;
}

export function parseMenus(raw: unknown): Menu[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error('"menus" must be a list');

  const menus: Menu[] = [];
  for (const entry of raw) {
    const menu = readMenu(typeof entry === 'string' ? BUILT_IN[entry] : entry);
    if (!menu) continue;
    const existing = menus.find((other) => other.label === menu.label);
    if (existing) existing.sections.push(...menu.sections);
    else menus.push(menu);
  }
  return menus;
}
