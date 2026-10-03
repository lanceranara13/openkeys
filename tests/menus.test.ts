import { describe, expect, it } from 'vitest';
import { bytesToNumber, numberToBytes, parseMenus, valueSize } from '../src/core/menus';
import { evaluateShowIf } from '../src/core/showif';

describe('parseMenus', () => {
  it('expands the stock QMK menus', () => {
    const [menu] = parseMenus(['qmk_backlight_rgblight']);
    expect(menu.label).toBe('Lighting');
    expect(menu.sections.map((section) => section.label)).toEqual(['Backlight', 'Underglow']);
    expect(
      menu.sections[1].controls.map((control) => [
        control.type,
        control.ref.channel,
        control.ref.valueId,
      ]),
    ).toEqual([
      ['range', 2, 1],
      ['range', 2, 2],
      ['range', 2, 3],
      ['color', 2, 4],
    ]);
  });

  it('merges menus that share a label and ignores unknown stock menus', () => {
    const menus = parseMenus(['qmk_backlight', 'qmk_rgblight', 'not_a_menu', 'qmk_audio']);
    expect(menus.map((menu) => [menu.label, menu.sections.length])).toEqual([
      ['Lighting', 2],
      ['Audio', 1],
    ]);
  });

  it('reads inline menus and leaves out controls it cannot draw', () => {
    const [menu] = parseMenus([
      {
        label: 'Lighting',
        content: [
          {
            label: 'Backlight',
            content: [
              { label: 'Mode', type: 'dropdown', options: ['Off', 'On'], content: ['id_mode', 0, 1] },
              {
                label: 'Effect',
                type: 'dropdown',
                options: [
                  ['Solid', 1],
                  ['Wave', 7],
                ],
                content: ['id_effect', 3, 2],
                showIf: '{id_mode} == 1',
              },
              { label: 'Row', type: 'range', options: [0, 1000], content: ['id_row', 0, 2, 5] },
              { label: 'Key', type: 'keycode', content: ['id_key', 0, 3] },
              { label: 'Broken', type: 'range', content: ['id_broken'] },
            ],
          },
          { label: 'Empty', content: [{ label: 'Go', type: 'button', content: ['id_go', 0, 9] }] },
        ],
      },
    ]);

    expect(menu.sections).toHaveLength(1);
    const [mode, effect, row] = menu.sections[0].controls;
    expect(menu.sections[0].controls).toHaveLength(3);
    expect(mode).toMatchObject({
      type: 'dropdown',
      choices: [
        { label: 'Off', value: 0 },
        { label: 'On', value: 1 },
      ],
    });
    expect(effect).toMatchObject({ showIf: '{id_mode} == 1', choices: [{ value: 1 }, { value: 7 }] });
    expect(row.ref).toEqual({ key: '0:2:5', id: 'id_row', channel: 0, valueId: 2, extra: [5] });
    expect(valueSize(row)).toBe(2);
    expect(valueSize(mode)).toBe(1);
  });

  it('packs two-byte values big-endian', () => {
    expect(numberToBytes(1000, 2)).toEqual([0x03, 0xe8]);
    expect(bytesToNumber([0x03, 0xe8])).toBe(1000);
    expect(numberToBytes(200, 1)).toEqual([200]);
  });
});

describe('evaluateShowIf', () => {
  const values: Record<string, number> = { effect: 3, mode: 0 };
  const lookup = (id: string) => values[id];

  it.each([
    [undefined, true],
    ['{effect} != 0', true],
    ['{effect} == 0', false],
    ['{effect} > 1 && {effect} < 3', false],
    ['{effect} >= 3 && {mode} == 0', true],
    ['{mode} == 1 || {effect} == 3', true],
    ['!({effect} == 3)', false],
    ['{mode}', false],
    ['{effect}', true],
  ])('%s -> %s', (expression, expected) => {
    expect(evaluateShowIf(expression, lookup)).toBe(expected);
  });

  it('shows the control when the expression cannot be evaluated', () => {
    expect(evaluateShowIf('{unknown} == 1', lookup)).toBe(true);
    expect(evaluateShowIf('{effect} === 3', lookup)).toBe(true);
    expect(evaluateShowIf('{effect} + 1', lookup)).toBe(true);
  });
});
