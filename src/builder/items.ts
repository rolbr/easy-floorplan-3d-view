// Entity markers: spheres, icons, labels, ripple rings and light glow

import * as THREE from 'three';
import { GLOW_TEXTURE, ICON_SPRITE, LABEL_POSITION_V, MARKER, markerConfig, RIPPLE, TEXT_SPRITE, toM } from '../config/constants';
import { getHass } from '../lib/context';
import { validIconId } from '../lib/icon-path';
import { resolveIcon } from '../lib/icon-resolver';
import { log } from '../lib/logger';
import { get2dContext, makeIconSprite, makeLabelSprite } from '../lib/sprites';
import type { BuildIssue, FloorData, Marker } from '../types';

function makeGlowTexture() {
  const size = GLOW_TEXTURE.CANVAS_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = get2dContext(canvas);
  const half = size * 0.5;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);

  for (let index = 0; index <= GLOW_TEXTURE.GRADIENT_STEPS; index += 1) {
    const t = index / GLOW_TEXTURE.GRADIENT_STEPS;
    const alpha = (1 - t) ** 2 * GLOW_TEXTURE.GRADIENT_ALPHA;
    gradient.addColorStop(t, `rgba(255, 255, 255, ${alpha})`);
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

function createRippleGroup(marker: THREE.Object3D, itemsGroup: THREE.Group, color: number, sizeScale = 1) {
  const rippleGroup = new THREE.Group();
  rippleGroup.scale.setScalar(sizeScale);

  for (let index = 0; index < RIPPLE.RING_COUNT; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RIPPLE.RING_INNER, RIPPLE.RING_OUTER, RIPPLE.RING_SEGMENTS),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: RIPPLE.REST_OPACITY,
        depthTest: false,
        depthWrite: false,
      }),
    );

    ring.userData.phase = index / RIPPLE.RING_COUNT;
    ring.renderOrder = RIPPLE.RENDER_ORDER;
    rippleGroup.add(ring);
  }

  rippleGroup.position.copy(marker.position);
  itemsGroup.add(rippleGroup);

  return rippleGroup;
}

