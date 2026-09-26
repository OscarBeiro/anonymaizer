import type { MappingSession } from '../core/types';
import type { RestoreSubStep } from '../lib/wizard';
import { RESTORE_SUB_STEPS } from '../lib/wizard';
import { SaveAsControl } from './SaveAsControl';

interface ReversalPanelProps {
  session: MappingSession;
  aiResponse: string;
  restored: string;
  onAiResponseChange: (text: string) => void;
  // Lifted into App so the Back/Next footer drives 3.1 -> 3.2 like Review's
  // sub-steps; the "Restore" and "Copy restored text" actions live there.
  subStep: RestoreSubStep;
  onSubStepChange: (subStep: RestoreSubStep) => void;
}

export const ReversalPanel = ({ session, aiResponse, restored, onAiResponseChange, subStep, onSubStepChange }: ReversalPanelProps) => (
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
        <textarea className="panel-textarea" readOnly value={restored} placeholder="Restored text appears here…" />
        <div className="panel-actions">
          <SaveAsControl text={restored} session={session} side="restored" />
        </div>
      </section>
    )}
  </div>
);
