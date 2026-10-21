// "Time override": moves the sun and tints the scene by time of day and season.
import type * as THREE from 'three';
import { DAYLIGHT } from '../config/constants';
import { computeDaylight, computeMoon, makeDate } from '../lib/sun-position';
import { setGroundHorizon, setGroundRing } from '../lib/world';
import type { ClipCaps } from '../types';
import type { TemplateRefs } from './template';

export interface TimeLights {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  floor: THREE.Mesh;
}

export class TimeController {
  private lights: TimeLights | null = null;
  private wired = false;
  private timer: number | undefined;
  private lat: number = DAYLIGHT.DEFAULT_LAT;
  private lon: number = DAYLIGHT.DEFAULT_LON;
  private northOffset: number = DAYLIGHT.DEFAULT_NORTH_OFFSET;
  private timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  private clipCaps: ClipCaps | null = null;
  private floorColor: THREE.Color | null = null;

  constructor(private refs: TemplateRefs) {}

  /** Cut caps follow the floor colour; null when the model is disposed. */
  setClipCaps(clipCaps: ClipCaps | null) {
    this.clipCaps = clipCaps;
    if (clipCaps && this.floorColor) clipCaps.setContrastFloorColor(this.floorColor);
  }

  attach(lights: TimeLights, northOffset?: number) {
    this.lights = lights;
    this.northOffset = northOffset ?? DAYLIGHT.DEFAULT_NORTH_OFFSET;
    const { toggleTime } = this.refs.toggles;
    const { timeSlider, monthSlider, timeGroup } = this.refs;

    if (!this.wired) {
      this.wired = true;
      timeSlider.addEventListener('input', () => this.update());
      monthSlider.addEventListener('input', () => this.update());
      toggleTime.addEventListener('change', () => {
        if (toggleTime.checked) {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.timeZone,
            month: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hourCycle: 'h23',
          }).formatToParts(new Date());
          const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
          timeSlider.value = String(value('hour') + value('minute') / 60);
          monthSlider.value = String(value('month'));
        }
        timeGroup.style.display = toggleTime.checked ? '' : 'none';
        this.update();
      });
      this.timer = window.setInterval(() => {
        if (!toggleTime.checked && this.refs.container.isConnected) this.update();
      }, DAYLIGHT.TICK_MS);
    }
    timeGroup.style.display = toggleTime.checked ? '' : 'none';
    this.update();
  }

  setLocation(lat?: number, lon?: number, timeZone?: string) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    const changed = lat !== this.lat || lon !== this.lon || (timeZone && timeZone !== this.timeZone);
    if (!changed) return;
    this.lat = lat;
    this.lon = lon;
    if (timeZone) this.timeZone = timeZone;
    this.update();
  }

  dispose() {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private update() {
    if (!this.lights) return;
    const { toggles, timeSlider, monthSlider, timeValue, monthValue } = this.refs;
    const overridden = toggles.toggleTime.checked;
    const hour = parseFloat(timeSlider.value);
    const month = parseInt(monthSlider.value, 10);
    const minutes = Math.round((hour % 1) * 60);
    timeValue.textContent = overridden ? `${String(Math.floor(hour)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : '';
    monthValue.textContent = overridden ? String(month) : '';

    const date = makeDate(this.timeZone, overridden ? { month, hour } : undefined);
    const state = computeDaylight(date, this.lat, this.lon, this.northOffset);
    const moonState = computeMoon(date, this.lat, this.lon, this.northOffset);
    const { scene, sun, moon, hemi, floor } = this.lights;
    moon.position.copy(moonState.direction).multiplyScalar(DAYLIGHT.SUN_DISTANCE);
    moon.intensity = moonState.intensity;
    sun.position.copy(state.direction).multiplyScalar(DAYLIGHT.SUN_DISTANCE);
    sun.color.copy(state.sunColor);
    sun.intensity = state.sunIntensity;
    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiIntensity;
    (scene.background as THREE.Color).copy(state.background);
    (floor.material as THREE.MeshStandardMaterial).color.copy(state.floor);
    setGroundHorizon(floor, state.background);
    this.floorColor = state.floor.clone();
    this.clipCaps?.setContrastFloorColor(state.floor);
    setGroundRing(floor, state.ring);
    this.refs.container.style.background = `#${state.background.getHexString()}`;
  }
}
