# Mathlete MTB Physics Playground

An interactive tutoring app that teaches projectile motion, vectors, and quadratics through mountain-bike jumps. Built with React + TypeScript + Vite. No backend, accounts, analytics, or network calls; all session state lives in memory.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # physics unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Requires Node 18+.

## What's inside

| Area | Where |
|---|---|
| Physics (SI only, pure functions) | `src/physics/projectile.ts`, `src/physics/labs.ts`, `src/physics/units.ts` |
| Physics tests | `src/physics/physics.test.ts` |
| App state (one reducer + derived values) | `src/state/store.tsx` |
| Jump Lab UI | `src/modules/jump/` (scene, controls, panels, challenges, transfer checks) |
| Other labs | `src/modules/vector/`, `src/modules/braking/`, `src/modules/cornering/` |
| Module menu registry | `src/modules/registry.tsx` |
| Tutor Mode | `src/components/TutorDrawer.tsx` |

### Key decisions

- **Physics is computed, never stored.** Trajectory, landing time/distance and outcome are derived from the current parameters on every render (`derive()` in the store), so results can't go stale. Saved attempts store frozen copies.
- **SI internally, display conversion only.** Sliders work in display units and convert back to SI with exact constants (1 mph = 0.44704 m/s, 1 ft = 0.3048 m).
- **No NaN on screen.** `computeFlight` returns `{ ok: false, reason }` for invalid or out-of-range input; the UI shows "Unable to calculate". `fmt()` renders any non-finite number as "—".
- **No answer leaks.** With *Predict first* on (or required by the tutor/challenge), the path, landing marker, outcome, landing-dependent equation steps and even the auto-zoom extent are hidden until launch.
- **Stepped zoom.** The scene zooms in 4 m steps so dragging a slider visibly moves the landing instead of rescaling the view.
- **Time-based animation**, slow-motion playback (≈0.55× real time), runs only while flying. Reduced-motion and Focus mode skip straight to the landing.

## Physics model

`vx = v₀cosθ`, `vy = v₀sinθ`, `y(t) = h + vy·t − ½gt²`, `g = 9.81 m/s²`. Landing uses the descending root `t = (vy + √(vy² + 2gh)) / g`, then `x = vx·t`. Outcome compares `x` against `[gap, gap + width]` (edges count as inside).

**Note on the spec's sanity check:** for h = 1.2192 m, v = 8.9408 m/s, θ = 20°, the model's equations give **t ≈ 0.900 s and x ≈ 7.56 m (24.8 ft)**. The spec's quoted 0.96 s / 8.07 m corresponds to a takeoff height of about 1.58 m (5.2 ft). The tests assert the equation-correct values.

## Tutor workflow

Open **🎓 Tutor** in the header (Esc closes it). From there you can pick a challenge, save the current sliders as that challenge's start, toggle equations, hints, required predictions and unrestricted controls, clear/restore comparisons, mark concepts (Needs practice / Developing / Demonstrated independently), read the student's written responses, and start a clean session for the next student. By default challenges lock all sliders except the one being investigated; turn on *Unrestricted controls* to free them.

## Adding a module

1. Put the physics in `src/physics/` as pure SI functions that return `{ ok: false, reason }` for invalid input, and add tests.
2. Create `src/modules/<name>/<Name>Lab.tsx`. Reuse `LabLayout`, `LabHints` and `LabLearning` from `src/modules/labShared.tsx` and `Slider`/`Card` from `src/components/ui.tsx` so the lab matches the others.
3. Add the id to `ModuleId` in `src/state/store.tsx` and register it in `src/modules/registry.tsx`.

To add a Jump Lab challenge, append to `CHALLENGES` in `src/modules/jump/challenges.ts`; its `check()` receives the launch history and saved attempts, so success is judged from computed results.

## Known limitations

- State is in memory only; reloading the page starts a fresh session (by design, for privacy).
- Written explanations are not auto-graded; they are collected for the tutor in Tutor Mode.
- On phones the prediction and results cards sit below the controls; scroll down after launching.
- The landing is a flat plane at the same height everywhere. Real landings are slopes; landing on the target isn't modeled differently from landing beside it.
