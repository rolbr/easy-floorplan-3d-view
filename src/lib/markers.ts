// Maps Home Assistant entity state to marker visuals and animates sensor ripple rings

import type { HomeAssistant } from 'home-assistant-frontend-types';
import * as THREE from 'three';
import { LABEL_POSITION_V, MARKER, MARKER_LIMITS, RIPPLE, TEXT_SPRITE } from '../config/constants';
import type { HassEntity, LabelOpts, Limits, Marker, MarkerSizeLimits, TextLine } from '../types';
import { loadIconPath } from './icon-path';
import { resolveIcon } from './icon-resolver';
import { log } from './logger';
import { FALLBACK_ICON, loadMdiPath, updateIconSprite, updateLabelSprite } from './sprites';
import { isEntityActive, resolveVisuals } from './vis-resolver';

// rotate vector perpendicular to camera plane, so labels are spaced from marker on 2D sceen, not 3D world
const _up = new THREE.Vector3();

type Visuals = NonNullable<ReturnType<typeof resolveVisuals>>;
type RippleRing = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

const _camPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _pos = new THREE.Vector3();

/** First value that is a finite number >= 0, else undefined. Ignores bad YAML. */
const firstValidNum = (...values: unknown[]) => values.find((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);

/** Merge YAML overrides over the constants for one device group. */
export function resolveMarkerSizeLimits(config: MarkerSizeLimits | undefined, isCoarse: boolean): Limits {
  const getLimits = (isCoarse: boolean): Limits => (isCoarse ? MARKER_LIMITS.COARSE : MARKER_LIMITS.FINE);
  const _default = getLimits(isCoarse);
  const group = isCoarse ? config?.coarse : config?.fine;

  const min = firstValidNum(group?.min, config?.min) ?? _default.min;
  let max = firstValidNum(group?.max, config?.max) ?? _default.max;
  if (max < min) max = min; // config.min: 100 overrides _default.max: 70
  return { min, max };
}

/** Tracks primary pointer input type (touch | mouse) and exposes the matching limits. */
export function watchMarkerLimits(initial?: MarkerSizeLimits) {
  const mq = window.matchMedia('(pointer: coarse)');
  let _config = initial;
  let _limits = resolveMarkerSizeLimits(_config, mq.matches);

  const onChange = (e: MediaQueryListEvent) => {
    _limits = resolveMarkerSizeLimits(_config, e.matches);
  };
  mq.addEventListener('change', onChange);

  return {
    get: () => _limits,
    setConfig(config: MarkerSizeLimits) {
      _config = config;
      _limits = resolveMarkerSizeLimits(_config, mq.matches);
    },
    dispose: () => mq.removeEventListener('change', onChange),
  };
}

/**
 * Scales every marker (sphere, icon, ripple, label) by one shared factor s(depth), so a
 * reference-sized marker stays within [min, max] CSS px on screen. Because the factor
 * multiplies each marker's base size, size ratios between markers are preserved.
 */
export function updateMarkerScales(
  pickableItems: Marker[] | undefined,
  camera: THREE.PerspectiveCamera,
  viewportHeightPx: number,
  limits: Limits,
) {
  if (!pickableItems?.length || viewportHeightPx <= 0) return;

  camera.getWorldPosition(_camPos);
  camera.getWorldDirection(_camDir);
  const k = (viewportHeightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * camera.zoom;
  const refPx = MARKER_LIMITS.REF_SIZE * k; // on-screen px of the reference marker at depth 1

  for (const marker of pickableItems) {
    marker.getWorldPosition(_pos);
    const depth = Math.max(_pos.sub(_camPos).dot(_camDir), camera.near);
    const px = refPx / depth;
    const s = THREE.MathUtils.clamp(px, limits.min, limits.max) / px;

    const { iconSprite, rippleGroup, labelSprite, baseIconScale, baseRippleScale, baseLabelOffset } = marker.userData;

    marker.scale.setScalar(s);
    if (iconSprite && baseIconScale != null) iconSprite.scale.set(baseIconScale * s, baseIconScale * s, 1);
    if (rippleGroup && baseRippleScale != null) rippleGroup.scale.setScalar(baseRippleScale * s);
    const base = labelSprite?.userData.baseScale;
    if (labelSprite && base) labelSprite.scale.set(base.x * s, base.y * s, 1);
    if (baseLabelOffset != null) marker.userData.labelOffset = baseLabelOffset * s;
  }
}

export function updateLabelPositions(pickableItems: Marker[] | undefined, camera: THREE.Camera) {
  _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const dir = LABEL_POSITION_V === 'top' ? 1 : -1;

  for (const marker of pickableItems ?? []) {
    const { labelSprite, labelOffset } = marker.userData;
    if (labelSprite?.visible) labelSprite.position.copy(marker.position).addScaledVector(_up, dir * (labelOffset ?? 0));
  }
}

/** Combine name/id lines and value lines into the single label sprite. */
function applyLabel(marker: Marker) {
  const sprite = marker.userData.labelSprite;
  if (!sprite) return;
  const lines: TextLine[] = [...(marker.userData.nameLines ?? []), ...(marker.userData.valueLines ?? [])];
  updateLabelSprite(sprite, lines);
}

/** Resolve the entity's MDI id to an SVG pathData and apply it to the sprite. */
async function setEntityIcon(
  sprite: THREE.Sprite | undefined,
  entity: HassEntity,
  color: Visuals['iconColor'],
  backgroundColor: Visuals['iconBackground'],
  configIcon?: string,
  fallbackIcon = FALLBACK_ICON,
) {
  if (!sprite) return;
  // Newest request wins -- older, slower responses are discarded
  const nextIconRequest = (sprite.userData.iconRequest ?? 0) + 1;
  sprite.userData.iconRequest = nextIconRequest;
  const token = nextIconRequest;

  let pathData: string;
  try {
    const iconId = configIcon ?? resolveIcon(entity);
    if (!iconId) throw new Error(`No icon for ${entity.entity_id}`);
    pathData = await loadMdiPath(iconId);
  } catch (err) {
    log.error('icon load failed', err);
    try {
      pathData = await loadIconPath(fallbackIcon);
    } catch {
      return; // HA cannot resolve the fallback either: leave the sprite as is
    }
  }
  if (sprite.userData.iconRequest !== token) return;
  updateIconSprite(sprite, pathData, color, backgroundColor);
}

export function updateEntityLabels(
  hass: HomeAssistant | undefined,
  pickableItems: Marker[] | undefined,
  { showName = false, showId = false }: Partial<LabelOpts> = {},
) {
  for (const marker of pickableItems ?? []) {
    const sprite = marker.userData.labelSprite;
    if (!sprite) continue;

    const id = marker.userData.entity;
    const lines: TextLine[] = [];

    if (showName) {
      const name = hass?.states?.[id]?.attributes?.friendly_name || '""';
      lines.push({
        text: name,
        color: TEXT_SPRITE.NAME_COLOR,
        fontSize: TEXT_SPRITE.NAME_FONT_SIZE,
      });
    }
    if (showId) {
      lines.push({
        text: id,
        color: TEXT_SPRITE.ID_COLOR,
        fontSize: TEXT_SPRITE.ID_FONT_SIZE,
      });
    }
    marker.userData.nameLines = lines;
    applyLabel(marker);
  }
}

function formatValue(hass: HomeAssistant | undefined, id: string, { attribute = null }: { attribute?: string | null } = {}) {
  const st = hass?.states?.[id];
  if (!st) return 'missing';

  const attrs = st.attributes ?? {};
  const domain = id.split('.')[0];
  let string: string;

  if (attribute) {
    const raw = attrs[attribute];
    if (raw == null) {
      // Attribute missing: HA shows "Unbekannt" for the attribute, independent of the entity state
      return hass?.localize?.('state.default.unknown') || 'unknown';
    }
    const formatted: string | undefined = hass?.formatEntityAttributeValue?.(st, attribute);
    if (formatted) {
      string = formatted; // HA: localized decimal separator + unit
    } else {
      // Fallback: Intl number formatting + unit from the weather attributes
      const unitByAttr: Record<string, string | undefined> = {
        temperature: attrs.temperature_unit ?? hass?.config?.unit_system?.temperature,
        apparent_temperature: attrs.temperature_unit ?? hass?.config?.unit_system?.temperature,
        dew_point: attrs.temperature_unit ?? hass?.config?.unit_system?.temperature,
        humidity: '%',
        cloud_coverage: '%',
        wind_speed: attrs.wind_speed_unit,
        wind_gust_speed: attrs.wind_speed_unit,
        pressure: attrs.pressure_unit,
        visibility: attrs.visibility_unit,
        precipitation: attrs.precipitation_unit,
      };
      const unit = unitByAttr[attribute] ?? '';
      const lang = hass?.locale?.language ?? hass?.language;
      const num = typeof raw === 'number' ? new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(raw) : String(raw);
      string = `${num}${unit ? ` ${unit}` : ''}`;
    }
  } else if (st.state === 'unavailable' || st.state === 'unknown') {
    string = hass?.formatEntityState?.(st) || hass?.localize?.(`state.default.${st.state}`) || st.state;
  } else if (domain === 'weather') {
    // Localized condition (e.g. "clear-night" -> "Klare Nacht") as provided by HA
    string = hass?.formatEntityState?.(st) || hass?.localize?.(`component.weather.entity_component._.state.${st.state}`) || st.state;
  } else if (domain === 'climate') {
    // Show the action (heating/idle/...) where HA normally shows the state
    const action: string | undefined = attrs.hvac_action;
    if (action) {
      string =
        hass?.formatEntityAttributeValue?.(st, 'hvac_action') ||
        hass?.localize?.(`component.climate.entity_component._.state_attributes.hvac_action.state.${action}`) ||
        action;
    } else {
      string = hass?.formatEntityState?.(st) || st.state;
    }
  } else {
    // HA: localized decimal separator, unit and state names (e.g. "on" -> "Ein")
    const localized: string | undefined = hass?.formatEntityState?.(st);
    if (localized) {
      string = localized;
    } else {
      const unit = attrs.unit_of_measurement;
      string = `${st.state}${unit ? ` ${unit}` : ''}`;
    }
  }

  const name = ''; // attrs.friendly_name;
  return name ? `${name}: ${string}` : string;
}

export function updateEntityValues(hass: HomeAssistant | undefined, pickableItems: Marker[] | undefined) {
  for (const marker of pickableItems ?? []) {
    if (!marker.userData.labelSprite) continue;

    const { entity, showState, readings, attribute } = marker.userData;
    const parts: string[] = [];
    if (showState) parts.push(formatValue(hass, entity, { attribute }));
    for (const r of readings ?? []) parts.push(formatValue(hass, r.entity, { attribute: r.attribute }));

    marker.userData.valueLines = parts.length
      ? [
          {
            text: parts.join(MARKER.VALUE_SEPARATOR),
            color: TEXT_SPRITE.VALUE_COLOR,
            fontSize: TEXT_SPRITE.VALUE_FONT_SIZE,
            background: TEXT_SPRITE.VALUE_BACKGROUND,
          },
        ]
      : [];
    applyLabel(marker);
  }
}

// ---------------------------------------------------------------------------
// State derivation (pure — no three.js writes)
// ---------------------------------------------------------------------------

export function isMarkerActive(hass: HomeAssistant | undefined, marker: Marker) {
  return isEntityActive(marker.userData.kind, hass?.states?.[marker.userData.entity]);
}

function applyVisuals(marker: Marker, entity: HassEntity | undefined, vis: Visuals) {
  const { material, userData } = marker;
  material.color.set(vis.color);
  material.emissive.set(vis.emissive);
  material.emissiveIntensity = vis.emissiveIntensity;
  if (userData.pointLight) userData.pointLight.visible = vis.active;
  if (userData.glowSprite) userData.glowSprite.visible = vis.active;

  // Glow follows the colour currently set in HA, else the configured fallback
  if (vis.active && (userData.pointLight || userData.glowSprite)) {
    const rgb = entity?.attributes?.rgb_color as number[] | undefined;
    const color =
      Array.isArray(rgb) && rgb.length >= 3
        ? new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
        : new THREE.Color(userData.glowFallbackColor);
    userData.pointLight?.color.copy(color);
    (userData.glowSprite?.material as THREE.SpriteMaterial | undefined)?.color.copy(color);
  }
  if (entity) setEntityIcon(userData.iconSprite, entity, vis.iconColor, vis.iconBackground, userData.configIcon);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function updateEntityStates(hass: HomeAssistant | undefined, pickableItems: Marker[] | undefined) {
  for (const marker of pickableItems ?? []) {
    const { kind, entity: id, color } = marker.userData;
    const entity = hass?.states?.[id];
    const visuals = resolveVisuals(kind, entity, color);
    if (!visuals) continue;
    applyVisuals(marker, entity, visuals);
  }
}

export function updateSensorRipples(
  hass: HomeAssistant | undefined,
  pickableItems: Marker[] | undefined,
  camera: THREE.Camera,
  timeSeconds: number,
) {
  for (const marker of pickableItems ?? []) {
    const rippleGroup = marker.userData.rippleGroup;
    if (!rippleGroup) continue;
    const rings = rippleGroup.children as RippleRing[];

    const isActive = isMarkerActive(hass, marker);
    rippleGroup.visible = isActive;
    if (!isActive) continue;

    if (marker.userData.kind === 'climate') {
      const entity = hass?.states?.[marker.userData.entity];
      const { rippleColor } = resolveVisuals('climate', entity, marker.userData.color) ?? {};
      if (rippleColor != null) {
        for (const ring of rings) ring.material.color.setHex(rippleColor);
      }
    }

    rippleGroup.quaternion.copy(camera.quaternion);

    for (const ring of rings) {
      const progress = (timeSeconds * RIPPLE.ANIM_SPEED + ring.userData.phase) % 1;
      ring.scale.setScalar(RIPPLE.SCALE_MIN + progress * RIPPLE.SCALE_SPAN);
      ring.material.opacity = (1 - progress) * RIPPLE.MAX_OPACITY;
    }
  }
}
