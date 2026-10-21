import { toM, WALL_HEIGHT } from '../config/constants';
import type { FloorData, Point } from '../types';

export interface FloorExtent {
  /** All values in metres. Centre of the bounding box in plan coordinates */
  centerX: number;
  centerY: number;
  width: number;
  depth: number;
  /** Horizontal distance from the box centre to the farthest point */
  radius: number;
}

/** All plan points (cm) of walls, areas and items. Openings and furniture sit on walls/in areas, so they are not needed. */
function collectPoints(floor: FloorData): Point[] {
  const points: Point[] = [];
  for (const w of floor.walls ?? []) points.push({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
  for (const a of floor.areas ?? []) points.push(...(a.points ?? []));
  for (const i of floor.items ?? []) points.push({ x: i.x, y: i.y });
  return points;
}

/** Footprint (in metres) of plan points (cm). Returns null if there are no valid points. */
export function pointsExtent(points: Point[]): FloorExtent | null {
  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (valid.length === 0) return null;

  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const radiusCm = Math.max(...valid.map((p) => Math.hypot(p.x - centerX, p.y - centerY)));
  return {
    centerX: toM(centerX),
    centerY: toM(centerY),
    width: toM(maxX - minX),
    depth: toM(maxY - minY),
    radius: toM(radiusCm),
  };
}

/** Footprint (in metres) of everything the user can see or click. Returns null for an empty floor. */
export function floorExtent(floor: FloorData): FloorExtent | null {
  return pointsExtent(collectPoints(floor));
}

/** Radius (m) of a sphere around the footprint extruded to wall height: the size to fit into the view */
export function fitRadius(extent: FloorExtent) {
  return 0.5 * Math.hypot(extent.width, extent.depth, WALL_HEIGHT);
}
