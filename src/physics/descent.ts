/**
 * Downhill race-run model: a point-mass "lap time" simulation, the same idea race engineers use.
 *
 * The track is cut into 1 m pieces. Three passes decide the speed in every piece:
 *   1. Corner limit:   the fastest the tires can hold the turn      v² = g·r·(sinβ + μ·cosβ)/(cosβ − μ·sinβ)
 *   2. Forward pass:   gravity (and a start sprint) speed the rider up, drag and rough ground slow them
 *   3. Backward pass:  the rider must already be braking early enough to make each corner
 * Time is the sum of (1 m / speed). Energy is tracked the whole way so we can see where the
 * mountain's potential energy went.
 *
 * SI units throughout.
 */

export interface TrackSection {
  name: string;
  /** length along the trail, m */
  length: number;
  /** relative steepness; scaled so the whole track loses exactly `drop` meters */
  steepness: number;
  /** number of real corners in this section */
  corners: number;
  /** typical corner radius, m */
  radius: number;
  /** berm banking angle, degrees (0 = flat turn) */
  bankDeg: number;
  /** rolling + roughness resistance coefficient: smooth hardpack ≈ 0.03, rock garden ≈ 0.12 */
  crr: number;
  /** true where riders can put pedal strokes in */
  pedal?: boolean;
}

export interface Track {
  id: string;
  /** total length, m */
  length: number;
  /** total vertical drop, m */
  drop: number;
  sections: TrackSection[];
}

export interface RunSetup {
  /** rider + bike, kg */
  mass: number;
  /** drag area, m² */
  cda: number;
  /** tire–ground friction coefficient for the conditions */
  mu: number;
  /** fraction of the available cornering grip the rider dares to use, 0–1 */
  cornerUse: number;
  /** fraction of the available grip used when braking, 0–1 */
  brakeUse: number;
  /** sprint power where pedalling is possible, W */
  power: number;
  rho: number;
  g: number;
}

export interface RunPoint {
  /** distance from the start gate, m */
  s: number;
  /** height above the finish line, m */
  h: number;
  /** speed, m/s */
  v: number;
  /** elapsed time, s */
  t: number;
  /** sideways load in corners, g */
  lateralG: number;
  braking: boolean;
  section: number;
}

export interface RunResult {
  time: number;
  points: RunPoint[];
  topSpeed: number;
  avgSpeed: number;
  peakLateralG: number;
  /** joules */
  energy: { potential: number; pedal: number; brakes: number; drag: number; rolling: number; kineticAtFinish: number };
  sectionTimes: number[];
  /** share of the run spent on the brakes, 0–1 */
  brakingShare: number;
}

interface Cell { theta: number; radius: number; bank: number; crr: number; pedal: boolean; section: number }

const TURN_ANGLE = 1.4; // radians swept by a typical corner (~80°)
const PEDAL_MAX_SPEED = 13; // m/s: above this, DH gearing spins out

/** Expand a track into 1 m cells with slope, corner radius, banking and surface. */
export function buildCells(track: Track): Cell[] {
  const totalLen = track.sections.reduce((a, s) => a + s.length, 0);
  const lenScale = track.length / totalLen;
  const weighted = track.sections.reduce((a, s) => a + s.length * lenScale * s.steepness, 0);
  const cells: Cell[] = [];
  track.sections.forEach((sec, si) => {
    const n = Math.max(1, Math.round(sec.length * lenScale));
    // drop per meter of trail = sin(slope angle)
    const sinT = Math.min(0.75, (sec.steepness * track.drop) / weighted);
    const theta = Math.asin(sinT);
    const arc = Math.max(3, Math.round(sec.radius * TURN_ANGLE));
    const spacing = sec.corners > 0 ? n / sec.corners : Infinity;
    for (let i = 0; i < n; i++) {
      let inCorner = false;
      if (sec.corners > 0) {
        const local = i % spacing;
        const start = Math.max(0, (spacing - arc) * 0.6);
        inCorner = local >= start && local < start + arc;
      }
      cells.push({ theta, radius: inCorner ? sec.radius : Infinity, bank: inCorner ? (sec.bankDeg * Math.PI) / 180 : 0, crr: sec.crr, pedal: !!sec.pedal, section: si });
    }
  });
  return cells;
}

