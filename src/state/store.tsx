import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  JUMP_LIMITS, classifyLanding, computeFlight, samplePath,
  type FlightResult, type LaunchParams, type Outcome, type Target,
} from '../physics/projectile';
import { fmt, lengthToDisplay, speedToDisplay, unitLabels, type UnitSystem } from '../physics/units';
import {
  CHALLENGES, getChallenge, setChallengeFormatter,
  type ConceptId, type ControlKey, type Launch, type PredictionType,
} from '../modules/jump/challenges';

export type ModuleId = 'menu' | 'jump' | 'vector' | 'braking' | 'cornering';
export type ConceptLevel = 'needs' | 'developing' | 'demonstrated';
export type RunStatus = 'ready' | 'flying' | 'landed';

export interface Attempt {
  id: number;
  label: 'A' | 'B' | 'C';
  params: LaunchParams;
  target: Target;
  flight: FlightResult & { ok: true };
  outcome: Outcome;
  path: { t: number; x: number; y: number }[];
}

export interface Panels {
  vectors: boolean;
  physics: boolean;
  steps: boolean;
  assumptions: boolean;
  moreStats: boolean;
}

export interface TutorConfig {
  open: boolean;
  equationsAllowed: boolean;
  hintsAllowed: boolean;
  /** null = use the challenge's default */
  requirePrediction: boolean | null;
  unrestricted: boolean;
  /** custom starting values per challenge, overriding the built-in start */
  customStart: Record<string, { params: LaunchParams; target: Target }>;
}

export interface CheckAnswer {
  value: string;
  submitted: boolean;
}

export interface State {
  module: ModuleId;
  units: UnitSystem;
  mode: 'explore' | 'challenge';
  challengeId: string;
  params: LaunchParams;
  target: Target;
  predictFirst: boolean;
  predictionType: PredictionType;
  predictionChoice: string | null;
  status: RunStatus;
  animKey: number;
  current: Launch | null;
  history: Launch[];
  attempts: Attempt[];
  attemptSeq: number;
  showAttempts: boolean;
  clearedAttempts: Attempt[] | null;
  panels: Panels;
  vectorsOpened: boolean;
  hintLevel: number;
  showGrid: boolean;
  lowDistraction: boolean;
  sound: boolean;
  timer: { enabled: boolean; running: boolean; startedAt: number | null; elapsed: number };
  tutor: TutorConfig;
  answers: Record<string, string>;
  checks: Record<string, CheckAnswer>;
  concepts: Partial<Record<ConceptId, ConceptLevel>>;
  completed: Record<string, boolean>;
  labResetKey: number;
}

const DEFAULT_PARAMS: LaunchParams = { speed: 8.9408, angleDeg: 20, height: 1.2192 }; // 20 mph, 20°, 4 ft
const DEFAULT_TARGET: Target = { start: 6.096, width: 2.4384 }; // 20 ft gap, 8 ft wide

const DEFAULT_PANELS: Panels = { vectors: false, physics: false, steps: false, assumptions: false, moreStats: false };

export function initialState(): State {
  return {
    module: 'menu',
    units: 'us',
    mode: 'explore',
    challengeId: CHALLENGES[0].id,
    params: { ...DEFAULT_PARAMS },
    target: { ...DEFAULT_TARGET },
    predictFirst: false,
    predictionType: 'outcome',
    predictionChoice: null,
    status: 'ready',
    animKey: 0,
    current: null,
    history: [],
    attempts: [],
    attemptSeq: 0,
    showAttempts: true,
    clearedAttempts: null,
    panels: { ...DEFAULT_PANELS },
    vectorsOpened: false,
    hintLevel: 0,
    showGrid: true,
    lowDistraction: false,
    sound: false,
    timer: { enabled: false, running: false, startedAt: null, elapsed: 0 },
    tutor: {
      open: false,
      equationsAllowed: true,
      hintsAllowed: true,
      requirePrediction: null,
      unrestricted: false,
      customStart: {},
    },
    answers: {},
    checks: {},
    concepts: {},
    completed: {},
    labResetKey: 0,
  };
}

