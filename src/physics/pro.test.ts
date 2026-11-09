import { describe, expect, it } from 'vitest';
import { RHO0, airDensity, localGravity } from './atmosphere';
import { impactG, simulateJump, takeoffSpeed, terrainAt, type JumpGeometry } from './flight';
import { INERTIA, airtimeFor, inertia, simulateRotation, type RotationPlan } from './rotation';
import { buildCells, cornerSpeedLimit, formatClock, simulateRun } from './descent';
import { computeFlight } from './projectile';
import { CONDITIONS, RIDER_PRESETS, TRACKS } from '../data/tracks';
import { FEATURES } from '../data/features';
import { VENUES } from '../data/venues';

const body = { mass: 88, cda: 0.55 };
const vacuum = { rho: 0, g: 9.81, headwind: 0 };
const still = { rho: RHO0, g: 9.81, headwind: 0 };
const flat: JumpGeometry = { lipHeight: 0.001, lipAngleDeg: 30, gap: 1, knuckleHeight: 0, landingAngleDeg: 0, landingLength: 100 };
const fly = (...a: Parameters<typeof simulateJump>) => {
  const r = simulateJump(...a);
  if (!r.ok) throw new Error(r.reason);
  return r;
};

describe('atmosphere', () => {
  it('matches standard values', () => {
    expect(airDensity(0)).toBeCloseTo(1.225, 3);
    expect(airDensity(2000)).toBeCloseTo(1.0066, 2);
    expect(localGravity(45, 0)).toBeCloseTo(9.8062, 3);
    expect(localGravity(0, 0)).toBeCloseTo(9.7803, 4);
    expect(localGravity(90, 0)).toBeCloseTo(9.8322, 3);
  });
  it('thins with altitude and heat, and gravity falls with height', () => {
    expect(airDensity(1900)).toBeLessThan(airDensity(300));
    expect(airDensity(1200, 35)).toBeLessThan(airDensity(1200, 5));
    expect(localGravity(46, 2000)).toBeLessThan(localGravity(46, 0));
  });
});

