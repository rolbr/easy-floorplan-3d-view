/**
 * Marker Color Resolver
 * =====================
 * Pure mapping: HA entity state -> marker colors. No three.js access.
 * Counterpart to icon-resolver.ts/resolveIcon.
 *
 * resolveVisuals(kind, entity, baseColor) returns:
 *   {
 *     color,              // body color (hex number or css string)
 *     emissive,           // emissive color
 *     emissiveIntensity,  // number
 *     iconColor,          // glyph color
 *     iconBackground,     // icon background color
 *     rippleColor,        // hex number, for ripple rings (climate)
 *     active,             // boolean, for light/glow visibility
 *   }
 */

import type { HassEntity, MarkerKind, MarkerVisuals } from '../types';

type Resolver = (entity: HassEntity | undefined, baseColor: number) => MarkerVisuals;

import { HVAC, ICON_SPRITE, LIGHT_MARKER, MARKER, STATE_MARKER, TEXT_SPRITE } from '../config/constants';

const ON_COLOR = MARKER.LABEL_COLOR;
const BG_COLOR = TEXT_SPRITE.BACKGROUND;

const toCss = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export function isEntityActive(kind: MarkerKind | '', entity: HassEntity | undefined) {
  if (!entity) return false;
  if (kind === 'climate') return entity?.attributes?.hvac_action !== 'idle';
  return entity.state === 'on';
}

// ---------------------------------------------------------------------------
// Per-kind resolvers
// ---------------------------------------------------------------------------

function activeVisuals(intensity: number, background: string, extra: Partial<MarkerVisuals> = {}): MarkerVisuals {
  return {
    color: ON_COLOR,
    emissive: ON_COLOR,
    emissiveIntensity: intensity,
    iconColor: ON_COLOR,
    iconBackground: background,
    active: true,
    ...extra,
  };
}

function idleVisuals(intensity: number, baseColor: number, extra: Partial<MarkerVisuals> = {}): MarkerVisuals {
  return {
    color: baseColor,
    emissive: baseColor,
    emissiveIntensity: intensity,
    iconColor: ICON_SPRITE.COLOR,
    iconBackground: BG_COLOR,
    active: false,
    ...extra,
  };
}

const RESOLVERS: Record<MarkerKind, Resolver> = {
  light(entity, baseColor) {
    return isEntityActive('', entity)
      ? activeVisuals(LIGHT_MARKER.EMISSIVE_ON, '#ffd600')
      : idleVisuals(LIGHT_MARKER.EMISSIVE_OFF, baseColor);
  },

  switch(entity, baseColor) {
    return isEntityActive('', entity)
      ? activeVisuals(STATE_MARKER.EMISSIVE_ACTIVE, '#00e676')
      : idleVisuals(STATE_MARKER.EMISSIVE_IDLE, baseColor);
  },

  climate(entity, baseColor) {
    const modeColors: Record<string, number | null> = {
      off: HVAC.COLOR_OFF,
      heat: HVAC.COLOR_HEAT,
      cool: HVAC.COLOR_COOL,
      auto: null,
      heat_cool: null,
      dry: null,
      fan_only: null,
    };
    const actionColors: Record<string, number | null> = {
      idle: null,
      heating: HVAC.COLOR_HEAT,
      cooling: HVAC.COLOR_COOL,
      drying: null,
      fan: null,
      defrosting: null,
      preheating: HVAC.COLOR_HEAT,
    };

    const modeColor = modeColors[entity?.state ?? ''] ?? baseColor;
    const action = String(entity?.attributes?.hvac_action ?? '');
    const rippleColor = actionColors[action] ?? baseColor;
    return isEntityActive('climate', entity)
      ? activeVisuals(STATE_MARKER.EMISSIVE_ACTIVE, toCss(modeColor), {
          rippleColor,
        })
      : idleVisuals(STATE_MARKER.EMISSIVE_IDLE, modeColor, { rippleColor });
  },
};

/**
 * @param kind       marker kind ("light" | "switch" | "climate")
 * @param entity     HA state object (may be undefined)
 * @param baseColor  marker base color (hex number)
 * @returns          visuals or null
 */
export function resolveVisuals(kind: MarkerKind, entity: HassEntity | undefined, baseColor: number): MarkerVisuals | null {
  const resolver = RESOLVERS[kind];
  if (!resolver) return null;
  return resolver(entity, baseColor);
}
