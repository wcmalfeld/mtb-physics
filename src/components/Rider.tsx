/**
 * Side-view rider used by the pro labs. Drawn facing right with the wheels' contact line at y = 0
 * and a wheelbase of 1 unit. `tiltDeg` leans the whole bike (nose up = positive),
 * `flipDeg` rotates about the rider's middle, and `spinDeg` fakes a turn about the vertical axis.
 */
export function Rider(props: { x: number; y: number; size: number; tiltDeg?: number; flipDeg?: number; spinDeg?: number; tuck?: number; ghost?: boolean }) {
  const { x, y, size, tiltDeg = 0, flipDeg = 0, spinDeg = 0, tuck = 0, ghost } = props;
  const sx = Math.cos((spinDeg * Math.PI) / 180);
  const facing = Math.abs(sx) < 0.12 ? (sx < 0 ? -0.12 : 0.12) : sx;
  const hip = -0.82 + tuck * 0.12, shoulder = -1.2 + tuck * 0.3, head = -1.36 + tuck * 0.34;
  return (
    <g transform={`translate(${x} ${y}) rotate(${-tiltDeg}) scale(${size})`} opacity={ghost ? 0.28 : 1} aria-hidden="true">
      <g transform={`translate(0 -0.62) rotate(${-flipDeg}) scale(${facing} 1) translate(0 0.62)`}>
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx={-0.5} cy={-0.3} r={0.3} stroke="var(--ink)" strokeWidth={0.07} />
          <circle cx={0.5} cy={-0.3} r={0.3} stroke="var(--ink)" strokeWidth={0.07} />
          <circle cx={-0.5} cy={-0.3} r={0.05} fill="var(--ink)" />
          <circle cx={0.5} cy={-0.3} r={0.05} fill="var(--ink)" />
          <path d="M-0.5 -0.3 L-0.02 -0.32 L-0.16 -0.74 L0.34 -0.7 L-0.02 -0.32 M0.34 -0.7 L0.5 -0.3 M-0.5 -0.3 L-0.16 -0.74" stroke="var(--accent)" strokeWidth={0.075} />
          <path d="M0.3 -0.8 L0.44 -0.84" stroke="var(--ink)" strokeWidth={0.07} />
          <path d={`M-0.14 ${hip} L${0.02 + tuck * 0.1} ${shoulder} L0.38 -0.84`} stroke="var(--jersey)" strokeWidth={0.12} />
          <path d={`M-0.14 ${hip} L${0.12 + tuck * 0.06} ${-0.55 - tuck * 0.06} L-0.02 -0.34`} stroke="var(--ink-soft)" strokeWidth={0.1} />
        </g>
        <circle cx={0.12 + tuck * 0.1} cy={head} r={0.13} fill="var(--helmet)" stroke="var(--ink)" strokeWidth={0.03} />
      </g>
    </g>
  );
}