describe('flight with real air', () => {
  it('reduces to the textbook projectile in a vacuum', () => {
    const r = fly(10, flat, body, vacuum);
    const v0 = takeoffSpeed(10, flat.lipHeight, 9.81)!;
    const ideal = (v0 * v0 * Math.sin((60 * Math.PI) / 180)) / 9.81;
    expect(r.distance).toBeCloseTo(ideal, 3);
    expect(r.airtime).toBeCloseTo(airtimeFor(v0, 30), 3);
    // and agrees with the Jump Lab's closed-form solver for a raised takeoff
    const jl = computeFlight({ speed: 8.9408, angleDeg: 20, height: 1.2192 });
    const drop: JumpGeometry = { ...flat, lipAngleDeg: 20, knuckleHeight: -1.2192, gap: 0.5 };
    const v = Math.sqrt(8.9408 ** 2 + 2 * 9.81 * drop.lipHeight);
    const rr = fly(v, drop, body, vacuum);
    if (!jl.ok) throw new Error('jump lab failed');
    expect(rr.distance).toBeCloseTo(jl.xLanding, 2);
  });
  it('conserves energy up the takeoff', () => {
    expect(takeoffSpeed(10, 2, 9.81)).toBeCloseTo(Math.sqrt(100 - 2 * 9.81 * 2), 10);
    expect(takeoffSpeed(5, 2, 9.81)).toBeNull();
    expect(simulateJump(5, { ...flat, lipHeight: 2 }, body, still).ok).toBe(false);
  });
  it('air shortens a jump; headwind shortens it more; tailwind helps', () => {
    const v = fly(20, flat, body, vacuum).distance;
    const a = fly(20, flat, body, still).distance;
    const head = fly(20, flat, body, { ...still, headwind: 8 }).distance;
    const tail = fly(20, flat, body, { ...still, headwind: -8 }).distance;
    expect(a).toBeLessThan(v);
    expect(head).toBeLessThan(a);
    expect(tail).toBeGreaterThan(a);
    // drag matters less for a heavier rider and in thinner air
    expect(fly(20, flat, { ...body, mass: 110 }, still).distance).toBeGreaterThan(a);
    expect(fly(20, flat, body, { ...still, rho: airDensity(1900) }).distance).toBeGreaterThan(a);
  });
  it('a matched downslope lands far softer than flat ground', () => {
    const geo: JumpGeometry = { lipHeight: 3, lipAngleDeg: 35, gap: 10, knuckleHeight: -0.5, landingAngleDeg: 33, landingLength: 9 };
    const slope = fly(13.2, geo, body, still);
    const toFlat = fly(13.2, { ...geo, landingAngleDeg: 0 }, body, still);
    expect(slope.zone).toBe('slope');
    expect(slope.equivalentDrop).toBeLessThan(toFlat.equivalentDrop / 2);
    expect(slope.vPerp ** 2 + slope.vPar ** 2).toBeCloseTo(slope.impactSpeed ** 2, 6);
    expect(impactG(slope.vPerp, 0.5, 9.81)).toBeLessThan(impactG(toFlat.vPerp, 0.5, 9.81));
    expect(impactG(0, 0.5, 9.81)).toBe(1);
  });
  it('classifies short, clean and long landings', () => {
    const geo = FEATURES.find((f) => f.id === 'slopestyle-booter')!.geo;
    expect(fly(11.5, geo, body, still).zone).toBe('case');
    expect(fly(13.2, geo, body, still).zone).toBe('slope');
    expect(fly(17, geo, body, still).zone).toBe('flat');
  });
  it('every preset lands on its downslope in still air, and the touchdown is on the ground', () => {
    for (const ft of FEATURES) {
      const r = fly(ft.approach, ft.geo, body, still);
      expect(r.zone, ft.id).toBe('slope');
      expect(r.landY).toBeCloseTo(terrainAt(ft.geo, r.distance).y, 3);
    }
  });
  it('returns a reason instead of NaN for bad input', () => {
    expect(simulateJump(NaN, flat, body, still).ok).toBe(false);
    expect(simulateJump(10, flat, { mass: 0, cda: 0.5 }, still).ok).toBe(false);
  });
});

describe('trick rotation', () => {
  const plan: RotationPlan = { axis: 'spin', turns: 1, airtime: 1.2, snapDegPerS: 300, tuck: 0, tuckFrom: 0.2, tuckTo: 0.8 };
  it('without a tuck, rotation = snap × airtime', () => {
    const r = simulateRotation(plan);
    expect(r.totalDeg).toBeCloseTo(360, 6);
    expect(r.verdict).toBe('clean');
  });
  it('tucking speeds the spin by I_open / I_tucked and conserves L', () => {
    const r = simulateRotation({ ...plan, tuck: 1 });
    expect(r.peakOmegaDegPerS).toBeCloseTo(300 * (INERTIA.spin.open / INERTIA.spin.tucked), 3);
    for (const s of r.samples) expect(s.inertia * ((s.omegaDegPerS * Math.PI) / 180)).toBeCloseTo(r.L, 8);
    expect(r.totalDeg).toBeGreaterThan(360);
    expect(inertia('flip', 0.5)).toBeCloseTo((INERTIA.flip.open + INERTIA.flip.tucked) / 2, 10);
  });
  it('flags under- and over-rotation and suggests the snap that fixes it', () => {
    const under = simulateRotation({ ...plan, turns: 2 });
    expect(under.verdict).toBe('under');
    const fixed = simulateRotation({ ...plan, turns: 2, snapDegPerS: under.idealSnapDegPerS });
    expect(fixed.errorDeg).toBeCloseTo(0, 4);
    expect(simulateRotation({ ...plan, snapDegPerS: 400 }).verdict).toBe('over');
  });
});

