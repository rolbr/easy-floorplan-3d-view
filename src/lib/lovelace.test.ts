import { describe, expect, it, vi } from 'vitest';
import type { DashboardConfig, HomeAssistant, LovelaceCardConfig, LovelaceView } from '../types';
import { fetchDashboardConfig, findCardsInView, findView } from './lovelace';

const card = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra }) as LovelaceCardConfig;
const asView = (v: unknown) => v as LovelaceView;
const asConfig = (c: unknown) => c as DashboardConfig;

describe('findView', () => {
  const viewPathHome = asView({ path: 'home' });
  const viewNoPath = asView({ title: 'No path' });
  const viewPathX = asView({ path: 'x' });
  const viewNoPathAgain = asView({ title: 'No path again' });

  const config = asConfig({ views: [viewPathHome, viewNoPath, viewPathX, viewNoPathAgain] });

  it('finds a view by path', () => {
    expect(findView(config, 'x')).toBe(viewPathX);
  });

  it('addresses path-less views by index', () => {
    expect(findView(config, '1')).toBe(viewNoPath);
    expect(findView(config, '3')).toBe(viewNoPathAgain);
  });

  it('does not resolve an index to a view that has a path', () => {
    expect(findView(config, '0')).toBeUndefined();
  });

  it('returns undefined for unknown or missing view', () => {
    expect(findView(config, 'nope')).toBeUndefined();
    expect(findView(config, undefined)).toBeUndefined();
  });

  it('handles a config without views', () => {
    expect(findView(asConfig({}), 'home')).toBeUndefined();
  });
});

describe('findCardsInView', () => {
  const T = 'custom:easy-floorplan-card';

  it('returns an empty array for an empty view', () => {
    expect(findCardsInView(asView({}), T)).toEqual([]);
  });

  it('finds top-level cards and ignores other types', () => {
    const a = card(T, { id: 'a' });
    const view = asView({ cards: [card('markdown'), a] });
    expect(findCardsInView(view, T)).toEqual([a]);
  });

  it('finds cards in sections', () => {
    const a = card(T, { id: 'a' });
    const view = asView({ sections: [{ cards: [a] }] });
    expect(findCardsInView(view, T)).toEqual([a]);
  });

  it('descends into nested stacks depth-first', () => {
    const inner = card(T, { id: 'inner' });
    const after = card(T, { id: 'after' });
    const view = asView({ cards: [card('vertical-stack', { cards: [card('horizontal-stack', { cards: [inner] })] }), after] });
    expect(findCardsInView(view, T)).toEqual([inner, after]);
  });

  it('orders top-level cards before section cards', () => {
    const top = card(T, { id: 'top' });
    const sec = card(T, { id: 'sec' });
    const view = asView({ sections: [{ cards: [sec] }], cards: [top] });
    expect(findCardsInView(view, T).map((c) => c.id)).toEqual(['top', 'sec']);
  });

  it('matches the stack itself when searching for a stack type', () => {
    const stack = card('vertical-stack', { cards: [card(T)] });
    expect(findCardsInView(asView({ cards: [stack] }), 'vertical-stack')).toEqual([stack]);
  });
});

describe('fetchDashboardConfig', () => {
  const makeHass = (impl: () => Promise<unknown>) => {
    const send = vi.fn(impl);
    return { hass: { connection: { sendMessagePromise: send } } as unknown as HomeAssistant, send };
  };

  it('sends lovelace/config with the url path', async () => {
    const cfg = { views: [] };
    const { hass, send } = makeHass(async () => cfg);
    await expect(fetchDashboardConfig(hass, 'dash')).resolves.toBe(cfg);
    expect(send).toHaveBeenCalledWith({ type: 'lovelace/config', url_path: 'dash' });
  });

  it('passes null for the default dashboard', async () => {
    const { hass, send } = makeHass(async () => ({}));
    await fetchDashboardConfig(hass, null);
    expect(send).toHaveBeenCalledWith({ type: 'lovelace/config', url_path: null });
  });

  it('propagates errors to the caller', async () => {
    const { hass } = makeHass(async () => {
      throw new Error('config_not_found');
    });
    await expect(fetchDashboardConfig(hass, 'yaml')).rejects.toThrow('config_not_found');
  });
});
