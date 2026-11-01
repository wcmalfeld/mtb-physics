import { useEffect, useState } from 'react';
import { useStore, type ConceptLevel } from '../../state/store';
import { Card, Segmented } from '../../components/ui';
import { CHALLENGES, CONCEPTS, getChallenge, type ChallengeContext, type ConceptId } from './challenges';
import { getTransfer, type TransferItem } from './transfer';

export function useChallengeContext(): ChallengeContext {
  const { state } = useStore();
  return { history: state.history, attempts: state.attempts, answers: state.answers, vectorsOpened: state.vectorsOpened };
}

export function ObjectiveBar() {
  const { state, dispatch } = useStore();
  const ctx = useChallengeContext();
  const inChallenge = state.mode === 'challenge';
  const c = getChallenge(state.challengeId);
  const progress = inChallenge ? c.check(ctx) : null;

  useEffect(() => {
    if (inChallenge && progress?.met) dispatch({ type: 'markComplete', id: c.id });
  }, [inChallenge, progress?.met, c.id, dispatch]);

  const idx = CHALLENGES.findIndex((x) => x.id === c.id);
  const next = CHALLENGES[idx + 1];

  return (
    <section className="objective" aria-labelledby="objective-h">
      <div className="objective-top">
        <Segmented
          label="Activity"
          hideLabel
          value={state.mode}
          onChange={(m) => dispatch({ type: 'setMode', mode: m })}
          options={[
            { value: 'explore', label: 'Explore freely' },
            { value: 'challenge', label: 'Guided challenges' },
          ]}
        />
        {inChallenge && (
          <nav className="challenge-chips" aria-label="Challenges">
            {CHALLENGES.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`chip-btn ${ch.id === c.id ? 'is-on' : ''} ${state.completed[ch.id] ? 'is-done' : ''}`}
                aria-current={ch.id === c.id ? 'step' : undefined}
                aria-label={`Challenge ${ch.number}: ${ch.title}${state.completed[ch.id] ? ' (explored)' : ''}`}
                title={ch.title}
                onClick={() => dispatch({ type: 'selectChallenge', id: ch.id })}
              >
                {state.completed[ch.id] ? '✓' : ch.number}
              </button>
            ))}
          </nav>
        )}
      </div>

      {inChallenge ? (
        <div className="objective-body">
          <p className="eyebrow">Challenge {c.number} of {CHALLENGES.length} · {c.title}</p>
          <h2 id="objective-h" className="goal">{c.goal}</h2>
          <ol className="steps-inline">
            {c.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className={`progress ${progress?.met ? 'met' : ''}`} aria-live="polite">
            {progress?.met ? '✓ ' : '→ '}
            {progress?.message}
          </p>
          {progress?.met && (
            <div className="reflect">
              <p><strong>Think about it:</strong> {c.reflection}</p>
              <ReflectionBox id={`reflect:${c.id}`} />
              {next && (
                <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'selectChallenge', id: next.id })}>
                  Next: {next.title} →
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="objective-body">
          <p className="eyebrow">Free explore</p>
          <h2 id="objective-h" className="goal">Change any setting and watch the path respond.</h2>
          <p className="small">Try landing inside the target, or switch on <em>Predict first</em> to test your thinking.</p>
        </div>
      )}
    </section>
  );
}