describe('race run', () => {
  const setup = (trackIdx: number, over = {}) => {
    const t = TRACKS[trackIdx];
    return { ...RIDER_PRESETS.elite, mu: CONDITIONS.dry.mu, rho: airDensity(t.finishAltitude + t.drop / 2), g: 9.806, ...over };
  };
  it('tracks keep their published length and drop', () => {
    for (const t of TRACKS) {
      const cells = buildCells(t);
      expect(Math.abs(cells.length - t.length)).toBeLessThanOrEqual(t.sections.length);
      const r = simulateRun(t, setup(TRACKS.indexOf(t)));
      expect(r.points[0].h).toBeCloseTo(t.drop, 6);
      expect(r.points[r.points.length - 1].h).toBeCloseTo(0, 6);
    }
  });
  it('the elite preset lands within 4% of the real 2026 winning time', () => {
    TRACKS.forEach((t, i) => {
      const r = simulateRun(t, setup(i));
      expect(Math.abs(r.time - t.reference[0].seconds) / t.reference[0].seconds, t.id).toBeLessThan(0.04);
    });
  });
  it('accounts for all the energy', () => {
    TRACKS.forEach((t, i) => {
      const { energy: e } = simulateRun(t, setup(i));
      const input = e.potential + e.pedal;
      const out = e.brakes + e.drag + e.rolling + e.kineticAtFinish;
      expect(Math.abs(out - input) / input).toBeLessThan(0.02);
      expect(e.potential).toBeCloseTo(RIDER_PRESETS.elite.mass * 9.806 * t.drop, -3);
    });
  });
  it('less grip, less commitment and softer braking are all slower', () => {
    const base = simulateRun(TRACKS[0], setup(0)).time;
    expect(simulateRun(TRACKS[0], setup(0, { mu: CONDITIONS.mud.mu })).time).toBeGreaterThan(base * 1.1);
    expect(simulateRun(TRACKS[0], setup(0, { cornerUse: 0.6 })).time).toBeGreaterThan(base);
    expect(simulateRun(TRACKS[0], setup(0, { brakeUse: 0.5 })).time).toBeGreaterThan(base);
    expect(simulateRun(TRACKS[0], setup(0, { cda: 0.3 })).time).toBeLessThan(base);
  });
  it('corner limit follows √(μ·g·r) and berms raise it', () => {
    expect(cornerSpeedLimit(10, 0.8, 0, 9.81)).toBeCloseTo(Math.sqrt(0.8 * 9.81 * 10), 10);
    expect(cornerSpeedLimit(10, 0.8, 0.35, 9.81)).toBeGreaterThan(cornerSpeedLimit(10, 0.8, 0, 9.81));
    expect(cornerSpeedLimit(Infinity, 0.8, 0, 9.81)).toBe(Infinity);
  });
  it('formats race clocks', () => {
    expect(formatClock(208.785, 3)).toBe('3:28.785');
    expect(formatClock(65.04, 1)).toBe('1:05.0');
    expect(formatClock(NaN)).toBe('—');
  });
});

