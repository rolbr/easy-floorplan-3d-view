import { expect, it, vi } from 'vitest';
import { loadFloorData, signatureOf } from './load-floor';
import type { HomeAssistant } from './types';

it('loads source symbols and rendering settings and includes them in change detection', async () => {
  const config = {
    type: 'custom:easy-floorplan-card',
    floors: [{ id: 'floor_main' }],
    rotation: 90,
    furniture3d: true,
    furnitureSeparateSection: true,
    furnitureSectionHeight: 220,
    wallHeight: 100,
    symbols: { custom: { model3d: { version: 1 } } },
  };
  const sendMessagePromise = vi.fn().mockResolvedValue({ views: [{ path: 'hus', cards: [config] }] });
  const hass = { connection: { sendMessagePromise } } as unknown as HomeAssistant;
  const source = { dashboard: 'home', view: 'hus', card_type: 'custom:easy-floorplan-card', floor_id: 'floor_main' };
  const before = await loadFloorData(hass, source);
  expect(before.furnitureSettings).toEqual({
    furniture3d: true,
    furnitureSeparateSection: true,
    furnitureSectionHeight: 220,
    wallHeight: 100,
    symbols: config.symbols,
  });
  const sig = signatureOf(before);
  config.wallHeight = 80;
  expect(signatureOf(await loadFloorData(hass, source))).not.toBe(sig);
});
