import { describe, expect, it } from 'vitest';
import builtins from '../config/furniture-symbols.json';
import type { FloorplanFurniture, FurnitureSourceSettings } from '../types';
import { detailedFurniture } from './furniture-models';
import { normalizeModel } from './symbol-model';

const model = { version: 1, units: 'cm', size: { width: 100, depth: 50, height: 200 }, parts: [{ box: [100, 50, 200] }] };
const f: FloorplanFurniture = { id: 'test', type: 'custom', x: 300, y: 400, w: 200, h: 100, angle: 90 };
const settings: FurnitureSourceSettings = {
  furniture3d: true,
  wallHeight: 200,
  symbols: { custom: { model3d: model, elevation: { from: 40 } } },
};

describe('source furniture models', () => {
  it('scales the footprint and height independently, then applies bottom and a closed cut', () => {
    const parts = detailedFurniture({ ...f, height3d: 100 }, { ...settings, wallHeight: 120 });
    expect(parts).toEqual([
      {
        base: [
          [-100, -50],
          [100, -50],
          [100, 50],
          [-100, 50],
        ],
        z0: 40,
        z1: 120,
      },
    ]);
  });
  it('honors a placed zero over the symbol bottom and ignores elevation.to', () => {
    expect(detailedFurniture({ ...f, elevation: { from: 0, to: 1 } }, settings)?.[0]).toMatchObject({ z0: 0, z1: 200 });
  });
  it('uses the independent cut only when explicitly enabled', () => {
    expect(detailedFurniture(f, { ...settings, wallHeight: 20, furnitureSectionHeight: 180 })).toEqual([]);
    expect(detailedFurniture(f, { ...settings, wallHeight: 20, furnitureSeparateSection: true, furnitureSectionHeight: 180 })?.[0].z1).toBe(
      180,
    );
    expect(detailedFurniture(f, { ...settings, wallHeight: 0 })).toEqual([]);
    expect(detailedFurniture(f, { ...settings, wallHeight: Infinity })?.[0].z1).toBe(60);
  });
  it('defaults to fallback when disabled, unknown or invalid without accidentally restoring a built-in', () => {
    expect(detailedFurniture(f)).toBeUndefined();
    expect(detailedFurniture(f, { ...settings, furniture3d: false })).toBeUndefined();
    expect(detailedFurniture({ ...f, type: 'unknown' }, settings)).toBeUndefined();
    expect(detailedFurniture({ ...f, type: 'bed' }, { ...settings, symbols: { bed: { model3d: { version: 2 } } } })).toBeUndefined();
  });
  it('accepts every bundled detailed model', () => {
    let count = 0;
    for (const s of Object.values(builtins))
      if ('model3d' in s) {
        expect(normalizeModel(s.model3d)).toBeDefined();
        count++;
      }
    expect(count).toBeGreaterThan(30);
  });
  it('supports repeats, glass and extrusions and rejects unbounded or malformed geometry', () => {
    const valid = {
      ...model,
      parts: [
        { repeat: 3, step: [0, 0, 40], part: { box: [100, 50, 2], material: 'glass' } },
        {
          extrude: {
            polygon: [
              [0, 0],
              [20, 0],
              [0, 20],
            ],
            height: 10,
          },
        },
        { cylinder: { radius: 5, height: 20 }, position: [10, 10, 0] },
      ],
    };
    const normalized = normalizeModel(valid);
    expect(normalized?.parts).toHaveLength(5);
    expect(normalized?.parts[2]).toMatchObject({ z0: 80, z1: 82, glass: true });
    for (const parts of [
      [{ box: [101, 50, 1] }],
      [{ box: [1, 1, NaN] }],
      [{ repeat: 65, step: [0, 0, 1], part: { box: [1, 1, 1] } }],
      [
        {
          extrude: {
            polygon: [
              [0, 0],
              [20, 20],
              [0, 20],
              [20, 0],
            ],
            height: 1,
          },
        },
      ],
    ])
      expect(normalizeModel({ ...model, parts })).toBeUndefined();
  });
});
