import type { WizardStep } from './session';

// W1: the one place that knows the wizard's order and what unlocks each step,
// so the sidebar (StepNav) and the Back/Next footer can't disagree.

export type ReviewSubStep = 'rules' | 'placeholders' | 'sanitized' | 'statistics';

export const REVIEW_SUB_STEPS: { id: ReviewSubStep; label: string }[] = [
  { id: 'rules', label: '2.1 Rules' },
  { id: 'placeholders', label: '2.2 Placeholders' },
  { id: 'sanitized', label: '2.3 Sanitized text' },
  { id: 'statistics', label: '2.4 Statistics' },
];

export interface WizardPosition {
  step: WizardStep;
  subStep?: ReviewSubStep; // only for step === 'review'
}

export interface WizardGate {
  hasText: boolean;
  hasMappings: boolean;
}

export const canEnter = (step: WizardStep, gate: WizardGate): boolean =>
  step === 'ingest' || (step === 'review' && gate.hasText) || (step === 'restore' && gate.hasMappings);

const ORDER: WizardPosition[] = [
  { step: 'ingest' },
  ...REVIEW_SUB_STEPS.map((s) => ({ step: 'review' as const, subStep: s.id })),
  { step: 'restore' },
];

const indexOf = (pos: WizardPosition): number =>
  ORDER.findIndex((p) => p.step === pos.step && (pos.step !== 'review' || p.subStep === (pos.subStep ?? 'rules')));

export const nextPosition = (pos: WizardPosition, gate: WizardGate): WizardPosition | null => {
  const next = ORDER[indexOf(pos) + 1];
  if (!next) return null;
  return next.step === pos.step || canEnter(next.step, gate) ? next : null;
};

export const prevPosition = (pos: WizardPosition): WizardPosition | null => ORDER[indexOf(pos) - 1] ?? null;
