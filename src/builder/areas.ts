// Clickable room areas: floor polygons, name labels, camera zoom

import * as THREE from 'three';
import { AREA, AREA_VIEW, AREA_VOLUME, toM, WALL_HEIGHT } from '../config/constants';
import { fitView } from '../lib/camera';
import { fitRadius, pointsExtent } from '../lib/floor-extent';
import { makeTextSprite } from '../lib/sprites';
import type { AreaController, AreaMesh, FloorData, World } from '../types';
import { makeCubicBezier } from '../utils/easing';

export function buildAreas(group: THREE.Group, floorData: FloorData) {
  const areaMeshes: AreaMesh[] = [];
  const areaVolumes: AreaMesh[] = [];
  const areaLabelGroup = new THREE.Group();
  group.add(areaLabelGroup);

  for (const area of floorData.areas || []) {
    const points = area.points || [];
    if (points.length < 3) continue;

    const extent = pointsExtent(points);
    if (!extent) continue;
    const { centerX, centerY } = extent; // metres

    // Shape is built around its own centroid to keep geometry near origin.
    const shape = new THREE.Shape();
    points.forEach((p, index) => {
      const x = toM(p.x) - centerX;
      const y = toM(p.y) - centerY;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();

    const color = area.color ?? AREA.FILL_COLOR;
    const activeColor = area.activeColor ?? color;
    const restOpacity = area.opacity ?? AREA.FILL_OPACITY;

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: restOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    // +PI/2 maps plan (x, y) to world (x, 0, y), matching the wall builder.
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(centerX, AREA.FILL_HEIGHT, centerY);

    mesh.userData = {
      isArea: true,
      areaId: area.id,
      name: area.name,
      color,
      activeColor,
      restOpacity,
      centroid: new THREE.Vector3(centerX, 0, centerY),
      radius: fitRadius(extent),
    };

    group.add(mesh);
    areaMeshes.push(mesh as AreaMesh);

    // Pick volume: footprint extruded to unit height, real height via scale.z.
    const volGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 1,
      bevelEnabled: false,
    });
    volGeometry.translate(0, 0, -1);
    const volColor = AREA_VOLUME.DEBUG_COLORS[areaVolumes.length % AREA_VOLUME.DEBUG_COLORS.length];
    const volMaterial = new THREE.MeshBasicMaterial({
      color: volColor,
      transparent: true,
      opacity: AREA_VOLUME.DEBUG_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
      visible: AREA_VOLUME.DEBUG_VISIBLE,
    });
    const volume = new THREE.Mesh(volGeometry, volMaterial);
    volume.rotation.x = Math.PI / 2;
    volume.position.set(centerX, AREA_VOLUME.SHRINK_CM / 200, centerY);
    volume.scale.z = Math.max(0.1, WALL_HEIGHT - AREA_VOLUME.SHRINK_CM / 100);
    // Shrink footprint by SHRINK_CM in each dimension (scaled around bbox center).
    const shrink = toM(AREA_VOLUME.SHRINK_CM);
    volume.scale.x = Math.max(0.1, 1 - shrink / extent.width);
    volume.scale.y = Math.max(0.1, 1 - shrink / extent.depth);
    volume.userData = {
      isAreaVolume: true,
      areaId: area.id,
      name: area.name,
      radius: fitRadius(extent),
      floorMesh: mesh as AreaMesh,
      color: volColor,
      activeColor: volColor,
      restOpacity: AREA_VOLUME.DEBUG_OPACITY,
    };
    group.add(volume);
    areaVolumes.push(volume as AreaMesh);

    if (area.showName !== false && area.name) {
      const label = makeTextSprite(area.name);
      label.position.set(centerX, AREA.LABEL_HEIGHT, centerY);
      areaLabelGroup.add(label);
    }
  }

  return { areaMeshes, areaVolumes, areaLabelGroup };
}

/** Running camera transition between two views. */
interface Tween {
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  /** Camera offset from the target as radius / phi / theta; interpolated per component so every in-between view stays inside the control limits. */
  startSph: THREE.Spherical;
  endSph: THREE.Spherical;
  startTime: number | null; // set on the first updateTween frame so a slow click handler cannot skip the ease-in
}

interface CameraView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

// Scratch objects reused every frame (no per-frame allocations)
const _offset = new THREE.Vector3();
const _sph = new THREE.Spherical();

