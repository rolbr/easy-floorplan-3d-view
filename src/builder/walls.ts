// Solid walls with window/door openings, mitered corners

import * as THREE from 'three';
import {
  CORNER_TOLERANCE,
  DOOR_HEIGHT,
  DOOR_OPEN_ANGLE,
  DOOR_THICKNESS,
  GLASS_INSET,
  MIN_TURN_ANGLE_DEG,
  OPENING_TOLERANCE,
  RAILING_HEIGHT,
  toM,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WINDOW_SILL,
  WINDOW_TOP,
} from '../config/constants';
import type { FloorData, FloorplanWall, Point } from '../types';

export interface WallMaterials {
  wallMaterial: THREE.MeshStandardMaterial;
  railMaterial: THREE.MeshStandardMaterial;
  glassMaterial: THREE.MeshStandardMaterial;
  doorMaterial: THREE.MeshStandardMaterial;
}

const MIN_TURN_ANGLE = THREE.MathUtils.degToRad(MIN_TURN_ANGLE_DEG);

// ---------------------------------------------------------------------------
// 2D vector helpers on plain { x, y } objects.
// Corner geometry runs in scene units: wall positions are converted with cm() so they can be
// related to WALL_THICKNESS and wall heights, which constants.js already defines in scene units
// ---------------------------------------------------------------------------

type Vec = Point;

/** A wall's endpoints and unit direction in scene units. */
interface SceneWall {
  p1: Vec;
  p2: Vec;
  u: Vec;
}

/** Cut edge of a wall end in wall-local x; `neg`/`pos` are the two ends of the edge across the wall thickness. */
interface CutLine {
  neg: number;
  pos: number;
}

/** null means a square cut at the nominal endpoint. */
interface WallCuts {
  start: CutLine | null;
  end: CutLine | null;
}

/** One wall end meeting at a corner. `end` is 0 for the start point and 1 for the end point. */
interface WallEnd {
  index: number;
  end: number;
  isRailing: boolean;
}

interface Corner {
  x: number;
  y: number;
  ends: WallEnd[];
}

const vSub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const vAdd = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const vDot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const vScale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const vNegate = (a: Vec): Vec => ({ x: -a.x, y: -a.y });
const vLength = (a: Vec) => Math.hypot(a.x, a.y);
const vNormalize = (a: Vec): Vec => vScale(a, 1 / vLength(a));
const vPerp = (a: Vec): Vec => ({ x: -a.y, y: a.x }); // rotate 90° counter-clockwise

/** Intersection of the infinite lines a + t·da and b + s·db, null if parallel. */
function lineIntersection(a: Vec, da: Vec, b: Vec, db: Vec): Vec | null {
  const denominator = da.x * db.y - da.y * db.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const diff = vSub(b, a);
  const t = (diff.x * db.y - diff.y * db.x) / denominator;
  return vAdd(a, vScale(da, t));
}

/**
 * Find the openings that sit on a wall. Returns them sorted by their
 * projection onto the wall axis, with the distance from the wall start.
 * Tolerances are in source-data centimeters.
 */
function findOpeningsOnWall(wall: FloorplanWall, floorData: FloorData) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];

  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;

  return (floorData.openings || [])
    .map((opening) => {
      const relativeX = opening.x - wall.x1;
      const relativeY = opening.y - wall.y1;

      const projection = relativeX * unitX + relativeY * unitY;
      const perpendicularDistance = Math.abs(relativeX * normalX + relativeY * normalY);

      if (perpendicularDistance > OPENING_TOLERANCE || projection < -OPENING_TOLERANCE || projection > length + OPENING_TOLERANCE) {
        return null;
      }

      return { opening, projection };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.projection - b.projection);
}

/**
 * Group wall endpoints that meet within CORNER_TOLERANCE and decide how each
 * joint is resolved:
 *
 *  - two walls of the same kind (solid/solid or railing/railing) → mitered
 *  - railing meeting a solid wall → the railing is butt-joined into the wall
 *  - near-collinear mixed joints → square end-to-end butt
 *  - anything else (3+ walls, very sharp turns, degenerate data) → round
 *    column; the walls keep plain square ends
 *
 * Returns { cuts, columns }: cuts[i] describes, for wall i, the cut line at
 * its start and/or end in wall-local scene coordinates — `neg`/`pos` are the
 * local x positions where the cut edge crosses across = ±WALL_THICKNESS/2.
 * null means a square cut at the nominal endpoint. columns lists the round
 * fallback columns as { x, y, hasSolid } in scene units.
 */
