import type { HomeAssistant } from '../types';

let currentHass: HomeAssistant | null = null;

export function setHass(h: HomeAssistant) {
  currentHass = h;
}

export function getHass(): HomeAssistant | null {
  return currentHass;
}
