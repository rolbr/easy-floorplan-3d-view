/**
 * Find every Easy Floorplan card on every dashboard/view.
 */

import { FLOORPLAN_CARD_TYPE } from '../config/constants';
import { log } from '../lib/logger';
import { fetchDashboardConfig, findCardsInView } from '../lib/lovelace';
import type { HomeAssistant } from '../types';

export type DashboardInfo = {
  id: string; // registry id, or 'lovelace' for the default dashboard
  url_path: string | null; // null = default dashboard
  title: string;
};

export type CardEntry = {
  key: string;
  dashboard: DashboardInfo;
  viewPath: string;
  viewHasPath: boolean;
  viewTitle: string;
  viewIndex: number;
  cardIndex: number;
  cardCount: number;
  floors: { id: string; name: string; areas: { id: string; name: string }[] }[];
};

/**
 * Find all Easy Floorplan cards on all dashboards/views and return their CardEntry
 */
export async function getAllFloorplanCards(hass: HomeAssistant): Promise<CardEntry[]> {
  const dashboards = await getAllDashboards(hass);

  // Get all configs for all dashboards
  const eachDashboard = await Promise.all(
    dashboards.map(async (dashboard) => {
      try {
        return { dashboard, config: await fetchDashboardConfig(hass, dashboard.url_path) };
      } catch {
        return { dashboard, config: null };
      }
    }),
  );

  // Find all floorplan cards on and return their CardEntry
  const entries: CardEntry[] = [];
  for (const { dashboard, config } of eachDashboard) {
    (config?.views ?? []).forEach((view, viewIndex) => {
      const floorplanCards = findCardsInView(view, FLOORPLAN_CARD_TYPE);
      floorplanCards.forEach((card, cardIndex) => {
        const floors = ((card.floors as { id: string; name?: string; areas?: { id: string; name?: string }[] }[]) ?? []).map((f) => ({
          id: f.id,
          name: f.name ?? f.id,
          areas: (f.areas ?? []).map((a) => ({ id: a.id, name: a.name ?? a.id })),
        }));
        entries.push({
          key: `${dashboard.id}|${viewIndex}|${cardIndex}`,
          dashboard,
          viewPath: view.path ?? String(viewIndex),
          viewHasPath: !!view.path,
          viewTitle: view.title ?? view.path ?? `View ${viewIndex}`,
          viewIndex,
          cardIndex,
          cardCount: floorplanCards.length,
          floors,
        });
      });
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
//  P R I V A T E
// ---------------------------------------------------------------------------

async function getAllDashboards(hass: HomeAssistant): Promise<DashboardInfo[]> {
  const result: DashboardInfo[] = [{ id: 'lovelace', url_path: null, title: 'Default dashboard' }];
  try {
    const list = await hass.connection.sendMessagePromise<DashboardInfo[]>({
      type: 'lovelace/dashboards/list', // admin only
    });
    for (const d of list) {
      result.push({ id: d.id, url_path: d.url_path, title: d.title });
    }
  } catch (e) {
    log.warn('editor: cannot list dashboards (admin required?)', e);
  }
  return result;
}