export type Action =
  | { type: 'setModule'; module: ModuleId }
  | { type: 'setUnits'; units: UnitSystem }
  | { type: 'setParam'; key: keyof LaunchParams; value: number }
  | { type: 'setTarget'; key: keyof Target; value: number }
  | { type: 'setMode'; mode: 'explore' | 'challenge' }
  | { type: 'selectChallenge'; id: string }
  | { type: 'setPredictFirst'; on: boolean }
  | { type: 'setPredictionType'; predictionType: PredictionType }
  | { type: 'choosePrediction'; choice: string | null }
  | { type: 'launch' }
  | { type: 'landed' }
  | { type: 'stop' }
  | { type: 'replay' }
  | { type: 'resetRun' }
  | { type: 'saveAttempt' }
  | { type: 'removeAttempt'; id: number }
  | { type: 'clearAttempts' }
  | { type: 'restoreAttempts' }
  | { type: 'setShowAttempts'; on: boolean }
  | { type: 'togglePanel'; panel: keyof Panels; open?: boolean }
  | { type: 'nextHint' }
  | { type: 'resetHints' }
  | { type: 'setShowGrid'; on: boolean }
  | { type: 'setLowDistraction'; on: boolean }
  | { type: 'setSound'; on: boolean }
  | { type: 'timer'; op: 'enable' | 'disable' | 'start' | 'pause' | 'reset' }
  | { type: 'tutor'; patch: Partial<Omit<TutorConfig, 'customStart'>> }
  | { type: 'setCustomStart'; id: string; params: LaunchParams; target: Target }
  | { type: 'clearCustomStart'; id: string }
  | { type: 'resetActivity' }
  | { type: 'newSession' }
  | { type: 'answer'; id: string; value: string }
  | { type: 'check'; id: string; value: string; submitted?: boolean }
  | { type: 'setConcept'; id: ConceptId; level: ConceptLevel | null }
  | { type: 'markComplete'; id: string }
  | { type: 'resetLab' };

const clamp = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));

function challengeStart(state: State, id: string) {
  return state.tutor.customStart[id] ?? getChallenge(id).start;
}

/** Fresh activity state: clears run, history, prediction, hints, attempts. Keeps settings & tutor config. */
function freshActivity(state: State, start: { params: LaunchParams; target: Target }, predictFirst: boolean, ptype: PredictionType): State {
  return {
    ...state,
    params: { ...start.params },
    target: { ...start.target },
    predictFirst,
    predictionType: ptype,
    predictionChoice: null,
    status: 'ready',
    current: null,
    history: [],
    attempts: [],
    clearedAttempts: state.attempts.length ? state.attempts : state.clearedAttempts,
    hintLevel: 0,
    vectorsOpened: false,
    showAttempts: true,
  };
}

function enterChallenge(state: State, id: string): State {
  const c = getChallenge(id);
  const s = freshActivity({ ...state, challengeId: id, mode: 'challenge' }, challengeStart(state, id), c.predictFirstDefault, c.predictionType);
  if (c.openVectors) s.panels = { ...s.panels, vectors: true };
  return s;
}