function analyzeCorners(floorData: FloorData) {
  const walls = floorData.walls || [];
  const halfT = WALL_THICKNESS / 2;
  const cuts = walls.map((): WallCuts => ({ start: null, end: null }));
  const columns: { x: number; y: number; hasSolid: boolean }[] = [];

  const sceneWalls = walls.map((wall) => {
    const p1 = { x: toM(wall.x1), y: toM(wall.y1) };
    const p2 = { x: toM(wall.x2), y: toM(wall.y2) };
    return { p1, p2, u: vNormalize(vSub(p2, p1)) };
  });

  const setCut = (end: WallEnd, cut: CutLine) => {
    cuts[end.index][end.end ? 'end' : 'start'] = cut;
  };

  const squareCut = (wall: SceneWall, point: Vec): CutLine => {
    const pLocal = vDot(vSub(point, wall.p1), wall.u);
    return { neg: pLocal, pos: pLocal };
  };

  // Both walls are cut along the bisector through the centerline
  // intersection, so their miter faces meet exactly.
  const miterCut = (wall: SceneWall, dSelf: Vec, dOther: Vec, point: Vec): CutLine => {
    const u = wall.u;
    const n = vPerp(u);
    const pLocal = vDot(vSub(point, wall.p1), u);
    const bisector = vAdd(dSelf, dOther);
    if (vLength(bisector) < 1e-6) return squareCut(wall, point);
    const w = vNormalize(bisector);
    const slope = vDot(w, u) / vDot(w, n);
    return { neg: pLocal - halfT * slope, pos: pLocal + halfT * slope };
  };

  // The railing's end edge lies in the face plane of the solid wall.
  const buttIntoWallCut = (railing: SceneWall, dRailing: Vec, solid: SceneWall, point: Vec): CutLine => {
    const uR = railing.u;
    const nR = vPerp(uR);
    const uS = solid.u;
    const nS = vPerp(uS);
    const pR = vDot(vSub(point, railing.p1), uR);
    const side = Math.sign(vDot(dRailing, nS));
    const edge = (across: number) => {
      const lambda = (across - side * halfT * vDot(nS, nR)) / vDot(uS, nR);
      return pR + side * halfT * vDot(nS, uR) + lambda * vDot(uS, uR);
    };
    return { neg: edge(-halfT), pos: edge(halfT) };
  };

  // The solid wall's end edge lies along the railing's far side, so the
  // railing's butt ends flush with the wall on the outside of the joint.
  const buttReceiveCut = (solid: SceneWall, dSolid: Vec, railing: SceneWall, point: Vec): CutLine => {
    const uS = solid.u;
    const nS = vPerp(uS);
    const uR = railing.u;
    const nR = vPerp(uR);
    const pS = vDot(vSub(point, solid.p1), uS);
    const side = -Math.sign(vDot(dSolid, nR));
    const edge = (across: number) => {
      const lambda = (across - side * halfT * vDot(nR, nS)) / vDot(uR, nS);
      return pS + side * halfT * vDot(nR, uS) + lambda * vDot(uR, uS);
    };
    return { neg: edge(-halfT), pos: edge(halfT) };
  };

  // Resolves one two-wall joint; returns false when a round column is needed.
  const resolveJoint = (endA: WallEnd, endB: WallEnd) => {
    const a = sceneWalls[endA.index];
    const b = sceneWalls[endB.index];

    // Direction from the shared endpoint into each wall body.
    const dA = endA.end ? vNegate(a.u) : a.u;
    const dB = endB.end ? vNegate(b.u) : b.u;

    // True centerline intersection (in source units, so the sanity clamp
    // shares units with CORNER_TOLERANCE) — robust against endpoints that
    // only match within tolerance. Near-parallel walls fall back to the
    // midpoint between the two endpoints.
    const rawA = walls[endA.index];
    const rawB = walls[endB.index];
    const anchorA = endA.end ? { x: rawA.x2, y: rawA.y2 } : { x: rawA.x1, y: rawA.y1 };
    const anchorB = endB.end ? { x: rawB.x2, y: rawB.y2 } : { x: rawB.x1, y: rawB.y1 };
    let pointCm = lineIntersection(
      { x: rawA.x1, y: rawA.y1 },
      { x: rawA.x2 - rawA.x1, y: rawA.y2 - rawA.y1 },
      { x: rawB.x1, y: rawB.y1 },
      { x: rawB.x2 - rawB.x1, y: rawB.y2 - rawB.y1 },
    );
    if (!pointCm || vLength(vSub(pointCm, anchorA)) > CORNER_TOLERANCE * 4 || vLength(vSub(pointCm, anchorB)) > CORNER_TOLERANCE * 4) {
      pointCm = vScale(vAdd(anchorA, anchorB), 0.5);
    }
    const point = { x: toM(pointCm.x), y: toM(pointCm.y) };

    // Turn angle between the two walls (0° = doubled back, 180° = straight).
    const turn = Math.acos(THREE.MathUtils.clamp(vDot(dA, dB), -1, 1));
    if (turn < MIN_TURN_ANGLE) return false;

    if (endA.isRailing === endB.isRailing) {
      setCut(endA, miterCut(a, dA, dB, point));
      setCut(endB, miterCut(b, dB, dA, point));
      return true;
    }

    // Mixed joint: butt the railing into the solid wall.
    const solidEnd = endA.isRailing ? endB : endA;
    const railingEnd = endA.isRailing ? endA : endB;
    const solid = sceneWalls[solidEnd.index];
    const railing = sceneWalls[railingEnd.index];
    const dSolid = solidEnd === endA ? dA : dB;
    const dRailing = railingEnd === endA ? dA : dB;

    if (turn > Math.PI - MIN_TURN_ANGLE) {
      // The railing continues almost straight out of the wall.
      setCut(solidEnd, squareCut(solid, point));
      setCut(railingEnd, squareCut(railing, point));
      return true;
    }

    setCut(railingEnd, buttIntoWallCut(railing, dRailing, solid, point));
    setCut(solidEnd, buttReceiveCut(solid, dSolid, railing, point));
    return true;
  };

  const corners: Corner[] = [];
  const findCorner = (x: number, y: number): Corner => {
    let corner = corners.find((item) => Math.abs(item.x - x) <= CORNER_TOLERANCE && Math.abs(item.y - y) <= CORNER_TOLERANCE);

    if (!corner) {
      corner = { x, y, ends: [] };
      corners.push(corner);
    }

    return corner;
  };

  walls.forEach((wall, index) => {
    const isRailing = wall.kind === 'railing';
    findCorner(wall.x1, wall.y1).ends.push({ index, end: 0, isRailing });
    findCorner(wall.x2, wall.y2).ends.push({ index, end: 1, isRailing });
  });

  for (const corner of corners) {
    const ends = corner.ends;
    const distinctWalls = new Set(ends.map((end) => end.index));

    if (ends.length === 2 && distinctWalls.size === 2 && resolveJoint(ends[0], ends[1])) {
      continue;
    }

    // Multi-way junctions, very sharp turns and degenerate data get a round
    // column; the walls themselves keep their square ends.
    if (ends.length >= 2) {
      let sumX = 0;
      let sumY = 0;
      for (const end of ends) {
        const wall = walls[end.index];
        sumX += end.end ? wall.x2 : wall.x1;
        sumY += end.end ? wall.y2 : wall.y1;
      }
      columns.push({
        x: toM(sumX / ends.length),
        y: toM(sumY / ends.length),
        hasSolid: ends.some((end) => !end.isRailing),
      });
    }
  }

  return { cuts, columns };
}

