// Form schemas, labels, helper texts and styles of the visual editor.

import type { HaFormSchema } from 'home-assistant-frontend-types';
import { MARKER_LIMITS } from '../config/constants';

const pxSelector = {
  number: { min: 7, max: 700, step: 1, mode: 'box', unit_of_measurement: 'px' },
} as const;

const limitsGrid = (): HaFormSchema => ({
  name: '',
  type: 'grid',
  schema: [
    { name: 'min', selector: pxSelector },
    { name: 'max', selector: pxSelector },
  ],
});

export const markerSizeLimitSchema: HaFormSchema = {
  name: 'marker_size_limits',
  type: 'expandable',
  schema: [
    limitsGrid(),
    {
      name: 'coarse',
      type: 'expandable',
      schema: [limitsGrid()],
    },
    {
      name: 'fine',
      type: 'expandable',
      schema: [limitsGrid()],
    },
  ],
} as const;

export const northSchema: HaFormSchema = {
  name: 'north',
  title: 'North',
  type: 'expandable',
  flatten: true,
  schema: [
    {
      name: 'north_offset',
      selector: { number: { min: 0, max: 360, step: 1, unit_of_measurement: '°', mode: 'slider' } },
    },
    {
      type: 'expandable',
      name: 'north_marker',
      title: 'Marker',
      schema: [
        { name: 'visible', selector: { boolean: {} } },
        {
          type: 'grid',
          name: '',
          flatten: true,
          column_min_width: '200px',
          schema: [
            { name: 'distance', selector: { number: { min: 0, step: 1.0, unit_of_measurement: 'm', mode: 'box' } } },
            { name: 'width', selector: { number: { min: 0, step: 0.1, unit_of_measurement: 'm', mode: 'box' } } },
            { name: 'length', selector: { number: { min: 0, step: 0.5, unit_of_measurement: 'm', mode: 'box' } } },
          ],
        },
      ],
    },
  ],
} as const;

export const LABELS: Record<string, string> = {
  north_offset: 'Offset',
  visible: 'Visible',
  distance: 'Distance',
  width: 'Width',
  length: 'Length',

  marker_size_limits: 'Marker size limits',
  min: 'Min',
  max: 'Max',
  coarse: 'Touch',
  fine: 'Mouse / trackpad',
};

export const HELPERS: Record<string, string> = {
  north: 'Align scene orientation with geographic north to get "real" sun shadows',
  north_offset: 'Rotation from scene north (-Z) to geographic north',

  marker_size_limits:
    'Both device groups. Optional. Refers to on-screen size of a default-sized marker. Relative sizes for items with a `size` set in `easy-floorplan` are maintained',
  coarse: `Touch overrides. Default ${MARKER_LIMITS.COARSE.min} / ${MARKER_LIMITS.COARSE.max}`,
  fine: `Mouse overrides. Default ${MARKER_LIMITS.FINE.min} / ${MARKER_LIMITS.FINE.max}`,
};

export const STYLE = `
  <style>
    .hint, .err { font-size: 12px; opacity: .7; margin: 4px 0 8px; }
    .err { color: var(--error-color, #a00); opacity: 1; }
    .headline-meta { display: flex; align-items: center; gap: 4px; }
    .dash { border: 1px solid var(--divider-color, #ccc); border-radius: 8px; margin-bottom: 10px; }
    .dash h4 { margin: 0; font-size: 14px; }
    .dash > .headline-meta { background-color: var(--primary-background-color, #fafafa); padding: 16px 12px 12px; border-radius: 8px 8px 0 0; }
    .view { margin: 16px 12px 0 }
    .view h5 { margin: 0; font-size: 13px; }
    .card { margin: 6px 0 12px 12px; padding-left: 6px; border-left: 2px solid var(--primary-color, #03a9f4); }
    .card h6 { margin: 0; font-size: 12px; font-weight: 600; }
    .meta { font-size: 11px; color: #e7e7e7; }
    .meta em { font-style: normal; color: #e7e7e7 }
    .dash:hover .meta em { color: #9f9f9f; }
    .warn { margin: 6px 0 12px 12px;  padding-left: 10px; font-size: 12px; color: var(--warning-color, #ac5000); border-left: 2px solid var(--warning-color, #ac5000); }
    ha-radio-option.floor { margin: 0; }
    ha-radio-option.area { margin: 0 0 0 2em; --ha-radio-option-toggle-size: 14px; }
    #rescan { margin: 8px 0; }
    ha-expansion-panel,
    ha-form {
      --ha-card-border-radius: 8px;
      margin-bottom: 1em;
    }
  </style>`;
