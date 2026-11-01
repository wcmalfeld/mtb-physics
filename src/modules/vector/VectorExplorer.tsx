import { useState } from 'react';
import { velocityComponents } from '../../physics/projectile';
import { combineComponents } from '../../physics/labs';
import { fmt, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Segmented, Slider } from '../../components/ui';
import { LabHints, LabLayout, LabLearning } from '../labShared';

export function VectorExplorer() {
  const { state, f } = useStore();
  const u = state.units;
  const [mode, setMode] = useState<'polar' | 'parts'>('polar');
  const [mag, setMag] = useState(8.9408); // SI m/s
  const [ang, setAng] = useState(20);
  const [vxIn, setVx] = useState(8.4);
  const [vyIn, setVy] = useState(3.06);

  const comps = mode === 'polar' ? velocityComponents(mag, ang) : { vx: vxIn, vy: vyIn };
  const polar = mode === 'polar' ? { magnitude: mag, angleDeg: ang } : combineComponents(vxIn, vyIn);
  const max = speedFromDisplay(u === 'us' ? 30 : 13.5, u);

  /* --- diagram --- */
  const W = 560, H = 340, ox = 60, oy = 290;
  const s = 240 / max;
  const ex = ox + comps.vx * s, ey = oy - comps.vy * s;
  const dsp = (v: number) => fmt(speedToDisplay(v, u), 1);
  const gridStep = (u === 'us' ? 5 : 2) * (u === 'us' ? 0.44704 : 1);
  const lines: number[] = [];
  for (let v = 0; v <= max * 1.15; v += gridStep) lines.push(v);

  const copyFromJump = () => {
    setMode('polar');
    setMag(state.params.speed);
    setAng(state.params.angleDeg);
  };

  const scene = (
    <div className="scene-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scene lab-svg" role="img" aria-label={`Vector of ${f.speed(polar.magnitude)} at ${fmt(polar.angleDeg, 0)} degrees. Horizontal component ${f.speed(comps.vx)}, vertical component ${f.speed(comps.vy)}.`}>
        <rect width={W} height={H} fill="var(--panel-2)" />
        <defs>
          {(['v', 'x', 'y'] as const).map((k) => (
            <marker key={k} id={`ve-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill={k === 'v' ? 'var(--accent)' : k === 'x' ? 'var(--vx)' : 'var(--vy)'} />
            </marker>
          ))}
        </defs>
        {lines.map((v) => (
          <g key={v} className="grid">
            <line x1={ox + v * s} x2={ox + v * s} y1={20} y2={H - 20} />
            <line x1={20} x2={W - 20} y1={oy - v * s} y2={oy - v * s} />
            <text x={ox + v * s} y={oy + 18} textAnchor="middle" className="tick">{dsp(v)}</text>
            {v > 0 && <text x={ox - 8} y={oy - v * s + 4} textAnchor="end" className="tick">{dsp(v)}</text>}
          </g>
        ))}
        <line x1={20} x2={W - 20} y1={oy} y2={oy} stroke="var(--ink)" />
        <line x1={ox} x2={ox} y1={20} y2={H - 20} stroke="var(--ink)" />
        <line x1={ex} y1={ey} x2={ex} y2={oy} stroke="var(--ink-soft)" strokeDasharray="4 4" />
        <line x1={ex} y1={ey} x2={ox} y2={ey} stroke="var(--ink-soft)" strokeDasharray="4 4" />
        {Math.abs(comps.vx) > 1e-6 && <line x1={ox} y1={oy} x2={ex} y2={oy} stroke="var(--vx)" strokeWidth={5} markerEnd="url(#ve-x)" />}
        {Math.abs(comps.vy) > 1e-6 && <line x1={ox} y1={oy} x2={ox} y2={ey} stroke="var(--vy)" strokeWidth={5} markerEnd="url(#ve-y)" />}
        {polar.magnitude > 1e-6 && <line x1={ox} y1={oy} x2={ex} y2={ey} stroke="var(--accent)" strokeWidth={5} markerEnd="url(#ve-v)" />}
        <text x={(ox + ex) / 2} y={oy + 36} textAnchor="middle" className="scene-label strong" fill="var(--vx)">vx = {dsp(comps.vx)} {f.L.speed}</text>
        <text x={ox + 10} y={(oy + ey) / 2} className="scene-label strong" fill="var(--vy)">vy = {dsp(comps.vy)}</text>
        <text x={ex + 8} y={ey - 8} className="scene-label strong">|v| = {dsp(polar.magnitude)} {f.L.speed}, θ = {fmt(polar.angleDeg, 0)}°</text>
      </svg>
    </div>
  );

  const controls = (
    <Card title="Vector settings" className="controls">
      <Segmented
        label="Build the vector from"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'polar', label: 'Size + direction' },
          { value: 'parts', label: 'Components' },
        ]}
      />
      <div className="control-groups">
        {mode === 'polar' ? (
          <fieldset>
            <legend>Size and direction</legend>
            <Slider label="Magnitude |v|" unit={f.L.speed} value={speedToDisplay(mag, u)} min={0} max={speedToDisplay(max, u)} step={u === 'us' ? 0.5 : 0.1} onChange={(v) => setMag(speedFromDisplay(v, u))} />
            <Slider label="Direction θ" unit="°" value={ang} min={0} max={90} step={1} digits={0} onChange={setAng} />
          </fieldset>
        ) : (
          <fieldset>
            <legend>Components</legend>
            <Slider label="Horizontal vx" unit={f.L.speed} value={speedToDisplay(vxIn, u)} min={0} max={speedToDisplay(max, u)} step={u === 'us' ? 0.5 : 0.1} onChange={(v) => setVx(speedFromDisplay(v, u))} />
            <Slider label="Vertical vy" unit={f.L.speed} value={speedToDisplay(vyIn, u)} min={0} max={speedToDisplay(max, u)} step={u === 'us' ? 0.5 : 0.1} onChange={(v) => setVy(speedFromDisplay(v, u))} />
          </fieldset>
        )}
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-small" onClick={copyFromJump}>Use my Jump Lab speed and angle</button>
      </div>
    </Card>
  );

  const side = (
    <>
      <Card title="Results" className="results">
        <dl className="stats">
          <div><dt>Magnitude |v|</dt><dd>{f.speed(polar.magnitude)}</dd></div>
          <div><dt>Direction θ</dt><dd>{fmt(polar.angleDeg, 1)}°</dd></div>
          <div><dt>Horizontal vx</dt><dd>{f.speed(comps.vx)}</dd></div>
          <div><dt>Vertical vy</dt><dd>{f.speed(comps.vy)}</dd></div>
        </dl>
        <p className="explain">
          Check: √(vx² + vy²) = √({dsp(comps.vx)}² + {dsp(comps.vy)}²) = {dsp(Math.hypot(comps.vx, comps.vy))} {f.L.speed}, the same as the magnitude. The components rebuild the original vector.
        </p>
      </Card>
      <LabHints
        hints={[
          'A vector has a size (how fast) and a direction (which way). Components are its horizontal and vertical parts.',
          'Keep the magnitude fixed and sweep the angle from 0° to 90°. Watch one component grow while the other shrinks.',
          'vx = |v|·cos θ and vy = |v|·sin θ. At 45°, cos and sin are equal (≈0.707), so vx = vy.',
        ]}
      />
      <LabLearning
        equations={
          <>
            <p className="eq">vx = |v| · cos θ</p>
            <p className="eq">vy = |v| · sin θ</p>
            <p className="eq">|v| = √(vx² + vy²)</p>
            <p className="eq">θ = tan⁻¹(vy / vx)</p>
            <p className="small">The vector and its two components form a right triangle; |v| is the hypotenuse (Pythagorean theorem).</p>
          </>
        }
        assumptions={['Vectors are drawn in 2D only.', 'Angles are measured from the horizontal.', 'The same math works for any vector quantity: velocity, force, or displacement.']}
        reflection="At what angle are vx and vy equal? Why does that make sense from the triangle?"
      />
    </>
  );

  return <LabLayout eyebrow="Vector Explorer" goal="See how a vector splits into horizontal and vertical parts, and how the parts rebuild it." scene={scene} controls={controls} side={side} />;
}
