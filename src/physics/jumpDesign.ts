/**
 * Jump design: turn a measured approach speed into buildable dimensions for a tabletop jump,
 * then stress-test the design across the speeds a real rider will actually arrive with.
 *
 * Design rules used here, and where they come from:
 *  - Transition radius: keep the extra load in the takeoff near or under 1.5 g, r ≥ v² / (1.5·g)   (trailism.com jump-design notes)
 *  - A straight section at the top of the lip, about 0.25 s of travel, so the bike leaves settled    (same source)
 *  - Landing judged by equivalent fall height, EFH = v⊥² / 2g. Snow-park research treats about 1.5 m as an upper
 *    bound and notes that no agreed figure exists for bikes                                            (Hubbard, McNeil and others)
 *  - Beginner tabletops 2–3 ft high and 4–7 ft long, at least 5 ft wide, landings wider               (IMBA Canada)
 *  - Landings at least one bike length long, ideally two                                              (BikeRadar)
 *
 * SI units; angles in degrees at the API boundary.
 */
import { simulateJump, takeoffSpeed, type AirFlight, type JumpGeometry } from './flight';
import { RHO0 } from './atmosphere';

export type BuildLevel = 'first' | 'intermediate' | 'advanced';

export const LEVELS: Record<BuildLevel, { label: string; maxLip: number; maxAngle: number; maxLanding: number; efhLimit: number; lip: number; angle: number }> = {
  first: { label: 'First jumps', maxLip: 0.9, maxAngle: 25, maxLanding: 25, efhLimit: 0.5, lip: 0.6, angle: 20 },
  intermediate: { label: 'Comfortable jumping', maxLip: 1.5, maxAngle: 35, maxLanding: 32, efhLimit: 1.0, lip: 1.0, angle: 30 },
  advanced: { label: 'Experienced', maxLip: 2.0, maxAngle: 45, maxLanding: 38, efhLimit: 1.5, lip: 1.5, angle: 38 },
};

export const LIP_G_LIMIT = 1.5; // extra g in the transition
export const SETTLE_TIME = 0.25; // seconds of straight lip
export const BIKE_LENGTH = 1.9; // m, wheelbase plus a wheel: a typical adult mountain bike
const BODY = { mass: 85, cda: 0.55 };

