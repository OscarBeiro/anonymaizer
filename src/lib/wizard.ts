import type { WizardStep } from './session';

// W1: the one place that knows the wizard's order and what unlocks each step,
// so the sidebar (StepNav), the sub-step tabs and the Back/Next footer can't
// disagree.

export type ReviewSubStep = 'rules' | 'placeholders' | 'sanitized' | 'statistics';
export type RestoreSubStep = 'response' | 'restored';
export type SubStep = ReviewSubStep | RestoreSubStep;

export const REVIEW_SUB_STEPS: { id: ReviewSubStep; label: string }[] = [
  { id: 'rules', label: '2.1 Rules' },
  { id: 'placeholders', label: '2.2 Placeholders' },
  { id: 'sanitized', label: '2.3 Sanitized text' },
  { id: 'statistics', label: '2.4 Statistics' },
];

export const RESTORE_SUB_STEPS: { id: RestoreSubStep; label: string }[] = [
  { id: 'response', label: '3.1 AI response' },
  { id: 'restored', label: '3.2 Restored text' },
];

export interface WizardPosition {
  step: WizardStep;
  subStep?: SubStep; // omitted means the step's first sub-step
}

export interface WizardGate {
  hasText: boolean;
  hasMappings: boolean;
  hasAiResponse: boolean;
}

export const canEnter = (step: WizardStep, gate: WizardGate): boolean =>
  step === 'ingest' || (step === 'review' && gate.hasText) || (step === 'restore' && gate.hasMappings);

const ORDER: WizardPosition[] = [
  { step: 'ingest' },
  ...REVIEW_SUB_STEPS.map((s) => ({ step: 'review' as const, subStep: s.id })),
  ...RESTORE_SUB_STEPS.map((s) => ({ step: 'restore' as const, subStep: s.id })),
];

const indexOf = (pos: WizardPosition): number => {
  const first = ORDER.findIndex((p) => p.step === pos.step);
  if (!pos.subStep) return first;
  return ORDER.findIndex((p) => p.step === pos.step && p.subStep === pos.subStep);
};

// Moving within a step is free, except that the restored text needs an AI
// response to restore; entering a step goes through canEnter.
const mayMove = (from: WizardPosition, to: WizardPosition, gate: WizardGate): boolean => {
  if (to.step !== from.step) return canEnter(to.step, gate);
  return to.subStep !== 'restored' || gate.hasAiResponse;
};

export const nextPosition = (pos: WizardPosition, gate: WizardGate): WizardPosition | null => {
  const next = ORDER[indexOf(pos) + 1];
  return next && mayMove(pos, next, gate) ? next : null;
};

export const prevPosition = (pos: WizardPosition): WizardPosition | null => ORDER[indexOf(pos) - 1] ?? null;

export const labelOf = (pos: WizardPosition): string => {
  const sub = [...REVIEW_SUB_STEPS, ...RESTORE_SUB_STEPS].find((s) => s.id === pos.subStep);
  if (sub) return sub.label.replace(/^[\d.]+\s*/, '');
  return { ingest: 'Ingest', review: 'Review', restore: 'Restore' }[pos.step];
};
