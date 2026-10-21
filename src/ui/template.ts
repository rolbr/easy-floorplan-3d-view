// HTML template of the card

import styles from './styles.css?inline';

const TOGGLE_IDS = [
  'toggleFurniture',
  'toggleItems',
  'toggleGlow',
  'toggleAreaLabels',
  'toggleLabels',
  'toggleHoverLabels',
  'toggleEntityNames',
  'toggleCut',
  'toggleTime',
] as const;
type ToggleId = (typeof TOGGLE_IDS)[number];

export type TemplateRefs = {
  container: HTMLDivElement;
  tooltip: HTMLElement;
  status: HTMLElement;
  reload: HTMLButtonElement;
  panels: HTMLElement[];
  toggles: Record<ToggleId, HTMLInputElement>;
  clipSlider: HTMLInputElement;
  clipValue: HTMLElement;
  timeSlider: HTMLInputElement;
  timeValue: HTMLElement;
  monthSlider: HTMLInputElement;
  monthValue: HTMLElement;
  timeGroup: HTMLElement;
  cutContrastLabel: HTMLLabelElement;
  cutContrastInput: HTMLInputElement;
};

export function getTemplateRefs(root: ParentNode): TemplateRefs {
  const q = <T extends Element>(selector: string) => root.querySelector(selector) as T;
  const toggles = Object.fromEntries(TOGGLE_IDS.map((id) => [id, q<HTMLInputElement>(`#${id}`)])) as Record<ToggleId, HTMLInputElement>;

  return {
    container: q<HTMLDivElement>('#container'),
    tooltip: q<HTMLElement>('#tooltip'),
    status: q<HTMLElement>('#status'),
    reload: q<HTMLButtonElement>('#reload'),
    panels: Array.from(root.querySelectorAll<HTMLElement>('.panel')),
    toggles,
    clipSlider: q<HTMLInputElement>('#clipHeight'),
    clipValue: q<HTMLElement>('#clipHeightVal'),
    timeSlider: q<HTMLInputElement>('#timeOfDay'),
    timeValue: q<HTMLElement>('#timeVal'),
    monthSlider: q<HTMLInputElement>('#monthOfYear'),
    monthValue: q<HTMLElement>('#monthVal'),
    timeGroup: q<HTMLElement>('#timeGroup'),
    cutContrastLabel: q<HTMLLabelElement>('#cutContrast'),
    cutContrastInput: q<HTMLInputElement>('#cutContrast input'),
  };
}

export function getTemplate() {
  const icon = (name: string) => `<ha-icon icon="mdi:${name}"></ha-icon>`;

  return `
    <style>${styles}</style>
    <ha-card ${__DEV_BUILD__ ? 'mode="dev"' : ''}>
      <div id="container" style="position:relative; width:100%; border-radius:8px; overflow:hidden; background:#dfe7ec; container-type:inline-size;">
        <div id="visibility-panel" class="panel top">
          <button class="efp-btn" title="Visibility"><i class="open">${icon('eye-outline')}</i><i class="close">${icon('close')}</i></button>
          <div class="panel-content">
            <label><input type="checkbox" id="toggleFurniture" checked /> Furniture </label>
            <label><input type="checkbox" id="toggleItems" checked /> Devices </label>
            <label><input type="checkbox" id="toggleGlow" checked /> Light glow </label>
            <label><input type="checkbox" id="toggleEntityNames" /> Entity names </label>
            <label><input type="checkbox" id="toggleLabels" /> Entity IDs </label>
            <label><input type="checkbox" id="toggleAreaLabels"> Area labels </label>
            <label><input type="checkbox" id="toggleHoverLabels" checked /> Hover labels </label>
            <div class="hint" style="display:flex; flex-direction:column; gap:4px;">
              <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer">
                <input type="checkbox" id="toggleCut"> Cut <span id="clipHeightVal"></span>
              </label>
              <input type="range" id="clipHeight" min="0.1" max="2.5" step="0.1" value="1.2" style="margin-left:1.3em; width:90%; display:none">
              <label id="cutContrast" style="margin-left:1em; align-items:center; gap:6px; cursor:pointer; display:none">
                <input type="checkbox"> Contrast
              </label>
            </div>
            <label>
              <input type="checkbox" id="toggleTime"> Time override <span id="timeVal"></span>
            </label>
            <div id="timeGroup" style="display:none">
              <input type="range" id="timeOfDay" min="0" max="24" step="0.25" value="12" style="margin-left:1.3em; width:90%">
              <label style="margin-left:1.3em">Month <span id="monthVal"></span></label>
              <input type="range" id="monthOfYear" min="1" max="12" step="1" value="6" style="margin-left:1.3em; width:90%">
            </div>
          </div>
        </div>

        <div id="help-panel" class="panel bottom">
          <button class="efp-btn" title="Help"><i class="open">${icon('help-circle-outline')}</i><i class="close">${icon('close')}</i></button>
          <div class="panel-content" style="gap:1.4em;">
            <div id="status-panel">
              <button id="reload">Reload</button>
              <span id="status">Three.js ready...</span>
            </div>
            <div id="legend">
              <span><span style="background:#f4c542;"></span>Light</span>
              <span><span style="background:#5aa9e6;"></span>Sensor</span>
              <span><span style="background:#e05d5d;"></span>Climate</span>
              <span><span style="background:#8fce8f;"></span>Switch</span>
            </div>
            <div id="controls-hint-mouse">
              <i data-lucide="mouse-left"></i> Pan · <i data-lucide="mouse-left"></i> Focus Area · <i data-lucide="mouse"></i> Zoom · <i data-lucide="mouse-right"></i> Rotate
            </div>
            <div id="controls-hint-touch">
              <span>${icon('gesture-swipe')}</span> Pan · <span>${icon('gesture-tap')}</span> Focus Area · <span>${icon('gesture-pinch')}</span> Zoom + Rotate
            </div>
          </div>
        </div>

        <div id="tooltip" style="position:absolute; pointer-events:none; z-index:20; background:rgba(20,20,20,0.85); color:#fff; padding:6px 10px; border-radius:6px; font-size:12px; display:none; white-space:nowrap;"></div>
      </div>
    </ha-card>
  `;
}
