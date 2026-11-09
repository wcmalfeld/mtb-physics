/**
 * Jumps for the Send It Lab.
 *
 * `real` lists the numbers that come from published reports. Everything else about a
 * feature's shape (lip height, landing angle and so on) is a reasonable model chosen so the
 * published numbers work, and is labelled that way in the app.
 */
import type { JumpGeometry } from '../physics/flight';

export interface Feature {
  id: string;
  name: string;
  venueId: string | null;
  where: string;
  /** approach speed at the bottom of the takeoff, m/s */
  approach: number;
  geo: JumpGeometry;
  real: string;
  modeled: string;
  mission: string;
}

export const FEATURES: Feature[] = [
  {
    id: 'dirt-jump', name: 'Dirt jump double', venueId: 'gorge-road', where: 'Typical of a jump-park line',
    approach: 8.3,
    geo: { lipHeight: 1.6, lipAngleDeg: 45, gap: 3.6, knuckleHeight: 0, landingAngleDeg: 40, landingLength: 3.5 },
    real: 'No single real jump: sized like a mid-level double at a public jump park.',
    modeled: 'All dimensions.',
    mission: 'Steep lips turn speed into height. Find the slowest approach speed that still clears the knuckle.',
  },
  {
    id: 'slopestyle-booter', name: 'Slopestyle booter', venueId: 'whistler', where: 'Typical of a contest course',
    approach: 13.2,
    geo: { lipHeight: 3, lipAngleDeg: 35, gap: 10, knuckleHeight: -0.5, landingAngleDeg: 33, landingLength: 9 },
    real: 'No single real jump: sized like a large contest jump.',
    modeled: 'All dimensions.',
    mission: 'Land in the first half of the downslope, then check how much a 15 mph (7 m/s) headwind moves you.',
  },
  {
    id: 'falcon-heavy', name: 'Falcon Heavy', venueId: 'darkfest', where: 'Darkfest 2026, South Africa',
    approach: 19.44,
    geo: { lipHeight: 7.5, lipAngleDeg: 53, gap: 20, knuckleHeight: 0, landingAngleDeg: 45, landingLength: 10 },
    real: '20 m gap, 53° takeoff, about 70 km/h approach speed (rider interview in BIKE Magazin).',
    modeled: 'Lip height and the landing’s height, angle and length.',
    mission: 'Why does this jump have more airtime than the longer 110-footer? Compare the airtime of both.',
  },
  {
    id: 'darkfest-110', name: 'The 110-footer', venueId: 'darkfest', where: 'Darkfest, South Africa',
    approach: 22.0,
    geo: { lipHeight: 6, lipAngleDeg: 35, gap: 33.5, knuckleHeight: -2, landingAngleDeg: 32, landingLength: 16 },
    real: '110 ft (33.5 m) gap.',
    modeled: 'Approach speed, lip height and angle, and the landing.',
    mission: 'Switch air resistance off and on. How many meters of this jump does the air take away?',
  },
  {
    id: 'canyon-gap', name: 'Desert canyon gap', venueId: 'virgin', where: 'In the style of Red Bull Rampage, Utah',
    approach: 18.0,
    geo: { lipHeight: 1, lipAngleDeg: 10, gap: 22.3, knuckleHeight: -5, landingAngleDeg: 35, landingLength: 14 },
    real: 'A 73 ft (22.3 m) canyon gap was reported at the 2026 venue (from reader comments, not an official figure). The 2026 men’s final was cancelled for high wind.',
    modeled: 'Approach speed, the step-down height and the landing.',
    mission: 'Dial in a clean landing in still air. Then add a gust. How strong a headwind makes you come up short?',
  },
];

export const getFeature = (id: string | null | undefined) => FEATURES.find((f) => f.id === id) ?? null;
