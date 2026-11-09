import type { ComponentType, ReactNode } from 'react';
import type { ModuleId } from '../state/store';
import { JumpLab } from './jump/JumpLab';
import { VectorExplorer } from './vector/VectorExplorer';
import { BrakingLab } from './braking/BrakingLab';
import { CorneringLab } from './cornering/CorneringLab';
import { WorldTour } from './atlas/WorldTour';
import { SendItLab } from './sendit/SendItLab';
import { TrickLab } from './tricks/TrickLab';
import { RaceLab } from './race/RaceLab';

/**
 * Module registry. To add a lab: create a component in src/modules/<name>/,
 * put its physics in src/physics/ (with tests), add an id to ModuleId, and register it here.
 */
export interface ModuleDef {
  id: Exclude<ModuleId, 'menu'>;
  title: string;
  tagline: string;
  concepts: string;
  icon: ReactNode;
  Component: ComponentType;
  featured?: boolean;
  /** foundations = the core concept labs; pro = labs built on real venues and fuller physics */
  group: 'foundations' | 'pro' | 'tour';
}

export const MODULES: ModuleDef[] = [
  {
    id: 'jump',
    title: 'MTB Jump Lab',
    tagline: 'Launch a rider off a ramp, predict the landing, and dial it in.',
    concepts: 'Projectile motion · quadratics · gravity',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="5" /><circle cx="24" cy="21" r="5" /><path d="M8 21 L14 11 L24 21 M14 11 L20 11" stroke="var(--accent)" /></svg>,
    Component: JumpLab,
    featured: true,
    group: 'foundations',
  },
  {
    id: 'vector',
    title: 'Vector Explorer',
    tagline: 'Split a velocity into horizontal and vertical parts.',
    concepts: 'Vectors · trigonometry · Pythagoras',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 26 L26 6 M14 6 H26 V18" stroke="var(--accent)" /><path d="M6 26 H26" strokeDasharray="2 3" /></svg>,
    Component: VectorExplorer,
    group: 'foundations',
  },
  {
    id: 'braking',
    title: 'Speed & Braking Lab',
    tagline: 'How far do you roll before you stop?',
    concepts: 'Deceleration · squares · area under a graph',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 22 H22" stroke="var(--accent)" /><path d="M24 12 V26" /><path d="M4 26 H28" strokeDasharray="2 3" /></svg>,
    Component: BrakingLab,
    group: 'foundations',
  },
  {
    id: 'cornering',
    title: 'Cornering Lab',
    tagline: 'Why tight, fast turns feel so intense.',
    concepts: 'Circular motion · centripetal acceleration',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 26 A20 20 0 0 1 26 6" stroke="var(--accent)" /><circle cx="6" cy="26" r="2" fill="currentColor" /></svg>,
    Component: CorneringLab,
    group: 'foundations',
  },
  {
    id: 'atlas',
    title: 'World Tour 2026',
    tagline: 'Twenty real venues, from the Black Snake to Gorge Road. See what happened and take it into a lab.',
    concepts: 'Gravity by latitude · air density · real results',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="16" r="11" /><path d="M5 16 H27 M16 5 C10 11 10 21 16 27 M16 5 C22 11 22 21 16 27" /><circle cx="21" cy="11" r="2.4" fill="var(--accent)" stroke="var(--accent)" /></svg>,
    Component: WorldTour,
    group: 'tour',
  },
  {
    id: 'sendit',
    title: 'Send It Lab',
    tagline: 'Real air, wind and sloped landings on jumps up to Darkfest size.',
    concepts: 'Energy · drag · impact and landing angle',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 26 H9 Q13 26 15 19" /><path d="M21 21 L29 27" /><path d="M15 17 Q20 3 25 19" stroke="var(--accent)" strokeDasharray="2 4" /></svg>,
    Component: SendItLab,
    group: 'pro',
  },
  {
    id: 'tricks',
    title: 'Trick Lab',
    tagline: 'Spin a 720 or flip the Falcon Heavy by managing your tuck.',
    concepts: 'Angular momentum · moment of inertia',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M24 9 A10 10 0 1 0 26 18" stroke="var(--accent)" /><path d="M24 3 V9 H18" stroke="var(--accent)" /><circle cx="16" cy="16" r="2.5" fill="currentColor" /></svg>,
    Component: TrickLab,
    group: 'pro',
  },
  {
    id: 'race',
    title: 'Race Run Lab',
    tagline: 'Race World Cup tracks against the 2026 winning times.',
    concepts: 'Energy budget · grip limits · braking on slopes',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7 L11 13 L15 12 L21 21 L28 25" /><circle cx="15" cy="12" r="2.6" fill="var(--accent)" stroke="var(--accent)" /><path d="M24 6 V14 M24 6 H29 V10 H24" /></svg>,
    Component: RaceLab,
    group: 'pro',
  },
];

export const getModule = (id: ModuleId) => MODULES.find((m) => m.id === id) ?? null;
