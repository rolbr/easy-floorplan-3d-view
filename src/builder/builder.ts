// Composition root

import * as THREE from 'three';
import { DOOR_MATERIAL_PARAMS, GLASS_MATERIAL_PARAMS, RAIL_MATERIAL_PARAMS, WALL_HEIGHT, WALL_MATERIAL_PARAMS } from '../config/constants';
import { log } from '../lib/logger';
import type { AreaController, CardConfig, FloorData, FloorplanModel, World } from '../types';
import { disposeObject3D } from '../utils/threejs';
import { buildAreas, createAreaController } from './areas';
import { createClipCaps } from './clip';
import { buildFurniture } from './furniture';
import { buildItems } from './items';
import { buildNorthMarker } from './north-marker';
import { buildCorners, buildWalls } from './walls';

function buildFloorplan(floorData: FloorData): FloorplanModel {
  const group = new THREE.Group();
  const wallsGroup = new THREE.Group();
  group.add(wallsGroup);

  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), WALL_HEIGHT);

  const materials = {
    wallMaterial: new THREE.MeshStandardMaterial(WALL_MATERIAL_PARAMS),
    railMaterial: new THREE.MeshStandardMaterial(RAIL_MATERIAL_PARAMS),
    glassMaterial: new THREE.MeshStandardMaterial({
      ...GLASS_MATERIAL_PARAMS,
      side: THREE.DoubleSide,
    }),
    doorMaterial: new THREE.MeshStandardMaterial(DOOR_MATERIAL_PARAMS),
  };

  Object.values(materials).forEach((mat) => {
    mat.clippingPlanes = [clipPlane];
    mat.clipShadows = true;
  });

  buildWalls(wallsGroup, floorData, materials);
  buildCorners(wallsGroup, floorData, materials);

  const furnitureGroup = new THREE.Group();
  group.add(furnitureGroup);
  buildFurniture(furnitureGroup, floorData);

  const { pickableItems, itemsGroup, glowGroup, issues } = buildItems(group, floorData);

  const stencilCapGroup = new THREE.Group();
  group.add(stencilCapGroup);
  const clipCaps = createClipCaps(clipPlane);
  clipCaps.rebuildClipCaps(wallsGroup, stencilCapGroup);

  return {
    group,
    pickableItems,
    furnitureGroup,
    itemsGroup,
    glowGroup,
    clipPlane,
    clipCaps,
    stencilCapGroup,
    issues,
  };
}

/** Build the floorplan, add it to the scene and attach the north marker. */
export function buildModel(world: World, floor: FloorData, config: CardConfig | undefined): FloorplanModel {
  const model = buildFloorplan(floor);
  world.scene.add(model.group);
  buildNorthMarker(config?.north_offset ?? 0, model.group, config?.north_marker);
  return model;
}

/** Build clickable areas and their controller; focuses the configured area if set. Call after the camera is framed. */
export function buildAreaLayer(world: World, group: THREE.Group, floor: FloorData, areaId: string | undefined, cardId: string) {
  const { areaMeshes, areaVolumes, areaLabelGroup } = buildAreas(group, floor);
  const areaController: AreaController = createAreaController(world);
  if (areaId && !areaController.focusArea(areaId, areaVolumes)) {
    log.warn(`${cardId} area "${areaId}" not found in floor "${floor.id}"; starting without area focus.`);
  }
  return { areaMeshes, areaVolumes, areaLabelGroup, areaController };
}

/** Remove the model from the scene and free its GPU resources. */
export function disposeModel(world: World | null, group: THREE.Group) {
  world?.scene.remove(group);
  disposeObject3D(group);
}
