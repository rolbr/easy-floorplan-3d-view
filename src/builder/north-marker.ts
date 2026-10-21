// north marker, final north after north_offset

import * as THREE from 'three';
import type { NorthMarkerConfig } from '../types';

export function buildNorthMarker(northOffset: number, group: THREE.Group, cfg: NorthMarkerConfig = {}) {
  if (cfg.visible === false) return;
  const distance = cfg.distance ?? 2;
  const width = cfg.width ?? 0.3;
  const length = cfg.length ?? 4;

  const bearing = THREE.MathUtils.degToRad(-northOffset);
  const northDir = new THREE.Vector3(Math.sin(bearing), 0, -Math.cos(bearing));

  const box = new THREE.Box3().setFromObject(group);
  const boxSize = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Place just outside floorplan, north side, ground level
  const origin = center.clone().addScaledVector(northDir, Math.max(boxSize.x, boxSize.z) + distance);
  origin.y = box.min.y + 0.95;

  // const arrow = new THREE.ArrowHelper(northDir, origin, 0, 0xE07C77, length, width);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(width, length, 12), new THREE.MeshStandardMaterial({ color: 0xe07c77 }));

  cone.position.copy(origin);
  // Cone apex points along +Y, centered on its origin
  // Rotate apex (+Y) to point along northDir
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), northDir);

  cone.name = 'north-marker';
  group.add(cone);
}
