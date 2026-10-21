/**
 * Home Assistant Icon Resolver
 * ==============================
 * Resolves the icon that HA's own frontend would show by default for a given entity (i.e. without a manual override).
 *
 * Resolution order, mirroring HA's own logic:
 *   1. entity.attributes.icon         -> manual override, always wins
 *   2. entity.attributes.device_class -> DEVICE_CLASS_ICONS[domain][device_class]
 *   2b. climate / weather             -> own state logic (CLIMATE_ICONS / WEATHER_ICONS), since these domains barely
 *                                        use device_class, but their icon depends heavily on the operating state
 *   3. Domain fallback                -> DOMAIN_FALLBACK_ICONS[domain]
 *   4. mdi:help-circle                -> absolute fallback
 *
 * Source of the device_class values: developers.home-assistant.io/docs/core/entity/
 */

// ---------------------------------------------------------------------------
// 1) device_class mapping, grouped by domain
//    (device_class names are only unique PER DOMAIN, e.g. "power" exists on both sensor AND number)
// ---------------------------------------------------------------------------

import { CLIMATE_ICONS, DEVICE_CLASS_ICONS, DOMAIN_FALLBACK_ICONS, FINAL_FALLBACK_ICON, WEATHER_ICONS } from '../config/icon-map';
import type { HassEntity } from '../types';

// ---------------------------------------------------------------------------
// 3) Resolver
// ---------------------------------------------------------------------------

/**
 * @param entity - HA entity object as returned by hass.states[entity_id]: { entity_id, state, attributes: { icon?, device_class?, ... } }
 * @returns mdi:iconName
 */
function resolveIcon(entity: HassEntity) {
  if (!entity) return;
  const { entity_id, state, attributes = {} } = entity;
  const domain = entity_id.split('.')[0];
  const isOn = state === 'on' || state === 'open' || state === 'unlocked' || state === 'home' || state === 'detected' || state === 'wet';

  // 1. Manual override always wins
  if (attributes.icon) return attributes.icon;

  // 2. device_class mapping (domain-specific)
  const dc = attributes.device_class;
  if (dc && DEVICE_CLASS_ICONS[domain]?.[dc]) {
    const entry = DEVICE_CLASS_ICONS[domain][dc];
    return typeof entry === 'string' ? entry : isOn ? entry.on : entry.off;
  }

  // 2b. Special cases with their own state logic (no device_class concept)
  if (domain === 'climate') {
    //   const key = attributes.hvac_action || state;
    //   if (CLIMATE_ICONS[key]) return CLIMATE_ICONS[key];
    //
    if (CLIMATE_ICONS[state]) return CLIMATE_ICONS[state];
  }
  if (domain === 'weather') {
    if (WEATHER_ICONS[state]) return WEATHER_ICONS[state];
  }

  // 3. Domain fallback
  const fallback = DOMAIN_FALLBACK_ICONS[domain];
  if (fallback) {
    return typeof fallback === 'string' ? fallback : isOn ? fallback.on : fallback.off;
  }

  // 4. Absolute fallback
  return FINAL_FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { CLIMATE_ICONS, DEVICE_CLASS_ICONS, DOMAIN_FALLBACK_ICONS, resolveIcon, WEATHER_ICONS };
