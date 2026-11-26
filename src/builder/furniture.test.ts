import * as THREE from 'three';
import { expect, it } from 'vitest';
import type { FloorData, FurnitureSourceSettings } from '../types';
import { buildFurniture } from './furniture';

it('renders real meshes with world footprint, rotation, raised bottom and cut top', () => {
  const group = new THREE.Group();
  const floor = {
    furniture: [{ id: 'f', type: 'custom', x: 300, y: 400, w: 200, h: 50, angle: 90, elevation: { from: 80 } }],
  } as FloorData;
  const settings: FurnitureSourceSettings = {
    furniture3d: true,
    wallHeight: 130,
    symbols: {
      custom: { model3d: { version: 1, units: 'cm', size: { width: 100, depth: 50, height: 100 }, parts: [{ box: [100, 50, 100] }] } },
    },
  };
  buildFurniture(group, floor, settings);
  const bounds = new THREE.Box3().setFromObject(group);
  expect(bounds.min.x).toBeCloseTo(2.75);
  expect(bounds.max.x).toBeCloseTo(3.25);
  expect(bounds.min.z).toBeCloseTo(3);
  expect(bounds.max.z).toBeCloseTo(5);
  expect(bounds.min.y).toBeCloseTo(0.8);
  expect(bounds.max.y).toBeCloseTo(1.3);
  expect(group.children[0].children[0]).toBeInstanceOf(THREE.Mesh);
  const cutAway = new THREE.Group();
  buildFurniture(cutAway, floor, { ...settings, wallHeight: 40 });
  expect(new THREE.Box3().setFromObject(cutAway).isEmpty()).toBe(true);
});
