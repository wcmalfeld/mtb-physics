/**
 * "Try it without the simulation" checks. Numeric answers are computed with the same physics module
 * so the expected answer always matches the model.
 */
import { computeFlight, positionAt, velocityComponents } from '../../physics/projectile';
import { feetToMeters, mphToMs } from '../../physics/units';
import type { ConceptId } from './challenges';

export type TransferItem =
  | {
      kind: 'numeric';
      id: string;
      prompt: string;
      unit: string;
      answer: number;
      tolerance: number;
      solution: string;
    }
  | {
      kind: 'choice';
      id: string;
      prompt: string;
      options: { value: string; label: string }[];
      correct: string;
      solution: string;
    }
  | { kind: 'text'; id: string; prompt: string; sample: string }
  | {
      kind: 'graph';
      id: string;
      prompt: string;
      path: { x: number; y: number }[]; // in feet
      xMax: number;
      yMax: number;
      options: { value: string; label: string }[];
      correct: string;
      solution: string;
    };

export interface TransferCheck {
  id: string;
  title: string;
  concept: ConceptId;
  items: TransferItem[];
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function buildCompareVy(): TransferItem {
  // A: 20 mph at 30°, B: 25 mph at 20° — computed, not hard-coded
  const a = velocityComponents(mphToMs(20), 30).vy;
  const b = velocityComponents(mphToMs(25), 20).vy;
  const correct = Math.abs(a - b) < 1e-9 ? 'same' : a > b ? 'A' : 'B';
  return {
    kind: 'choice',
    id: 'compare-vy-q',
    prompt: 'Rider A launches at 20 mph at 30°. Rider B launches at 25 mph at 20°. Who has the greater initial vertical velocity vy?',
    options: [
      { value: 'A', label: 'Rider A' },
      { value: 'B', label: 'Rider B' },
      { value: 'same', label: 'They are equal' },
    ],
    correct,
    solution: `vy = v₀·sin θ. A: 20 × sin 30° = ${round(20 * Math.sin(Math.PI / 6), 1)} mph. B: 25 × sin 20° = ${round(25 * Math.sin((20 * Math.PI) / 180), 1)} mph. The steeper angle wins even with less total speed.`,
  };
}

function buildGraph(): TransferItem {
  const p = { speed: mphToMs(18), angleDeg: 25, height: feetToMeters(3) };
  const f = computeFlight(p);
  const ft = 1 / 0.3048;
  const path: { x: number; y: number }[] = [];
  let xLand = 0;
  if (f.ok) {
    xLand = f.xLanding * ft;
    for (let i = 0; i <= 40; i++) {
      const t = (f.tLanding * i) / 40;
      const pos = positionAt(p, t);
      path.push({ x: pos.x * ft, y: Math.max(0, pos.y * ft) });
    }
  }
  const nearest = Math.round(xLand / 5) * 5; // nearest 5 ft
  const opts = [nearest - 10, nearest - 5, nearest, nearest + 5].filter((v) => v > 0);
  return {
    kind: 'graph',
    id: 'graph-q',
    prompt: 'This graph shows a trajectory (height vs. horizontal distance, in feet). About how far from the takeoff does the rider land?',
    path,
    xMax: Math.ceil((xLand + 6) / 5) * 5,
    yMax: 8,
    options: opts.map((v) => ({ value: String(v), label: `About ${v} ft` })),
    correct: String(nearest),
    solution: `The curve meets the ground line (height = 0) at about ${round(xLand, 1)} ft, closest to ${nearest} ft. The landing is where height returns to zero, not the highest point.`,
  };
}

export const TRANSFER_CHECKS: TransferCheck[] = [
  {
    id: 'calc-vx',
    title: 'Calculate a horizontal component',
    concept: 'components',
    items: [
      {
        kind: 'numeric',
        id: 'calc-vx-q',
        prompt: 'A rider leaves the lip at 20 ft/s at an angle of 30°. What is the horizontal velocity vx? (Use vx = v₀·cos θ.)',
        unit: 'ft/s',
        answer: 20 * Math.cos(Math.PI / 6),
        tolerance: 0.15,
        solution: 'vx = 20 × cos 30° = 20 × 0.866 ≈ 17.3 ft/s.',
      },
    ],
  },
  {
    id: 'compare-vy',
    title: 'Compare vertical velocities',
    concept: 'angle',
    items: [buildCompareVy()],
  },
  {
    id: 'height-time',
    title: 'Height and flight time',
    concept: 'height',
    items: [
      {
        kind: 'choice',
        id: 'height-time-q',
        prompt: 'Speed and angle stay the same, but the takeoff is raised. In this model, the flight time…',
        options: [
          { value: 'up', label: 'increases' },
          { value: 'down', label: 'decreases' },
          { value: 'same', label: 'stays the same' },
        ],
        correct: 'up',
        solution: 'The rider starts higher, so gravity has farther to pull the rider before reaching the landing height. More time in the air.',
      },
      {
        kind: 'text',
        id: 'height-time-text',
        prompt: 'In one or two sentences, explain why.',
        sample: 'Starting higher means the rider has to fall farther before reaching the landing surface, and falling farther takes more time.',
      },
    ],
  },
  {
    id: 'target-traj',
    title: 'Target vs. trajectory',
    concept: 'target',
    items: [
      {
        kind: 'text',
        id: 'target-traj-text',
        prompt: 'Explain why moving the landing target does not change the rider’s trajectory.',
        sample: 'The path only depends on how the rider leaves the lip (speed, angle, height) and gravity. The target is just where we hope to land; moving it changes whether we hit it, not how the rider flies.',
      },
    ],
  },
  {
    id: 'read-graph',
    title: 'Read a trajectory graph',
    concept: 'reading',
    items: [buildGraph()],
  },
  {
    id: 'calc-vy',
    title: 'Calculate a vertical component',
    concept: 'components',
    items: [
      {
        kind: 'numeric',
        id: 'calc-vy-q',
        prompt: 'A rider launches at 15 ft/s at 40°. What is the initial vertical velocity vy? (Use vy = v₀·sin θ.)',
        unit: 'ft/s',
        answer: 15 * Math.sin((40 * Math.PI) / 180),
        tolerance: 0.15,
        solution: 'vy = 15 × sin 40° = 15 × 0.643 ≈ 9.6 ft/s.',
      },
    ],
  },
];

export const getTransfer = (id: string | null) => TRANSFER_CHECKS.find((t) => t.id === id) ?? null;
