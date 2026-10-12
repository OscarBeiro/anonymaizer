import { t } from '../i18n';
import type { WizardStep } from '../lib/session';
import { canEnter, type WizardGate } from '../lib/wizard';

interface StepNavProps {
  step: WizardStep;
  gate: WizardGate;
  onSelect: (step: WizardStep) => void;
}

const STEPS: () => { id: WizardStep; label: string }[] = () => ([
  { id: 'ingest', label: t('StepNav.1_ingest') },
  { id: 'review', label: t('StepNav.2_review') },
  { id: 'restore', label: t('StepNav.3_restore') },
]);

export const StepNav = ({ step, gate, onSelect }: StepNavProps) => {

  return (
    <nav className="step-nav">
      {STEPS().map((s) => (
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