function ReflectionBox({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  return (
    <label className="field">
      <span className="sr-only">Your thoughts</span>
      <textarea
        rows={2}
        value={state.answers[id] ?? ''}
        onChange={(e) => dispatch({ type: 'answer', id, value: e.target.value })}
        placeholder="Optional: jot a few words, or talk it through with your tutor."
      />
    </label>
  );
}

/** In-challenge questions (Compare Two Runs, Build an Explanation). */
export function ChallengeQuestionCard() {
  const { state, dispatch } = useStore();
  const ctx = useChallengeContext();
  if (state.mode !== 'challenge') return null;
  const c = getChallenge(state.challengeId);
  const q = c.question?.(ctx);
  const showText = c.id === 'explain';
  if (!q && !showText) return null;
  const chosen = q ? state.answers[q.id] : undefined;
  return (
    <Card title="Your turn" className="question">
      {q ? (
        <fieldset className="choice-set">
          <legend>{q.prompt}</legend>
          {q.options.map((o) => (
            <label key={o.value} className={`choice ${chosen === o.value ? 'is-on' : ''}`}>
              <input type="radio" name={q.id} checked={chosen === o.value} onChange={() => dispatch({ type: 'answer', id: q.id, value: o.value })} />
              <span>{o.label}</span>
            </label>
          ))}
          {chosen && (
            <p className={`feedback ${chosen === q.correct ? 'match' : 'differ'}`} role="status">
              {chosen === q.correct ? '✓ Yes. ' : '◆ Not quite. '}
              {q.explain}
            </p>
          )}
        </fieldset>
      ) : (
        c.id === 'compare' && <p className="muted">Save two attempts to unlock the question ({state.attempts.length}/2).</p>
      )}
      {showText && (
        <label className="field">
          <span>Explain in your own words how speed and angle change vx and vy.</span>
          <textarea
            rows={3}
            value={state.answers['text:explain'] ?? ''}
            onChange={(e) => dispatch({ type: 'answer', id: 'text:explain', value: e.target.value })}
          />
          <small className="muted">Your tutor reviews this one. There’s no automatic grade.</small>
        </label>
      )}
    </Card>
  );
}

/* ================= Transfer: try it without the simulation ================= */

export function ConceptMarker({ concept }: { concept: ConceptId }) {
  const { state, dispatch } = useStore();
  const level = state.concepts[concept] ?? null;
  const opts: { v: ConceptLevel; label: string }[] = [
    { v: 'needs', label: 'Needs practice' },
    { v: 'developing', label: 'Developing' },
    { v: 'demonstrated', label: 'Demonstrated independently' },
  ];
  const name = CONCEPTS.find((c) => c.id === concept)?.label ?? concept;
  return (
    <div className="concept-marker" role="radiogroup" aria-label={`Tutor mark for ${name}`}>
      <span className="concept-name">{name}</span>
      <div className="concept-opts">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={level === o.v}
            className={`lvl lvl-${o.v} ${level === o.v ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'setConcept', id: concept, level: level === o.v ? null : o.v })}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniGraph({ item }: { item: Extract<TransferItem, { kind: 'graph' }> }) {
  const W = 300, H = 150, pl = 30, pb = 24, pt = 8, pr = 8;
  const sx = (x: number) => pl + (x / item.xMax) * (W - pl - pr);
  const sy = (y: number) => H - pb - (y / item.yMax) * (H - pb - pt);
  const xt: number[] = [];
  for (let x = 0; x <= item.xMax; x += 5) xt.push(x);
  const yt = [0, 2, 4, 6, 8].filter((y) => y <= item.yMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-graph" role="img" aria-label="Trajectory graph: height in feet versus horizontal distance in feet. Grid lines every 5 feet horizontally.">
      {xt.map((x) => (
        <g key={x}>
          <line x1={sx(x)} x2={sx(x)} y1={pt} y2={H - pb} stroke="var(--grid)" />
          <text x={sx(x)} y={H - 8} textAnchor="middle" className="svg-tiny">{x}</text>
        </g>
      ))}
      {yt.map((y) => (
        <g key={y}>
          <line x1={pl} x2={W - pr} y1={sy(y)} y2={sy(y)} stroke="var(--grid)" />
          <text x={pl - 4} y={sy(y) + 3} textAnchor="end" className="svg-tiny">{y}</text>
        </g>
      ))}
      <line x1={pl} x2={W - pr} y1={sy(0)} y2={sy(0)} stroke="var(--ink)" strokeWidth={1.5} />
      <polyline points={item.path.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke="var(--path)" strokeWidth={2.5} />
    </svg>
  );
}

function TransferItemView({ item }: { item: TransferItem }) {
  const { state, dispatch } = useStore();
  const a = state.checks[item.id];
  const value = a?.value ?? '';
  const submitted = a?.submitted ?? false;
  const [showSample, setShowSample] = useState(false);
  const set = (v: string, sub = false) => dispatch({ type: 'check', id: item.id, value: v, submitted: sub });

  if (item.kind === 'numeric') {
    const vu = state.units === 'us' ? 'ft/s' : 'm/s';
    const swap = (t: string) => t.split('ft/s').join(vu);
    const num = Number(value);
    const correct = value.trim() !== '' && Number.isFinite(num) && Math.abs(num - item.answer) <= item.tolerance;
    return (
      <div className="transfer-item">
        <label className="field">
          <span>{swap(item.prompt)}</span>
          <span className="input-unit">
            <input type="number" inputMode="decimal" step="any" value={value} onChange={(e) => set(e.target.value, false)} />
            <span>{vu}</span>
          </span>
        </label>
        <button type="button" className="btn btn-small" disabled={value.trim() === ''} onClick={() => set(value, true)}>
          Check
        </button>
        {submitted && (
          <p className={`feedback ${correct ? 'match' : 'differ'}`} role="status">
            {correct ? '✓ Correct. ' : '◆ Not yet. Check your calculator is in degrees. '}
            {swap(item.solution)}
          </p>
        )}
      </div>
    );
  }
  if (item.kind === 'choice' || item.kind === 'graph') {
    return (
      <div className="transfer-item">
        {item.kind === 'graph' && <MiniGraph item={item} />}
        <fieldset className="choice-set">
          <legend>{item.prompt}</legend>
          {item.options.map((o) => (
            <label key={o.value} className={`choice ${value === o.value ? 'is-on' : ''}`}>
              <input type="radio" name={item.id} checked={value === o.value} onChange={() => set(o.value, true)} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        {submitted && value && (
          <p className={`feedback ${value === item.correct ? 'match' : 'differ'}`} role="status">
            {value === item.correct ? '✓ Yes. ' : '◆ Not quite. '}
            {item.solution}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="transfer-item">
      <label className="field">
        <span>{item.prompt}</span>
        <textarea rows={3} value={value} onChange={(e) => set(e.target.value, false)} />
      </label>
      <div className="row-actions">
        <button type="button" className="btn btn-small" disabled={value.trim().length < 3} onClick={() => set(value, true)}>
          Done: ready for tutor
        </button>
        <button type="button" className="btn btn-small btn-ghost" aria-expanded={showSample} onClick={() => setShowSample(!showSample)}>
          {showSample ? 'Hide sample answer' : 'Show a sample answer'}
        </button>
      </div>
      {submitted && <p className="feedback neutral" role="status">Saved for your tutor to review. Explanations are checked by a person, not the app.</p>}
      {showSample && <p className="sample">{item.sample}</p>}
    </div>
  );
}

export function TransferCard() {
  const { state } = useStore();
  const ctx = useChallengeContext();
  if (state.mode !== 'challenge') return null;
  const c = getChallenge(state.challengeId);
  const tc = getTransfer(c.transferId);
  if (!tc) return state.tutor.open ? <Card title="Tutor mark" className="transfer"><ConceptMarker concept={c.concept} /></Card> : null;
  const met = c.check(ctx).met || state.completed[c.id];
  if (!met) return null;
  return (
    <Card title="Try it without the simulation" className="transfer">
      <p className="small muted">{tc.title}: pencil and paper or out loud.</p>
      {tc.items.map((it) => (
        <TransferItemView key={it.id} item={it} />
      ))}
      {state.tutor.open && <ConceptMarker concept={tc.concept} />}
    </Card>
  );
}
