import type { FlightResult, LaunchParams, Outcome, Target } from '../../physics/projectile';
import { feetToMeters, mphToMs } from '../../physics/units';

export type ControlKey = 'speed' | 'angle' | 'height' | 'gap' | 'width';
export type PredictionType = 'outcome' | 'distance' | 'airtime';
export type ConceptId = 'components' | 'speed' | 'angle' | 'height' | 'target' | 'reading' | 'variables';

export const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'components', label: 'Velocity components (vx, vy)' },
  { id: 'speed', label: 'Launch speed and distance' },
  { id: 'angle', label: 'Launch angle and trajectory shape' },
  { id: 'height', label: 'Takeoff height and flight time' },
  { id: 'target', label: 'Target vs. trajectory' },
  { id: 'reading', label: 'Reading a trajectory graph' },
  { id: 'variables', label: 'Changing one variable at a time' },
];

export interface Launch {
  params: LaunchParams;
  target: Target;
  flight: FlightResult;
  outcome: Outcome;
  prediction: { type: PredictionType; choice: string } | null;
  /** the launch before this one, used by comparison predictions */
  reference: { params: LaunchParams; flight: FlightResult } | null;
}

export interface SavedAttemptLite {
  params: LaunchParams;
}

export interface ChallengeContext {
  history: Launch[];
  attempts: SavedAttemptLite[];
  answers: Record<string, string>;
  vectorsOpened: boolean;
}

export interface Progress {
  met: boolean;
  message: string;
}

export interface Challenge {
  id: string;
  number: number;
  title: string;
  goal: string;
  steps: string[];
  start: { params: LaunchParams; target: Target };
  unlocked: ControlKey[];
  predictionType: PredictionType;
  predictFirstDefault: boolean;
  predictionRequired: boolean;
  hints: [string, string, string];
  reflection: string;
  tutorNote: string;
  transferId: string | null;
  concept: ConceptId;
  check: (ctx: ChallengeContext) => Progress;
  /** an in-challenge question (e.g. Compare Two Runs) */
  question?: (ctx: ChallengeContext) => ChallengeQuestion | null;
  openVectors?: boolean;
}

export interface ChallengeQuestion {
  id: string;
  prompt: string;
  options: { value: string; label: string }[];
  correct: string;
  explain: string;
}

const us = (mph: number, angleDeg: number, ft: number, gapFt = 20, widthFt = 8) => ({
  params: { speed: mphToMs(mph), angleDeg, height: feetToMeters(ft) },
  target: { start: feetToMeters(gapFt), width: feetToMeters(widthFt) },
});

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Find two launches in history that differ only in `key` (speed / angleDeg / height). */
function pairDifferingOnly(history: Launch[], key: keyof LaunchParams): [Launch, Launch] | null {
  const keys: (keyof LaunchParams)[] = ['speed', 'angleDeg', 'height'];
  for (let i = history.length - 1; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      const a = history[j], b = history[i];
      if (!a.flight.ok || !b.flight.ok) continue;
      const ok = keys.every((k) => (k === key ? !same(a.params[k], b.params[k]) : same(a.params[k], b.params[k])));
      if (ok) return [a, b];
    }
  }
  return null;
}

export type Fmt = {
  speed: (ms: number) => string;
  length: (m: number) => string;
  time: (s: number) => string;
};

/** Messages need unit-aware formatting; the store injects a formatter at runtime. */
let F: Fmt = {
  speed: (v) => `${v.toFixed(1)} m/s`,
  length: (v) => `${v.toFixed(1)} m`,
  time: (v) => `${v.toFixed(2)} s`,
};
export const setChallengeFormatter = (f: Fmt) => {
  F = f;
};

