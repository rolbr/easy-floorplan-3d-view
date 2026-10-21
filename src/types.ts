import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import type { Object3D } from 'three';
import type { FLOORPLAN_CARD_TYPE } from './config/constants';

export type { HassEntity } from 'home-assistant-js-websocket';

export type MarkerKind = 'light' | 'switch' | 'climate';

export type MarkerVisuals = {
  rippleColor?: number;
  color: THREE.ColorRepresentation;
  emissive: THREE.ColorRepresentation;
  emissiveIntensity: number;
  iconColor: string;
  iconBackground: string;
  active: boolean;
};

export interface MoreInfoDetail {
  entityId: string;
}

export interface PickingOptions {
  getAreaMeshes?: () => Object3D[];
  isHoverLabelEnabled?: () => boolean;
  onAreaClick?: (area: Object3D | null) => void;
}

export type Limits = {
  min: number;
  max: number;
};

export type NorthMarkerConfig = {
  /** Show the north marker. Default true. */
  visible?: boolean;
  /** Distance from the floorplan center, as a multiple of the footprint size. Default 1. */
  distance?: number;
  /** Arrow head width (scene units). Default 0.6. */
  width?: number;
  /** Arrow head length (scene units). Default 5. */
  length?: number;
};

/** 
  ```
  type: custom:your-card
  # Fixed size: min === max gives markers a constant size at any zoom, maintaining ratios between markers
  # Effectively disabling clamp: min: 0 and max: 100000
  marker_screen:
    min: 24          # both device groups
    max: 64
    coarse:          # touch overrides
      min: 32
    fine:            # mouse overrides
      max: 48
  ```
*/
export type CardConfig = {
  /** Compass bearing (degrees) the scene -Z axis points to. Default 0. */
  north_offset?: number;
  north_marker?: NorthMarkerConfig;
  source: SourceConfig;
  height?: number;
  card_size?: string; // string, number?
  marker_size_limits?: MarkerSizeLimits;
};
// Fixed size: min === max gives markers a constant size at any zoom, maintaining ratios between markers
// Effectively disabling clamp: min: 0 and max: 100000

export type SourceConfig = {
  dashboard?: string;
  view?: string;
  card_type?: string;
  /** n-th source card within the view (traversal order). Omitted = first card. */
  card_index?: number;
  floor_id?: string;
  /** Optional area to focus when the floor initially loads. */
  area_id?: string;
};

// ----  ----

export type HomeAssistant = {
  config?: {
    latitude?: number;
    longitude?: number;
    time_zone?: string;
    unit_system?: { temperature?: string };
  };
  connection: Connection;
  states: HassEntities;
  // add more only when tsc asks for them, e.g.:
  // callService(domain: string, service: string, data?: Record<string, unknown>): Promise<void>;
};

// ---- Generic Lovelace ----
export type DashboardConfig = {
  views: LovelaceView[];
  title?: string;
};

export type LovelaceView = {
  type?: string; // "sections"
  path?: string;
  title?: string;
  icon?: string;
  max_columns?: number;
  top_margin?: boolean;
  sections?: LovelaceSection[];
  cards?: LovelaceCardConfig[];
  badges?: unknown[];
  header?: Record<string, unknown>;
  background?: Record<string, unknown>;
};

export type LovelaceSection = {
  type: string; // "grid"
  cards: LovelaceCardConfig[];
  column_span?: number;
  visibility?: Array<{ condition: string; media_query?: string }>;
  background?: { color?: string; opacity?: number };
};

/** Any card. Unknown keys are allowed, because HA and third-party cards define their own. */
export type LovelaceCardConfig = {
  type: string;
  entity?: string;
  grid_options?: GridOptions;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  [key: string]: unknown;
};

export type GridOptions = {
  columns?: number | 'full';
  rows?: number | 'auto';
};

export type ActionConfig = {
  action: string; // "more-info" | "toggle" | "navigate" | "url" | ...
  navigation_path?: string;
  url_path?: string;
};

// ---- Your floorplan card ----
export type Point = { x: number; y: number };

export type FloorplanWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind?: 'railing' | (string & {});
};

export type FloorplanOpening = {
  id: string;
  type: 'window' | 'door' | 'passage';
  x: number;
  y: number;
  length: number;
  angle: number;
  motion?: string;
  sash?: string;
  flipH?: boolean;
};

export type FloorplanItem = {
  id: string;
  entity: string;
  x: number;
  y: number;
  // `kind: "railing" | (string & {})` keeps editor autocomplete for known values but still accepts others
  kind: 'light' | 'switch' | 'climate' | 'sensor' | 'binary_sensor' | 'generic' | (string & {});
  size?: number;
  showState?: boolean;
  showIcon?: boolean;
  showName?: boolean;
  glow?: boolean;
  glowRadius?: number;
  display?: string;
  badgeContent?: string;
  iconAnimation?: string;
  icon?: string;
  angle?: number;
  attribute?: string;
  readings?: Array<{ entity?: string; attribute?: string; showState?: boolean }>;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
};

export type FloorplanText = {
  id: string;
  x: number;
  y: number;
  size: number;
  entity?: string;
};

export type FloorplanFurniture = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
};

export type FloorplanArea = {
  id: string;
  name?: string;
  haArea?: string;
  entity?: string;
  points: Point[];
  showName?: boolean;
  color?: string;
  activeColor?: string;
  opacity?: number;
  zoom?: number;
  filterEntities?: boolean;
};

