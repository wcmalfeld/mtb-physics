/**
 * Trick rotation: conservation of angular momentum.
 * Once the wheels leave the lip nothing can twist the rider + bike (ignoring air), so
 *   L = I·ω  stays constant.
 * Pull in (smaller moment of inertia I) and the spin rate ω rises; open up and it slows.
 * SI units; angles in degrees at the API boundary.
 */

export type TrickAxis = 'flip' | 'spin';

/**
 * Rough moments of inertia for a ~75 kg rider on a ~12 kg dirt-jump bike, kg·m².
 * These are order-of-magnitude estimates built from published human body-segment data
 * plus a bike treated as two wheels and a frame. They set the *ratio* a tuck can achieve.
 */
export const INERTIA: Record<TrickAxis, { open: number; tucked: number }> = {
  flip: { open: 12, tucked: 7.5 }, // rotating about the left–right axis (backflip, frontflip)
  spin: { open: 6, tucked: 4.4 }, // rotating about the head-to-toe axis (360, 720 …)
};

export function inertia(axis: TrickAxis, tuck: number): number {
  const c = Math.min(1, Math.max(0, tuck));
  const { open, tucked } = INERTIA[axis];
  return open - (open - tucked) * c;
}

export interface RotationPlan {
  axis: TrickAxis;
  /** full rotations the trick needs */
  turns: number;
  /** time in the air, s */
  airtime: number;
  /** spin rate the rider leaves the lip with, in the open position, deg/s */
  snapDegPerS: number;
  /** how tight the tuck is, 0 = stays open, 1 = fully tucked */
  tuck: number;
  /** when the rider pulls in and opens back up, as fractions of the airtime */
  tuckFrom: number;
  tuckTo: number;
}

export interface RotationSample { t: number; angleDeg: number; omegaDegPerS: number; inertia: number; tuck: number }

export interface RotationResult {
  samples: RotationSample[];
  /** angular momentum, kg·m²/s (constant for the whole flight) */
  L: number;
  totalDeg: number;
  targetDeg: number;
  /** positive = over-rotated, negative = under-rotated */
  errorDeg: number;
  verdict: 'clean' | 'under' | 'over';
  peakOmegaDegPerS: number;
  /** the takeoff snap that would land this exact plan perfectly */
  idealSnapDegPerS: number;
}

/** How far off a landing can be and still be ridden out. */
export const LANDING_TOLERANCE_DEG = 25;
const RAMP = 0.12; // seconds to pull in or open out

/** Tuck amount at time t: smooth ramp in at tuckFrom, out at tuckTo. */
export function tuckAt(plan: RotationPlan, t: number): number {
  const a = plan.tuckFrom * plan.airtime, b = plan.tuckTo * plan.airtime;
  if (b <= a) return 0;
  const smooth = (u: number) => { const c = Math.min(1, Math.max(0, u)); return c * c * (3 - 2 * c); };
  return plan.tuck * Math.min(smooth((t - a) / RAMP), 1 - smooth((t - (b - RAMP)) / RAMP));
}

export function simulateRotation(plan: RotationPlan): RotationResult {
  const L = inertia(plan.axis, 0) * ((plan.snapDegPerS * Math.PI) / 180);
  const N = 240;
  const dt = plan.airtime / N;
  let angle = 0, peak = 0;
  const samples: RotationSample[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i * dt;
    const tk = tuckAt(plan, t);
    const I = inertia(plan.axis, tk);
    const omega = ((L / I) * 180) / Math.PI;
    peak = Math.max(peak, omega);
    samples.push({ t, angleDeg: angle, omegaDegPerS: omega, inertia: I, tuck: tk });
    if (i < N) {
      // midpoint rule: evaluate the spin rate half a step ahead
      const Im = inertia(plan.axis, tuckAt(plan, t + dt / 2));
      angle += (((L / Im) * 180) / Math.PI) * dt;
    }
  }
  const targetDeg = plan.turns * 360;
  const errorDeg = angle - targetDeg;
  const verdict = Math.abs(errorDeg) <= LANDING_TOLERANCE_DEG ? 'clean' : errorDeg < 0 ? 'under' : 'over';
  // rotation is exactly proportional to L, so the perfect snap is a simple ratio
  const idealSnapDegPerS = angle > 0 ? (plan.snapDegPerS * targetDeg) / angle : Infinity;
  return { samples, L, totalDeg: angle, targetDeg, errorDeg, verdict, peakOmegaDegPerS: peak, idealSnapDegPerS };
}

/** Airtime for a jump that lands at the same height it took off from: t = 2·v·sinθ / g. */
export function airtimeFor(speed: number, lipAngleDeg: number, g = 9.81): number {
  return (2 * speed * Math.sin((lipAngleDeg * Math.PI) / 180)) / g;
}