function variableQuestion(ctx: ChallengeContext): ChallengeQuestion | null {
  if (ctx.attempts.length < 2) return null;
  const [a, b] = ctx.attempts.slice(-2);
  const diffs: string[] = [];
  if (!same(a.params.speed, b.params.speed)) diffs.push('speed');
  if (!same(a.params.angleDeg, b.params.angleDeg)) diffs.push('angle');
  if (!same(a.params.height, b.params.height)) diffs.push('height');
  const correct = diffs.length === 1 ? diffs[0] : diffs.length === 0 ? 'none' : 'several';
  const explain =
    correct === 'several'
      ? `More than one setting changed (${diffs.join(' and ')}), so we can't tell which one caused the difference. Try again changing just one.`
      : correct === 'none'
        ? 'Both saved runs used the same launch settings, so their trajectories match. Change one setting and save again.'
        : `Only the ${correct} changed between the last two saved runs, so the ${correct} is responsible for the different trajectory.`;
  return {
    id: `compare-${a.params.speed.toFixed(4)}-${a.params.angleDeg}-${a.params.height.toFixed(4)}-${b.params.speed.toFixed(4)}-${b.params.angleDeg}-${b.params.height.toFixed(4)}`,
    prompt: 'Look at your last two saved runs. Which setting caused the difference?',
    options: [
      { value: 'speed', label: 'Launch speed' },
      { value: 'angle', label: 'Launch angle' },
      { value: 'height', label: 'Takeoff height' },
      { value: 'several', label: 'More than one changed' },
      { value: 'none', label: 'Nothing changed' },
    ],
    correct,
    explain,
  };
}

const COMPONENT_Q: ChallengeQuestion = {
  id: 'explain-angle-components',
  prompt: 'Keeping the same speed, you increase the launch angle. What happens to the components?',
  options: [
    { value: 'a', label: 'vx gets smaller, vy gets bigger' },
    { value: 'b', label: 'vx gets bigger, vy gets smaller' },
    { value: 'c', label: 'Both get bigger' },
    { value: 'd', label: 'Neither changes' },
  ],
  correct: 'a',
  explain:
    'vx = v₀·cos θ and vy = v₀·sin θ. As θ grows, cos θ shrinks and sin θ grows, so the same speed is shared differently: less forward, more upward.',
};