/** After an input change, a landed result no longer describes the current settings. */
function invalidateRun(state: State): State {
  if (state.status === 'ready') return state;
  return { ...state, status: 'ready', current: null, predictionChoice: null };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setModule':
      return state.status === 'flying'
        ? { ...state, module: action.module, status: 'ready', current: null, history: state.history.slice(0, -1) }
        : { ...state, module: action.module };
    case 'setUnits':
      return { ...state, units: action.units };
    case 'setParam': {
      const limits = { speed: JUMP_LIMITS.speed, angleDeg: JUMP_LIMITS.angleDeg, height: JUMP_LIMITS.height }[action.key];
      if (!Number.isFinite(action.value)) return state;
      return invalidateRun({ ...state, params: { ...state.params, [action.key]: clamp(action.value, limits) } });
    }
    case 'setTarget': {
      const limits = action.key === 'start' ? JUMP_LIMITS.targetStart : JUMP_LIMITS.targetWidth;
      if (!Number.isFinite(action.value)) return state;
      return invalidateRun({ ...state, target: { ...state.target, [action.key]: clamp(action.value, limits) } });
    }
    case 'setMode':
      if (action.mode === 'challenge') return enterChallenge(state, state.challengeId);
      return {
        ...freshActivity({ ...state, mode: 'explore' }, { params: state.params, target: state.target }, false, 'outcome'),
        attempts: state.attempts,
        clearedAttempts: state.clearedAttempts,
      };
    case 'selectChallenge':
      return enterChallenge(state, action.id);
    case 'setPredictFirst':
      return { ...invalidateRun(state), predictFirst: action.on, predictionChoice: null };
    case 'setPredictionType':
      return { ...state, predictionType: action.predictionType, predictionChoice: null };
    case 'choosePrediction':
      return { ...state, predictionChoice: action.choice };
    case 'launch': {
      const flight = computeFlight(state.params);
      const outcome = classifyLanding(flight, state.target);
      const prev = state.history[state.history.length - 1];
      const launch: Launch = {
        params: { ...state.params },
        target: { ...state.target },
        flight,
        outcome,
        prediction: state.predictionChoice ? { type: effectivePredictionType(state), choice: state.predictionChoice } : null,
        reference: prev ? { params: prev.params, flight: prev.flight } : null,
      };
      return {
        ...state,
        status: flight.ok ? 'flying' : 'landed',
        animKey: state.animKey + 1,
        current: launch,
        history: [...state.history, launch].slice(-30),
      };
    }
    case 'landed':
      return state.status === 'flying' ? { ...state, status: 'landed' } : state;
    case 'stop':
      // Stop immediately: abandon the in-flight animation without revealing a result.
      if (state.status !== 'flying') return state;
      return { ...state, status: 'ready', current: null, history: state.history.slice(0, -1) };
    case 'replay':
      return state.current && state.current.flight.ok ? { ...state, status: 'flying', animKey: state.animKey + 1 } : state;
    case 'resetRun':
      return { ...state, status: 'ready', current: null, predictionChoice: null };
    case 'saveAttempt': {
      const flight = computeFlight(state.params);
      if (!flight.ok) return state;
      const used = new Set(state.attempts.map((a) => a.label));
      const label = (['A', 'B', 'C'] as const).find((l) => !used.has(l));
      if (!label) return state;
      const attempt: Attempt = {
        id: state.attemptSeq + 1,
        label,
        params: { ...state.params },
        target: { ...state.target },
        flight,
        outcome: classifyLanding(flight, state.target),
        path: samplePath(state.params, flight),
      };
      return { ...state, attempts: [...state.attempts, attempt], attemptSeq: state.attemptSeq + 1, showAttempts: true };
    }
    case 'removeAttempt':
      return { ...state, attempts: state.attempts.filter((a) => a.id !== action.id) };
    case 'clearAttempts':
      return state.attempts.length ? { ...state, attempts: [], clearedAttempts: state.attempts } : state;
    case 'restoreAttempts':
      return state.clearedAttempts ? { ...state, attempts: state.clearedAttempts.slice(0, 3), clearedAttempts: null } : state;
    case 'setShowAttempts':
      return { ...state, showAttempts: action.on };
    case 'togglePanel': {
      const open = action.open ?? !state.panels[action.panel];
      return {
        ...state,
        panels: { ...state.panels, [action.panel]: open },
        vectorsOpened: state.vectorsOpened || (action.panel === 'vectors' && open),
      };
    }
    case 'nextHint':
      return { ...state, hintLevel: Math.min(3, state.hintLevel + 1) };
    case 'resetHints':
      return { ...state, hintLevel: 0 };
    case 'setShowGrid':
      return { ...state, showGrid: action.on };
    case 'setLowDistraction':
      return {
        ...state,
        lowDistraction: action.on,
        showGrid: action.on ? false : true,
        panels: action.on ? { ...DEFAULT_PANELS } : state.panels,
      };
    case 'setSound':
      return { ...state, sound: action.on };
    case 'timer': {
      const t = state.timer;
      const now = Date.now();
      const elapsedNow = t.running && t.startedAt ? t.elapsed + (now - t.startedAt) : t.elapsed;
      switch (action.op) {
        case 'enable':
          return { ...state, timer: { enabled: true, running: false, startedAt: null, elapsed: 0 } };
        case 'disable':
          return { ...state, timer: { enabled: false, running: false, startedAt: null, elapsed: 0 } };
        case 'start':
          return t.running ? state : { ...state, timer: { ...t, running: true, startedAt: now } };
        case 'pause':
          return { ...state, timer: { ...t, running: false, startedAt: null, elapsed: elapsedNow } };
        case 'reset':
          return { ...state, timer: { ...t, running: false, startedAt: null, elapsed: 0 } };
      }
      return state;
    }
    case 'tutor':
      return { ...state, tutor: { ...state.tutor, ...action.patch } };
    case 'setCustomStart':
      return {
        ...state,
        tutor: { ...state.tutor, customStart: { ...state.tutor.customStart, [action.id]: { params: action.params, target: action.target } } },
      };
    case 'clearCustomStart': {
      const cs = { ...state.tutor.customStart };
      delete cs[action.id];
      return { ...state, tutor: { ...state.tutor, customStart: cs } };
    }
    case 'resetActivity':
      if (state.mode === 'challenge') return enterChallenge(state, state.challengeId);
      return freshActivity(state, state.tutor.customStart.explore ?? { params: DEFAULT_PARAMS, target: DEFAULT_TARGET }, state.predictFirst, state.predictionType);
    case 'newSession': {
      const fresh = initialState();
      return { ...fresh, module: state.module === 'menu' ? 'menu' : state.module, tutor: { ...fresh.tutor, open: state.tutor.open }, labResetKey: state.labResetKey + 1 };
    }
    case 'answer':
      return { ...state, answers: { ...state.answers, [action.id]: action.value } };
    case 'check':
      return {
        ...state,
        checks: { ...state.checks, [action.id]: { value: action.value, submitted: action.submitted ?? state.checks[action.id]?.submitted ?? false } },
      };
    case 'setConcept': {
      const concepts = { ...state.concepts };
      if (action.level) concepts[action.id] = action.level;
      else delete concepts[action.id];
      return { ...state, concepts };
    }
    case 'markComplete':
      return state.completed[action.id] ? state : { ...state, completed: { ...state.completed, [action.id]: true } };
    case 'resetLab':
      return { ...state, labResetKey: state.labResetKey + 1, hintLevel: 0 };
  }
}

