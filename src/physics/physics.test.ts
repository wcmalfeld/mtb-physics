import { describe, expect, it } from 'vitest';
import {
  feetToMeters, metersToFeet, mphToMs, msToMph, MS_PER_MPH, fmt,
  speedToDisplay, lengthToDisplay, speedFromDisplay, lengthFromDisplay,
} from './units';
import {
  G, JUMP_LIMITS, classifyLanding, computeFlight, positionAt, samplePath, validateLaunch, velocityComponents,
  type LaunchParams,
} from './projectile';
import { brakingStateAt, combineComponents, computeBraking, computeCentripetal } from './labs';

const base: LaunchParams = { speed: 8.9408, angleDeg: 20, height: 1.2192 };
const ok = (p: LaunchParams) => {
  const f = computeFlight(p);
  if (!f.ok) throw new Error(f.reason);
  return f;
};

describe('1. unit conversions', () => {
  it('uses exact mph and foot definitions', () => {
    expect(MS_PER_MPH).toBeCloseTo(0.44704, 12);
    expect(mphToMs(20)).toBeCloseTo(8.9408, 12);
    expect(msToMph(8.9408)).toBeCloseTo(20, 12);
    expect(feetToMeters(4)).toBeCloseTo(1.2192, 12);
    expect(metersToFeet(0.3048)).toBeCloseTo(1, 12);
  });
  it('round-trips through display units without changing the SI value', () => {
    for (const u of ['us', 'metric'] as const) {
      expect(speedFromDisplay(speedToDisplay(7.3, u), u)).toBeCloseTo(7.3, 12);
      expect(lengthFromDisplay(lengthToDisplay(2.5, u), u)).toBeCloseTo(2.5, 12);
    }
  });
  it('formats invalid numbers safely', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
    expect(fmt(-0.01, 1)).toBe('0.0');
  });
});

describe('2. velocity components', () => {
  it('splits speed by angle', () => {
    const c = velocityComponents(10, 30);
    expect(c.vx).toBeCloseTo(10 * Math.sqrt(3) / 2, 10);
    expect(c.vy).toBeCloseTo(5, 10);
    const flat = velocityComponents(10, 0);
    expect(flat.vx).toBeCloseTo(10, 12);
    expect(flat.vy).toBeCloseTo(0, 12);
  });
  it('components recombine to the original magnitude', () => {
    const c = velocityComponents(8.9408, 20);
    expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(8.9408, 12);
  });
});

describe('3–4. flight time and landing distance (core sanity check)', () => {
  // 20 mph, 20°, 4 ft. Evaluated with the model's own equations and g = 9.81 m/s².
  // NOTE: the original spec listed ≈0.96 s / 8.07 m; those values are not consistent with
  // these inputs (they correspond to a takeoff height of ≈1.58 m / 5.2 ft). The equation gives:
  it('returns the positive descending landing time', () => {
    const f = ok(base);
    expect(f.tLanding).toBeGreaterThan(0);
    expect(f.tLanding).toBeCloseTo(0.8997, 3);
    expect(f.vyLanding).toBeLessThan(0); // moving downward at landing
    expect(f.tLanding).toBeGreaterThan(f.tApex);
  });
  it('lands at y = 0 at tLanding', () => {
    const f = ok(base);
    expect(positionAt(base, f.tLanding).y).toBeCloseTo(0, 9);
  });
  it('computes horizontal landing distance', () => {
    const f = ok(base);
    expect(f.xLanding).toBeCloseTo(7.559, 2);
    expect(metersToFeet(f.xLanding)).toBeCloseTo(24.8, 1);
    expect(f.xLanding).toBeCloseTo(f.vx * f.tLanding, 12);
  });
  it('apex is the highest sampled point', () => {
    const f = ok(base);
    const maxY = Math.max(...samplePath(base, f, 400).map((p) => p.y));
    expect(f.yApex).toBeGreaterThanOrEqual(maxY - 1e-9);
  });
});

describe('5. landing classification', () => {
  const f = ok(base); // lands ≈ 7.559 m
  it('short', () => {
    const o = classifyLanding(f, { start: 8, width: 2 });
    expect(o.kind).toBe('short');
    if (o.kind === 'short') expect(o.by).toBeCloseTo(8 - f.xLanding, 10);
  });
  it('inside', () => {
    expect(classifyLanding(f, { start: 7, width: 1 }).kind).toBe('inside');
  });
  it('inside on the exact edges', () => {
    expect(classifyLanding(f, { start: f.xLanding, width: 1 }).kind).toBe('inside');
    expect(classifyLanding(f, { start: f.xLanding - 1, width: 1 }).kind).toBe('inside');
  });
  it('overshot', () => {
    const o = classifyLanding(f, { start: 5, width: 2 });
    expect(o.kind).toBe('overshot');
    if (o.kind === 'overshot') expect(o.by).toBeCloseTo(f.xLanding - 7, 10);
  });
  it('moving the target never changes the trajectory', () => {
    const before = ok(base);
    classifyLanding(before, { start: 3, width: 1 });
    expect(ok(base)).toEqual(before);
  });
});

