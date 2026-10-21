import type { CardConfig } from '../types';
import { TAG_NAMES_DEV, TAG_NAMES_PROD } from './tag-names';

// ---------------------------------------------------------------------------
// Units & dimensions - floorplan source data in centimeters, 3D scene in meters
// ---------------------------------------------------------------------------
/** Convert a floorplan source value (cm) to a scene value (m). */
export const toM = (cm: number) => cm * 0.01;

export const WALL_HEIGHT = 2.5;
export const WALL_THICKNESS = 0.1;
export const RAILING_HEIGHT = 1.0;
export const DOOR_HEIGHT = 2.0;
export const DOOR_THICKNESS = 0.04;
export const DOOR_OPEN_ANGLE = Math.PI * 0.4;
export const WINDOW_SILL = 0.9;
export const WINDOW_TOP = 2.0;
export const GLASS_INSET = 0.0004;

// Tolerances in centimeters.
export const OPENING_TOLERANCE = 5;
export const CORNER_TOLERANCE = 1;

// Joints sharper than this turn angle (the angle between the two walls at the joint)
// would stretch a miter face across many times the wall thickness, so those corners
// fall back to a round column instead. Mixed railing/wall joints flatter than 180°
// minus this angle become simple end-to-end butts.
export const MIN_TURN_ANGLE_DEG = 30;

// Vertical clip plane offset (main.ts slider + cap positions).
export const CLIP_EPSILON = 0.001;

// ---------------------------------------------------------------------------
// Climate / HVAC
// ---------------------------------------------------------------------------

export const HVAC = {
  COLOR_OFF: 0x9aa4ad,
  COLOR_HEAT: 0xff8a00,
  COLOR_COOL: 0x42a5f5,
};

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

export const ICON_SPRITE = {
  CANVAS_SIZE: 128,
  MDI_VIEWBOX: 24,
  WORLD_SIZE: 0.36, // whole sprite / background
  ICON_FRACTION: 0.7, // 70% of sprite diameter
  COLOR: '#ffffff',
};

export const TEXT_SPRITE = {
  //
  NAME_FONT_SIZE: 72,
  NAME_COLOR: '#55ffdd',
  //
  ID_FONT_SIZE: 52,
  ID_COLOR: '#ffffff',
  //
  VALUE_FONT_SIZE: 72,
  VALUE_COLOR: '#111111',
  VALUE_BACKGROUND: '#ffffffdd',
  //
  FONT_WEIGHT: 'normal',
  FONT_FAMILY: 'sans-serif',
  PADDING_X: 20,
  PADDING_Y: 12,
  BORDER_RADIUS: 24,
  SCALE: 0.0025,
  BACKGROUND: '#000000cc',
};

/** Position des gemeinsamen Labels (Name/ID/Values) relativ zum Marker */
export type LabelPositionV = 'top' | 'bottom';
export const LABEL_POSITION_V: LabelPositionV = 'bottom';

// ---------------------------------------------------------------------------
// Marker kind registry
// ---------------------------------------------------------------------------

export const MARKER = {
  SPHERE_SEGMENTS: 28,
  EMISSIVE_INTENSITY: 0.6,
  ROUGHNESS: 1,
  LABEL_COLOR: '#111111',
  LABEL_OFFSET_Y: 0.05,
  SIZE_ICON_FACTOR: 1.0, // icon sprite diameter = size (cm) * this
  ICON_PADDING: 3, // cm
  VALUE_SEPARATOR: ' · ', // between the main value and readings
  GLOW_RADIUS_DEFAULT: 150, // cm
  GLOW_LIGHT_INTENSITY: 8,
  GLOW_LIGHT_RANGE_FACTOR: 3,
  GLOW_LIGHT_DECAY: 1,
  GLOW_SPRITE_OPACITY: 0.9,
  GLOW_SPRITE_MIN_FACTOR: 6,
  GLOW_SPRITE_RANGE_FACTOR: 0.35,
  GLOW_LIGHT_CAST_SHADOW: true,
  GLOW_LIGHT_SHADOW_MAP_SIZE: 512,
  GLOW_LIGHT_SHADOW_BIAS: -0.001,
  GLOW_LIGHT_SHADOW_NORMAL_BIAS: 0.02,
  GLOW_LIGHT_SHADOW_NEAR: 0.1, // (m) min distance for occluders to block light / cast shadow
};

export interface MarkerConfig {
  color: number;
  radius: number; // TODO: make this a `size`
  height: number;
  ripple: { color: number } | null;
}

export const MARKER_CONFIG: Record<string, MarkerConfig> = {
  light: {
    color: 0xf4c542,
    radius: 0.21,
    height: WALL_HEIGHT * 0.8,
    ripple: null,
  },
  binary_sensor: {
    color: 0x5aa9e6,
    radius: 0.08,
    height: WALL_HEIGHT * 0.8,
    ripple: { color: 0x5aa9e6 },
  },
  climate: {
    color: 0xe05d5d,
    radius: 0.21,
    height: WALL_HEIGHT * 0.4,
    ripple: { color: HVAC.COLOR_HEAT },
  },
  switch: {
    color: 0x8fce8f,
    radius: 0.21,
    height: WALL_HEIGHT * 0.4,
    ripple: null,
  },
  _default: {
    color: 0xff00ff,
    radius: 0.08,
    height: 2.5,
    ripple: null,
  },
};

