import { describe, expect, it } from 'vitest';
import { createQmkCatalog } from '../src/core/keycodes';

const modern = createQmkCatalog(12, 4);
const legacy = createQmkCatalog(9, 4);

describe('createQmkCatalog', () => {
  it('uses the USB HID numbers for basic keys', () => {
    const expected: Record<string, number> = {
      KC_A: 0x04,
      KC_Z: 0x1d,
      KC_1: 0x1e,
      KC_0: 0x27,
      KC_ESC: 0x29,
      KC_CAPS: 0x39,
      KC_F1: 0x3a,
      KC_F12: 0x45,
      KC_F13: 0x68,
      KC_UP: 0x52,
      KC_P1: 0x59,
      KC_P0: 0x62,
      KC_PDOT: 0x63,
      KC_MPLY: 0xae,
      KC_BRIU: 0xbd,
      KC_LCTL: 0xe0,
      KC_RGUI: 0xe7,
      KC_EXLM: 0x021e,
      KC_QUES: 0x0238,
    };
    for (const [name, code] of Object.entries(expected)) {
      expect(modern.parse(name), name).toBe(code);
      expect(legacy.parse(name), name).toBe(code);
    }
  });

  it('numbers layer, lighting and bootloader keys by protocol version', () => {
    expect(modern.parse('MO(1)')).toBe(0x5221);
    expect(modern.parse('TG(2)')).toBe(0x5262);
    expect(modern.parse('TO(0)')).toBe(0x5200);
    expect(modern.parse('QK_BOOT')).toBe(0x7c00);
    expect(modern.parse('RGB_TOG')).toBe(0x7820);
    expect(modern.parse('BL_TOGG')).toBe(0x7802);
    expect(modern.parse('RM_TOGG')).toBe(0x7842);

    expect(legacy.parse('MO(1)')).toBe(0x5101);
    expect(legacy.parse('TG(2)')).toBe(0x5302);
    expect(legacy.parse('TO(0)')).toBe(0x5010);
    expect(legacy.parse('QK_BOOT')).toBe(0x5c00);
    expect(legacy.parse('RGB_TOG')).toBe(0x5cc2);
    expect(legacy.parse('BL_TOGG')).toBe(0x5cbf);
    expect(legacy.parse('RM_TOGG')).toBeUndefined();
  });

  it('only offers layers the keyboard has', () => {
    const layers = createQmkCatalog(12, 2).groups.find((group) => group.id === 'layers')!;
    expect(layers.keycodes.map((keycode) => keycode.name)).toEqual([
      'MO(1)',
      'TG(1)',
      'TT(1)',
      'OSL(1)',
      'TO(0)',
      'TO(1)',
      'DF(0)',
      'DF(1)',
    ]);
  });

  it('never lists the same keycode twice', () => {
    for (const catalog of [modern, legacy]) {
      const codes = catalog.groups.flatMap((group) => group.keycodes.map((keycode) => keycode.code));
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('describes keycodes that are in no group', () => {
    expect(modern.describe(0x5229).label).toBe('MO(9)');
    expect(modern.describe(0x0106).label).toBe('Ctrl+C');
    expect(modern.describe(0x1204).label).toBe('RShift+A');
    expect(modern.describe(0x4104).label).toBe('LT1 A');
    expect(modern.describe(0x2204).label).toBe('A / Shift');
    expect(legacy.describe(0x6204).label).toBe('A / Shift');
    expect(modern.describe(0x7703).label).toBe('M3');
    expect(modern.describe(0x6abc).label).toBe('0x6ABC');
  });

  it('reads hex values and ignores case and spaces', () => {
    expect(modern.parse(' 0x5221 ')).toBe(0x5221);
    expect(modern.parse('kc_esc')).toBe(0x29);
    expect(modern.parse('nope')).toBeUndefined();
  });

  it('adds the keys a keyboard defines itself', () => {
    const custom = [{ name: 'Siri', title: 'Siri in macOS', shortName: 'Siri' }];
    expect(createQmkCatalog(12, 4, custom).parse('CUSTOM(0)')).toBe(0x7e00);
    expect(createQmkCatalog(11, 4, custom).parse('CUSTOM(0)')).toBe(0x7f00);
    expect(createQmkCatalog(9, 4, custom).describe(0x5f80).label).toBe('Siri');
  });
});