export function buildItems(group: THREE.Group, floorData: FloorData) {
  const issues: BuildIssue[] = [];
  const itemsGroup = new THREE.Group();
  group.add(itemsGroup);

  const glowGroup = new THREE.Group();
  group.add(glowGroup);

  const glowTexture = makeGlowTexture();
  const pickableItems: Marker[] = [];

  const hass = getHass();
  if (!hass) {
    log.warn('buildItems: hass is not available, markers get no icons');
  }

  for (const item of floorData.items || []) {
    const mConf = markerConfig(item.kind);

    const hasSize = Number.isFinite(item.size) && (item.size ?? 0) > 0;
    const baseIconScale = hasSize ? toM(item.size ?? 0) * MARKER.SIZE_ICON_FACTOR : ICON_SPRITE.WORLD_SIZE;
    const radius = hasSize ? toM(item.size ?? 0) / 2 : mConf.radius;
    const sizeScale = radius / mConf.radius; // 1 when size is missing

    const entity = hass?.states[item.entity];
    if (hass && !entity) {
      const message = `Entity "${item.entity}" (item "${item.id}") not found.`;
      log.warn(`buildItems: ${message}`);
      issues.push({ itemId: item.id, entity: item.entity, message });
    }
    const configIcon = validIconId(item.icon);
    const icon = configIcon ?? (entity ? resolveIcon(entity) : undefined);

    // log.trace('', icon.padEnd(22, ' '), item );

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(radius + toM(MARKER.ICON_PADDING), MARKER.SPHERE_SEGMENTS, MARKER.SPHERE_SEGMENTS),
      new THREE.MeshStandardMaterial({
        color: mConf.color,
        emissive: mConf.color,
        emissiveIntensity: MARKER.EMISSIVE_INTENSITY,
        roughness: MARKER.ROUGHNESS,
      }),
    );

    marker.position.set(toM(item.x), mConf.height, toM(item.y));
    marker.userData.entity = item.entity;
    marker.userData.kind = item.kind;
    marker.userData.label = item.entity;
    marker.userData.color = mConf.color;

    pickableItems.push(marker as Marker);
    itemsGroup.add(marker);

    //// ICON
    if (icon) {
      const iconSprite = makeIconSprite(icon, ICON_SPRITE.COLOR, TEXT_SPRITE.BACKGROUND);
      iconSprite.position.copy(marker.position);

      if (hasSize) {
        const d = toM(item.size ?? 0) * MARKER.SIZE_ICON_FACTOR;
        iconSprite.scale.set(d, d, 1);
      }

      itemsGroup.add(iconSprite);
      marker.userData.iconSprite = iconSprite;
    }

    // halfExtent is the larger of sphere radius and half icon diameter, label clears whichever is bigger
    const halfExtent = Math.max(radius, icon && hasSize ? (toM(item.size ?? 0) * MARKER.SIZE_ICON_FACTOR) / 2 : ICON_SPRITE.WORLD_SIZE / 2);

    //// LABEL (Name / ID / Values)
    const labelSprite = makeLabelSprite([]);
    // top: bottom edge at marker, grows upward; bottom: top edge at marker, grows downward
    labelSprite.center.set(0.5, LABEL_POSITION_V === 'top' ? 0 : 1);
    labelSprite.position.copy(marker.position);
    marker.userData.baseLabelOffset = halfExtent + MARKER.LABEL_OFFSET_Y;
    marker.userData.labelOffset = marker.userData.baseLabelOffset;
    marker.userData.baseIconScale = baseIconScale;
    marker.userData.baseRippleScale = sizeScale;
    marker.userData.labelSprite = labelSprite;
    itemsGroup.add(labelSprite);

    // `item.showState` is either `true` or `false`. Show on label if `true`.
    //// VALUE / READINGS (data only, rendered in labelSprite)
    marker.userData.configIcon = configIcon;
    marker.userData.showState = item.showState !== false;
    marker.userData.attribute = item.attribute ?? null;
    // `item.readings[n].showState` is either `true` or `undefined`. Show on label if `true` or `undefined`
    // A reading without `entity` inherits the item's entity (e.g. `{ attribute: 'humidity' }`).
    marker.userData.readings = (item.readings ?? [])
      .filter((r) => r && (r.entity || r.attribute) && r.showState !== false)
      .map((r) => ({ entity: r.entity ?? item.entity, attribute: r.attribute ?? null }));

    //// RIPPLE
    if (mConf.ripple) {
      marker.userData.rippleGroup = createRippleGroup(marker, itemsGroup, mConf.ripple.color, sizeScale);
    }

    //// GLOW
    if (item.kind === 'light' && item.glow) {
      const glowRadius = toM(item.glowRadius ?? MARKER.GLOW_RADIUS_DEFAULT);
      const glowRange = glowRadius * MARKER.GLOW_LIGHT_RANGE_FACTOR;
      const pointLight = new THREE.PointLight(mConf.color, MARKER.GLOW_LIGHT_INTENSITY, glowRange, MARKER.GLOW_LIGHT_DECAY);
      pointLight.castShadow = MARKER.GLOW_LIGHT_CAST_SHADOW;
      pointLight.shadow.mapSize.set(MARKER.GLOW_LIGHT_SHADOW_MAP_SIZE, MARKER.GLOW_LIGHT_SHADOW_MAP_SIZE);
      pointLight.shadow.bias = MARKER.GLOW_LIGHT_SHADOW_BIAS;
      pointLight.shadow.normalBias = MARKER.GLOW_LIGHT_SHADOW_NORMAL_BIAS;

      // Shadow frustum must match the light: geometry within `near` of the
      // light is excluded from the shadow map (three.js default: 0.5m).
      pointLight.shadow.camera.near = MARKER.GLOW_LIGHT_SHADOW_NEAR;
      pointLight.shadow.camera.far = glowRange;
      pointLight.shadow.camera.updateProjectionMatrix();

      pointLight.position.copy(marker.position);
      glowGroup.add(pointLight);
      marker.userData.pointLight = pointLight;

      const glowSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: mConf.color,
          transparent: true,
          opacity: MARKER.GLOW_SPRITE_OPACITY,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );

      const spriteSize = Math.max(mConf.radius * MARKER.GLOW_SPRITE_MIN_FACTOR, glowRadius * MARKER.GLOW_SPRITE_RANGE_FACTOR);
      glowSprite.scale.set(spriteSize, spriteSize, 1);
      glowSprite.position.copy(marker.position);
      glowGroup.add(glowSprite);

      marker.userData.glowSprite = glowSprite;
      // Fallback colour when HA reports no colour (see applyVisuals)
      marker.userData.glowFallbackColor = mConf.color;
    }
  }

  return { pickableItems, itemsGroup, glowGroup, issues };
}
