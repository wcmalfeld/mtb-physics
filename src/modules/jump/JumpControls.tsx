import { JUMP_LIMITS } from '../../physics/projectile';
import { fmt, lengthFromDisplay, lengthToDisplay, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Slider, Switch } from '../../components/ui';
import { ATTEMPT_STYLE } from './JumpScene';

const LOCKED = 'Locked for this challenge so you can test one thing at a time.';

export function JumpControls() {
  const { state, dispatch, d, f } = useStore();
  const u = state.units;
  const us = u === 'us';
  const L = f.L;
  const sp = (v: number) => speedToDisplay(v, u);
  const ln = (v: number) => lengthToDisplay(v, u);
  const lim = JUMP_LIMITS;

  return (
    <Card title="Launch settings" className="controls">
      <div className="control-groups">
        <fieldset>
          <legend>Takeoff</legend>
          <Slider
            label="Launch speed"
            unit={L.speed}
            value={sp(state.params.speed)}
            min={sp(lim.speed.min)}
            max={sp(lim.speed.max)}
            step={us ? 0.5 : 0.1}
            digits={1}
            disabled={!d.enabled.speed}
            lockedReason={LOCKED}
            onChange={(v) => dispatch({ type: 'setParam', key: 'speed', value: speedFromDisplay(v, u) })}
          />
          <Slider
            label="Effective launch angle"
            unit="°"
            value={state.params.angleDeg}
            min={lim.angleDeg.min}
            max={lim.angleDeg.max}
            step={1}
            digits={0}
            disabled={!d.enabled.angle}
            lockedReason={LOCKED}
            help="Direction the rider is moving at the lip. It can differ from the ramp’s shape."
            onChange={(v) => dispatch({ type: 'setParam', key: 'angleDeg', value: v })}
          />
          <Slider
            label="Takeoff height above landing"
            unit={L.length}
            value={ln(state.params.height)}
            min={ln(lim.height.min)}
            max={ln(lim.height.max)}
            step={us ? 0.5 : 0.05}
            digits={us ? 1 : 2}
            disabled={!d.enabled.height}
            lockedReason={LOCKED}
            help="Vertical distance. Higher = more time for gravity to act."
            onChange={(v) => dispatch({ type: 'setParam', key: 'height', value: lengthFromDisplay(v, u) })}
          />
        </fieldset>
        <fieldset>
          <legend>Landing target</legend>
          <Slider
            label="Gap to start of target"
            unit={L.length}
            value={ln(state.target.start)}
            min={ln(lim.targetStart.min)}
            max={ln(lim.targetStart.max)}
            step={us ? 1 : 0.1}
            digits={us ? 0 : 1}
            disabled={!d.enabled.gap}
            lockedReason={LOCKED}
            help="Horizontal distance. Moving the target never changes the path."
            onChange={(v) => dispatch({ type: 'setTarget', key: 'start', value: lengthFromDisplay(v, u) })}
          />
          <Slider
            label="Target width"
            unit={L.length}
            value={ln(state.target.width)}
            min={ln(lim.targetWidth.min)}
            max={ln(lim.targetWidth.max)}
            step={us ? 0.5 : 0.05}
            digits={us ? 1 : 2}
            disabled={!d.enabled.width}
            lockedReason={LOCKED}
            onChange={(v) => dispatch({ type: 'setTarget', key: 'width', value: lengthFromDisplay(v, u) })}
          />
          <Switch label="Grid lines" checked={state.showGrid} onChange={(on) => dispatch({ type: 'setShowGrid', on })} />
        </fieldset>
      </div>
    </Card>
  );
}

