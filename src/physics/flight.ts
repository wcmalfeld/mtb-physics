/**
 * "Real air" jump model: a rider leaves a shaped takeoff, flies through moving air, and
 * meets a shaped landing. Compared with projectile.ts this adds
 *   - energy lost climbing the takeoff  (v_lip² = v_in² − 2·g·h)
 *   - aerodynamic drag  F = ½·ρ·CdA·v_rel²  and wind
 *   - a sloped landing, so we can ask how hard the ground hits back.
 *
 * Coordinates: origin at the takeoff lip. x = horizontal distance, y = height above the lip.
 * SI units; angles in degrees at the API boundary.
 */
import type { LabResult } from './labs';

export interface JumpGeometry {
  /** height of the lip above the run-in, m */
  lipHeight: number;
  /** angle of the lip (direction of travel at takeoff), degrees above horizontal */
  lipAngleDeg: number;
  /** horizontal distance from the lip to the landing knuckle, m */
  gap: number;
  /** height of the knuckle relative to the lip, m (negative = step-down, positive = step-up) */
  knuckleHeight: number;
  /** steepness of the landing slope, degrees below horizontal */
  landingAngleDeg: number;
  /** length of the landing slope measured along the slope, m */
  landingLength: number;
  /** true = the space between lip and knuckle is filled in level with the lip (a tabletop) */
  tabletop?: boolean;
}

export interface Air {
  /** air density, kg/m³ (0 = vacuum) */
  rho: number;
  /** gravitational acceleration, m/s² */
  g: number;
  /** headwind speed, m/s (positive blows against the rider, negative is a tailwind) */
  headwind: number;
}

export interface Body {
  /** rider + bike mass, kg */
  mass: number;
  /** drag area Cd·A, m² */
  cda: number;
}

export interface FlightSample { t: number; x: number; y: number; vx: number; vy: number }

export type LandingZone = 'case' | 'slope' | 'flat';

export interface AirFlight {
  takeoffSpeed: number;
  path: FlightSample[];
  airtime: number;
  /** horizontal distance from lip to touchdown */
  distance: number;
  /** touchdown height relative to the lip */
  landY: number;
  /** highest point relative to the lip */
  apex: number;
  zone: LandingZone;
  /** how far past the knuckle the rider touched down (negative = short of it), m horizontal */
  pastKnuckle: number;
  /** speed at touchdown */
  impactSpeed: number;
  /** slope of the ground where the rider touched down, degrees below horizontal */
  surfaceAngleDeg: number;
  /** angle between the flight path and the ground at touchdown, degrees */
  mismatchDeg: number;
  /** velocity component driven straight into the ground */
  vPerp: number;
  /** velocity component that keeps rolling along the ground */
  vPar: number;
  /** the flat-ground drop that would hit just as hard: vPerp² / 2g */
  equivalentDrop: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Energy conservation up the takeoff: ½v_in² = ½v_lip² + g·h. Returns null if the rider can't reach the lip. */
export function takeoffSpeed(approachSpeed: number, lipHeight: number, g: number): number | null {
  const v2 = approachSpeed * approachSpeed - 2 * g * lipHeight;
  return v2 > 0.25 ? Math.sqrt(v2) : null;
}

/** The ground as a list of straight pieces. Returns the corner points, left to right. */
export function terrainPoints(geo: JumpGeometry): { x: number; y: number }[] {
  const floor = -geo.lipHeight;
  const a = rad(geo.landingAngleDeg);
  const k = geo.knuckleHeight;
  if (geo.tabletop) {
    const tx = geo.gap + geo.landingLength * Math.cos(a);
    const ty = k - geo.landingLength * Math.sin(a);
    return [{ x: 0, y: 0 }, { x: geo.gap, y: k }, { x: tx, y: ty }, { x: tx + 400, y: ty }];
  }
  // the pit between takeoff and landing: run-in level for a normal double, a canyon for a step-down
  const pit = Math.min(floor, k - 1);
  const face = Math.min(geo.gap * 0.45, Math.max(0.4, (k - pit) * 0.7)); // steep front face of the landing mound
  const endX = geo.gap + geo.landingLength * Math.cos(a);
  const endY = k - geo.landingLength * Math.sin(a);
  return [
    { x: 0, y: floor },
    { x: Math.min(0.3, geo.gap * 0.1), y: pit },
    { x: geo.gap - face, y: pit },
    { x: geo.gap, y: k },
    { x: endX, y: endY },
    { x: endX + 400, y: endY },
  ];
}

/** Ground height and slope (dy/dx) under a given x > 0. */
export function terrainAt(geo: JumpGeometry, x: number): { y: number; slope: number } {
  const pts = terrainPoints(geo);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (x <= q.x || i === pts.length - 2) {
      const slope = (q.y - p.y) / (q.x - p.x);
      return { y: p.y + slope * (x - p.x), slope };
    }
  }
  return { y: pts[0].y, slope: 0 };
}

/**
 * Fly the jump. Fourth-order Runge–Kutta integration of
 *   dv/dt = −g·ĵ − (ρ·CdA / 2m)·|v_rel|·v_rel        with v_rel = v − v_wind
 * until the path meets the ground.
 */
