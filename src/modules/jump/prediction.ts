import type { Launch, PredictionType } from './challenges';

export const PREDICTION_QUESTIONS: Record<PredictionType, { prompt: string; options: { value: string; label: string }[] }> = {
  outcome: {
    prompt: 'Where will the rider reach the landing height?',
    options: [
      { value: 'short', label: 'Short of the target' },
      { value: 'inside', label: 'Inside the target' },
      { value: 'overshot', label: 'Beyond the target' },
    ],
  },
  distance: {
    prompt: 'Compared with your last launch, the landing distance will be…',
    options: [
      { value: 'more', label: 'Farther' },
      { value: 'same', label: 'About the same' },
      { value: 'less', label: 'Closer' },
    ],
  },
  airtime: {
    prompt: 'Compared with your last launch, the time in the air will be…',
    options: [
      { value: 'more', label: 'Longer' },
      { value: 'same', label: 'About the same' },
      { value: 'less', label: 'Shorter' },
    ],
  },
};

/** Relative change within ±1% counts as "about the same". */
function compare(now: number, before: number): 'more' | 'same' | 'less' {
  const rel = (now - before) / Math.max(Math.abs(before), 1e-9);
  if (Math.abs(rel) <= 0.01) return 'same';
  return rel > 0 ? 'more' : 'less';
}

/** What actually happened, in the same vocabulary as the prediction options. null = can't evaluate. */
export function actualAnswer(l: Launch, type: PredictionType): string | null {
  if (!l.flight.ok) return null;
  if (type === 'outcome') return l.outcome.kind === 'invalid' ? null : l.outcome.kind;
  if (!l.reference || !l.reference.flight.ok) return null;
  return type === 'distance'
    ? compare(l.flight.xLanding, l.reference.flight.xLanding)
    : compare(l.flight.tLanding, l.reference.flight.tLanding);
}

export const labelFor = (type: PredictionType, value: string) =>
  PREDICTION_QUESTIONS[type].options.find((o) => o.value === value)?.label ?? value;
