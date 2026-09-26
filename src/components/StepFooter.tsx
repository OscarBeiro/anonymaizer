import { useState } from 'react';
import { labelOf, nextPosition, prevPosition, type WizardGate, type WizardPosition } from '../lib/wizard';

// A tab whose real job is "copy this out" (2.3 sanitized, 3.2 restored): the
// copy takes Next's place until it has been done.
export interface CopyAction {
  label: string;
  text: string;
  doneMessage: string;
}

interface StepFooterProps {
  position: WizardPosition;
  gate: WizardGate;
  onNavigate: (position: WizardPosition) => void;
  copyAction?: CopyAction;
}

// Why Next is disabled, when the order has a next position but the gate holds it back.
const blockedHint = (pos: WizardPosition): string => {
  if (pos.step === 'ingest') return 'Paste text or drop a document first.';
  if (pos.step === 'restore') return "Paste the AI's response first.";
  return 'Nothing was detected, so there is nothing to restore.';
};

// 3.1's Next is the restore itself, so it says so.
const nextLabel = (to: WizardPosition): string => (to.subStep === 'restored' ? 'Restore' : `Next: ${labelOf(to)}`);

export const StepFooter = ({ position, gate, onNavigate, copyAction }: StepFooterProps) => {
  // The exact text copied, not a flag: if the text changes afterwards,
  // "Copied" no longer holds and the Copy button comes back.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copyAction !== undefined && copiedText === copyAction.text;
  const prev = prevPosition(position);
  const next = nextPosition(position, gate);
  const isLast = position.step === 'restore' && position.subStep === 'restored';

  const copy = (): void => {
    if (!copyAction) return;
    const { text } = copyAction;
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
      <div className="step-footer-next-group">
        {copied && <span className="step-footer-done">✓ {copyAction.doneMessage}</span>}
        {copyAction && !copied && (
          <button type="button" className="step-footer-next" disabled={!copyAction.text} onClick={copy}>
            {copyAction.label}
          </button>
        )}
        {isLast && copied && (
          // The end of the round trip: back to Ingest for the next document.
          // Navigation only — the session is kept, pasting replaces it.
          <button type="button" className="step-footer-next" onClick={() => onNavigate({ step: 'ingest' })}>
            Start again →
          </button>
        )}
        {!isLast && (!copyAction || copied) && (
          <>
            {!next && <span className="empty-hint">{blockedHint(position)}</span>}
            <button type="button" className="step-footer-next" disabled={!next} onClick={() => next && onNavigate(next)}>
              {next ? nextLabel(next) : 'Next'} →
            </button>
          </>
        )}
      </div>
    </footer>
  );
};
