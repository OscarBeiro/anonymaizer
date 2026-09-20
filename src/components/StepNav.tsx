import type { WizardStep } from '../lib/session';

interface StepNavProps {
  step: WizardStep;
  canReview: boolean;
  canRestore: boolean;
  onSelect: (step: WizardStep) => void;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'ingest', label: '1. Ingest' },
  { id: 'review', label: '2. Review' },
  { id: 'restore', label: '3. Restore' },
];

export const StepNav = ({ step, canReview, canRestore, onSelect }: StepNavProps) => {
  const isDisabled = (id: WizardStep): boolean =>
    (id === 'review' && !canReview) || (id === 'restore' && !canRestore);

  return (
    <nav className="step-nav">
      {STEPS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={s.id === step ? 'step-nav-button step-nav-active' : 'step-nav-button'}
          disabled={isDisabled(s.id)}
          onClick={() => onSelect(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
};
