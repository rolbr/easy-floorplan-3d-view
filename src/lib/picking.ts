// Pointer raycasting on the 3D canvas: hover tooltips and click-to-more-info dispatch
// Items are picked first; if no item is hit, room areas are picked

import * as THREE from 'three';
import { AREA, TOOLTIP } from '../config/constants';
import type { AreaMesh, Marker, MoreInfoDetail, PickingOptions, World } from '../types';

/** Small wrapper around the tooltip DOM element. */
class Tooltip {
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  show(event: MouseEvent, rect: DOMRect, text: string) {
    this.element.style.display = 'block';
    this.element.style.left = `${event.clientX - rect.left + TOOLTIP.OFFSET_X}px`;
    this.element.style.top = `${event.clientY - rect.top + TOOLTIP.OFFSET_Y}px`;
    this.element.textContent = text;
  }

  hide() {
    this.element.style.display = 'none';
  }
}

export function setupRaycasting(
  cardEl: HTMLElement,
  world: World,
  getPickableItems: () => Marker[] | undefined,
  tooltipEl: HTMLElement | null | undefined,
  options: PickingOptions = {},
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const domElement = world.renderer.domElement;
  const tooltip = tooltipEl ? new Tooltip(tooltipEl) : null;

  const getAreaMeshes = options.getAreaMeshes ?? (() => []);
  const onAreaClick = options.onAreaClick ?? (() => {});
  const isHoverLabelEnabled = options.isHoverLabelEnabled ?? (() => true);
  let hoveredArea: AreaMesh | null = null;

  const updatePointer = (event: MouseEvent) => {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const pickItem = (event: MouseEvent): Marker | undefined => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, world.camera);

    const hits = raycaster.intersectObjects(getPickableItems() ?? [], false);
    return hits[0]?.object as Marker | undefined;
  };

  const pickArea = (event: MouseEvent): AreaMesh | undefined => {
    updatePointer(event);
    raycaster.setFromCamera(pointer, world.camera);

    const hits = raycaster.intersectObjects(getAreaMeshes() ?? [], false);
    return hits[0]?.object as AreaMesh | undefined;
  };

  const CLICK_THRESHOLD = 4;

  let mouseDownPos: { x: number; y: number } | null = null;

  const highlight = (m: AreaMesh | null | undefined, on: boolean) => {
    if (!m?.material) return;
    m.material.color.set(on ? m.userData.activeColor : m.userData.color);
    m.material.opacity = on ? Math.min(1, m.userData.restOpacity + AREA.HOVER_OPACITY_BOOST) : m.userData.restOpacity;
  };

  const setHoveredArea = (area: AreaMesh | null | undefined) => {
    const mesh = area ?? null;
    if (hoveredArea === mesh) return;

    if (hoveredArea) {
      highlight(hoveredArea, false);
      highlight(hoveredArea.userData.floorMesh, false);
    }

    hoveredArea = mesh;

    if (mesh) {
      highlight(mesh, true);
      highlight(mesh.userData.floorMesh, true);
    }
  };

  const onMouseDown = (event: MouseEvent) => {
    mouseDownPos = { x: event.clientX, y: event.clientY };
  };

  const onMouseMove = (event: MouseEvent) => {
    const item = pickItem(event);
    const area = item ? null : pickArea(event);
    setHoveredArea(area);

    if (!isHoverLabelEnabled()) {
      tooltip?.hide();
    } else if (item && tooltip) {
      const rect = domElement.getBoundingClientRect();
      tooltip.show(event, rect, item.userData.label ?? item.userData.entity);
    } else if (area && tooltip) {
      const rect = domElement.getBoundingClientRect();
      tooltip.show(event, rect, area.userData.name ?? 'Area');
    } else if (tooltip) {
      tooltip.hide();
    }
  };

  const onClick = (event: MouseEvent) => {
    if (mouseDownPos) {
      const dx = event.clientX - mouseDownPos.x;
      const dy = event.clientY - mouseDownPos.y;
      if (Math.hypot(dx, dy) > CLICK_THRESHOLD) {
        mouseDownPos = null;
        return;
      }
    }
    mouseDownPos = null;
    const item = pickItem(event);
    if (item) {
      const moreInfoEvent = new CustomEvent<MoreInfoDetail>('hass-more-info', {
        detail: { entityId: item.userData.entity },
        bubbles: true,
        composed: true,
      });
      cardEl.dispatchEvent(moreInfoEvent);
      return;
    }

    // No item hit: null = clicked outside all areas (triggers restore).
    onAreaClick(pickArea(event) ?? null);
  };

  domElement.addEventListener('mousedown', onMouseDown);
  domElement.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('click', onClick);

  return function disposePicking() {
    domElement.removeEventListener('mousedown', onMouseDown);
    domElement.removeEventListener('mousemove', onMouseMove);
    domElement.removeEventListener('click', onClick);
    setHoveredArea(null);
    tooltip?.hide();
  };
}