describe('venue data', () => {
  it('has unique ids, sane coordinates, sources, and lab links that resolve', () => {
    const ids = new Set(VENUES.map((v) => v.id));
    expect(ids.size).toBe(VENUES.length);
    for (const v of VENUES) {
      expect(Math.abs(v.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(v.lon)).toBeLessThanOrEqual(180);
      expect(v.sources.length, v.id).toBeGreaterThan(0);
      for (const l of v.labs) {
        if (l.module === 'sendit' && l.preset) expect(FEATURES.some((f) => f.id === l.preset), l.preset).toBe(true);
        if (l.module === 'race' && l.preset) expect(TRACKS.some((t) => t.id === l.preset), l.preset).toBe(true);
      }
    }
    for (const t of TRACKS) expect(ids.has(t.venueId)).toBe(true);
    for (const f of FEATURES) if (f.venueId) expect(ids.has(f.venueId)).toBe(true);
  });
});

import { LEVELS, evaluateDesign, minRadius, profileArea, radiusForStraight, suggestDesign, transitionG, transitionGeometry, type BuildLevel } from './jumpDesign';

describe('jump design', () => {
  it('transition geometry adds up to the lip height', () => {
    const t = transitionGeometry(1, 30, 3);
    expect(t.arcHeight + t.straight * Math.sin(Math.PI / 6)).toBeCloseTo(1, 10);
    expect(t.arcHeight).toBeCloseTo(3 * (1 - Math.cos(Math.PI / 6)), 10);
    expect(transitionGeometry(0.3, 40, 5).fits).toBe(false);
    const r = radiusForStraight(1, 30, 0.8);
    expect(transitionGeometry(1, 30, r).straight).toBeCloseTo(0.8, 10);
  });
  it('minimum radius holds the transition to 1.5 g and quadruples when speed doubles', () => {
    expect(transitionG(6, minRadius(6))).toBeCloseTo(1.5, 10);
    expect(minRadius(12) / minRadius(6)).toBeCloseTo(4, 10);
  });
  it('suggested designs pass every hard check across speeds and levels', () => {
    for (const level of Object.keys(LEVELS) as BuildLevel[]) {
      for (let v = 4; v <= 11.5; v += 0.5) {
        const d = suggestDesign(v, level, 0.05);
        const e = evaluateDesign(d, level, 0.05);
        const failed = e.checks.filter((c) => c.status === 'fail').map((c) => c.id);
        expect(failed, `${level} @ ${v} m/s`).toEqual([]);
        expect(e.flights.design.ok && e.flights.design.zone, `${level} @ ${v}`).toBe('slope');
        expect(e.flights.slow.ok && e.flights.fast.ok && e.flights.fast.zone).toBe('slope');
        expect(d.lipHeight).toBeLessThanOrEqual(LEVELS[level].maxLip);
        expect(e.transition.fits).toBe(true);
        expect(e.sweetWindow).not.toBeNull();
      }
    }
  });
  it('a first-jump suggestion at 15 mph is in the range trail guides give for beginners', () => {
    const d = suggestDesign(6.7, 'first', 0.05);
    expect(d.lipHeight).toBeGreaterThanOrEqual(0.6); // 2–3 ft high
    expect(d.lipHeight).toBeLessThanOrEqual(0.92);
    expect(d.tableLength).toBeGreaterThan(1.2); // 4–7 ft long
    expect(d.tableLength).toBeLessThan(2.2);
  });
  it('flags designs that are wrong', () => {
    const d = suggestDesign(6.7, 'first', 0.05);
    const ids = (x: typeof d, lvl: BuildLevel = 'first') => evaluateDesign(x, lvl, 0.05).checks.filter((c) => c.status === 'fail').map((c) => c.id);
    expect(ids({ ...d, tableLength: d.tableLength + 3 })).toContain('design'); // lands on the table
    expect(ids({ ...d, lipHeight: 1.4 })).toContain('size');
    expect(ids({ ...d, lipHeight: 2, approach: 4 })).toContain('reach');
    expect(ids({ ...d, radius: 1.5, lipHeight: 0.9, approach: 8 })).toContain('radius');
    expect(evaluateDesign({ ...d, landingAngleDeg: 8, landingLength: 1.2 }, 'first', 0.15).verdict).not.toBe('pass');
  });
  it('dirt volume grows with every dimension', () => {
    const d = suggestDesign(6.7, 'first', 0.05);
    expect(profileArea({ ...d, tableLength: d.tableLength + 1 })).toBeCloseTo(profileArea(d) + d.lipHeight, 6);
    expect(profileArea({ ...d, lipHeight: d.lipHeight + 0.2, radius: 2 })).toBeGreaterThan(profileArea({ ...d, radius: 2 }));
  });
});
