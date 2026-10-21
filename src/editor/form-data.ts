// Mapping between the card config and the editor form data.

import type { CardConfig, MarkerSizeLimits } from '../types';

export type NorthMarkerData = {
  visible: boolean;
  distance: number;
  width: number;
  length: number;
};

// What our schema really produces. HaFormData has no member for nested
// `expandable` sections, so this can't be expressed in the library's types.
export type EditorFormData = {
  north_offset: number;
  north_marker: NorthMarkerData;
  marker_size_limits: MarkerSizeLimits;
};

// Defaults shown in the form. Values equal to these are not written to the card config.
// If CARD_CONFIG already defines them, derive these from it instead.
export const DEFAULT_NORTH_OFFSET = 0;
export const DEFAULT_NORTH_MARKER: NorthMarkerData = { visible: true, distance: 1, width: 0.6, length: 5 };

// The config keys the form owns; everything else in the config is left untouched.
export type FormOwnedConfig = Pick<CardConfig, 'north_offset' | 'north_marker' | 'marker_size_limits'>;

export const FORM_OWNED_KEYS = ['north_offset', 'north_marker', 'marker_size_limits'] as const;

/** Remove undefined/NaN values and empty objects, recursively. Arrays are returned as-is. */
export function prune<T>(value: T): T | undefined {
  if (value === null || typeof value !== 'object') {
    return value === undefined || Number.isNaN(value) ? undefined : value;
  }
  if (Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const p = prune(v);
    if (p !== undefined) out[k] = p;
  }
  return Object.keys(out).length ? (out as T) : undefined;
}
