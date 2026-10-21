// Sun position and day/night lighting values for a given date and location.

import * as SunCalc from 'suncalc';
import * as THREE from 'three';
import { DAYLIGHT } from '../config/constants';

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export interface MoonState {
  direction: THREE.Vector3;
  intensity: number;
}

export interface DaylightState {
  direction: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  background: THREE.Color;
  floor: THREE.Color;
  ring: [THREE.Color, THREE.Color, THREE.Color];
}

/** Calendar fields in an IANA timezone, using the current instant as reference. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

/** Offset in milliseconds between a time-zone wall time and its UTC representation. */
function zoneOffset(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - date.getTime();
}

/**
 * Current time in the HA timezone. With overrides, the 15th and selected wall-clock hour
 * are used in that timezone, including its daylight-saving offset.
 */
export function makeDate(timeZone: string, override?: { month: number; hour: number }): Date {
  const now = new Date();
  if (!override) return now;
  const current = zonedParts(now, timeZone);
  const hour = Math.floor(override.hour);
  const minute = Math.round((override.hour % 1) * 60);
  const utc = Date.UTC(current.year, override.month - 1, 15, hour, minute);
  // Re-evaluate after the first adjustment to cover DST offset changes in the chosen month.
  let date = new Date(utc - zoneOffset(new Date(utc), timeZone));
  date = new Date(utc - zoneOffset(date, timeZone));
  return date;
}

export function computeDaylight(date: Date, lat: number, lon: number, northOffsetDeg: number): DaylightState {
  const pos = SunCalc.getPosition(date, lat, lon);
  const elevation = pos.altitude;
  const bearing = THREE.MathUtils.degToRad(pos.azimuth - northOffsetDeg);
  const shadowElevation = THREE.MathUtils.degToRad(Math.max(elevation, DAYLIGHT.MIN_SHADOW_ELEVATION));
  const direction = new THREE.Vector3(
    Math.cos(shadowElevation) * Math.sin(bearing),
    Math.sin(shadowElevation),
    -Math.cos(shadowElevation) * Math.cos(bearing),
  );
  const sunColor = new THREE.Color(DAYLIGHT.SUN_COLOR_LOW).lerp(
    new THREE.Color(DAYLIGHT.SUN_COLOR_HIGH),
    smooth(DAYLIGHT.SUN_COLOR_RANGE[0], DAYLIGHT.SUN_COLOR_RANGE[1], elevation),
  );
  const sunIntensity = DAYLIGHT.SUN_MAX_INTENSITY * smooth(DAYLIGHT.SUN_FADE_RANGE[0], DAYLIGHT.SUN_FADE_RANGE[1], elevation);

  const frames = DAYLIGHT.KEYFRAMES;
  let index = 0;
  while (index < frames.length - 2 && elevation > frames[index + 1].elevation) index++;
  const a = frames[index];
  const b = frames[index + 1];
  const t = THREE.MathUtils.clamp((elevation - a.elevation) / (b.elevation - a.elevation), 0, 1);
  const mix = (from: number, to: number) => new THREE.Color(from).lerp(new THREE.Color(to), t);

  const ringOf = (f: { floor: number; ring?: readonly number[] }) =>
    DAYLIGHT.RING_FALLBACK_DARKEN.map((k, i) =>
      f.ring?.[i] !== undefined ? new THREE.Color(f.ring[i]) : new THREE.Color(f.floor).multiplyScalar(k),
    );
  const ringA = ringOf(a);
  const ringB = ringOf(b);
  const ring = ringA.map((c, i) => c.clone().lerp(ringB[i], t)) as DaylightState['ring'];

  return {
    direction,
    sunColor,
    sunIntensity,
    hemiSky: mix(a.sky, b.sky),
    hemiGround: mix(a.ground, b.ground),
    hemiIntensity: THREE.MathUtils.lerp(a.intensity, b.intensity, t),
    background: mix(a.background, b.background),
    floor: mix(a.floor, b.floor),
    ring,
  };
}

/** Moon direction and intensity: scaled by phase, elevation and fades out in daylight. */
export function computeMoon(date: Date, lat: number, lon: number, northOffsetDeg: number): MoonState {
  const moon = SunCalc.getMoonPosition(date, lat, lon);
  const sun = SunCalc.getPosition(date, lat, lon);
  const bearing = THREE.MathUtils.degToRad(moon.azimuth - northOffsetDeg);
  const elevation = THREE.MathUtils.degToRad(Math.max(moon.altitude, DAYLIGHT.MIN_SHADOW_ELEVATION));
  const direction = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(bearing),
    Math.sin(elevation),
    -Math.cos(elevation) * Math.cos(bearing),
  );
  const { fraction } = SunCalc.getMoonIllumination(date);
  const phaseIntensity = THREE.MathUtils.lerp(DAYLIGHT.MOON_MIN_INTENSITY, DAYLIGHT.MOON_MAX_INTENSITY, fraction);
  const risen = smooth(DAYLIGHT.MOON_FADE_RANGE[0], DAYLIGHT.MOON_FADE_RANGE[1], moon.altitude);
  const night = 1 - smooth(DAYLIGHT.MOON_SUN_FADE_RANGE[0], DAYLIGHT.MOON_SUN_FADE_RANGE[1], sun.altitude);
  return { direction, intensity: phaseIntensity * risen * night };
}
