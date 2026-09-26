import { nextPosition, prevPosition, REVIEW_SUB_STEPS, type WizardGate, type WizardPosition } from '../lib/wizard';

interface StepFooterProps {
  position: WizardPosition;
  gate: WizardGate;
  onNavigate: (position: WizardPosition) => void;
}

const STEP_LABELS = { ingest: 'Ingest', review: 'Review', restore: 'Restore' } as const;

const labelOf = (pos: WizardPosition): string =>
  pos.step === 'review'
    ? (REVIEW_SUB_STEPS.find((s) => s.id === pos.subStep)?.label.replace(/^[\d.]+\s*/, '') ?? 'Review')
    : STEP_LABELS[pos.step];

// Why Next is disabled, when the order has a next position but the gate holds it back.
const blockedHint = (pos: WizardPosition): string =>
  pos.step === 'ingest' ? 'Paste text or drop a document first.' : 'Nothing was detected, so there is nothing to restore.';

export const StepFooter = ({ position, gate, onNavigate }: StepFooterProps) => {
  const prev = prevPosition(position);
  const next = nextPosition(position, gate);
  // Restore is the last step: no Next at all, rather than a disabled one.
  const isLast = position.step === 'restore';

  return (
    <footer className="step-footer">
      {prev ? (
        <button type="button" className="step-footer-back" onClick={() => onNavigate(prev)}>
          ← {labelOf(prev)}
        </button>
      ) : (
        <span />
      )}
      {!isLast && (
        <div className="step-footer-next-group">
          {!next && <span className="empty-hint">{blockedHint(position)}</span>}
          <button type="button" className="step-footer-next" disabled={!next} onClick={() => next && onNavigate(next)}>
            {next ? `Next: ${labelOf(next)}` : 'Next'} →
          </button>
        </div>
      )}
    </footer>
  );
};