export interface JumpDesign {
  /** speed at the bottom of the takeoff, m/s */
  approach: number;
  lipHeight: number;
  lipAngleDeg: number;
  /** transition radius, m */
  radius: number;
  /** length of the flat table from lip to knuckle, m */
  tableLength: number;
  landingAngleDeg: number;
  /** length of the landing measured down the slope, m */
  landingLength: number;
  /** riding width of the lip, m */
  width: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Tightest transition that keeps the extra load at or under the limit: r = v² / (limit·g). */
export function minRadius(speed: number, g = 9.81, limit = LIP_G_LIMIT): number {
  return (speed * speed) / (limit * g);
}

/** Extra load felt in a transition of radius r at speed v, in g: v² / (r·g). */
export function transitionG(speed: number, radius: number, g = 9.81): number {
  return (speed * speed) / (radius * g);
}

/**
 * A takeoff is a circular arc that turns the bike from flat to the lip angle, then a straight ramp to the lip.
 *   arc height = r·(1 − cosθ)      arc run = r·sinθ
 *   straight length s solves   lip height = arc height + s·sinθ
 * A negative straight means the arc alone is already taller than the lip: that radius cannot fit.
 */
export function transitionGeometry(lipHeight: number, lipAngleDeg: number, radius: number) {
  const t = rad(lipAngleDeg);
  const arcHeight = radius * (1 - Math.cos(t));
  const arcRun = radius * Math.sin(t);
  const straight = (lipHeight - arcHeight) / Math.sin(t);
  const run = arcRun + Math.max(0, straight) * Math.cos(t);
  return { arcHeight, arcRun, straight, run, fits: straight >= -1e-9 };
}

/** The radius that leaves exactly `straight` meters of flat ramp before the lip. */
export function radiusForStraight(lipHeight: number, lipAngleDeg: number, straight: number): number {
  const t = rad(lipAngleDeg);
  return (lipHeight - straight * Math.sin(t)) / (1 - Math.cos(t));
}

export function designGeometry(d: JumpDesign): JumpGeometry {
  return {
    lipHeight: d.lipHeight, lipAngleDeg: d.lipAngleDeg, gap: d.tableLength, knuckleHeight: 0,
    landingAngleDeg: d.landingAngleDeg, landingLength: d.landingLength, tabletop: true,
  };
}

export function flyDesign(d: JumpDesign, approach = d.approach, g = 9.81) {
  return simulateJump(approach, designGeometry(d), BODY, { rho: RHO0, g, headwind: 0 });
}

/** Where the rider comes back down to lip height if the table went on forever, and how steeply. */
function levelFlight(approach: number, lipHeight: number, lipAngleDeg: number, g: number) {
  const r = simulateJump(approach, { lipHeight, lipAngleDeg, gap: 500, knuckleHeight: 0, landingAngleDeg: 10, landingLength: 5, tabletop: true }, BODY, { rho: RHO0, g, headwind: 0 });
  if (!r.ok) return null;
  const last = r.path[r.path.length - 1];
  return { distance: r.distance, descentDeg: (Math.atan2(-last.vy, last.vx) * 180) / Math.PI };
}

/**
 * Suggest a full set of dimensions from a measured speed.
 *  1. Lip height: the level's usual size, but never so tall that climbing it eats more than ~45% of the kinetic energy.
 *  2. Radius: leaves 0.25 s of straight lip, and is never tighter than the 1.5 g limit.
 *  3. Table: as long as the flight of a rider arriving `tolerance` slow, so slow hits still reach the knuckle.
 *  4. Landing angle: a few degrees shallower than the flight path at design speed.
 *  5. Landing length: long enough that a rider arriving `tolerance` fast still touches down on the slope with
 *     half a bike length to spare. Flight distance grows with speed squared, so this is usually longer than the
 *     takeoff is tall, which is why jumps are built on ground that falls away.
 */
export function suggestDesign(approach: number, level: BuildLevel, tolerance: number, g = 9.81): JumpDesign {
  const L = LEVELS[level];
  const lipHeight = Math.max(0.3, Math.min(L.lip, Math.round(((0.45 * approach * approach) / (2 * g)) * 20) / 20));
  const vLip = takeoffSpeed(approach, lipHeight, g) ?? approach * 0.7;
  // faster jumps need gentler transitions, and a gentle transition only fits under the lip at a lower angle
  let lipAngleDeg = L.angle;
  while (lipAngleDeg > 15 && radiusForStraight(lipHeight, lipAngleDeg, 0.5 * SETTLE_TIME * vLip) < minRadius(approach, g)) lipAngleDeg -= 1;
  const fitted = radiusForStraight(lipHeight, lipAngleDeg, SETTLE_TIME * vLip);
  const rMin = minRadius(approach, g);
  const rMaxFit = radiusForStraight(lipHeight, lipAngleDeg, 0);
  const radius = Math.max(1.5, Math.min(Math.floor(rMaxFit * 10) / 10, Math.ceil(Math.max(fitted, rMin) * 10) / 10));
  const slow = levelFlight(approach * (1 - tolerance), lipHeight, lipAngleDeg, g);
  const mid = levelFlight(approach, lipHeight, lipAngleDeg, g);
  const tableLength = Math.max(0.4, Math.floor((slow ? slow.distance : 1.2) * 0.97 * 10) / 10);
  const landingAngleDeg = Math.round(Math.max(12, Math.min(L.maxLanding, (mid ? mid.descentDeg : lipAngleDeg) - 4)));
  const draft: JumpDesign = { approach, lipHeight, lipAngleDeg, radius, tableLength, landingAngleDeg, landingLength: 40, width: 1.5 };
  const fast = flyDesign(draft, approach * (1 + tolerance), g);
  const reach = fast.ok ? fast.pastKnuckle / Math.cos(rad(landingAngleDeg)) : BIKE_LENGTH;
  const landingLength = Math.max(BIKE_LENGTH, Math.ceil((reach + BIKE_LENGTH / 2) * 10) / 10);
  return { ...draft, landingLength };
}

export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface Check { id: string; status: CheckStatus; title: string; detail: string }

export interface SweepPoint { approach: number; zone: AirFlight['zone'] | 'none'; efh: number; distance: number }

export interface Evaluation {
  geo: JumpGeometry;
  lipSpeed: number | null;
  transition: ReturnType<typeof transitionGeometry>;
  rMin: number;
  lipG: number;
  flights: { slow: ReturnType<typeof flyDesign>; design: ReturnType<typeof flyDesign>; fast: ReturnType<typeof flyDesign> };
  sweep: SweepPoint[];
  /** approach speeds that land on the downslope under the impact limit, m/s (null if none) */
  sweetWindow: [number, number] | null;
  /** approach speeds whose impact stays under the limit wherever they land, m/s */
  forgivingWindow: [number, number] | null;
  landingLength: number;
  /** horizontal length of the whole jump, takeoff start to landing end, m */
  footprint: number;
  /** how far the bottom of the landing sits below the base of the takeoff, m (0 on flat ground) */
  groundFall: number;
  /** packed dirt needed above the takeoff's ground level, m³ */
  volume: number;
  /** vertical drop of a roll-in that would give the approach speed without pedalling, m */
  rollInHeight: number;
  checks: Check[];
  verdict: CheckStatus;
}

/** Cross-section area of the jump (side view), m². */
export function profileArea(d: JumpDesign): number {
  const tr = transitionGeometry(d.lipHeight, d.lipAngleDeg, d.radius);
  const t = rad(d.lipAngleDeg);
  // arc: area under y = r − √(r² − x²) from 0 to r·sinθ
  const r = d.radius;
  const arc = r * tr.arcRun - (0.5 * r * r * t + 0.5 * tr.arcRun * r * Math.cos(t));
  const s = Math.max(0, tr.straight);
  const ramp = s * Math.cos(t) * (Math.min(tr.arcHeight, d.lipHeight) + d.lipHeight) * 0.5;
  const table = d.lipHeight * d.tableLength;
  // only the part of the landing that stands above the takeoff's ground level is fill
  const hl = Math.min(d.lipHeight, d.landingLength * Math.sin(rad(d.landingAngleDeg)));
  const landing = hl > 0 ? 0.5 * hl * (hl / Math.tan(rad(Math.max(5, d.landingAngleDeg)))) : 0;
  return Math.max(0, arc) + ramp + table + landing;
}

const metricLen = (m: number) => (m < 1 ? `${(m * 100).toFixed(0)} cm` : `${m.toFixed(2)} m`);

/** `len` formats a length in meters for the check messages (the UI passes feet-and-inches for US units). */
export function evaluateDesign(d: JumpDesign, level: BuildLevel, tolerance: number, g = 9.81, len: (m: number) => string = metricLen): Evaluation {
  const L = LEVELS[level];
  const geo = designGeometry(d);
  const lipSpeed = takeoffSpeed(d.approach, d.lipHeight, g);
  const transition = transitionGeometry(d.lipHeight, d.lipAngleDeg, d.radius);
  const rMin = minRadius(d.approach, g);
  const lipG = transitionG(d.approach, d.radius, g);
  const flights = { slow: flyDesign(d, d.approach * (1 - tolerance), g), design: flyDesign(d, d.approach, g), fast: flyDesign(d, d.approach * (1 + tolerance), g) };

  const sweep: SweepPoint[] = [];
  const lo = d.approach * 0.6, hi = d.approach * 1.4;
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const v = lo + ((hi - lo) * i) / N;
    const r = flyDesign(d, v, g);
    sweep.push(r.ok ? { approach: v, zone: r.zone, efh: r.equivalentDrop, distance: r.distance } : { approach: v, zone: 'none', efh: NaN, distance: 0 });
  }
  const windowAround = (ok: (p: SweepPoint) => boolean): [number, number] | null => {
    const mid = N / 2;
    if (!ok(sweep[mid])) return null;
    let a = mid, b = mid;
    while (a > 0 && ok(sweep[a - 1])) a--;
    while (b < N && ok(sweep[b + 1])) b++;
    return [sweep[a].approach, sweep[b].approach];
  };
  const sweetWindow = windowAround((p) => p.zone === 'slope' && p.efh <= L.efhLimit);
  const forgivingWindow = windowAround((p) => p.zone !== 'none' && p.efh <= L.efhLimit);