export function createAreaController(world: World): AreaController {
  const { camera, controls } = world;
  const ease = makeCubicBezier(...AREA_VIEW.EASING);

  let tween: Tween | null = null;
  let savedView: CameraView | null = null;
  let activeAreaId: string | null = null;

  const saveView = () => ({
    position: camera.position.clone(),
    target: controls.target.clone(),
  });

  const toSpherical = (position: THREE.Vector3, target: THREE.Vector3) =>
    new THREE.Spherical().setFromVector3(_offset.copy(position).sub(target));

  const flyTo = (endPosition: THREE.Vector3, endTarget: THREE.Vector3) => {
    const startTarget = controls.target.clone();
    const startSph = toSpherical(camera.position, startTarget);
    const endSph = toSpherical(endPosition, endTarget);
    // Take the shortest way around the circle
    const dTheta = THREE.MathUtils.euclideanModulo(endSph.theta - startSph.theta + Math.PI, Math.PI * 2) - Math.PI;
    endSph.theta = startSph.theta + dTheta;
    tween = {
      startTarget,
      endTarget,
      startSph,
      endSph,
      startTime: null,
    };
    controls.enabled = false;
    controls.enableDamping = false; // let tween fully handle camera orientation
  };

  const snapTo = (position: THREE.Vector3, target: THREE.Vector3) => {
    tween = null;
    camera.position.copy(position);
    controls.target.copy(target);
    controls.enabled = true; // a running fly-to had disabled them
    controls.enableDamping = true;
    controls.update();
  };

  const getAreaView = (mesh: AreaMesh) => {
    const target = mesh.getWorldPosition(new THREE.Vector3()).setY(AREA_VIEW.TARGET_Y);

    // Preserve the current compass direction; `atan2(0, 0)` consistently falls back to 0.
    const offset = camera.position.clone().sub(controls.target);
    const azimuth = Math.atan2(offset.z, offset.x);
    const elevation = THREE.MathUtils.degToRad(AREA_VIEW.ELEVATION_DEG);
    return fitView(camera, target, mesh.userData.radius, azimuth, elevation, AREA_VIEW.PADDING, controls.minDistance);
  };

  const enterArea = (mesh: AreaMesh, animate: boolean) => {
    if (!savedView) savedView = saveView();
    activeAreaId = mesh.userData.areaId;
    const { position, target } = getAreaView(mesh);
    if (animate) flyTo(position, target);
    else snapTo(position, target);
  };

  const leaveArea = () => {
    if (!activeAreaId || !savedView) return;
    flyTo(savedView.position.clone(), savedView.target.clone());
    activeAreaId = null;
    savedView = null;
  };

  // Instant, idempotent focus for programmatic callers. Start from the saved default view when another area is active.
  const focusArea = (areaId: string, volumes: THREE.Object3D[]) => {
    const mesh = volumes.find((o) => (o as AreaMesh).userData.areaId === areaId) as AreaMesh | undefined;
    if (!mesh) return false;
    if (savedView) snapTo(savedView.position, savedView.target);
    savedView = null;
    enterArea(mesh, false);
    return true;
  };

  // savedView is obsolete when camera was reset elsewhere
  const clearSavedView = () => {
    savedView = null;
  };

  const getActiveAreaId = () => activeAreaId;

  // `object === null` means "clicked outside every area".
  const handleClick = (object: THREE.Object3D | null) => {
    const mesh = object as AreaMesh | null;
    if (!mesh || mesh.userData.areaId === activeAreaId) {
      leaveArea();
      return;
    }
    enterArea(mesh, true);
  };

  const updateTween = (now: number) => {
    if (!tween) return;

    tween.startTime ??= now;
    const progress = Math.min((now - tween.startTime) / AREA_VIEW.TRANSITION_MS, 1);
    const eased = ease(progress);

    controls.target.lerpVectors(tween.startTarget, tween.endTarget, eased);
    const { startSph: a, endSph: b } = tween;
    _sph.set(
      Math.exp(THREE.MathUtils.lerp(Math.log(a.radius), Math.log(b.radius), eased)), // log-space: even-feeling zoom
      THREE.MathUtils.lerp(a.phi, b.phi, eased),
      THREE.MathUtils.lerp(a.theta, b.theta, eased),
    );
    camera.position.copy(controls.target).add(_offset.setFromSpherical(_sph));

    if (progress >= 1) {
      tween = null;
      controls.enabled = true;
      controls.enableDamping = true;
    }
  };

  const refit = (scale: number, volumes: THREE.Object3D[]) => {
    if (savedView) savedView.position.sub(savedView.target).multiplyScalar(scale).add(savedView.target);
    const mesh = volumes.find((o) => (o as AreaMesh).userData.areaId === activeAreaId) as AreaMesh | undefined;
    if (mesh) {
      const { position, target } = getAreaView(mesh);
      snapTo(position, target);
    }
  };

  return { handleClick, focusArea, getActiveAreaId, clearSavedView, refit, updateTween };
}