/** Fastest speed a turn can be held: flat when bank = 0, faster on a berm. */
export function cornerSpeedLimit(radius: number, mu: number, bankRad: number, g: number): number {
  if (!Number.isFinite(radius)) return Infinity;
  const den = Math.cos(bankRad) - mu * Math.sin(bankRad);
  if (den <= 0.05) return Infinity; // berm steep enough that grip is never the limit
  return Math.sqrt((g * radius * (Math.sin(bankRad) + mu * Math.cos(bankRad))) / den);
}

export function simulateRun(track: Track, setup: RunSetup): RunResult {
  const cells = buildCells(track);
  const n = cells.length;
  const { mass: m, g } = setup;
  const kDrag = (setup.rho * setup.cda) / 2;
  const muCorner = setup.mu * setup.cornerUse;
  const muBrake = setup.mu * setup.brakeUse;

  const vMax = cells.map((c) => cornerSpeedLimit(c.radius, muCorner, c.bank, g * Math.cos(c.theta)));

  /** forces along the trail with the brakes off, N */
  const free = (c: Cell, v: number) => {
    const gravity = m * g * Math.sin(c.theta);
    const rolling = c.crr * m * g * Math.cos(c.theta);
    const drag = kDrag * v * v;
    const pedal = c.pedal && v < PEDAL_MAX_SPEED ? setup.power / Math.max(v, 3) : 0;
    return { gravity, rolling, drag, pedal, net: gravity - rolling - drag + pedal };
  };

  // forward pass (no brakes except to respect each corner's own limit)
  const vf = new Array<number>(n + 1);
  vf[0] = 1;
  for (let i = 0; i < n; i++) {
    const a = free(cells[i], vf[i]).net / m;
    vf[i + 1] = Math.min(Math.sqrt(Math.max(1, vf[i] * vf[i] + 2 * a)), vMax[Math.min(i + 1, n - 1)]);
  }
  // backward pass: latest possible braking
  const v = vf.slice();
  for (let i = n - 1; i >= 0; i--) {
    const c = cells[i];
    const f = free(c, v[i + 1]);
    const decel = Math.max(0.3, (muBrake * m * g * Math.cos(c.theta) - f.gravity + f.rolling + f.drag) / m);
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * decel));
  }

  const points: RunPoint[] = [];
  const sectionTimes = track.sections.map(() => 0);
  const energy = { potential: 0, pedal: 0, brakes: 0, drag: 0, rolling: 0, kineticAtFinish: 0 };
  let t = 0, h = track.drop, top = 0, peakLat = 0, brakeTime = 0;
  // exact drop of the discretized track, so the profile ends at zero
  const drops = cells.map((c) => Math.sin(c.theta));
  const dropScale = track.drop / drops.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const vAvg = (v[i] + v[i + 1]) / 2;
    const dt = 1 / vAvg;
    const f = free(c, vAvg);
    const dKE = 0.5 * m * (v[i + 1] * v[i + 1] - v[i] * v[i]);
    const brake = Math.max(0, f.net - dKE); // work removed by the brakes over this 1 m
    energy.potential += f.gravity;
    energy.pedal += f.pedal;
    energy.drag += f.drag;
    energy.rolling += f.rolling;
    energy.brakes += brake;
    const lat = Number.isFinite(c.radius) ? (vAvg * vAvg) / c.radius / g : 0;
    const braking = brake > 0.02 * m * g;
    if (braking) brakeTime += dt;
    points.push({ s: i, h, v: v[i], t, lateralG: lat, braking, section: c.section });
    t += dt;
    h -= drops[i] * dropScale;
    sectionTimes[c.section] += dt;
    top = Math.max(top, v[i + 1]);
    peakLat = Math.max(peakLat, lat);
  }
  points.push({ s: n, h: 0, v: v[n], t, lateralG: 0, braking: false, section: cells[n - 1].section });
  energy.kineticAtFinish = 0.5 * m * v[n] * v[n];
  return { time: t, points, topSpeed: top, avgSpeed: n / t, peakLateralG: peakLat, energy, sectionTimes, brakingShare: brakeTime / t };
}

/** "3:28.785" style race clock. */
export function formatClock(seconds: number, digits = 1): string {
  if (!Number.isFinite(seconds)) return '—';
  const mnt = Math.floor(seconds / 60);
  const s = seconds - mnt * 60;
  return `${mnt}:${s.toFixed(digits).padStart(digits ? digits + 3 : 2, '0')}`;
}
