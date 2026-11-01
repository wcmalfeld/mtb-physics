/**
 * Simplified 2D projectile model for an MTB jump (point mass, constant g, no air resistance).
 * Every input and output here is SI: meters, seconds, m/s, degrees for angles at the API boundary.
 *
 * Coordinate system: x = horizontal distance from the takeoff lip, y = height above the landing surface.
 * The takeoff point is (0, h). The landing surface is y = 0.
 */
import { degToRad, feetToMeters, mphToMs } from './units';

export const G = 9.81; // m/s²

/** Allowed ranges for the Jump Lab, stored in SI (converted from the spec's US values). */
export const JUMP_LIMITS = {
  speed: { min: mphToMs(5), max: mphToMs(30) }, // m/s
  angleDeg: { min: 5, max: 35 },
  height: { min: feetToMeters(1), max: feetToMeters(10) }, // m
  targetStart: { min: feetToMeters(5), max: feetToMeters(50) }, // m
  targetWidth: { min: feetToMeters(3), max: feetToMeters(15) }, // m
} as const;

export interface LaunchParams {
  /** launch speed v0 in m/s */
  speed: number;
  /** effective launch angle (direction of velocity at takeoff), degrees */
  angleDeg: number;
  /** takeoff height above the landing surface y0, meters */
  height: number;
}

export interface Target {
  /** horizontal gap from takeoff to the start of the landing zone, meters */
  start: number;
  /** width of the landing zone, meters */
  width: number;
}

export interface Components {
  vx: number;
  vy: number;
}

export type FlightResult =
  | {
      ok: true;
      vx: number;
      vy: number;
      /** time of the descending intersection with y = 0 */
      tLanding: number;
      /** horizontal landing distance from the takeoff point */
      xLanding: number;
      /** time and height of the highest point (apex) */
      tApex: number;
      yApex: number;
      /** vertical velocity just before landing (negative = downward) */
      vyLanding: number;
    }
  | { ok: false; reason: string };

export type Outcome =
  | { kind: 'inside'; fromStart: number; fromEnd: number }
  | { kind: 'short'; by: number }
  | { kind: 'overshot'; by: number }
  | { kind: 'invalid'; reason: string };

const TOL = 1e-9;
const inRange = (v: number, r: { min: number; max: number }) => v >= r.min - TOL && v <= r.max + TOL;

/** Resolve a speed and angle into horizontal and vertical components. */
export function velocityComponents(speed: number, angleDeg: number): Components {
  const theta = degToRad(angleDeg);
  return { vx: speed * Math.cos(theta), vy: speed * Math.sin(theta) };
}

/** Position at time t:  x = vx·t,  y = y0 + vy·t − ½·g·t² */
export function positionAt(p: LaunchParams, t: number): { x: number; y: number } {
  const { vx, vy } = velocityComponents(p.speed, p.angleDeg);
  return { x: vx * t, y: p.height + vy * t - 0.5 * G * t * t };
}

/** Check that parameters are finite and inside the Jump Lab's allowed ranges. Returns a reason or null. */
export function validateLaunch(p: LaunchParams): string | null {
  if (![p.speed, p.angleDeg, p.height].every(Number.isFinite)) return 'A setting is not a valid number.';
  if (!inRange(p.speed, JUMP_LIMITS.speed)) return 'Launch speed is outside the allowed range.';
  if (!inRange(p.angleDeg, JUMP_LIMITS.angleDeg)) return 'Launch angle is outside the allowed range.';
  if (!inRange(p.height, JUMP_LIMITS.height)) return 'Takeoff height is outside the allowed range.';
  return null;
}

/**
 * Compute the flight. Uses the positive (descending) root of
 *   0 = y0 + vy·t − ½·g·t²   →   t = (vy + √(vy² + 2·g·y0)) / g
 * The "+" root is always the later, descending crossing; the "−" root is ≤ 0 for y0 ≥ 0
 * (i.e. before or at takeoff), so it is never treated as a landing.
 */
export function computeFlight(p: LaunchParams, opts: { enforceBounds?: boolean } = {}): FlightResult {
  const enforce = opts.enforceBounds ?? true;
  if (enforce) {
    const why = validateLaunch(p);
    if (why) return { ok: false, reason: why };
  } else if (![p.speed, p.angleDeg, p.height].every(Number.isFinite) || p.speed < 0 || p.height < 0) {
    return { ok: false, reason: 'Settings must be finite, with non-negative speed and height.' };
  }

  const { vx, vy } = velocityComponents(p.speed, p.angleDeg);
  const disc = vy * vy + 2 * G * p.height;
  if (!(disc >= 0)) return { ok: false, reason: 'No landing point exists for these settings.' };

  const tLanding = (vy + Math.sqrt(disc)) / G;
  if (!Number.isFinite(tLanding) || tLanding <= 0) {
    return { ok: false, reason: 'The rider never descends to the landing height with these settings.' };
  }
  const xLanding = vx * tLanding;
  const tApex = Math.max(0, vy / G);
  const yApex = p.height + vy * tApex - 0.5 * G * tApex * tApex;
  const vyLanding = vy - G * tLanding;

  if (![xLanding, tApex, yApex, vyLanding].every(Number.isFinite)) {
    return { ok: false, reason: 'The calculation produced an invalid number.' };
  }
  return { ok: true, vx, vy, tLanding, xLanding, tApex, yApex, vyLanding };
}

/** Compare the landing distance to the target interval [start, start + width]. */
export function classifyLanding(flight: FlightResult, target: Target): Outcome {
  if (!flight.ok) return { kind: 'invalid', reason: flight.reason };
  if (![target.start, target.width].every(Number.isFinite) || target.width <= 0 || target.start < 0) {
    return { kind: 'invalid', reason: 'The landing target is not valid.' };
  }
  const end = target.start + target.width;
  const x = flight.xLanding;
  if (x < target.start) return { kind: 'short', by: target.start - x };
  if (x > end) return { kind: 'overshot', by: x - end };
  return { kind: 'inside', fromStart: x - target.start, fromEnd: end - x };
}

/** Sample the path from takeoff to landing for drawing. Deterministic: same inputs → same points. */
export function samplePath(p: LaunchParams, flight: FlightResult, n = 80): { t: number; x: number; y: number }[] {
  if (!flight.ok) return [];
  const pts: { t: number; x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (flight.tLanding * i) / n;
    const { x, y } = positionAt(p, t);
    pts.push({ t, x, y: i === n ? 0 : y });
  }
  return pts;
}
