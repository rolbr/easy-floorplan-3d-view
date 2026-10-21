// Canvas-based sprite factories for icons, text labels

import * as THREE from 'three';
import { ICON_SPRITE, TEXT_SPRITE } from '../config/constants';
import type { TextLine } from '../types';
import { loadIconPath } from './icon-path';
import { log } from './logger';

export const FALLBACK_ICON = 'mdi:crosshairs-question';

/** 2D context of a canvas; throws if the browser cannot provide one. */
export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

const iconTextureCache = new Map();

/** Get (or lazily create) the shared texture for an icon path + color. */
export function getIconTexture(pathData: string, color = ICON_SPRITE.COLOR, backgroundColor = TEXT_SPRITE.BACKGROUND) {
  const key = `${pathData}|${color}|${backgroundColor}`;
  if (!iconTextureCache.has(key)) {
    iconTextureCache.set(key, renderIconTexture(pathData, color, backgroundColor));
  }
  return iconTextureCache.get(key);
}

function renderIconTexture(pathData: string, color: string, backgroundColor: string) {
  const { CANVAS_SIZE, MDI_VIEWBOX, ICON_FRACTION } = ICON_SPRITE;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = get2dContext(canvas);

  // Background - draw BEFORE ctx.scale
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  const ctr = CANVAS_SIZE / 2;
  ctx.arc(ctr, ctr, ctr, 0, Math.PI * 2);
  ctx.fill();

  // Icon size
  const iconSize = CANVAS_SIZE * ICON_FRACTION;
  const offset = (CANVAS_SIZE - iconSize) / 2;
  ctx.translate(offset, offset);

  // Scale
  const scl = iconSize / MDI_VIEWBOX;
  ctx.scale(scl, scl);

  // Icon
  ctx.fillStyle = color;
  ctx.fill(new Path2D(pathData));

  return new THREE.CanvasTexture(canvas);
}

/**
 * ASYNC
 * @param id "mdi:mouse-left-click" | "mouse-left-click"
 * @returns PROMISE which resolves to cached SVG path (`d` attribute)
 */
export function loadMdiPath(id: string) {
  // id `mdi:icon` -> name `icon`
  // id     `icon` -> name `icon`
  // To prevent loading the same SVG twice, cache it by NAME, not ID
  // Resolved by Home Assistant itself (hidden <ha-icon>), cached in icon-path.ts
  return loadIconPath(id.includes(':') ? id : `mdi:${id}`);
}

const isMdiId = (s: unknown): s is string => typeof s === 'string' && s.startsWith('mdi:');

/**
 * Synchron: sprite is returned synchronously. Remains invisible until path is loaded
 * Cached: IDs / pathDatas are cached and only loaded once
 * userData.iconId: mdi:iconName
 * userData.iconPathData: only set after path finished loading
 * Preload: to preload all icons, i.e. before starting a scene: `await Promise.all(ids.map(loadMdiPath))`
 *
 * @param {*} icon `mdi:iconName` or SVG path `M12 2C6.5 2 2 6.5 2 12S6.5 22 12 ...`
 * @param {*} color
 * @param {*} backgroundColor
 * @returns
 */
