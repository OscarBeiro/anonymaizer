import { useState } from 'react';
import { nextPosition, prevPosition, REVIEW_SUB_STEPS, type WizardGate, type WizardPosition } from '../lib/wizard';

interface StepFooterProps {
  position: WizardPosition;
  gate: WizardGate;
  onNavigate: (position: WizardPosition) => void;
  // On 2.3 Sanitized text, the text to copy. Copying is that tab's real
  // action, so it takes Next's place until done.
  sanitizedText?: string;
}

const STEP_LABELS = { ingest: 'Ingest', review: 'Review', restore: 'Restore' } as const;

const labelOf = (pos: WizardPosition): string =>
  pos.step === 'review'
    ? (REVIEW_SUB_STEPS.find((s) => s.id === pos.subStep)?.label.replace(/^[\d.]+\s*/, '') ?? 'Review')
    : STEP_LABELS[pos.step];

// Why Next is disabled, when the order has a next position but the gate holds it back.
const blockedHint = (pos: WizardPosition): string =>
  pos.step === 'ingest' ? 'Paste text or drop a document first.' : 'Nothing was detected, so there is nothing to restore.';

export const StepFooter = ({ position, gate, onNavigate, sanitizedText }: StepFooterProps) => {
  // The exact text copied, not a flag: if a toggle changes the sanitized text
  // afterwards, "Copied" no longer holds and the Copy button comes back.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copiedText !== null && copiedText === sanitizedText;
  const prev = prevPosition(position);
  const next = nextPosition(position, gate);
  // Restore is the last step: no Next at all, rather than a disabled one.
  const isLast = position.step === 'restore';
  const offersCopy = position.subStep === 'sanitized' && sanitizedText !== undefined;

  const copy = (): void => {
    if (sanitizedText === undefined) return;
    const text = sanitizedText;
    navigator.clipboard.writeText(text).then(
      () => setCopiedText(text),
      () => setCopiedText(null),
    );
  };

  return (
    <footer className="step-footer">
      {prev ? (
        <button type="button" className="step-footer-back" onClick={() => onNavigate(prev)}>
          ← {labelOf(prev)}
        </button>
      ) : (
        <span />
      )}
      {offersCopy && !copied && (
        <button type="button" className="step-footer-next" onClick={copy}>
          Copy sanitized text
        </button>
      )}
      {!isLast && (!offersCopy || copied) && (
        <div className="step-footer-next-group">
          {offersCopy && <span className="step-footer-done">✓ Copied — your text is ready to send to the AI.</span>}
          {!next && <span className="empty-hint">{blockedHint(position)}</span>}
          <button type="button" className="step-footer-next" disabled={!next} onClick={() => next && onNavigate(next)}>
            {next ? `Next: ${labelOf(next)}` : 'Next'} →
          </button>
        </div>
      )}
    </footer>
  );
};