export function buildWalls(group: THREE.Group, floorData: FloorData, materials: WallMaterials) {
  const { wallMaterial, railMaterial, glassMaterial, doorMaterial } = materials;
  const { cuts } = analyzeCorners(floorData);

  for (const [wallIndex, wall] of (floorData.walls || []).entries()) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const wallLength = Math.hypot(dx, dy);
    if (wallLength === 0) continue;

    const unitX = dx / wallLength;
    const unitY = dy / wallLength;
    const angle = Math.atan2(dy, dx);

    const isRailing = wall.kind === 'railing';
    const wallHeight = isRailing ? RAILING_HEIGHT : WALL_HEIGHT;
    const wallMat = isRailing ? railMaterial : wallMaterial;
    const openings = findOpeningsOnWall(wall, floorData);
    const cut = cuts[wallIndex];
    const halfT = WALL_THICKNESS / 2;

    let cursor = 0;

    const addWallSegment = (start: number, end: number) => {
      const length = end - start;
      if (length <= 0.001) return;

      // Miter/butt cuts only apply at the wall's own ends; boundaries
      // created by openings stay square.
      const atStart = start <= 0.001 && cut.start;
      const atEnd = end >= wallLength - 0.001 && cut.end;
      let startNeg = atStart ? atStart.neg : toM(start);
      let startPos = atStart ? atStart.pos : toM(start);
      let endNeg = atEnd ? atEnd.neg : toM(end);
      let endPos = atEnd ? atEnd.pos : toM(end);

      // Keep the quad well-formed if an opening reaches into a miter.
      startNeg = Math.min(startNeg, endNeg);
      startPos = Math.min(startPos, endPos);
      endNeg = Math.max(endNeg, startNeg);
      endPos = Math.max(endPos, startPos);

      if (endNeg - startNeg < 0.0001 && endPos - startPos < 0.0001) return;

      // Wall footprint in local scene coordinates: x along the wall, y
      // across. The local across axis maps to shape y = −across after the
      // rotateX below, so `neg` (across = −halfT) sits at shape y = +halfT.
      const shape = new THREE.Shape();
      shape.moveTo(startNeg, halfT);
      shape.lineTo(endNeg, halfT);
      shape.lineTo(endPos, -halfT);
      shape.lineTo(startPos, -halfT);

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: wallHeight,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geometry, wallMat);
      mesh.position.set(toM(wall.x1), 0, toM(wall.y1));
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    for (const { opening, projection } of openings) {
      const gapStart = Math.max(0, projection - opening.length / 2);
      const gapEnd = Math.min(wallLength, projection + opening.length / 2);

      addWallSegment(cursor, gapStart);

      const midpoint = (gapStart + gapEnd) / 2;
      const midX = wall.x1 + unitX * midpoint;
      const midY = wall.y1 + unitY * midpoint;
      const openingLength = gapEnd - gapStart;

      if (opening.type === 'window') {
        const sill = new THREE.Mesh(new THREE.BoxGeometry(toM(openingLength), WINDOW_SILL, WALL_THICKNESS), wallMaterial);
        sill.position.set(toM(midX), WINDOW_SILL / 2, toM(midY));
        sill.rotation.y = -angle;
        sill.castShadow = true;
        sill.receiveShadow = true;
        group.add(sill);

        const lintelHeight = WALL_HEIGHT - WINDOW_TOP;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(toM(openingLength), lintelHeight, WALL_THICKNESS), wallMaterial);
        lintel.position.set(toM(midX), WINDOW_TOP + lintelHeight / 2, toM(midY));
        lintel.rotation.y = -angle;
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        group.add(lintel);

        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(
            Math.max(0.0001, toM(openingLength) - GLASS_INSET),
            Math.max(0.0001, WINDOW_TOP - WINDOW_SILL - GLASS_INSET),
            WALL_THICKNESS * 0.45,
          ),
          glassMaterial,
        );
        glass.position.set(toM(midX), WINDOW_SILL + (WINDOW_TOP - WINDOW_SILL) / 2, toM(midY));
        glass.rotation.y = -angle;
        group.add(glass);
      }

      if (opening.type === 'passage') {
        const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(toM(openingLength), lintelHeight, WALL_THICKNESS), wallMaterial);
        lintel.position.set(toM(midX), DOOR_HEIGHT + lintelHeight / 2, toM(midY));
        lintel.rotation.y = -angle;
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        group.add(lintel);
      }

      if (opening.type === 'door') {
        const lintelHeight = WALL_HEIGHT - DOOR_HEIGHT;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(toM(openingLength), lintelHeight, WALL_THICKNESS), wallMaterial);
        lintel.position.set(toM(midX), DOOR_HEIGHT + lintelHeight / 2, toM(midY));
        lintel.rotation.y = -angle;
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        group.add(lintel);

        const doorAngle = THREE.MathUtils.degToRad(opening.angle ?? 0);
        let angleDifference = doorAngle - angle;
        angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference));

        const isReversed = Math.abs(Math.abs(angleDifference) - Math.PI) < 0.01;
        const effectiveFlipH = isReversed ? !opening.flipH : Boolean(opening.flipH);
        const hingeAtStart = !effectiveFlipH;
        const hingeDistance = hingeAtStart ? gapStart : gapEnd;

        const hingeX = wall.x1 + unitX * hingeDistance;
        const hingeY = wall.y1 + unitY * hingeDistance;

        const doorGeometry = new THREE.BoxGeometry(toM(openingLength), DOOR_HEIGHT, DOOR_THICKNESS);
        doorGeometry.translate(hingeAtStart ? toM(openingLength) / 2 : -toM(openingLength) / 2, 0, 0);

        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        let swing = hingeAtStart ? DOOR_OPEN_ANGLE : -DOOR_OPEN_ANGLE;
        if (isReversed) swing = -swing;

        door.position.set(toM(hingeX), DOOR_HEIGHT / 2, toM(hingeY));
        door.rotation.y = -angle + swing;
        door.castShadow = true;
        door.receiveShadow = true;
        group.add(door);
      }

      cursor = Math.max(cursor, gapEnd);
    }

    addWallSegment(cursor, wallLength);
  }
}

export function buildCorners(group: THREE.Group, floorData: FloorData, materials: WallMaterials) {
  const { columns } = analyzeCorners(floorData);

  for (const column of columns) {
    const height = column.hasSolid ? WALL_HEIGHT : RAILING_HEIGHT;
    const material = column.hasSolid ? materials.wallMaterial : materials.railMaterial;

    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(WALL_THICKNESS / 2, WALL_THICKNESS / 2, height, 24), material);
    mesh.position.set(column.x, height / 2, column.y);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
