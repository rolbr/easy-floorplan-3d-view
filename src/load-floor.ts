/**
 * @module
 * Loads floor data from an Easy Floorplan card config -- Pure data access: no DOM, no three.js
 */

import { log } from './lib/logger';
import { fetchDashboardConfig, findCardsInView, findView } from './lib/lovelace';
import type { FloorplanCardConfig, HomeAssistant, LoadedFloor, SourceConfig } from './types';

/**
 * Fetch the floor definition for the configured `source` card.
 *
 * @returns the floor definition
 * @throws if the floor cannot be found
 */
export async function loadFloorData(hass: HomeAssistant, source: SourceConfig): Promise<LoadedFloor> {
  // sendMessagePromise throws if the config is unavailable. handled by main._loadSource.catch
  const dashboardConfig = await fetchDashboardConfig(hass, source.dashboard);

  const view = findView(dashboardConfig, source.view);
  if (!view) {
    throw new Error(`View "${source.view}" not found.`);
  }

  const cardType = source.card_type ?? ''; // don't default back to FLOORPLAN_CARD_TYPE, if a misconfiguration arrived here, we want to know
  const cards = findCardsInView(view, cardType);
  const cardIndex = source.card_index ?? 0;
  const sourceCard = cards[cardIndex] as FloorplanCardConfig;
  if (!sourceCard) {
    throw new Error(`Card "${cardType}" #${cardIndex} not found in view "${source.view}" (${cards.length} found).`);
  }

  const floorData = sourceCard.floors?.find((item) => item.id === source.floor_id);
  if (!floorData) {
    throw new Error(`Floor "${source.floor_id}" not found.`);
  }

  log.trace('fetchFloorData', floorData);

  return { floor: floorData, rotation: sourceCard.rotation };
}

// --- Floor cache: lets the card paint instantly, then revalidate ---------

type CachedFloor = { data: LoadedFloor; sig: string };

const floorCache = new Map<string, CachedFloor>();
const cacheKey = (source: SourceConfig) => JSON.stringify(source);

/** Cheap change detection; fine for modest data. */
export const signatureOf = (data: LoadedFloor) => JSON.stringify(data);

export function getCachedFloor(source: SourceConfig): CachedFloor | undefined {
  return floorCache.get(cacheKey(source));
}

export function storeFloor(source: SourceConfig, data: LoadedFloor, sig = signatureOf(data)) {
  floorCache.set(cacheKey(source), { data, sig });
}
