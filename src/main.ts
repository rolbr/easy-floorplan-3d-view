performance.mark('efp3d:module-start');

import pkg from '../package.json';
import { EasyFloorplan3DCard } from './card';
import { TAG_NAMES } from './config/constants';
import './editor/editor';

performance.mark('efp3d:import-complete');

customElements.define(TAG_NAMES.card, EasyFloorplan3DCard);

const dev_suffix =__DEV_BUILD__ ? ' DEV' : '';

window.customCards = window.customCards || [];
window.customCards.push({
  type: TAG_NAMES.card,
  name: `Easy Floorplan - 3D View${dev_suffix}`,
  description: '3D view sourced from Easy Floorplan',
});
// biome-ignore lint/suspicious/noConsole: one-off exception for startup banner
console.info(
  `%c EASY-FLOORPLAN-3D-VIEW %c ${pkg.version}${dev_suffix}`,
  'background:#03a9f4; color:#fff',
  'color:#03a9f4',
);
