import { useState } from 'react';
import type { MappingSession } from '../core/types';
import { HighlightedText } from './MappingPanels';
import { SaveAsControl } from './SaveAsControl';

interface QuickResultProps {
  session: MappingSession;
  onFineTune: () => void;
  onRestore: () => void;
  onNewDocument: () => void;
}

// S3: the Standard-mode result. Always the placeholder rendering, never the
// realistic one, so whatever is copied here can still be restored later.
export const QuickResult = ({ session, onFineTune, onRestore, onNewDocument }: QuickResultProps) => {
  const text = session.anonymizedMarkdown;
  const [copied, setCopied] = useState(false);

  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );

  return (
    <section className="panel quick-result">
      <h2>Anonymized text</h2>
      <div className="panel-textarea sanitized-highlight"><HighlightedText text={text} /></div>
      <p className="quick-result-hint">
        Need realistic fake data (names, companies, amounts ± a range you choose) for test files? Use Fine-tune…, then
        2.3 Sanitized text → Realistic. Realistic output cannot be restored.
      </p>
      <div className="panel-actions quick-result-actions">
        <button type="button" className="step-footer-next" disabled={!text} onClick={() => void copy()}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <SaveAsControl text={text} session={session} side="sanitized" />
        <button type="button" className="step-footer-back" onClick={onFineTune}>
          Fine-tune…
        </button>
        <button type="button" className="step-footer-back" onClick={onNewDocument}>
          New document
        </button>
        <button type="button" className="link-button" onClick={onRestore}>
          Restore an AI response
        </button>
      </div>
    </section>
  );
};