export function makeIconSprite(icon: string, color = ICON_SPRITE.COLOR, backgroundColor = TEXT_SPRITE.BACKGROUND) {
  const { WORLD_SIZE } = ICON_SPRITE;

  const material = new THREE.SpriteMaterial({
    depthTest: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(WORLD_SIZE, WORLD_SIZE, 1);
  sprite.renderOrder = 100;
  sprite.userData.iconColor = color;
  sprite.userData.iconBackgroundColor = backgroundColor;

  const applyPath = (pathData: string) => {
    sprite.userData.iconPathData = pathData;
    material.map = getIconTexture(pathData, color, backgroundColor);
    material.needsUpdate = true;
    sprite.visible = true;
  };

  if (isMdiId(icon)) {
    sprite.userData.iconId = icon;
    sprite.visible = false; // sonst wird ein weisses Quadrat ohne Textur gezeichnet
    sprite.userData.ready = loadMdiPath(icon)
      .then(applyPath)
      .catch(async (err: unknown) => {
        log.error('icon load failed', err);
        // Unknown icon: show a placeholder instead of an empty sphere
        try {
          applyPath(await loadIconPath(FALLBACK_ICON));
        } catch {
          /* HA cannot resolve the fallback either: sprite remains invisible */
        }
      });
  } else {
    // icon is pathData
    applyPath(icon);
    sprite.userData.ready = Promise.resolve();
  }

  return sprite;
}

/**
 * Update an existing icon sprite's icon, color, and/or background color.
 * Only re-renders if something actually changed.
 */
export function updateIconSprite(sprite: THREE.Sprite | undefined, pathData: string, color: string, backgroundColor: string) {
  if (!sprite) return;

  const currentPath = sprite.userData.iconPathData;
  const currentColor = sprite.userData.iconColor;
  const currentBgColor = sprite.userData.iconBackgroundColor;
  if (currentPath === pathData && currentColor === color && currentBgColor === backgroundColor) return;

  sprite.material.map = getIconTexture(pathData, color, backgroundColor);
  sprite.material.needsUpdate = true;
  sprite.visible = true; // makeIconSprite hides it until the first path arrived
  sprite.userData.iconPathData = pathData;
  sprite.userData.iconColor = color;
  sprite.userData.iconBackgroundColor = backgroundColor;
}

export function makeTextSprite(text: string, color: string = TEXT_SPRITE.ID_COLOR) {
  const { NAME_FONT_SIZE, FONT_WEIGHT, FONT_FAMILY, PADDING_X, PADDING_Y, BORDER_RADIUS, SCALE, BACKGROUND } = TEXT_SPRITE;

  const canvas = document.createElement('canvas');
  const ctx = get2dContext(canvas);
  const font = `${FONT_WEIGHT} ${NAME_FONT_SIZE}px ${FONT_FAMILY}`;

  ctx.font = font;
  const metrics = ctx.measureText(text);

  canvas.width = Math.ceil(metrics.width + PADDING_X * 2);
  canvas.height = Math.ceil(NAME_FONT_SIZE + PADDING_Y * 2);

  ctx.font = font;
  ctx.fillStyle = BACKGROUND;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, BORDER_RADIUS);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PADDING_X, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width * SCALE, canvas.height * SCALE, 1);
  sprite.renderOrder = 100;

  return sprite;
}

/** Multi-line label. lines: [{ text, color, fontSize }]. Empty array hides the sprite. */
export function makeLabelSprite(lines: TextLine[] = []) {
  const material = new THREE.SpriteMaterial({
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 100;
  updateLabelSprite(sprite, lines);
  return sprite;
}

/** Redraws only if the content actually changed. */
export function updateLabelSprite(sprite: THREE.Sprite, lines: TextLine[], background = TEXT_SPRITE.BACKGROUND) {
  const { FONT_WEIGHT, FONT_FAMILY, PADDING_X, PADDING_Y, BORDER_RADIUS, SCALE } = TEXT_SPRITE;

  if (!lines.length) {
    sprite.visible = false;
    sprite.userData.labelKey = '';
    return;
  }

  const key = JSON.stringify([lines, background]);
  if (sprite.userData.labelKey === key) {
    sprite.visible = true;
    return;
  }
  sprite.userData.labelKey = key;

  const fontOf = (l: TextLine) => `${FONT_WEIGHT} ${l.fontSize}px ${FONT_FAMILY}`;
  const canvas = document.createElement('canvas');
  const ctx = get2dContext(canvas);

  let maxWidth = 0;
  let totalHeight = 0;
  for (const line of lines) {
    ctx.font = fontOf(line);
    maxWidth = Math.max(maxWidth, ctx.measureText(line.text).width);
    totalHeight += line.fontSize;
  }

  canvas.width = Math.ceil(maxWidth + PADDING_X * 2);
  canvas.height = Math.ceil(totalHeight + PADDING_Y * 2);

  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, BORDER_RADIUS);
  ctx.fill();

  // per-line background strips, clipped to the rounded label shape
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, BORDER_RADIUS);
  ctx.clip();
  let by = PADDING_Y;
  lines.forEach((line, i) => {
    if (line.background) {
      const top = i === 0 ? 0 : by;
      const bottom = i === lines.length - 1 ? canvas.height : by + line.fontSize;
      ctx.fillStyle = line.background;
      ctx.fillRect(0, top, canvas.width, bottom - top);
    }
    by += line.fontSize;
  });
  ctx.restore();

  ctx.textBaseline = 'middle';
  let y = PADDING_Y;
  for (const line of lines) {
    ctx.font = fontOf(line);
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, PADDING_X, y + line.fontSize / 2);
    y += line.fontSize;
  }

  sprite.material.map?.dispose();
  sprite.material.map = new THREE.CanvasTexture(canvas);
  sprite.material.needsUpdate = true;

  // sprite.scale.set(canvas.width * SCALE, canvas.height * SCALE, 1);
  const w = canvas.width * SCALE;
  const h = canvas.height * SCALE;
  sprite.userData.baseScale = { x: w, y: h }; // updateMarkerScales multiplies this
  sprite.scale.set(w, h, 1);

  sprite.visible = true;
}