export const markerConfig = (kind: string): MarkerConfig => MARKER_CONFIG[kind] ?? MARKER_CONFIG._default;

// ---------------------------------------------------------------------------
/** Screen-size (CSS px) clamping relative to a reference-sized marker */
export const MARKER_LIMITS = {
  /** (m) A marker of this size is the yardstick for the limits */
  REF_SIZE: ICON_SPRITE.WORLD_SIZE,
  /** mouse/ trackpad */
  FINE: { min: 20, max: 150 },
  /** touch */
  COARSE: { min: 25, max: 100 },
};

// ---------------------------------------------------------------------------
// Marker state visuals
// ---------------------------------------------------------------------------

export const LIGHT_MARKER = {
  EMISSIVE_ON: 1.2,
  EMISSIVE_OFF: 0.15,
};

// Climate and switch markers share the same active/idle emissive levels.
export const STATE_MARKER = {
  EMISSIVE_ACTIVE: 1.0,
  EMISSIVE_IDLE: 0.3,
};

// ---------------------------------------------------------------------------
// Ripple rings
// ---------------------------------------------------------------------------

export const RIPPLE = {
  RING_COUNT: 3,
  RING_INNER: 0.16,
  RING_OUTER: 0.19,
  RING_SEGMENTS: 48,
  REST_OPACITY: 1,
  RENDER_ORDER: 100,
  ANIM_SPEED: 0.35,
  SCALE_MIN: 0.3,
  SCALE_SPAN: 3.2,
  MAX_OPACITY: 0.9,
};

// ---------------------------------------------------------------------------
// Glow texture
// ---------------------------------------------------------------------------

export const GLOW_TEXTURE = {
  CANVAS_SIZE: 256,
  GRADIENT_STEPS: 5,
  GRADIENT_ALPHA: 0.5,
};

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

export const FURNITURE = {
  HEIGHT: {
    _default: 0.5,
    wardrobe: 1.2,
    fridge: 1.8,
    table: 0.42,
    washer: 0.85,
    stove: 0.9,
    dishwasher: 0.85,
  },
  MATERIAL_PARAMS: { color: 0x8899aa, roughness: 0.75 },
};

// ---------------------------------------------------------------------------
// Building materials
// ---------------------------------------------------------------------------

export const WALL_MATERIAL_PARAMS = { color: 0xffffff, roughness: 0.85 };
export const RAIL_MATERIAL_PARAMS = {
  color: 0xb9c4cc,
  roughness: 0.2,
  transparent: true,
  opacity: 0.6,
};
export const GLASS_MATERIAL_PARAMS = {
  color: 0x8ecdf0,
  roughness: 0.05,
  metalness: 0.2,
  transparent: true,
  opacity: 0.3,
};
export const DOOR_MATERIAL_PARAMS = { color: 0x7c6b45, roughness: 0.7 };

// ---------------------------------------------------------------------------
// Clip caps / stencil
// ---------------------------------------------------------------------------

export const CLIP_CAP = {
  MATERIAL_COLOR: 0xb9a98f,
  METALNESS: 0.05,
  ROUGHNESS: 0.9,
  PLANE_SIZE: 2,
  SCALE: 50,
  RENDER_ORDER_START: 1,
};

export const DEFAULT_CLIP_HEIGHT = 1.2;

export const CLIP_TWEEN = {
  DURATION_MS: 500,
  EASING: [0.2, 0, 0.4, 1] as const,
};

// ---------------------------------------------------------------------------

export const AREA = {
  LABEL_HEIGHT: 0.9, // label height above floor
  // Area fill defaults; per-area YAML color/opacity/activeColor override
  FILL_HEIGHT: 0.01,
  FILL_COLOR: '#f0ffff',
  FILL_OPACITY: 0.25,
  HOVER_OPACITY_BOOST: 0.25,
};

export const AREA_VOLUME = {
  DEBUG_VISIBLE: true,
  DEBUG_OPACITY: 0.0,
  SHRINK_CM: 1,
  DEBUG_COLORS: ['#ff4d4d', '#4dff88', '#4d88ff', '#ffd24d', '#d24dff', '#4dfff0', '#ff944d', '#a6ff4d'],
};

export const AREA_VIEW = {
  ELEVATION_DEG: 80, // Camera elevation above the horizontal
  TARGET_Y: 1.4, // target height (m)
  PADDING: 0, // (m) margin added to the fitted sphere's radius; 0 = exact fit
  TRANSITION_MS: 1200,
  EASING: [0.2, 0, 0.4, 1] as const, // cubic-bezier: [0.25, 0.1, 0.25, 1]
};

export const FLOOR_VIEW = {
  ELEVATION_DEG: 40, // Camera elevation above the horizontal
  TARGET_Y: 2.0, // target height (m)
  PADDING: 0, // (m) margin added to the fitted sphere's radius; 0 = exact fit
  AZIMUTH_DEG: 55, // Base viewing direction. YAML `rotation` is applied on top of this
};

