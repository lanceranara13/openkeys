import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { brandName, modelName, scanKeyboards } from '../build/keyboard-index';
import { parseDefinition } from '../src/core/definition';
import { groupByBrand, searchKeyboards, type KeyboardEntry } from '../src/core/keyboard-list';
import { resolveLayout } from '../src/core/kle';
import { drivers } from '../src/drivers';

// Runs every file in keyboards/ through the same code the app uses, so a broken
// definition fails `npm run check` instead of failing for a user.

const dir = path.resolve(__dirname, '../keyboards');
const keyboards = scanKeyboards(dir);

describe('keyboard index', () => {
  it('spells a brand the way its keyboards do', () => {
    expect(brandName('keychron', ['Keychron Q1V2 ANSI'])).toBe('Keychron');
    expect(brandName('gmmk', ['GMMK Pro'])).toBe('GMMK');
    expect(brandName('ergodox_ez', ['ErgoDox EZ'])).toBe('ErgoDox EZ');
    expect(brandName('olkb', ['Planck rev4', 'OLKB PLANCK REV6.1'])).toBe('OLKB');
  });

  it('tidies the folder name when no keyboard starts with it', () => {
    expect(brandName('keebio', ['Iris Rev. 8'])).toBe('Keebio');
    expect(brandName('my-brand', ['Something else'])).toBe('My Brand');
    // "Keychrons" is a different word, not the brand followed by a model.
    expect(brandName('keychron', ['Keychrons X'])).toBe('Keychron');
  });

  it('takes the brand off the front of a name', () => {
    expect(modelName('Keychron', 'Keychron Q1V2 ANSI')).toBe('Q1V2 ANSI');
    expect(modelName('OLKB', 'olkb Planck')).toBe('Planck');
    expect(modelName('Keebio', 'Iris Rev. 8')).toBe('Iris Rev. 8');
    expect(modelName('ErgoDox EZ', 'ErgoDox EZ')).toBe('ErgoDox EZ');
  });

  it('is sorted by brand, then by model, with numbers in order', () => {
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    for (let index = 1; index < keyboards.length; index++) {
      const [before, after] = [keyboards[index - 1], keyboards[index]];
      const order =
        collator.compare(before.brand, after.brand) || collator.compare(before.model, after.model);
      expect(order, `${before.name} before ${after.name}`).toBeLessThanOrEqual(0);
    }
    expect(collator.compare('Q2 ANSI', 'Q10 ANSI')).toBeLessThan(0);
  });
});

describe('keyboard list', () => {
  const entry = (brand: string, model: string, productId: number): KeyboardEntry => ({
    path: `${brand.toLowerCase()}/${model.toLowerCase()}.json`,
    name: `${brand} ${model}`,
    brand,
    model,
    vendorId: 0x3434,
    productId,
  });
  const list = [
    entry('Keebio', 'Iris Rev. 8', 0x0001),
    entry('Keychron', 'Q1 ANSI', 0x0100),
    entry('Keychron', 'Q2 ISO', 0x0111),
  ];

  it('groups consecutive keyboards under their brand', () => {
    expect(groupByBrand(list).map((group) => [group.brand, group.keyboards.length])).toEqual([
      ['Keebio', 1],
      ['Keychron', 2],
    ]);
  });

  it('searches brand, model and USB id, every word having to match', () => {
    const models = (query: string) => searchKeyboards(list, query).map((item) => item.model);
    expect(models('')).toHaveLength(3);
    expect(models('KEYCHRON')).toEqual(['Q1 ANSI', 'Q2 ISO']);
    expect(models('iris')).toEqual(['Iris Rev. 8']);
    expect(models('keychron iso')).toEqual(['Q2 ISO']);
    expect(models('  q1  ')).toEqual(['Q1 ANSI']);
    expect(models('3434:0111')).toEqual(['Q2 ISO']);
    expect(models('0111')).toEqual(['Q2 ISO']);
    expect(models('keychron iris')).toEqual([]);
    // A short number is part of a model name, not a piece of a USB id.
    expect(models('iris 8')).toEqual(['Iris Rev. 8']);
    expect(models('keychron 4')).toEqual([]);
  });
});

describe('keyboards/', () => {
  it('has no two files for the same USB device', () => {
    // scanKeyboards throws on duplicates; reaching this line means there are none.
    expect(keyboards.length).toBeGreaterThan(0);
  });

  it.each(keyboards)('$path is a valid definition', (entry) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, entry.path), 'utf8'));
    const definition = parseDefinition(raw);

    expect(definition.vendorId).toBe(entry.vendorId);
    expect(definition.productId).toBe(entry.productId);
    expect(drivers.map((driver) => driver.id)).toContain(definition.protocol);

    // The standard layout and every choice of every layout option must draw.
    const standard = resolveLayout(definition.layout);
    expect(standard.keys.length).toBeGreaterThan(0);
    expect(standard.width).toBeGreaterThan(0);
    expect(standard.height).toBeGreaterThan(0);
    for (const [group, options] of Object.entries(definition.layout.options)) {
      for (const option of Object.keys(options)) {
        const selection: number[] = [];
        selection[Number(group)] = Number(option);
        const { keys, width, height } = resolveLayout(definition.layout, selection);
        expect(keys.length).toBeGreaterThan(0);
        expect(Number.isFinite(width) && Number.isFinite(height)).toBe(true);
      }
    }
  });
});
