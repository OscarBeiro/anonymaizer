import type { WizardStep } from '../lib/session';
import { canEnter, type WizardGate } from '../lib/wizard';

interface StepNavProps {
  step: WizardStep;
  gate: WizardGate;
  onSelect: (step: WizardStep) => void;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'ingest', label: '1. Ingest' },
  { id: 'review', label: '2. Review' },
  { id: 'restore', label: '3. Restore' },
];

export const StepNav = ({ step, gate, onSelect }: StepNavProps) => {

  return (
    <nav className="step-nav">
      {STEPS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={s.id === step ? 'step-nav-button step-nav-active' : 'step-nav-button'}
          disabled={!canEnter(s.id, gate)}
          onClick={() => onSelect(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
};
