import { useEffect, useState } from 'react';
import { brakingStateAt, computeBraking } from '../../physics/labs';
import { fmt, lengthToDisplay, mphToMs, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Slider, usePrefersReducedMotion } from '../../components/ui';
import { LabHints, LabLayout, LabLearning, startLoop } from '../labShared';

const FT = 0.3048;

export function BrakingLab() {
  const { state, f } = useStore();
  const u = state.units;
  const us = u === 'us';
  const reduced = usePrefersReducedMotion() || state.lowDistraction;
  const [v0, setV0] = useState(mphToMs(15));
  const [a, setA] = useState(4); // m/s²
  const [simT, setSimT] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const r = computeBraking(v0, a);
  useEffect(() => {
    setSimT(null);
    setRunning(false);
  }, [v0, a]);

  useEffect(() => {
    if (!running || !r.ok) return;
    if (reduced) {
      setSimT(r.time);
      setRunning(false);
      return;
    }
    return startLoop(Math.min(4, Math.max(1, r.time)), (p) => setSimT(p * r.time), () => setRunning(false));
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --- trail scene --- */
  const W = 760, H = 210, pl = 40, pr = 30, groundY = 150;
  const dist = r.ok ? r.distance : 0;
  const steps = [10, 20, 40, 80, 160]; // meters
  const worldMax = steps.find((s) => s >= dist * 1.1) ?? 160;
  const sx = (m: number) => pl + (Math.min(m, worldMax) / worldMax) * (W - pl - pr);
  const offChart = dist * 1.1 > 160;
  const st = r.ok && simT !== null ? brakingStateAt(v0, a, simT) : { speed: v0, distance: 0 };
  const tickU = us ? FT : 1;
  const tickStep = (us ? [5, 10, 25, 50, 100] : [2, 5, 10, 20, 50]).find((s) => (s * tickU) / worldMax >= 0.1) ?? 100;
  const ticks: number[] = [];
  for (let v = 0; v * tickU <= worldMax + 1e-9; v += tickStep) ticks.push(v);

  /* --- v–t graph --- */
  const GW = 320, GH = 180, gl = 40, gb = 30, gt = 12, gr = 10;
  const vMax = mphToMs(30);
  const tMax = r.ok ? Math.max(1, Math.ceil(r.time)) : 1;
  const gx = (t: number) => gl + (t / tMax) * (GW - gl - gr);
  const gy = (v: number) => GH - gb - (v / vMax) * (GH - gb - gt);

  const scene = (
    <div className="scene-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scene lab-svg" role="img" aria-label={r.ok ? `Braking from ${f.speed(v0)}: stops after ${f.length(r.distance)} in ${f.time(r.time)}.` : r.reason}>
        <rect width={W} height={H} fill="var(--sky-bottom)" />
        <rect x={0} y={groundY} width={W} height={H - groundY} fill="var(--dirt)" />
        <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="var(--trail)" strokeWidth={3} />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v * tickU)} x2={sx(v * tickU)} y1={groundY} y2={groundY + 8} stroke="var(--ink-soft)" />
            <text x={sx(v * tickU)} y={groundY + 24} textAnchor="middle" className="tick">{v}</text>
          </g>
        ))}
        <text x={W - pr} y={H - 6} textAnchor="end" className="axis-title">distance ({f.L.length})</text>
        <line x1={sx(0)} x2={sx(0)} y1={groundY - 60} y2={groundY} stroke="var(--ink)" strokeDasharray="4 3" />
        <text x={sx(0) + 4} y={groundY - 64} className="scene-label small">brakes on</text>
        {r.ok && (
          <g>
            <rect x={sx(0)} y={groundY - 5} width={sx(dist) - sx(0)} height={5} fill="var(--accent)" opacity={0.5} />
            <line x1={sx(dist)} x2={sx(dist)} y1={groundY - 60} y2={groundY} stroke="var(--target-line)" strokeWidth={3} />
            <text x={Math.min(sx(dist), W - 120)} y={groundY - 64} className="scene-label strong">
              {offChart ? '→ ' : ''}stops at {fmt(lengthToDisplay(dist, u), 1)} {f.L.length}
            </text>
          </g>
        )}
        <g transform={`translate(${sx(st.distance)} ${groundY})`} aria-hidden="true">
          <circle cx={-14} cy={-10} r={10} fill="none" stroke="var(--ink)" strokeWidth={3} />
          <circle cx={14} cy={-10} r={10} fill="none" stroke="var(--ink)" strokeWidth={3} />
          <path d="M-14 -10 L0 -10 L-5 -24 L10 -23 L0 -10 M10 -23 L14 -10" stroke="var(--accent)" strokeWidth={3} fill="none" />
          <path d="M-4 -27 L2 -40 L12 -27" stroke="var(--jersey)" strokeWidth={4} fill="none" />
          <circle cx={4} cy={-46} r={5} fill="var(--helmet)" />
        </g>
        <text x={12} y={22} className="chip-text">speed now: {f.speed(st.speed)}</text>
      </svg>
      <div className="action-bar">
        <button type="button" className="btn btn-primary" disabled={!r.ok || running} onClick={() => { setSimT(0); setRunning(true); }}>
          Brake!
        </button>
        <button type="button" className="btn" disabled={simT === null} onClick={() => { setRunning(false); setSimT(null); }}>
          Reset
        </button>
      </div>
    </div>
  );

  const controls = (
    <Card title="Braking settings" className="controls">
      <div className="control-groups">
        <fieldset>
          <legend>Rider</legend>
          <Slider label="Initial speed" unit={f.L.speed} value={speedToDisplay(v0, u)} min={0} max={speedToDisplay(mphToMs(30), u)} step={us ? 0.5 : 0.1} onChange={(v) => setV0(speedFromDisplay(v, u))} />
        </fieldset>
        <fieldset>
          <legend>Brakes</legend>
          <Slider
            label="Braking deceleration"
            unit={f.L.accel}
            value={us ? a / FT : a}
            min={0}
            max={us ? 26 : 8}
            step={us ? 0.5 : 0.1}
            onChange={(v) => setA(us ? v * FT : v)}
            help="How quickly speed drops each second. 0 = no braking."
          />
        </fieldset>
      </div>
    </Card>
  );

  const side = (
    <>
      <Card title="Results" className="results">
        {r.ok ? (
          <>
            <dl className="stats">
              <div><dt>Stopping distance</dt><dd>{f.length(r.distance)}</dd></div>
              <div><dt>Stopping time</dt><dd>{f.time(r.time)}</dd></div>
            </dl>
            <svg viewBox={`0 0 ${GW} ${GH}`} className="mini-graph" role="img" aria-label="Speed versus time graph: a straight line falling to zero. The area under it equals the stopping distance.">
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <line key={p} x1={gl} x2={GW - gr} y1={gy(vMax * p)} y2={gy(vMax * p)} stroke="var(--grid)" />
              ))}
              <polygon points={`${gx(0)},${gy(0)} ${gx(0)},${gy(v0)} ${gx(r.time)},${gy(0)}`} fill="var(--accent)" opacity={0.25} />
              <line x1={gx(0)} y1={gy(v0)} x2={gx(r.time)} y2={gy(0)} stroke="var(--accent)" strokeWidth={3} />
              {simT !== null && <circle cx={gx(Math.min(simT, r.time))} cy={gy(st.speed)} r={5} fill="var(--ink)" />}
              <line x1={gl} x2={GW - gr} y1={gy(0)} y2={gy(0)} stroke="var(--ink)" />
              <line x1={gl} x2={gl} y1={gt} y2={gy(0)} stroke="var(--ink)" />
              {Array.from({ length: tMax + 1 }, (_, i) => i).filter((i) => tMax <= 10 || i % 2 === 0).map((i) => (
                <text key={i} x={gx(i)} y={GH - 14} textAnchor="middle" className="svg-tiny">{i}</text>
              ))}
              <text x={GW - gr} y={GH - 2} textAnchor="end" className="svg-tiny">time (s)</text>
              <text x={4} y={gt + 2} className="svg-tiny">speed</text>
            </svg>
            <p className="small">The shaded triangle’s area (½ × base × height) is the stopping distance.</p>
          </>
        ) : (
          <p className="feedback neutral" role="status"><strong>Unable to calculate.</strong> {r.reason}</p>
        )}
        <p className="disclaimer">Educational model only. Real braking depends on tires, terrain, and conditions.</p>
      </Card>
      <LabHints
        hints={[
          'Deceleration is how much speed you lose every second while braking.',
          'Try doubling the speed while keeping the brakes the same. Compare the stopping distance.',
          'distance = v₀² / (2a). Because speed is squared, doubling speed makes the distance 4 times as long.',
        ]}
      />
      <LabLearning
        equations={
          <>
            <p className="eq">stopping distance = v₀² / (2 · a)</p>
            <p className="eq">stopping time = v₀ / a</p>
            <p className="small">v₀ is the speed when the brakes go on; a is the size of the deceleration (constant).</p>
          </>
        }
        assumptions={[
          'Deceleration stays constant the whole time.',
          'Flat trail, no slope, no skidding changes.',
          'Real braking varies with tire grip, terrain, wet roots, and rider skill. This does not predict real stopping performance.',
        ]}
        reflection="If you ride twice as fast into a corner, how much more room do you need to stop? Why is it not just twice as much?"
      />
    </>
  );

  return <LabLayout eyebrow="Speed and Braking Lab" goal="Find out how speed and braking change stopping time and distance." scene={scene} controls={controls} side={side} />;
}