export const CAMERA = {
  FOV: 20,
  NEAR: 0.1,
  FAR: 200, // placeholder, before model is loaded
};

export const CAMERA_LIMITS = {
  // Elevations must contain FLOOR_VIEW and AREA_VIEW elevations, or controls clamp the view right after it is set
  ELEVATION_DEG_MAX: 85, // vertical, top-down
  ELEVATION_DEG_MIN: 10, // horizontal, ground plane
  DOLLY_MAX_FACTOR: 2, // maxDistance = default view distance × this; keeps the floor from shrinking to a few px
  DOLLY_MIN_DIST: 5, // (m) closest the camera may get to its target
};

export const STAGE = {
  BACKGROUND: 0xdfe7ec,
  GROUND_COLOR: 0xc8dedf,
  GROUND_SIZE: 120,
  HEMISPHERE: { sky: 0xcceeff, ground: 0x7a8791, intensity: 2 },
  SUN: {
    color: 0xffeecc,
    intensity: 0.6,
    position: [4, 6, 3] as const,

    shadowMapSize: 1024,
    shadowBias: -0.00001,
    shadowNormalBias: 0.1,

    // Orthographic shadow-camera volume, in scene metres
    shadowCameraSize: 6, // 9 = 18m square
    shadowCameraNear: 0.5,
    shadowCameraFar: 60,
  },
  MAX_PIXEL_RATIO: 2,
  RENDERER: {
    // TONE_MAPPING: "ACESFilmicToneMapping",
    // TONE_MAPPING: "CineonToneMapping",
    // TONE_MAPPING: "AgXToneMapping",
    // TONE_MAPPING: "NeutralToneMapping",
    // TONE_MAPPING: "NoToneMapping",
    TONE_MAPPING_EXPOSURE: 0.8, // overall brightness
  },
};

export const TOOLTIP = {
  OFFSET_X: 12,
  OFFSET_Y: -12,
};

export const TAG_NAMES = __DEV_BUILD__ ? TAG_NAMES_DEV : TAG_NAMES_PROD;
export const FLOORPLAN_CARD_TYPE = 'custom:easy-floorplan-card';

// When true, scene.js exposes window.__ha_renderer / window.__ha_scene for console-based debugging.
export const DEBUG = false;

export const CARD_CONFIG: CardConfig = {
  source: {
    card_type: FLOORPLAN_CARD_TYPE,
    dashboard: '',
    view: '',
    floor_id: '',
  },
};

export const STATUS_COLORS = {
  IDLE: '#888',
  OK: '#222',
  ERROR: '#a00',
};

/** Day/night lighting driven by the sun elevation (degrees). */
export const DAYLIGHT = {
  SUN_DISTANCE: 15,
  MOON_COLOR: 0x9db4ff,
  MOON_MAX_INTENSITY: 0.7, // at full moon, clear night
  MOON_MIN_INTENSITY: 0.2, // at new moon, before elevation/daylight fades
  MOON_FADE_RANGE: [-2, 8] as const, // moon elevation (deg) for fade-in
  MOON_SUN_FADE_RANGE: [-6, 4] as const, // sun elevation (deg): moon fades out as sun rises
  SUN_MAX_INTENSITY: 1,
  SUN_COLOR_LOW: 0xff8a3d,
  SUN_COLOR_HIGH: 0xffeecc,
  SUN_COLOR_RANGE: [0, 25] as const,
  SUN_FADE_RANGE: [-2, 8] as const,
  MIN_SHADOW_ELEVATION: 3,
  DEFAULT_LAT: 50.0,
  DEFAULT_LON: 8.27,
  DEFAULT_NORTH_OFFSET: 0,
  TICK_MS: 60_000,
  RING_STOPS: [0.3, 0.6, 0.9] as const, // radius fraction where each ring colour is fully reached; after the last one it fades to the horizon colour
  RING_FALLBACK_DARKEN: [0.85, 0.7, 0.55] as const, // used when a keyframe has no `ring: [c1, c2, c3]`: floor colour x factor
  KEYFRAMES: [
    /* Optional per keyframe: ring: [0xRRGGBB, 0xRRGGBB, 0xRRGGBB] = ground gradient colours at STAGE.RING_STOPS */
    /*     HL=HemisphereLight      HL.color       HL.groundColor    HL brightness   floor plane            optional: ground gradient at STAGE.RING_STOPS   scene.background aka sky   
    /* night   */ { elevation: -8, sky: 0x3b5287, ground: 0x242f3e, intensity: 1.2, floor: 0x4b7d8f, background: 0x0f1e38 },
    /* horizon */ {
      elevation: 0,
      sky: 0xf0a878,
      ground: 0x6b5a5a,
      intensity: 1.5,
      floor: 0x7d8a8c,
      ring: [0x3e4546, 0x323738, 0x1c2020],
      background: 0x8a7f8f,
    },
    /* noon    */ { elevation: 12, sky: 0xcceeff, ground: 0x7a8791, intensity: 2.0, floor: 0xc8dedf, background: 0xdfe7ec },
  ],
} as const;
