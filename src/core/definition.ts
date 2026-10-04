import { parseKle, type ParsedLayout } from './kle';
import { parseMenus, type Menu } from './menus';

/**
 * A keyboard definition is one JSON file in `keyboards/`. The format is the VIA v3
 * definition format, so the thousands of files that already exist for VIA work as-is.
 * See docs/adding-a-keyboard.md.
 */
export interface KeyboardDefinition {
  name: string;
  vendorId: number;
  productId: number;
  /** Which driver talks to this keyboard (see src/drivers). Defaults to "via". */
  protocol: string;
  /**
   * How the keyboard's magnetic switches are configured, e.g. "keychron". null leaves
   * it to the driver, which recognises the makers it knows by their USB vendor id.
   */
  analog: string | null;
  matrix: { rows: number; cols: number };
  layout: ParsedLayout;
  layoutOptions: LayoutOption[];
  menus: Menu[];
  customKeycodes: CustomKeycode[];
}

export interface LayoutOption {
  label: string;
  /** Names of the choices. A plain on/off option has ["Off", "On"]. */
  choices: string[];
}

export interface CustomKeycode {
  name: string;
  title: string;
  shortName: string;
}

export class DefinitionError extends Error {}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null;

function readName(value: unknown): string {
  // A few definitions list one name per board variant; use the first.
  const name = isObject(value) && Array.isArray(value.options) ? value.options[0] : value;
  if (typeof name !== 'string' || !name) throw new DefinitionError('Missing "name"');
  return name;
}

function readUsbId(value: unknown, field: string): number {
  const id = typeof value === 'string' ? Number.parseInt(value, 16) : value;
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id > 0xffff) {
    throw new DefinitionError(`"${field}" must be a hex string like "0x3434"`);
  }
  return id;
}

function readCount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 255) {
    throw new DefinitionError(`"${field}" must be a whole number of 1 or more`);
  }
  return value;
}

function readLayoutOptions(labels: unknown): LayoutOption[] {
  if (labels === undefined) return [];
  if (!Array.isArray(labels)) throw new DefinitionError('"layouts.labels" must be a list');
  return labels.map((label) => {
    if (typeof label === 'string') return { label, choices: ['Off', 'On'] };
    if (Array.isArray(label) && label.length >= 2) {
      const [name, ...choices] = label.map(String);
      return { label: name, choices };
    }
    throw new DefinitionError('each entry of "layouts.labels" must be text or a list of text');
  });
}

function readCustomKeycodes(value: unknown): CustomKeycode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((entry, index) => {
    const name = typeof entry.name === 'string' ? entry.name : `Custom ${index}`;
    return {
      name,
      title: typeof entry.title === 'string' ? entry.title : name,
      shortName: typeof entry.shortName === 'string' ? entry.shortName : name,
    };
  });
}

/** Validates a definition file and turns it into the shape the app works with. */
export function parseDefinition(raw: unknown): KeyboardDefinition {
  if (!isObject(raw)) throw new DefinitionError('A keyboard definition must be a JSON object');
  const name = readName(raw.name);
  if (!isObject(raw.matrix)) throw new DefinitionError('Missing "matrix" ({ "rows", "cols" })');
  if (!isObject(raw.layouts)) throw new DefinitionError('Missing "layouts"');

  const matrix = {
    rows: readCount(raw.matrix.rows, 'matrix.rows'),
    cols: readCount(raw.matrix.cols, 'matrix.cols'),
  };

  let layout: ParsedLayout;
  let menus: Menu[];
  try {
    layout = parseKle(raw.layouts.keymap, matrix);
    menus = parseMenus(raw.menus);
  } catch (error) {
    throw new DefinitionError((error as Error).message);
  }

  return {
    name,
    vendorId: readUsbId(raw.vendorId, 'vendorId'),
    productId: readUsbId(raw.productId, 'productId'),
    protocol: typeof raw.protocol === 'string' ? raw.protocol : 'via',
    analog: typeof raw.analog === 'string' ? raw.analog : null,
    matrix,
    layout,
    layoutOptions: readLayoutOptions(raw.layouts.labels),
    menus,
    customKeycodes: readCustomKeycodes(raw.customKeycodes),
  };
}

const hex4 = (value: number) => value.toString(16).padStart(4, '0');

/** "3434:0107": how a USB device is identified across the app. */
export function deviceKey(vendorId: number, productId: number): string {
  return `${hex4(vendorId)}:${hex4(productId)}`;
}
