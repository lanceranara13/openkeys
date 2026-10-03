import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanKeyboards } from '../build/keyboard-index';
import { parseDefinition } from '../src/core/definition';
import { resolveLayout } from '../src/core/kle';
import { drivers } from '../src/drivers';

// Runs every file in keyboards/ through the same code the app uses, so a broken
// definition fails `npm run check` instead of failing for a user.

const dir = path.resolve(__dirname, '../keyboards');
const keyboards = scanKeyboards(dir);

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