  const landingLength = geo.landingLength;
  const groundFall = Math.max(0, landingLength * Math.sin(rad(d.landingAngleDeg)) - d.lipHeight);
  const footprint = transition.run + d.tableLength + landingLength * Math.cos(rad(d.landingAngleDeg));
  // side slopes add roughly 30% to a straight-sided block of the riding width (landing built 1.5× wider)
  const volume = profileArea(d) * d.width * 1.3;
  const rollInHeight = ((d.approach * d.approach) / (2 * g)) * 1.25; // +25% for rolling and air losses

  const checks: Check[] = [];
  const add = (id: string, status: CheckStatus, title: string, detail: string) => checks.push({ id, status, title, detail });
  const cm = len;

  if (lipSpeed === null) add('reach', 'fail', 'Not enough speed to reach the lip', 'All the kinetic energy turns into height before the top. Lower the lip or find more speed.');
  else {
    const kept = (lipSpeed / d.approach) ** 2;
    add('reach', kept < 0.5 ? 'warn' : 'pass', `Leaves the lip at ${Math.round((lipSpeed / d.approach) * 100)}% of approach speed`,
      kept < 0.5 ? 'Climbing this lip uses more than half the kinetic energy. Small changes in speed will change the flight a lot.' : 'v_lip² = v² − 2·g·h. The climb costs speed, but leaves plenty to fly with.');
  }
  add('size', d.lipHeight > L.maxLip + 1e-9 || d.lipAngleDeg > L.maxAngle ? 'fail' : 'pass',
    d.lipHeight > L.maxLip + 1e-9 || d.lipAngleDeg > L.maxAngle ? `Too big for “${L.label}”` : `Size suits “${L.label}”`,
    `This level tops out at a ${cm(L.maxLip)} lip and a ${L.maxAngle}° takeoff.`);
  add('radius', lipG > LIP_G_LIMIT * 1.25 ? 'fail' : lipG > LIP_G_LIMIT + 0.03 ? 'warn' : 'pass', `Transition load ${lipG.toFixed(1)} g extra`,
    lipG > LIP_G_LIMIT + 0.03 ? `Tight for this speed: it will compress and buck the bike. A radius of ${len(rMin)} or more keeps it under ${LIP_G_LIMIT} g.` : `v² / (r·g) stays under the ${LIP_G_LIMIT} g guide, so the bike is not slammed into the takeoff.`);
  if (!transition.fits) add('straight', 'fail', 'This radius does not fit under the lip', `An arc of this radius reaches ${cm(transition.arcHeight)} before it gets to ${d.lipAngleDeg}°, taller than the lip. Use a smaller radius, a taller lip or a lower angle.`);
  else {
    const want = SETTLE_TIME * (lipSpeed ?? d.approach);
    add('straight', transition.straight < want * 0.5 ? 'warn' : 'pass', `${cm(transition.straight)} of straight lip`,
      transition.straight < want * 0.5 ? `The curve runs almost to the top, which kicks the bike as it leaves. About ${cm(want)} of straight ramp (0.25 s of travel) gives a calmer takeoff.` : 'Enough straight ramp for the bike to settle before it leaves the ground.');
  }
  const { slow, design, fast } = flights;
  if (design.ok) {
    const run = landingLength * Math.cos(rad(d.landingAngleDeg));
    add('design', design.zone === 'slope' ? (design.pastKnuckle > run * 0.75 ? 'warn' : 'pass') : 'fail',
      design.zone === 'slope' ? `At your speed you land ${cm(design.pastKnuckle)} past the knuckle` : design.zone === 'case' ? 'At your speed you land on the table' : 'At your speed you overshoot the landing',
      design.zone === 'slope' ? (design.pastKnuckle > run * 0.75 ? 'That is near the bottom of the landing. Lengthen the table so you touch down higher up.' : 'On the downslope, with room either side.') : design.zone === 'case' ? 'Shorten the table until the design-speed flight reaches the downslope.' : 'Lengthen the table or make the landing steeper so there is slope under the flight path.');
    add('impact', design.equivalentDrop > L.efhLimit ? 'fail' : 'pass', `Landing feels like a ${cm(design.equivalentDrop)} drop to flat`,
      `Equivalent fall height v⊥² / 2g. The target for this level is under ${cm(L.efhLimit)}.`);
  }
  if (slow.ok && fast.ok) {
    const worst = Math.max(slow.equivalentDrop, fast.equivalentDrop);
    const where = (z: AirFlight['zone']) => (z === 'slope' ? 'the downslope' : z === 'case' ? 'the table' : 'the flat past the landing');
    add('window', worst > L.efhLimit ? 'fail' : slow.zone !== 'slope' || fast.zone !== 'slope' ? 'warn' : 'pass',
      `±${Math.round(tolerance * 100)}% speed: lands on ${where(slow.zone)} (slow) and ${where(fast.zone)} (fast)`,
      worst > L.efhLimit ? `The harder of those two landings feels like a ${cm(worst)} drop to flat, over the ${cm(L.efhLimit)} target. Nobody arrives at exactly the same speed twice.`
        : slow.zone !== 'slope' || fast.zone !== 'slope' ? `Both impacts stay under the target (worst ${cm(worst)}), but one misses the downslope. Adjust the table or landing to centre the window.` : `Both still land on the downslope, worst impact ${cm(worst)}.`);
  }
  add('landing', landingLength < BIKE_LENGTH ? 'warn' : 'pass', `Landing slope ${len(landingLength)} long`,
    landingLength < BIKE_LENGTH ? 'Shorter than one bike length. A lower landing angle makes it longer.' : landingLength < 2 * BIKE_LENGTH ? 'At least one bike length. Two is the usual ideal.' : 'Two bike lengths or more.');
  if (groundFall > 0.15) add('ground', 'warn', `Needs ground that falls ${cm(groundFall)} by the end of the landing`,
    `The landing drops further than the lip is tall, so its lower end sits below the base of the takeoff. Build on a hill that falls about ${Math.round((groundFall / footprint) * 100)}% along the jump, or dig the landing in. On flat ground, shorten the landing and accept a narrower speed window.`);
  add('width', d.width < 1.5 ? 'warn' : 'pass', `Lip ${len(d.width)} wide`, d.width < 1.5 ? `Guides suggest ${len(1.524)} or more, with the landing wider still.` : 'Build the landing about 1.5× this width.');

  const verdict: CheckStatus = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { geo, lipSpeed, transition, rMin, lipG, flights, sweep, sweetWindow, forgivingWindow, landingLength, groundFall, footprint, volume, rollInHeight, checks, verdict };
}