export function simulateJump(approachSpeed: number, geo: JumpGeometry, body: Body, air: Air): LabResult<AirFlight> {
  const nums = [approachSpeed, geo.lipHeight, geo.lipAngleDeg, geo.gap, geo.knuckleHeight, geo.landingAngleDeg, geo.landingLength, body.mass, body.cda, air.rho, air.g, air.headwind];
  if (!nums.every(Number.isFinite)) return { ok: false, reason: 'A setting is not a valid number.' };
  if (body.mass <= 0 || air.g <= 0 || air.rho < 0 || body.cda < 0) return { ok: false, reason: 'Mass and gravity must be positive.' };
  if (geo.gap <= 0 || geo.landingLength <= 0) return { ok: false, reason: 'The jump needs a gap and a landing.' };
  const v0 = takeoffSpeed(approachSpeed, geo.lipHeight, air.g);
  if (v0 === null) return { ok: false, reason: 'Not enough speed to climb the takeoff: all the kinetic energy turns into height before the lip.' };

  const th = rad(geo.lipAngleDeg);
  const k = (air.rho * body.cda) / (2 * body.mass);
  const wx = -air.headwind;
  const acc = (vx: number, vy: number) => {
    const rx = vx - wx;
    const sp = Math.hypot(rx, vy);
    return { ax: -k * sp * rx, ay: -air.g - k * sp * vy };
  };
  const step = (s: FlightSample, dt: number): FlightSample => {
    const a1 = acc(s.vx, s.vy);
    const a2 = acc(s.vx + (a1.ax * dt) / 2, s.vy + (a1.ay * dt) / 2);
    const a3 = acc(s.vx + (a2.ax * dt) / 2, s.vy + (a2.ay * dt) / 2);
    const a4 = acc(s.vx + a3.ax * dt, s.vy + a3.ay * dt);
    const vx = s.vx + (dt * (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax)) / 6;
    const vy = s.vy + (dt * (a1.ay + 2 * a2.ay + 2 * a3.ay + a4.ay)) / 6;
    // position from the same RK4 slopes (velocity at the four stages)
    const x = s.x + (dt * (s.vx + 2 * (s.vx + (a1.ax * dt) / 2) + 2 * (s.vx + (a2.ax * dt) / 2) + (s.vx + a3.ax * dt))) / 6;
    const y = s.y + (dt * (s.vy + 2 * (s.vy + (a1.ay * dt) / 2) + 2 * (s.vy + (a2.ay * dt) / 2) + (s.vy + a3.ay * dt))) / 6;
    return { t: s.t + dt, x, y, vx, vy };
  };

  const DT = 1 / 240;
  let s: FlightSample = { t: 0, x: 0, y: 0, vx: v0 * Math.cos(th), vy: v0 * Math.sin(th) };
  const path: FlightSample[] = [s];
  let apex = 0;
  for (let i = 0; i < 240 * 20; i++) {
    const n = step(s, DT);
    apex = Math.max(apex, n.y);
    if (n.x <= 0 && n.t > 0.2) return { ok: false, reason: 'The wind blew the rider back behind the lip.' };
    if (n.x > 0.02 && n.y <= terrainAt(geo, n.x).y) {
      // bisect the last step for the touchdown instant
      let lo = 0, hi = DT, hit = n;
      for (let j = 0; j < 30; j++) {
        const mid = (lo + hi) / 2;
        const m = step(s, mid);
        if (m.y <= terrainAt(geo, m.x).y) { hi = mid; hit = m; } else lo = mid;
      }
      path.push(hit);
      const ground = terrainAt(geo, hit.x);
      const endX = geo.gap + geo.landingLength * Math.cos(rad(geo.landingAngleDeg));
      const zone: LandingZone = hit.x < geo.gap ? 'case' : hit.x <= endX ? 'slope' : 'flat';
      const surf = Math.atan(ground.slope); // negative on a downslope
      const tx = Math.cos(surf), ty = Math.sin(surf);
      const vPar = hit.vx * tx + hit.vy * ty;
      const vPerp = Math.abs(-hit.vx * ty + hit.vy * tx);
      return {
        ok: true,
        takeoffSpeed: v0,
        path,
        airtime: hit.t,
        distance: hit.x,
        landY: hit.y,
        apex,
        zone,
        pastKnuckle: hit.x - geo.gap,
        impactSpeed: Math.hypot(hit.vx, hit.vy),
        surfaceAngleDeg: (-surf * 180) / Math.PI,
        mismatchDeg: (Math.atan2(vPerp, Math.abs(vPar)) * 180) / Math.PI,
        vPerp,
        vPar,
        equivalentDrop: (vPerp * vPerp) / (2 * air.g),
      };
    }
    s = n;
    if (i % 2 === 1) path.push(s);
  }
  return { ok: false, reason: 'The rider never came back down within 20 seconds.' };
}

/**
 * Average load on the rider while the landing is absorbed, in g.
 * Stopping the into-the-ground speed vPerp over a distance d needs a = vPerp² / 2d,
 * and the ground also has to hold the rider up, hence the +1.
 */
export function impactG(vPerp: number, absorbDistance: number, g: number): number {
  if (!(absorbDistance > 0)) return Infinity;
  return (vPerp * vPerp) / (2 * absorbDistance * g) + 1;
}