export function ActionBar() {
  const { state, dispatch, d } = useStore();
  const { status } = state;
  const needsChoice = d.predictionActive && !state.predictionChoice && status === 'ready';
  const full = state.attempts.length >= 3;
  const canSave = d.flight.ok && d.revealed && status !== 'flying' && !full;
  const saveTitle = full ? 'Three attempts saved. Remove one to save another.' : !d.revealed ? 'Launch first, then save.' : 'Save these settings to compare';

  return (
    <div className="action-bar" role="toolbar" aria-label="Simulation actions">
      {status === 'flying' ? (
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'stop' })}>
          ■ Stop
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-launch"
          disabled={needsChoice}
          aria-describedby={needsChoice ? 'launch-why' : undefined}
          onClick={() => dispatch({ type: status === 'landed' ? 'replay' : 'launch' })}
        >
          {status === 'landed' ? '↻ Replay' : 'Launch'}
        </button>
      )}
      <button type="button" className="btn" onClick={() => dispatch({ type: 'resetRun' })} disabled={status === 'ready'}>
        Reset rider
      </button>
      <button type="button" className="btn" disabled={!canSave} title={saveTitle} onClick={() => dispatch({ type: 'saveAttempt' })}>
        ＋ Save Attempt <span className="muted">({state.attempts.length}/3)</span>
      </button>
      <p id="launch-why" className="action-note" aria-live="polite">
        {needsChoice ? 'Choose a prediction to unlock Launch.' : status === 'landed' ? 'Change any setting to set up a new launch.' : ''}
      </p>
    </div>
  );
}

export function AttemptsPanel() {
  const { state, dispatch, f } = useStore();
  const { attempts } = state;
  if (attempts.length === 0 && !state.clearedAttempts) {
    if (state.lowDistraction) return null;
    return (
      <Card title="Saved attempts" className="attempts">
        <p className="muted">Launch, then press <strong>Save Attempt</strong> to keep a path on screen. Save up to 3 and change one setting between them.</p>
      </Card>
    );
  }
  const outcomeText = { inside: '✓ Inside', short: '← Short', overshot: '→ Beyond', invalid: '? N/A' } as const;
  return (
    <Card
      title="Saved attempts"
      className="attempts"
      actions={
        <>
          {attempts.length > 0 && (
            <Switch label="Show on scene" checked={state.showAttempts} onChange={(on) => dispatch({ type: 'setShowAttempts', on })} />
          )}
        </>
      }
    >
      {attempts.length > 0 ? (
        <div className="table-scroll">
          <table className="attempt-table">
            <caption className="sr-only">Saved trajectory attempts</caption>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Speed</th>
                <th scope="col">Angle</th>
                <th scope="col">Height</th>
                <th scope="col">Air time</th>
                <th scope="col">Distance</th>
                <th scope="col">Outcome</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const st = ATTEMPT_STYLE[a.label];
                return (
                  <tr key={a.id}>
                    <th scope="row">
                      <span className="att-key">
                        <svg width="30" height="12" aria-hidden="true">
                          <line x1="1" x2="29" y1="6" y2="6" stroke={st.color} strokeWidth="3" strokeDasharray={st.dash} />
                        </svg>
                        <span className="att-letter" style={{ borderColor: st.color }}>{a.label}</span>
                        <span className="sr-only">({st.name} line)</span>
                      </span>
                    </th>
                    <td>{f.speed(a.params.speed)}</td>
                    <td>{fmt(a.params.angleDeg, 0)}°</td>
                    <td>{f.length(a.params.height)}</td>
                    <td>{f.time(a.flight.tLanding)}</td>
                    <td>{f.length(a.flight.xLanding)}</td>
                    <td>{outcomeText[a.outcome.kind]}</td>
                    <td>
                      <button type="button" className="btn btn-icon" aria-label={`Remove attempt ${a.label}`} onClick={() => dispatch({ type: 'removeAttempt', id: a.id })}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No saved attempts.</p>
      )}
      <div className="row-actions">
        {attempts.length > 0 && (
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'clearAttempts' })}>
            Clear all
          </button>
        )}
        {state.clearedAttempts && (
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'restoreAttempts' })}>
            Restore cleared attempts
          </button>
        )}
        {attempts.length > 0 && <span className="muted small">Outcome is relative to the target when each run was saved.</span>}
      </div>
    </Card>
  );
}
