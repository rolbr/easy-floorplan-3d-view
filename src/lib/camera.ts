import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, CAMERA_LIMITS, FLOOR_VIEW, STAGE, WALL_HEIGHT } from '../config/constants';
import type { FloorData } from '../types';
import { type FloorExtent, fitRadius, floorExtent } from './floor-extent';

/** Distance at which a sphere of `radius` just fits the camera's viewport (limited by the narrower of vertical/horizontal FOV) */
export function fitSphereDistance(camera: THREE.PerspectiveCamera, radius: number) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return radius / Math.sin(Math.min(vFov, hFov) / 2);
}

/** Point at `distance` from `target`, seen under `azimuth` (around Y) and `elevation` (angle above the horizontal), both in radians */
export function orbitPosition(target: THREE.Vector3, azimuth: number, elevation: number, distance: number) {
  const horizontal = distance * Math.cos(elevation);
  return new THREE.Vector3(
    target.x + horizontal * Math.cos(azimuth),
    target.y + distance * Math.sin(elevation),
    target.z + horizontal * Math.sin(azimuth),
  );
}

export interface View {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Distance (m) between position and target */
  distance: number;
}

/**
 * The camera pose that fits a sphere of `radius` (plus `padding` metres) around `target`, seen under `azimuth` and
 * `elevation` (radians). Shared by the default floor view and the area focus view.
 */
export function fitView(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  radius: number,
  azimuth: number,
  elevation: number,
  padding: number,
  minDistance = 0,
): View {
  const distance = Math.max(fitSphereDistance(camera, radius + padding), minDistance);
  return { position: orbitPosition(target, azimuth, elevation, distance), target, distance };
}

export interface Frame {
  extent: FloorExtent;
  /** Default view for the current floor and viewport aspect */
  view: View;
}

/** Derives everything that depends on floor shape and viewport aspect, without touching camera or controls. */
export function computeFrame(camera: THREE.PerspectiveCamera, floorData: FloorData, rotation?: number): Frame | null {
  const extent = floorExtent(floorData);
  if (!extent || camera.aspect <= 0) return null;

  const { AZIMUTH_DEG, ELEVATION_DEG, TARGET_Y, PADDING } = FLOOR_VIEW;
  const azimuth = THREE.MathUtils.degToRad(AZIMUTH_DEG - Number(rotation ?? 0));
  const elevation = THREE.MathUtils.degToRad(ELEVATION_DEG);

  const view = fitView(camera, new THREE.Vector3(0, TARGET_Y, 0), fitRadius(extent), azimuth, elevation, PADDING);
  if (![...view.position.toArray(), ...view.target.toArray()].every(Number.isFinite)) return null;

  return { extent, view };
}

/** Dolly limits and far plane. Depend on the framing only, so they stay valid wherever the user moves the camera. */
export function applyFrameLimits(camera: THREE.PerspectiveCamera, controls: OrbitControls, { extent, view }: Frame) {
  const { DOLLY_MAX_FACTOR, DOLLY_MIN_DIST } = CAMERA_LIMITS;
  controls.minDistance = Math.max(DOLLY_MIN_DIST, camera.near * 2);
  controls.maxDistance = Math.max(controls.minDistance, view.distance * DOLLY_MAX_FACTOR);

  // Far plane: camera <= maxDistance from target, target <= extent.radius from origin, content/ground <= its own radius from origin.
  const groundRadius = (STAGE.GROUND_SIZE * Math.SQRT2) / 2;
  const sceneRadius = Math.max(Math.hypot(extent.radius, WALL_HEIGHT), groundRadius);
  const reach = controls.maxDistance + extent.radius + sceneRadius;
  camera.far = Math.max(CAMERA.FAR, reach * 1.01);
  camera.updateProjectionMatrix();
}

/** Centres the model group and puts the camera at the default view of `frame`. Discards any user orbit/pan/dolly. */
export function resetToFrame(group: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: OrbitControls, frame: Frame) {
  const { extent, view } = frame;

  group.position.set(-extent.centerX, 0, -extent.centerY);
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  applyFrameLimits(camera, controls, frame);
  controls.update();
}

/**
 * Adapts the camera to a new viewport aspect without discarding the user's view: azimuth, polar angle and target stay,
 * only the distance is scaled by the ratio of the fit distances. Returns that scale (1 = unchanged).
 */
export function refitToFrame(camera: THREE.PerspectiveCamera, controls: OrbitControls, previous: Frame, next: Frame) {
  const scale = next.view.distance / previous.view.distance;
  if (Number.isFinite(scale) && scale > 0 && scale !== 1) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(scale);
    camera.position.copy(controls.target).add(offset);
  }
  applyFrameLimits(camera, controls, next);
  controls.update();
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Keeps `controls.target` on the floorplan: inside a disc of `radius` around the origin (the model group is centred there)
 * and between ground and wall height. The camera moves by the same offset, so panning simply stops at the edge instead of
 * rotating the view.
 */
export function clampPanTarget(camera: THREE.PerspectiveCamera, controls: OrbitControls, radius: number) {
  const t = controls.target;
  const dist = Math.hypot(t.x, t.z);
  const scale = dist > radius ? radius / dist : 1;
  const y = THREE.MathUtils.clamp(t.y, 0, WALL_HEIGHT);
  const dx = t.x * scale - t.x;
  const dy = y - t.y;
  const dz = t.z * scale - t.z;
  if (dx === 0 && dy === 0 && dz === 0) return;
  t.x += dx;
  t.y += dy;
  t.z += dz;
  camera.position.x += dx;
  camera.position.y += dy;
  camera.position.z += dz;
}
