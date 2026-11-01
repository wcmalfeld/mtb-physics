import { useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { Card, Disclosure } from '../components/ui';

/** Common layout & learning widgets used by the additional labs so they match Jump Lab. */
export function LabLayout(props: { goal: string; eyebrow: string; scene: ReactNode; controls: ReactNode; side: ReactNode }) {
  return (
    <div className="lab-grid">
      <div className="lab-main">
        <section className="objective" aria-labelledby="lab-goal">
          <div className="objective-body">
            <p className="eyebrow">{props.eyebrow}</p>
            <h2 id="lab-goal" className="goal">{props.goal}</h2>
          </div>
        </section>
        <section className="card scene-card">{props.scene}</section>
        {props.controls}
      </div>
      <aside className="lab-side">{props.side}</aside>
    </div>
  );
}

export function LabHints({ hints }: { hints: [string, string, string] }) {
  const { state, dispatch } = useStore();
  if (!state.tutor.hintsAllowed) return null;
  const lvl = state.hintLevel;
  const labels = ['Reminder', 'Clue', 'Worked step'];
  return (
    <Card title="Hints" className="hints">
      <ol className="hint-list" aria-live="polite">
        {hints.slice(0, lvl).map((h, i) => (
          <li key={i}><span className="hint-tag">{labels[i]}</span> {h}</li>
        ))}
      </ol>
      <div className="row-actions">
        <button type="button" className="btn btn-small" disabled={lvl >= 3} onClick={() => dispatch({ type: 'nextHint' })}>
          {lvl === 0 ? 'Show a hint' : lvl < 3 ? `Next hint (${lvl + 1} of 3)` : 'All hints shown'}
        </button>
        {lvl > 0 && <button type="button" className="btn btn-small btn-ghost" onClick={() => dispatch({ type: 'resetHints' })}>Hide hints</button>}
      </div>
    </Card>
  );
}

export function LabLearning(props: { equations: ReactNode; assumptions: string[]; reflection: string }) {
  const { state } = useStore();
  const [eq, setEq] = useState(false);
  const [as, setAs] = useState(false);
  const [note, setNote] = useState('');
  return (
    <>
      <Card title="Learn the physics" className="learning">
        {state.tutor.equationsAllowed ? (
          <Disclosure title="Explore the physics" icon="ƒ" open={eq} onToggle={() => setEq(!eq)}>
            <div className="equations">{props.equations}</div>
          </Disclosure>
        ) : (
          <p className="muted small locked-note">Equations are hidden for this activity.</p>
        )}
        <Disclosure title="Model assumptions" icon="ⓘ" open={as} onToggle={() => setAs(!as)}>
          <ul className="assumptions">{props.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Disclosure>
      </Card>
      <Card title="Think about it" className="reflect-card">
        <p>{props.reflection}</p>
        <label className="field">
          <span className="sr-only">Your thoughts</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: a few words, or talk it through." />
        </label>
      </Card>
    </>
  );
}

/** requestAnimationFrame loop that runs only while `running` is true. Calls onFrame with elapsed seconds. */
export function startLoop(duration: number, onFrame: (p: number) => void, onDone: () => void) {
  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 1000 / duration);
    onFrame(p);
    if (p < 1) raf = requestAnimationFrame(tick);
    else onDone();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
