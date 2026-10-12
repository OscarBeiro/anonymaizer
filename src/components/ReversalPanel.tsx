import type { RestoreFormat } from '../core/markdownRender';
import type { MappingSession } from '../core/types';
import type { RestoreSubStep } from '../lib/wizard';
import { RESTORE_SUB_STEPS } from '../lib/wizard';
import { SaveAsControl } from './SaveAsControl';

const FORMATS: { value: RestoreFormat; label: string; hint: string }[] = [
  { value: 'plain', label: 'Plain text', hint: 'Formatting marks removed — for email bodies, forms and plain editors.' },
  {
    value: 'markdown',
    label: 'Markdown',
    hint: 'Shown formatted. Copy pastes formatted into Word, Docs or email, and as Markdown into plain editors.',
  },
  { value: 'html', label: 'HTML', hint: 'The HTML source, to paste into a web page, a CMS or a template.' },
];

interface ReversalPanelProps {
  session: MappingSession;
  aiResponse: string;
  restored: string;
  /** The restored text in the chosen format: plain text, sanitized HTML (markdown view) or HTML source. */
  restoredView: string;
  restoreFormat: RestoreFormat;
  onRestoreFormatChange: (format: RestoreFormat) => void;
  onAiResponseChange: (text: string) => void;
  // Lifted into App so the Back/Next footer drives 3.1 -> 3.2 like Review's
  // sub-steps; the "Restore" and "Copy restored text" actions live there.
  subStep: RestoreSubStep;
  onSubStepChange: (subStep: RestoreSubStep) => void;
}

export const ReversalPanel = ({
  session,
  aiResponse,
  restored,
  restoredView,
  restoreFormat,
  onRestoreFormatChange,
  onAiResponseChange,
  subStep,
  onSubStepChange,
}: ReversalPanelProps) => (
  <div className="restore-step">
    <nav className="review-sub-nav">
      {RESTORE_SUB_STEPS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={s.id === subStep ? 'review-sub-nav-button review-sub-nav-active' : 'review-sub-nav-button'}
          disabled={s.id === 'restored' && !aiResponse}
          onClick={() => onSubStepChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>

    {subStep === 'response' && (
      <section className="panel">
        <h2>AI response</h2>
        <p className="panel-hint">
          Only placeholders can be restored. The fake names, companies and amounts of Realistic output stay as
          they are — they cannot be mapped back to the originals.
        </p>
        <textarea
          className="panel-textarea"
          placeholder="Paste the AI's response here…"
          value={aiResponse}
          onChange={(e) => onAiResponseChange(e.target.value)}
        />
      </section>
    )}

    {subStep === 'restored' && (
      <section className="panel">
        <h2>Restored text</h2>
        <div className="segmented" role="radiogroup" aria-label="Show restored text as">
          {FORMATS.map((f) => (
            <label key={f.value} className={restoreFormat === f.value ? 'segmented-option is-active' : 'segmented-option'}>
              <input
                type="radio"
                name="restore-format"
                value={f.value}
                checked={restoreFormat === f.value}
                onChange={() => onRestoreFormatChange(f.value)}
              />
              {f.label}
            </label>
          ))}
        </div>
        <p className="panel-hint">{FORMATS.find((f) => f.value === restoreFormat)?.hint}</p>
        {restoreFormat === 'markdown' ? (
          // Sanitized with DOMPurify in App before it gets here.
          <div className="panel-textarea restored-html" dangerouslySetInnerHTML={{ __html: restoredView }} />
        ) : (
          <textarea className="panel-textarea" readOnly value={restoredView} placeholder="Restored text appears here…" />
        )}
        <div className="panel-actions">
          <SaveAsControl text={restored} session={session} side="restored" />
        </div>
      </section>
    )}
  </div>
);
