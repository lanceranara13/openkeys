import { describe, expect, it } from 'vitest';
import { parseKle, resolveLayout } from '../src/core/kle';

const matrix = { rows: 2, cols: 4 };

describe('parseKle', () => {
  it('places keys left to right and reads their matrix position', () => {
    const layout = parseKle(
      [
        ['0,0', '0,1', { w: 2 }, '0,2'],
        ['1,0', { x: 1 }, '1,1'],
      ],
      matrix,
    );
    expect(layout.keys.map(({ row, col, x, y, w }) => [row, col, x, y, w])).toEqual([
      [0, 0, 0, 0, 1],
      [0, 1, 1, 0, 1],
      [0, 2, 2, 0, 2],
      [1, 0, 0, 1, 1],
      [1, 1, 2, 1, 1],
    ]);
    expect(resolveLayout(layout)).toMatchObject({ width: 4, height: 2 });
  });

  it('skips decals and KLE metadata blocks', () => {
    const layout = parseKle([{ name: 'My board' }, ['0,0', { d: true }, 'just a label', '0,1']], matrix);
    expect(layout.keys.map((key) => [key.col, key.x])).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it('rejects keys without a matrix position or outside the matrix', () => {
    expect(() => parseKle([['Esc']], matrix)).toThrow(/matrix position/);
    expect(() => parseKle([['']], matrix)).toThrow(/row,col/);
    expect(() => parseKle([['5,0']], matrix)).toThrow(/outside the 2x4 matrix/);
  });

  it('moves alternative layout options onto the spot of the default option', () => {
    const layout = parseKle(
      [['0,0', { w: 2 }, '0,1\n\n\n0,0', { x: 1 }, '0,1\n\n\n0,1', '0,2\n\n\n0,1']],
      matrix,
    );
    expect(layout.keys).toHaveLength(1);

    const standard = resolveLayout(layout);
    expect(standard.keys.map((key) => [key.col, key.x, key.w])).toEqual([
      [0, 0, 1],
      [1, 1, 2],
    ]);

    const split = resolveLayout(layout, [1]);
    expect(split.keys.map((key) => [key.col, key.x, key.w])).toEqual([
      [0, 0, 1],
      [1, 1, 1],
      [2, 2, 1],
    ]);
    expect(split.width).toBe(3);
  });

  it('uses a decal to mark where an empty default option sits', () => {
    const layout = parseKle([['0,0', { d: true }, '\n\n\n0,0', { x: 1 }, '0,1\n\n\n0,1']], matrix);
    expect(resolveLayout(layout).keys.map((key) => key.col)).toEqual([0]);
    expect(resolveLayout(layout, [1]).keys.map((key) => [key.col, key.x])).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('colours keys by how common their keycap colour is', () => {
    const layout = parseKle(
      [[{ c: '#777777' }, '0,0', { c: '#cccccc' }, '0,1', '0,2', '0,3', { c: '#aaaaaa' }, '1,0', '1,1']],
      matrix,
    );
    expect(layout.keys.map((key) => key.color)).toEqual([
      'accent',
      'alpha',
      'alpha',
      'alpha',
      'mod',
      'mod',
    ]);
  });

  it('fits rotated keys inside the layout box', () => {
    const layout = parseKle([[{ r: 90, rx: 2, ry: 0 }, '0,0']], matrix);
    const { keys, width, height } = resolveLayout(layout);
    expect(width).toBeCloseTo(1);
    expect(height).toBeCloseTo(1);
    // The key swings to the left of its rotation origin, so the origin moves right by one.
    expect(keys[0]).toMatchObject({ x: 1, y: 0, rx: 1, ry: 0, r: 90 });
  });

  it('reads encoders, with or without a switch', () => {
    const layout = parseKle([['\n\n\n\n\n\n\n\n\ne0', '0,1\n\n\n\n\n\n\n\n\ne1']], matrix);
    expect(layout.keys.map(({ row, col, encoder }) => [row, col, encoder])).toEqual([
      [-1, -1, 0],
      [0, 1, 1],
    ]);
  });
});
