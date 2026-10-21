// Resolve a Home Assistant icon name ("mdi:lightbulb") to its SVG path (`d`).
// HA already knows every icon; a hidden <ha-icon> loads it and exposes the
// path on its inner <ha-svg-icon>. Canvas/three.js code then draws that path.

const TIMEOUT_MS = 5000;
const cache = new Map<string, Promise<string>>(); // icon name -> path

type SvgIconEl = HTMLElement & { path?: string };

export function loadIconPath(icon: string): Promise<string> {
  let promise = cache.get(icon);
  if (!promise) {
    promise = lookup(icon).catch((err) => {
      cache.delete(icon); // never cache failures
      throw err;
    });
    cache.set(icon, promise);
  }
  return promise;
}

async function lookup(icon: string): Promise<string> {
  await customElements.whenDefined('ha-icon');
  const el = document.createElement('ha-icon') as unknown as HTMLElement & { icon?: string };
  el.icon = icon;
  // Must be connected, otherwise Lit never renders it
  el.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  document.body.appendChild(el);
  try {
    const t0 = performance.now();
    while (performance.now() - t0 < TIMEOUT_MS) {
      await new Promise((r) => requestAnimationFrame(r));
      const path = (el.shadowRoot?.querySelector('ha-svg-icon') as SvgIconEl | null)?.path;
      if (path) return path;
    }
    throw new Error(`No path for icon "${icon}" (unknown icon or timeout)`);
  } finally {
    el.remove();
  }
}

const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** `set:name` icon id, or undefined if the value cannot be an icon (same rule as the 2D card). */
export function validIconId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return ICON_NAME.test(v) ? v : undefined;
}
