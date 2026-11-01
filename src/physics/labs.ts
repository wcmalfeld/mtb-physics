/**
 * Physics for the additional labs (SI units throughout).
 */

export type LabResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

/**
 * Constant-deceleration braking:
 *   stoppingDistance = v0² / (2·a)
 *   stoppingTime     = v0 / a
 * a is the magnitude of deceleration (> 0). a = 0 means the bike never stops in this model.
 */
export function computeBraking(
  initialSpeed: number,
  deceleration: number,
): LabResult<{ distance: number; time: number }> {
  if (!Number.isFinite(initialSpeed) || !Number.isFinite(deceleration)) {
    return { ok: false, reason: 'Speed and deceleration must be valid numbers.' };
  }
  if (initialSpeed < 0) return { ok: false, reason: 'Speed cannot be negative.' };
  const a = Math.abs(deceleration);
  if (a === 0) {
    return { ok: false, reason: 'With zero deceleration the rider never slows down, so there is no stopping point.' };
  }
  return { ok: true, distance: (initialSpeed * initialSpeed) / (2 * a), time: initialSpeed / a };
}

/** Speed and distance travelled at time t while braking (clamped at the stop). */
export function brakingStateAt(initialSpeed: number, deceleration: number, t: number) {
  const a = Math.abs(deceleration);
  const tStop = a > 0 ? initialSpeed / a : Infinity;
  const tc = Math.min(Math.max(t, 0), tStop);
  return { speed: initialSpeed - a * tc, distance: initialSpeed * tc - 0.5 * a * tc * tc };
}

/** Centripetal acceleration a = v² / r  (r > 0). Also reported as a multiple of g. */
export function computeCentripetal(
  speed: number,
  radius: number,
  g = 9.81,
): LabResult<{ acceleration: number; gForce: number }> {
  if (!Number.isFinite(speed) || !Number.isFinite(radius)) {
    return { ok: false, reason: 'Speed and radius must be valid numbers.' };
  }
  if (speed < 0) return { ok: false, reason: 'Speed cannot be negative.' };
  if (radius <= 0) return { ok: false, reason: 'Turn radius must be greater than zero.' };
  const acceleration = (speed * speed) / radius;
  return { ok: true, acceleration, gForce: acceleration / g };
}

/** Recombine components into magnitude and direction (degrees). */
export function combineComponents(x: number, y: number) {
  return { magnitude: Math.hypot(x, y), angleDeg: (Math.atan2(y, x) * 180) / Math.PI };
}
