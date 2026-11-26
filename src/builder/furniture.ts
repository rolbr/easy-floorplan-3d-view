// Source-authored models, with simple furniture as fallback

import * as THREE from 'three';
import { FURNITURE, toM } from '../config/constants';
import { detailedFurniture } from '../lib/furniture-models';
import type { FloorData, FloorplanFurniture, FurnitureSourceSettings } from '../types';

export function buildFurniture(group: THREE.Group, floorData: FloorData, settings?: FurnitureSourceSettings) {
  const material = new THREE.MeshStandardMaterial(FURNITURE.MATERIAL_PARAMS);

  for (const furniture of floorData.furniture || []) {
    const detailed = detailedFurniture(furniture, settings);
    if (detailed !== undefined) {
      const item = new THREE.Group();
      item.position.set(toM(furniture.x), 0, toM(furniture.y));
      item.rotation.y = -THREE.MathUtils.degToRad(furniture.angle ?? 0);
      item.userData.furnitureId = furniture.id;
      for (const part of detailed) {
        const shape = new THREE.Shape();
        part.base.forEach(([x, y], i) => {
          if (i === 0) shape.moveTo(toM(x), -toM(y));
          else shape.lineTo(toM(x), -toM(y));
        });
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: toM(part.z1 - part.z0), bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const partMaterial = part.glass
          ? new THREE.MeshStandardMaterial({ color: 0x8ecdf0, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide })
          : material;
        const mesh = new THREE.Mesh(geometry, partMaterial);
        mesh.position.y = toM(part.z0);
        mesh.castShadow = !part.glass;
        mesh.receiveShadow = true;
        item.add(mesh);
      }
      group.add(item);
    } else {
      addFurniture(group, furniture, material);
    }
  }
}

function addFurniture(group: THREE.Group, furniture: FloorplanFurniture, material: THREE.Material) {
  const height = FURNITURE.HEIGHT._default;
  const itemGroup = new THREE.Group();

  const width = toM(furniture.w);
  const depth = toM(furniture.h);

  const itemHeightValue = (FURNITURE.HEIGHT as Record<string, number>)[furniture.type] ?? height;

  const addBox = (boxWidth: number, boxHeight: number, boxDepth: number, y: number, boxMaterial = material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth), boxMaterial);
    mesh.position.y = y;
    itemGroup.add(mesh);
    return mesh;
  };

  if (furniture.type === 'bathtub') {
    const tubHeight = 0.5;
    addBox(width, tubHeight, depth, tubHeight / 2);
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.82, tubHeight * 0.6, depth * 0.72),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
    );
    inner.position.y = tubHeight * 0.75;
    itemGroup.add(inner);
  } else if (furniture.type === 'toilet') {
    const toiletHeight = 0.4;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.28, width * 0.35, toiletHeight * 0.5, 16), material);
    base.position.y = toiletHeight * 0.25;
    const tank = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, toiletHeight * 0.3, depth * 0.25), material);
    tank.position.set(0, toiletHeight * 0.65, -depth * 0.3);
    itemGroup.add(base, tank);
  } else if (furniture.type === 'sink') {
    const sinkHeight = 0.85;
    addBox(width * 0.85, sinkHeight * 0.8, depth * 0.6, sinkHeight * 0.4);
    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.75, 0.12, depth * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    basin.position.y = sinkHeight;
    itemGroup.add(basin);
  } else {
    addBox(width, itemHeightValue, depth, itemHeightValue / 2);
  }

  if (furniture.type === 'bed') {
    const pillowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
    });
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.08, depth * 0.22), pillowMaterial);
    pillow.position.set(0, height + 0.04, -depth * 0.35);
    itemGroup.add(pillow);
  }

  if (furniture.type === 'sofa') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.9, depth * 0.22), material);
    back.position.set(0, height + height * 0.45, -depth * 0.39);
    itemGroup.add(back);
  }

  itemGroup.position.set(toM(furniture.x), 0, toM(furniture.y));
  itemGroup.rotation.y = -THREE.MathUtils.degToRad(furniture.angle ?? 0);

  itemGroup.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  group.add(itemGroup);
}
