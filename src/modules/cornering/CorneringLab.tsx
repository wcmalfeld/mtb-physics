import { useEffect, useState } from 'react';
import { computeCentripetal } from '../../physics/labs';
import { fmt, lengthToDisplay, mphToMs, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Slider, usePrefersReducedMotion } from '../../components/ui';
import { LabHints, LabLayout, LabLearning } from '../labShared';

const FT = 0.3048;

export function CorneringLab() {
  const { state, f } = useStore();
  const u = state.units;
  const us = u === 'us';
  const reduced = usePrefersReducedMotion() || state.lowDistraction;
  const [v, setV] = useState(mphToMs(12));
  const [r, setR] = useState(8); // m
  const [phase, setPhase] = useState(0.35); // position on the arc, 0..1
  const [moving, setMoving] = useState(false);

  const res = computeCentripetal(v, r);

  useEffect(() => {
    if (!moving || reduced || !res.ok || v <= 0) return;
    let raf = 0;
    let last = performance.now();
    const arcLen = (Math.PI / 2) * r; // quarter turn
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => {
        const np = p + (v * dt * 0.5) / arcLen; // half-speed playback
        return np > 1 ? 0 : np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, reduced, res.ok, v, r]);

  /* --- top-down scene: a quarter-circle turn, centre bottom-left --- */
  const W = 560, H = 380, cx = 80, cy = 330;
  const pxPerM = 260 / 30;
  const R = Math.max(0, r) * pxPerM;
  const ang = (phase * Math.PI) / 2; // 0 → east of centre, π/2 → north
  const bx = cx + R * Math.cos(ang), by = cy - R * Math.sin(ang);
  const tx = -Math.sin(ang), ty = -Math.cos(ang); // tangent direction (counter-clockwise), screen coords
  const vLen = 20 + (v / mphToMs(30)) * 80;
  const aLen = res.ok ? Math.min(150, 14 + Math.sqrt(res.acceleration) * 18) : 0;

  const scene = (
    <div className="scene-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scene lab-svg" role="img" aria-label={res.ok ? `Top view of a turn with radius ${f.length(r)} at ${f.speed(v)}. Required centripetal acceleration ${fmt(res.acceleration, 1)} meters per second squared.` : res.reason}>
        <defs>
          {(['v', 'a'] as const).map((k) => (
            <marker key={k} id={`co-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill={k === 'v' ? 'var(--accent)' : 'var(--vy)'} />
            </marker>
          ))}
        </defs>
        <rect width={W} height={H} fill="var(--grass)" />
        {R > 0 && (
          <>
            <path d={`M ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx} ${cy - R}`} fill="none" stroke="var(--dirt)" strokeWidth={26} strokeLinecap="round" />
            <path d={`M ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx} ${cy - R}`} fill="none" stroke="var(--trail)" strokeWidth={2} strokeDasharray="6 6" />
            <line x1={cx} y1={cy} x2={bx} y2={by} stroke="var(--ink-soft)" strokeDasharray="4 4" />
            <text x={(cx + bx) / 2 + 6} y={(cy + by) / 2} className="scene-label">r = {fmt(lengthToDisplay(r, u), 1)} {f.L.length}</text>
          </>
        )}
        <circle cx={cx} cy={cy} r={5} fill="var(--ink)" />
        <text x={cx + 8} y={cy + 18} className="scene-label small">centre of turn</text>
        {R > 0 && (
          <g>
            {v > 0 && <line x1={bx} y1={by} x2={bx + tx * vLen} y2={by + ty * vLen} stroke="var(--accent)" strokeWidth={4} markerEnd="url(#co-v)" />}
            {res.ok && aLen > 0 && v > 0 && <line x1={bx} y1={by} x2={bx + ((cx - bx) / R) * aLen} y2={by + ((cy - by) / R) * aLen} stroke="var(--vy)" strokeWidth={4} markerEnd="url(#co-a)" />}
            <circle cx={bx} cy={by} r={9} fill="var(--jersey)" stroke="var(--ink)" strokeWidth={2} />
          </g>
        )}
        <g className="chip">
          <rect x={W - 220} y={10} width={210} height={52} rx={8} />
          <text x={W - 208} y={31} className="chip-text"><tspan fill="var(--accent)">━</tspan> velocity (along the path)</text>
          <text x={W - 208} y={51} className="chip-text"><tspan fill="var(--vy)">━</tspan> acceleration (to the centre)</text>
        </g>
      </svg>
      <div className="action-bar">
        <button type="button" className="btn btn-primary" disabled={!res.ok || reduced} onClick={() => setMoving(!moving)}>
          {moving ? 'Pause' : 'Ride the turn'}
        </button>
        {reduced && <span className="action-note">Animation off (reduced motion). Drag the position slider instead.</span>}
      </div>
    </div>
  );

  const controls = (
    <Card title="Turn settings" className="controls">
      <div className="control-groups">
        <fieldset>
          <legend>Rider and turn</legend>
          <Slider label="Speed" unit={f.L.speed} value={speedToDisplay(v, u)} min={0} max={speedToDisplay(mphToMs(30), u)} step={us ? 0.5 : 0.1} onChange={(x) => setV(speedFromDisplay(x, u))} />
          <Slider
            label="Turn radius"
            unit={f.L.length}
            value={us ? r / FT : r}
            min={0}
            max={us ? 100 : 30}
            step={us ? 1 : 0.5}
            digits={us ? 0 : 1}
            onChange={(x) => setR(us ? x * FT : x)}
            help="Tight turn = small radius. A radius of 0 isn’t a curve."
          />
        </fieldset>
        <fieldset>
          <legend>View</legend>
          <Slider label="Position in the turn" unit="%" value={phase * 100} min={0} max={100} step={1} digits={0} onChange={(x) => setPhase(x / 100)} />
        </fieldset>
      </div>
    </Card>
  );

  const side = (
    <>
      <Card title="Results" className="results">
        {res.ok ? (
          <dl className="stats">
            <div><dt>Centripetal acceleration</dt><dd>{us ? `${fmt(res.acceleration / FT, 1)} ft/s²` : `${fmt(res.acceleration, 2)} m/s²`}</dd></div>
            <div><dt>As a multiple of g</dt><dd>{fmt(res.gForce, 2)} g</dd></div>
          </dl>
        ) : (
          <p className="feedback neutral" role="status"><strong>Unable to calculate.</strong> {res.reason}</p>
        )}
        <p className="small">This is the sideways acceleration <em>needed</em> to follow the curve. Tires and lean have to provide it.</p>
        <p className="disclaimer">Not a safe cornering-speed recommendation. Real grip varies with tires, surface, and lean.</p>
      </Card>
      <LabHints
        hints={[
          'To move in a circle you must keep changing direction, and changing direction is acceleration, even at constant speed.',
          'Double the speed and watch the acceleration. Then halve the radius instead and compare.',
          'a = v² / r. Doubling v makes a four times larger; halving r only doubles it.',
        ]}
      />
      <LabLearning
        equations={
          <>
            <p className="eq">a = v² / r</p>
            <p className="small">v is speed along the path, r is the turn radius, and a points toward the centre of the turn. Dividing by g gives “how many g’s”.</p>
          </>
        }
        assumptions={['Constant speed and a perfectly circular path.', 'Flat (unbanked) turn.', 'Ignores tire grip limits, lean angle, berms, and rider skill.']}
        reflection="Which change makes a corner more demanding: going 2× faster or making the turn 2× tighter? Use the equation to explain."
      />
    </>
  );

  return <LabLayout eyebrow="Cornering Lab" goal="See how speed and turn radius change the acceleration needed to follow a curve." scene={scene} controls={controls} side={side} />;
}
