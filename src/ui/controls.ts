// DOM wiring for the card's panels and toggles (no scene building, no clip logic).

import type { HomeAssistant } from 'home-assistant-frontend-types';
import { STATUS_COLORS } from '../config/constants';
import { updateEntityLabels } from '../lib/markers';
import type { FloorRefs, LabelOpts } from '../types';
import type { TemplateRefs } from './template';

type GroupKey = 'furnitureGroup' | 'itemsGroup' | 'glowGroup' | 'areaLabelGroup';

type ToggleId = keyof TemplateRefs['toggles'];

/** Checkbox id -> key of the three.js group in the floor refs it controls. */
const VISIBILITY_BINDINGS: readonly [ToggleId, GroupKey][] = [
  ['toggleFurniture', 'furnitureGroup'],
  ['toggleItems', 'itemsGroup'],
  ['toggleGlow', 'glowGroup'],
  ['toggleAreaLabels', 'areaLabelGroup'],
];

export interface ControlsContext {
  getFloorRefs: () => FloorRefs | null;
  getHass: () => HomeAssistant;
  setLabelOpts: (opts: LabelOpts) => void;
}

/**
 * Sets the status text. Each entry of `errors` is shown on its own line below
 * the text, in the error color only. Built with DOM nodes (not innerHTML), so
 * entity names from user config cannot inject markup.
 */
export function setStatus(status: HTMLElement, text: string, color?: string, errors: string[] = []) {
  status.replaceChildren(document.createTextNode(text));
  if (color) status.style.color = color;
  for (const message of errors) {
    status.appendChild(document.createElement('br'));
    const line = document.createElement('span');
    line.style.color = STATUS_COLORS.ERROR;
    line.textContent = message;
    status.appendChild(line);
  }
}

export function wirePanelToggle(panels: HTMLElement[]) {
  for (const panel of panels) {
    panel.querySelector(':scope > .efp-btn')?.addEventListener('click', () => panel.classList.toggle('efp-open'));
  }
}

/** Keep pointer events inside the card so HA's dashboard doesn't react to them. */
export function stopPropagation(container: HTMLElement) {
  const stop = (e: Event) => e.stopPropagation();
  for (const type of ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend']) {
    container.addEventListener(type, stop, { passive: false });
  }
}

export function setupControls(refs: TemplateRefs, ctx: ControlsContext) {
  const syncGroup = ([id, key]: readonly [ToggleId, GroupKey]) => {
    const group = ctx.getFloorRefs()?.[key];
    if (group) group.visible = refs.toggles[id].checked;
  };
  const syncGroups = () => VISIBILITY_BINDINGS.forEach(syncGroup);

  const syncLabels = () => {
    const showId = refs.toggles.toggleLabels.checked;
    const showName = refs.toggles.toggleEntityNames.checked;
    const opts: LabelOpts = { showName, showId };
    ctx.setLabelOpts(opts);

    updateEntityLabels(ctx.getHass(), ctx.getFloorRefs()?.pickableItems, opts);
  };

  for (const binding of VISIBILITY_BINDINGS) {
    refs.toggles[binding[0]].addEventListener('change', () => syncGroup(binding));
  }
  refs.toggles.toggleLabels.addEventListener('change', syncLabels);
  refs.toggles.toggleEntityNames.addEventListener('change', syncLabels);
  syncGroups();

  return {
    /** Re-apply all checkbox states to a freshly built model. */
    syncVisibility() {
      syncGroups();
      syncLabels();
    },
    syncLabels,
  };
}
