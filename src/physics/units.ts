/**
 * Unit conversions. All physics runs in SI (meters, seconds, m/s).
 * These helpers convert to and from display units only.
 *
 * Exact definitions:
 *   1 mile = 1609.344 m,  1 hour = 3600 s  →  1 mph = 0.44704 m/s
 *   1 foot = 0.3048 m
 */

export const METERS_PER_MILE = 1609.344;
export const SECONDS_PER_HOUR = 3600;
export const METERS_PER_FOOT = 0.3048;
export const MS_PER_MPH = METERS_PER_MILE / SECONDS_PER_HOUR; // 0.44704

export type UnitSystem = 'us' | 'metric';

export const mphToMs = (mph: number): number => mph * MS_PER_MPH;
export const msToMph = (ms: number): number => ms / MS_PER_MPH;
export const feetToMeters = (ft: number): number => ft * METERS_PER_FOOT;
export const metersToFeet = (m: number): number => m / METERS_PER_FOOT;

/** Display helpers: SI value in → value in the chosen display system. */
export const speedToDisplay = (ms: number, u: UnitSystem): number => (u === 'us' ? msToMph(ms) : ms);
export const speedFromDisplay = (v: number, u: UnitSystem): number => (u === 'us' ? mphToMs(v) : v);
export const lengthToDisplay = (m: number, u: UnitSystem): number => (u === 'us' ? metersToFeet(m) : m);
export const lengthFromDisplay = (v: number, u: UnitSystem): number => (u === 'us' ? feetToMeters(v) : v);

/** Velocity components are shown in ft/s (US) or m/s (metric) — mph is awkward for components in equations. */
export const velocityToDisplay = (ms: number, u: UnitSystem): number => (u === 'us' ? metersToFeet(ms) : ms);

export const unitLabels = (u: UnitSystem) =>
  u === 'us'
    ? { speed: 'mph', length: 'ft', velocity: 'ft/s', accel: 'ft/s²', g: '32.2 ft/s²' }
    : { speed: 'm/s', length: 'm', velocity: 'm/s', accel: 'm/s²', g: '9.81 m/s²' };

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Safe number formatting: never prints NaN or Infinity. */
export function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  // avoid "-0.0"
  return Number(fixed) === 0 ? (0).toFixed(digits) : fixed;
}
