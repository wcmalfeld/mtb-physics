import type { ComponentType, ReactNode } from 'react';
import type { ModuleId } from '../state/store';
import { JumpLab } from './jump/JumpLab';
import { VectorExplorer } from './vector/VectorExplorer';
import { BrakingLab } from './braking/BrakingLab';
import { CorneringLab } from './cornering/CorneringLab';

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
  },
  {
    id: 'vector',
    title: 'Vector Explorer',
    tagline: 'Split a velocity into horizontal and vertical parts.',
    concepts: 'Vectors · trigonometry · Pythagoras',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 26 L26 6 M14 6 H26 V18" stroke="var(--accent)" /><path d="M6 26 H26" strokeDasharray="2 3" /></svg>,
    Component: VectorExplorer,
  },
  {
    id: 'braking',
    title: 'Speed & Braking Lab',
    tagline: 'How far do you roll before you stop?',
    concepts: 'Deceleration · squares · area under a graph',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 22 H22" stroke="var(--accent)" /><path d="M24 12 V26" /><path d="M4 26 H28" strokeDasharray="2 3" /></svg>,
    Component: BrakingLab,
  },
  {
    id: 'cornering',
    title: 'Cornering Lab',
    tagline: 'Why tight, fast turns feel so intense.',
    concepts: 'Circular motion · centripetal acceleration',
    icon: <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 26 A20 20 0 0 1 26 6" stroke="var(--accent)" /><circle cx="6" cy="26" r="2" fill="currentColor" /></svg>,
    Component: CorneringLab,
  },
];

export const getModule = (id: ModuleId) => MODULES.find((m) => m.id === id) ?? null;