describe('6–8. parameter effects', () => {
  it('higher speed travels farther', () => {
    expect(ok({ ...base, speed: 11 }).xLanding).toBeGreaterThan(ok(base).xLanding);
  });
  it('different angle gives a different trajectory', () => {
    const a = ok(base), b = ok({ ...base, angleDeg: 30 });
    expect(b.vy).toBeGreaterThan(a.vy);
    expect(b.vx).toBeLessThan(a.vx);
    expect(b.tLanding).toBeGreaterThan(a.tLanding);
    expect(positionAt({ ...base, angleDeg: 30 }, 0.3).y).not.toBeCloseTo(positionAt(base, 0.3).y, 3);
  });
  it('higher takeoff means longer flight and farther landing', () => {
    const hi = ok({ ...base, height: feetToMeters(8) });
    expect(hi.tLanding).toBeGreaterThan(ok(base).tLanding);
    expect(hi.xLanding).toBeGreaterThan(ok(base).xLanding);
  });
});

describe('9. determinism', () => {
  it('identical inputs → identical outputs', () => {
    expect(computeFlight({ ...base })).toEqual(computeFlight({ ...base }));
    expect(samplePath(base, ok(base))).toEqual(samplePath(base, ok(base)));
  });
});

describe('10. invalid and out-of-bounds input', () => {
  it('rejects non-finite values without NaN output', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const f = computeFlight({ ...base, speed: bad });
      expect(f.ok).toBe(false);
      expect(classifyLanding(f, { start: 5, width: 2 }).kind).toBe('invalid');
    }
  });
  it('rejects values outside the Jump Lab ranges', () => {
    expect(validateLaunch({ ...base, speed: mphToMs(31) })).not.toBeNull();
    expect(validateLaunch({ ...base, angleDeg: 40 })).not.toBeNull();
    expect(validateLaunch({ ...base, height: feetToMeters(0.5) })).not.toBeNull();
    expect(computeFlight({ ...base, angleDeg: 2 }).ok).toBe(false);
  });
  it('accepts exact range edges', () => {
    const { speed, angleDeg, height } = JUMP_LIMITS;
    expect(computeFlight({ speed: speed.min, angleDeg: angleDeg.min, height: height.min }).ok).toBe(true);
    expect(computeFlight({ speed: speed.max, angleDeg: angleDeg.max, height: height.max }).ok).toBe(true);
  });
  it('rejects an invalid target', () => {
    expect(classifyLanding(ok(base), { start: 5, width: 0 }).kind).toBe('invalid');
  });
  it('unbounded mode still guards negatives', () => {
    expect(computeFlight({ speed: -1, angleDeg: 20, height: 1 }, { enforceBounds: false }).ok).toBe(false);
  });
  it('g is 9.81', () => expect(G).toBe(9.81));
});

describe('11–12. braking and cornering', () => {
  it('stopping distance and time', () => {
    const r = computeBraking(10, 5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.distance).toBeCloseTo(10, 12);
      expect(r.time).toBeCloseTo(2, 12);
    }
    const s = brakingStateAt(10, 5, 5);
    expect(s.speed).toBe(0);
    expect(s.distance).toBeCloseTo(10, 12);
  });
  it('doubling speed quadruples stopping distance', () => {
    const a = computeBraking(5, 4), b = computeBraking(10, 4);
    if (a.ok && b.ok) expect(b.distance / a.distance).toBeCloseTo(4, 12);
  });
  it('zero / invalid deceleration is handled without division by zero', () => {
    expect(computeBraking(10, 0).ok).toBe(false);
    expect(computeBraking(10, NaN).ok).toBe(false);
    expect(computeBraking(-1, 2).ok).toBe(false);
  });
  it('centripetal acceleration', () => {
    const r = computeCentripetal(10, 20);
    expect(r.ok && r.acceleration).toBeCloseTo(5, 12);
    expect(computeCentripetal(10, 0).ok).toBe(false);
    expect(computeCentripetal(10, -3).ok).toBe(false);
    expect(computeCentripetal(NaN, 3).ok).toBe(false);
  });
  it('vector recombination', () => {
    const c = combineComponents(3, 4);
    expect(c.magnitude).toBeCloseTo(5, 12);
    expect(c.angleDeg).toBeCloseTo(53.130, 3);
  });
});