export const CHALLENGES: Challenge[] = [
  {
    id: 'first-jump',
    number: 1,
    title: 'First Jump',
    goal: 'See how launch speed changes jump distance.',
    steps: ['Launch at the starting speed.', 'Change only the speed.', 'Launch again and compare where the rider lands.'],
    start: us(15, 20, 4),
    unlocked: ['speed'],
    predictionType: 'distance',
    predictFirstDefault: false,
    predictionRequired: false,
    hints: [
      'Launch speed is how fast the rider leaves the lip. A faster rider covers more ground every second.',
      'Keep the angle and height the same so speed is the only thing that changes between launches.',
      'Try 15 mph, then 25 mph. Distance = vx × flight time, and a higher speed increases both vx and vy (which lengthens the flight).',
    ],
    reflection: 'When the speed went up, what happened to the distance? Was the change bigger or smaller than you expected?',
    tutorNote: 'Ask the student to say a prediction out loud before the second launch. Point out that distance grew faster than speed.',
    transferId: 'calc-vx',
    concept: 'speed',
    check: (ctx) => {
      const pair = pairDifferingOnly(ctx.history, 'speed');
      if (!pair) return { met: false, message: 'Launch twice with different speeds (same angle and height).' };
      const [a, b] = pair;
      if (!a.flight.ok || !b.flight.ok) return { met: false, message: '' };
      return {
        met: true,
        message: `At ${F.speed(a.params.speed)} the rider landed ${F.length(a.flight.xLanding)} away; at ${F.speed(b.params.speed)}, ${F.length(b.flight.xLanding)}.`,
      };
    },
  },
  {
    id: 'angle',
    number: 2,
    title: 'Angle Experiment',
    goal: 'Compare two jumps at the same speed but different launch angles.',
    steps: ['Launch at 10° and press Save Attempt.', 'Change only the angle (try 30°).', 'Launch, save again, and compare the two paths.'],
    start: us(20, 10, 4),
    unlocked: ['angle'],
    predictionType: 'airtime',
    predictFirstDefault: true,
    predictionRequired: false,
    hints: [
      'The launch angle is the direction the rider is moving at the lip, not necessarily the ramp’s shape.',
      'A steeper angle points more of the same speed upward. Watch the vy value.',
      'With the speed fixed, vy = v₀·sin θ grows with θ. More upward speed means it takes longer for gravity to bring the rider down.',
    ],
    reflection: 'The speed stayed the same. Where did the extra height come from when the angle increased?',
    tutorNote: 'Use saved attempts so both paths stay visible. Ask: “What changed when we kept the speed the same and increased the angle?”',
    transferId: 'compare-vy',
    concept: 'angle',
    check: (ctx) => {
      const pair = pairDifferingOnly(ctx.history, 'angleDeg');
      if (!pair) return { met: false, message: 'Launch twice with different angles (same speed and height).' };
      const [a, b] = pair;
      if (!a.flight.ok || !b.flight.ok) return { met: false, message: '' };
      return {
        met: true,
        message: `At ${a.params.angleDeg}° the flight lasted ${F.time(a.flight.tLanding)}; at ${b.params.angleDeg}°, ${F.time(b.flight.tLanding)}.`,
      };
    },
  },
  {
    id: 'height',
    number: 3,
    title: 'Takeoff Height',
    goal: 'Find out how takeoff height above the landing affects the jump.',
    steps: ['Launch from 2 ft.', 'Raise only the takeoff height.', 'Launch again and compare flight time and distance.'],
    start: us(18, 15, 2),
    unlocked: ['height'],
    predictionType: 'distance',
    predictFirstDefault: true,
    predictionRequired: false,
    hints: [
      'Height is vertical: how far above the landing surface the rider takes off. It is not the gap distance.',
      'Gravity pulls the rider down the whole time. A higher start gives gravity more distance to work through.',
      'Flight time t = (vy + √(vy² + 2·g·h)) / g. A bigger h makes the square root bigger, so t grows, and distance = vx × t grows too.',
    ],
    reflection: 'Why does a higher takeoff keep the rider in the air longer, even with the same speed and angle?',
    tutorNote: 'Emphasize that height and gap are different: one is vertical, one is horizontal.',
    transferId: 'height-time',
    concept: 'height',
    check: (ctx) => {
      const pair = pairDifferingOnly(ctx.history, 'height');
      if (!pair) return { met: false, message: 'Launch twice with different heights (same speed and angle).' };
      const [a, b] = pair;
      if (!a.flight.ok || !b.flight.ok) return { met: false, message: '' };
      return {
        met: true,
        message: `From ${F.length(a.params.height)}: ${F.time(a.flight.tLanding)} in the air. From ${F.length(b.params.height)}: ${F.time(b.flight.tLanding)}.`,
      };
    },
  },
  {
    id: 'dial-in',
    number: 4,
    title: 'Dial In the Landing',
    goal: 'Find settings that land the rider inside the target.',
    steps: ['Launch to see where the rider lands now.', 'Adjust speed, angle, or height.', 'Keep testing until the landing is inside the target.'],
    start: us(20, 20, 4, 30, 6),
    unlocked: ['speed', 'angle', 'height'],
    predictionType: 'outcome',
    predictFirstDefault: false,
    predictionRequired: false,
    hints: [
      'The target sits a fixed distance away. You need the landing distance to fall between its start and end.',
      'Landing short? You need more horizontal distance. Overshooting? You need less. Change one setting in small steps.',
      'Speed has the strongest effect. From the start, try raising speed by 2–3 mph at a time and launch after each change.',
    ],
    reflection: 'Is there more than one setting that works? Try to find a second one.',
    tutorNote: 'Several solutions exist. Challenge a fast finisher to land inside using a different variable.',
    transferId: 'target-traj',
    concept: 'target',
    check: (ctx) => {
      const hit = [...ctx.history].reverse().find((l) => l.outcome.kind === 'inside');
      if (!hit || hit.outcome.kind !== 'inside' || !hit.flight.ok)
        return { met: false, message: 'Land inside the target zone.' };
      return {
        met: true,
        message: `Landed ${F.length(hit.outcome.fromStart)} past the start of the ${F.length(hit.target.width)} target.`,
      };
    },
  },
  {
    id: 'predict',
    number: 5,
    title: 'Predict the Flight',
    goal: 'Predict the landing before you launch, then explain what happened.',
    steps: ['Look at the settings and the target.', 'Choose your prediction.', 'Launch and compare the result with your prediction.'],
    start: us(22, 12, 6, 26, 6),
    unlocked: ['speed', 'angle', 'height'],
    predictionType: 'outcome',
    predictFirstDefault: true,
    predictionRequired: true,
    hints: [
      'Think about the earlier challenges: what does each setting do to distance?',
      'Compare this setup to the default jump (20 mph, 20°, 4 ft lands about 25 ft away). Which settings are bigger or smaller here?',
      'Here the speed is a little higher and the takeoff is higher, but the angle is lower. Higher speed and height add distance; a lower angle shortens the time in the air.',
    ],
    reflection: 'What would you change for the next attempt, and why?',
    tutorNote: 'A mismatch between prediction and result is the most useful moment: ask which idea it challenges.',
    transferId: 'read-graph',
    concept: 'reading',
    check: (ctx) => {
      const p = [...ctx.history].reverse().find((l) => l.prediction);
      if (!p) return { met: false, message: 'Make a prediction, then launch.' };
      return { met: true, message: 'You made a prediction and tested it. Now explain what you noticed.' };
    },
  },
  {
    id: 'compare',
    number: 6,
    title: 'Compare Two Runs',
    goal: 'Save two runs and identify which setting caused the difference.',
    steps: ['Launch and press Save Attempt.', 'Change ONE setting, launch, and save again.', 'Answer the question below.'],
    start: us(18, 20, 3),
    unlocked: ['speed', 'angle', 'height'],
    predictionType: 'distance',
    predictFirstDefault: false,
    predictionRequired: false,
    hints: [
      'A fair comparison changes only one thing at a time.',
      'Check the Saved Attempts list. Which values differ between the two rows?',
      'If two values differ, you can’t know which caused the change. Clear one run and redo it changing only one setting.',
    ],
    reflection: 'Why is it easier to learn from two runs when only one thing changes?',
    tutorNote: 'Try deliberately changing two settings to show the student why that makes the comparison unclear.',
    transferId: null,
    concept: 'variables',
    question: variableQuestion,
    check: (ctx) => {
      if (ctx.attempts.length < 2) return { met: false, message: `Save two attempts (${ctx.attempts.length}/2 saved).` };
      const q = variableQuestion(ctx);
      if (q && ctx.answers[q.id]) return { met: true, message: q.explain };
      return { met: false, message: 'Answer the question about your two runs.' };
    },
  },
  {
    id: 'explain',
    number: 7,
    title: 'Build an Explanation',
    goal: 'Explain how angle and speed split into horizontal and vertical velocity.',
    steps: ['Open “Velocity vectors”.', 'Change the angle and watch vx and vy.', 'Change the speed, then answer and explain.'],
    start: us(20, 20, 4),
    unlocked: ['speed', 'angle'],
    predictionType: 'airtime',
    predictFirstDefault: false,
    predictionRequired: false,
    openVectors: true,
    hints: [
      'The launch speed is one arrow. vx and vy are its shadows on the horizontal and vertical axes.',
      'Hold speed fixed and sweep the angle from 5° to 35°. Which arrow grows and which shrinks?',
      'vx = v₀·cos θ and vy = v₀·sin θ. Raising v₀ scales both up; raising θ moves speed from vx into vy.',
    ],
    reflection: 'In your own words: how do speed and angle each change vx and vy?',
    tutorNote: 'Have the student explain aloud first, then type a short version. Mark the concept in Tutor Mode.',
    transferId: 'calc-vy',
    concept: 'components',
    question: () => COMPONENT_Q,
    check: (ctx) => {
      if (!ctx.vectorsOpened) return { met: false, message: 'Open the Velocity vectors panel.' };
      if (ctx.answers[COMPONENT_Q.id] === COMPONENT_Q.correct || (ctx.answers['text:explain'] ?? '').trim().length > 10)
        return { met: true, message: 'Nice explanation work. Share it with your tutor.' };
      return { met: false, message: 'Answer the question or write your explanation below.' };
    },
  },
];

export const getChallenge = (id: string) => CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