export type FloorData = {
  id: string;
  name: string;
  walls: FloorplanWall[];
  openings: FloorplanOpening[];
  items: FloorplanItem[];
  texts: FloorplanText[];
  furniture: FloorplanFurniture[];
  trackers: unknown[];
  areas: FloorplanArea[];
};

export interface FloorplanCardConfig extends LovelaceCardConfig {
  type: typeof FLOORPLAN_CARD_TYPE;
  width: number;
  height: number;
  grid: number;
  overlayScale?: string;
  floors: FloorData[];
  view?: string; // "3d"
  wallHeight?: number;
  background?: string;
  skin?: string;
  snap?: number;
  wallOpacity?: number;
  ambientDaylight?: boolean;
  sunDimming?: boolean;
  sunBrightnessMax?: number;
  sunBrightnessMin?: number;
  showDeadSpaces?: boolean;
  zoomedOverlayScale?: number;
  overlayMinWidth?: number;
  rotation?: number;
}

import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ResizeHandler = (entries: ResizeObserverEntry[]) => void;

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  resizeObserver: ResizeObserver;
}

/** A problem found while building the model that the user should see (e.g. unknown entity). */
export interface BuildIssue {
  itemId: string;
  entity: string;
  message: string;
}

export interface FloorplanModel {
  group: THREE.Group;
  pickableItems: Marker[];
  furnitureGroup: THREE.Group;
  itemsGroup: THREE.Group;
  glowGroup: THREE.Group;
  clipPlane: THREE.Plane;
  clipCaps: ClipCaps;
  stencilCapGroup: THREE.Group;
  issues: BuildIssue[];
}

/** Subset of the built model the card keeps for updates and toggles. */
export interface FloorRefs extends Pick<FloorplanModel, 'pickableItems' | 'furnitureGroup' | 'itemsGroup' | 'glowGroup'> {
  areaLabelGroup: THREE.Group;
}

export interface AreaController {
  handleClick(mesh: THREE.Object3D | null): void;
  focusArea(areaId: string, volumes: THREE.Object3D[]): boolean;
  getActiveAreaId(): string | null;
  /** Forget the saved default view after the camera was reset; the focused area stays active */
  clearSavedView(): void;
  /** Viewport aspect changed: rescales the saved default view by `scale` and re-fits the focused area, if any */
  refit(scale: number, volumes: THREE.Object3D[]): void;
  /** Advance the running camera transition; `now` is the frame timestamp (ms, performance.now() clock) */
  updateTween(now: number): void;
}

export interface ClipCaps {
  rebuildClipCaps(group: THREE.Object3D, stencilCapGroup: THREE.Group): void;
  setContrast(contrast: boolean): void;
  /** Floor base colour; contrast caps are lit like the floor, then inverted. */
  setContrastFloorColor(color: THREE.Color): void;
}

export interface LabelOpts {
  showName: boolean;
  showId: boolean;
}

/** Custom data builder/items.ts attaches to every marker mesh. */
export interface MarkerUserData {
  entity: string;
  kind: MarkerKind;
  label: string;
  color: number;
  iconSprite?: THREE.Sprite;
  labelSprite?: THREE.Sprite;
  labelOffset?: number;
  nameLines?: TextLine[];
  valueLines?: TextLine[];
  pointLight?: THREE.PointLight;
  glowSprite?: THREE.Sprite;
  glowFallbackColor?: THREE.ColorRepresentation;
  rippleGroup?: THREE.Group;
  showState?: boolean;
  readings?: Array<{ entity: string; attribute: string | null }>;
  attribute?: string | null;
  iconRequest?: number;
  /** Icon chosen in the floorplan config; wins over the entity icon. */
  configIcon?: string;
  /** Unscaled sizes; updateMarkerScales multiplies these by the per-frame factor. */
  baseIconScale?: number;
  baseRippleScale?: number;
  baseLabelOffset?: number;
}

export type Marker = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> & { userData: MarkerUserData };

/** Screen-size limits (CSS px) of a default-sized marker */
export type MarkerSizeLimits = Partial<Limits> & {
  /** Overrides for touch devices */
  coarse?: Partial<Limits>;
  /** Overrides for mouse / trackpad */
  fine?: Partial<Limits>;
};

/** Custom data builder/areas.ts attaches to area meshes (used for hover highlight and tooltips). */
export interface AreaUserData {
  isArea?: boolean;
  isAreaVolume?: boolean;
  areaId: string;
  name?: string;
  color: THREE.ColorRepresentation;
  activeColor: THREE.ColorRepresentation;
  restOpacity: number;
  /** Area center in model-local scene units (floor meshes only). */
  centroid?: THREE.Vector3;
  /** Larger footprint extent in scene units, drives the zoom distance. */
  /** Fit radius (m): sphere around the area footprint extruded to wall height */
  radius: number;
  /** Pick volumes point back to their visible floor mesh. */
  floorMesh?: AreaMesh;
}

export type AreaMesh = THREE.Mesh<THREE.ShapeGeometry | THREE.ExtrudeGeometry, THREE.MeshBasicMaterial> & { userData: AreaUserData };

/**
 * A floor as the card consumes it: the floor itself plus settings that live one level
 * above `floors` in the source card's YAML (and therefore are not part of FloorData).
 */
export interface LoadedFloor {
  floor: FloorData;
  rotation?: number;
}

/** One line of text in a label sprite. */
export interface TextLine {
  text: string;
  color: string;
  fontSize: number;
  background?: string; // optional strip behind this line
}