/** Comparison predictions need a previous launch; until then, ask about the target. */
export function effectivePredictionType(state: State): PredictionType {
  const hasRef = state.history.some((l) => l.flight.ok);
  return state.predictionType !== 'outcome' && !hasRef ? 'outcome' : state.predictionType;
}

/* ---------- Derived values ---------- */

export interface Derived {
  flight: FlightResult;
  outcome: Outcome;
  path: { t: number; x: number; y: number }[];
  predictionActive: boolean;
  predictionRequired: boolean;
  /** true when results may be shown (no pending prediction, or the launch has landed) */
  revealed: boolean;
  enabled: Record<ControlKey, boolean>;
}

export function derive(state: State): Derived {
  const flight = computeFlight(state.params);
  const outcome = classifyLanding(flight, state.target);
  const path = samplePath(state.params, flight);
  const challenge = state.mode === 'challenge' ? getChallenge(state.challengeId) : null;
  const predictionRequired = challenge ? state.tutor.requirePrediction ?? challenge.predictionRequired : state.tutor.requirePrediction === true;
  const predictionActive = predictionRequired || state.predictFirst;
  const revealed = !predictionActive || state.status === 'landed';
  const all = !challenge || state.tutor.unrestricted;
  const enabled = {
    speed: all || challenge!.unlocked.includes('speed'),
    angle: all || challenge!.unlocked.includes('angle'),
    height: all || challenge!.unlocked.includes('height'),
    gap: all || challenge!.unlocked.includes('gap'),
    width: all || challenge!.unlocked.includes('width'),
  };
  return { flight, outcome, path, predictionActive, predictionRequired, revealed, enabled };
}

/* ---------- Formatting ---------- */

export function makeFormat(units: UnitSystem) {
  const L = unitLabels(units);
  return {
    L,
    speed: (ms: number, d = 1) => `${fmt(speedToDisplay(ms, units), d)} ${L.speed}`,
    length: (m: number, d = 1) => `${fmt(lengthToDisplay(m, units), d)} ${L.length}`,
    velocity: (ms: number, d = 1) => `${fmt(units === 'us' ? ms / 0.3048 : ms, d)} ${L.velocity}`,
    time: (s: number, d = 2) => `${fmt(s, d)} s`,
  };
}
export type Format = ReturnType<typeof makeFormat>;

/* ---------- Context ---------- */

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action>; d: Derived; f: Format } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const d = useMemo(() => derive(state), [state.params, state.target, state.mode, state.challengeId, state.tutor, state.predictFirst, state.status]);
  const f = useMemo(() => makeFormat(state.units), [state.units]);
  setChallengeFormatter(f); // idempotent; keeps challenge messages in the active units
  const value = useMemo(() => ({ state, dispatch, d, f }), [state, d, f]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
