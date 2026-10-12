import { useOutput } from './OutputContext';
import { useState } from 'react';
import { labelOf, nextPosition, prevPosition, type WizardGate, type WizardPosition } from '../lib/wizard';

// A tab whose real job is "copy this out" (2.3 sanitized, 3.2 restored): the
// copy takes Next's place until it has been done.
export interface CopyAction {
  label: string;
  text: string;
  /** When set, copied as rich text (text/html) with `text` as the plain fallback. */
  html?: string;
  doneMessage: string;
  sanitized?: boolean;
}

interface StepFooterProps {
  position: WizardPosition;
  gate: WizardGate;
  onNavigate: (position: WizardPosition) => void;
  copyAction?: CopyAction;
  // Clears the session (after its own confirmation) and returns to Ingest.
  onStartOver: () => void;
}

// Why Next is disabled, when the order has a next position but the gate holds it back.
const blockedHint = (pos: WizardPosition): string => {
  if (pos.step === 'ingest') return 'Paste text or drop a document first.';
  if (pos.step === 'restore') return "Paste the AI's response first.";
  return 'Nothing was detected, so there is nothing to restore.';
};

// 3.1's Next is the restore itself, so it says so.
const nextLabel = (to: WizardPosition): string => (to.subStep === 'restored' ? 'Restore' : `Next: ${labelOf(to)}`);

export const StepFooter = ({ position, gate, onNavigate, copyAction, onStartOver }: StepFooterProps) => {
  // The exact text copied, not a flag: if the text changes afterwards,
  // "Copied" no longer holds and the Copy button comes back.
  const output = useOutput();
  const [error, setError] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copyAction !== undefined && copiedText === copyAction.text;
  const prev = prevPosition(position);
  const next = nextPosition(position, gate);
  const isLast = position.step === 'restore' && position.subStep === 'restored';

  const copy = async (): Promise<void> => {
    if (!copyAction) return;
    try {
    const artifact = copyAction.sanitized ? output.prepare(copyAction.text, 'txt') : null;
    artifact?.assertCurrent();
    const text = artifact?.file.content ?? copyAction.text;
    const html = copyAction.html;
    const write =
      html && typeof ClipboardItem !== 'undefined'
        ? navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
          ])
        : navigator.clipboard.writeText(text);
    await write;
    if (artifact) output.delivered(artifact.exportId);
    setCopiedText(copyAction.text); setError('');
    } catch (e) { setCopiedText(null); setError(e instanceof Error ? e.message : 'Copy failed.'); }

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
        <span role="status" aria-live="polite">{error}</span>
        {copied && <span className="step-footer-done" role="status">✓ {copyAction.doneMessage}</span>}
        {copyAction && !copied && (
          <button type="button" className="step-footer-next" disabled={!copyAction.text} onClick={() => void copy()}>
            {copyAction.label}
          </button>
        )}
        {isLast && (
          // The end of the round trip. Always offered; primary once the
          // restored text has been copied.
          <button type="button" className={copied ? 'step-footer-next' : 'step-footer-back'} onClick={onStartOver}>
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
