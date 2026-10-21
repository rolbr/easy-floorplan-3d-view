/**
 * @module
 * Lovelace access shared by card and editor -- Pure data access: no DOM, no three.js
 */

import type { DashboardConfig, HomeAssistant, LovelaceCardConfig, LovelaceView } from '../types';

/**
 * @param urlPath null/undefined = default dashboard
 * @throws if HA rejects the request, e.g. empty or YAML-mode dashboard
 */
export function fetchDashboardConfig(hass: HomeAssistant, urlPath?: string | null): Promise<DashboardConfig> {
  return hass.connection.sendMessagePromise<DashboardConfig>({
    type: 'lovelace/config',
    url_path: urlPath,
  });
}

/**
 * Find a view by `path`
 * Views without `path` are addressed by their index (same as HA's URL, e.g. /dashboard-test/0)
 */
export function findView(config: DashboardConfig, view: string | undefined): LovelaceView | undefined {
  if (view === undefined) return undefined;
  const views = config.views ?? [];
  return views.find((v) => v.path === view) ?? views.find((v, i) => !v.path && String(i) === view);
}

/**
 * All cards of `cardType` in a view, in stable traversal order: \
 * top-level cards first, then section cards, nested stacks depth-first
 */
export function findCardsInView(view: LovelaceView, cardType: string): LovelaceCardConfig[] {
  const out: LovelaceCardConfig[] = [];
  const walk = (cards?: LovelaceCardConfig[]) => {
    for (const card of cards ?? []) {
      if (card.type === cardType) out.push(card);
      walk(card.cards as LovelaceCardConfig[] | undefined);
    }
  };
  walk(view.cards);
  for (const sec of view.sections ?? []) walk(sec.cards);
  return out;
}
