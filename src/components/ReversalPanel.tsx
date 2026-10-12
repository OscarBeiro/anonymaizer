import { t } from '../i18n';
import type { RestoreFormat } from '../core/markdownRender';
import type { MappingSession } from '../core/types';
import type { RestoreSubStep } from '../lib/wizard';
import { RESTORE_SUB_STEPS } from '../lib/wizard';
import { SaveAsControl } from './SaveAsControl';

const FORMATS: () => { value: RestoreFormat; label: string; hint: string }[] = () => ([
  { value: 'plain', label: t('ReversalPanel.plain_text'), hint: t('ReversalPanel.formatting_marks_removed_for_email_bodies_forms') },
  {
    value: 'markdown',
    label: t('ReversalPanel.markdown'),
    hint: t('ReversalPanel.shown_formatted_copy_pastes_formatted_into_word'),
  },
  { value: 'html', label: t('ReversalPanel.html'), hint: t('ReversalPanel.the_html_source_to_paste_into_a') },
]);

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
      {RESTORE_SUB_STEPS().map((s) => (
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
        <h2>{t('ReversalPanel.ai_response')}</h2>
        <p className="panel-hint">
          {t('ReversalPanel.only_placeholders_can_be_restored_the_fake')}</p>
        <textarea
          className="panel-textarea"
          placeholder={t('ReversalPanel.paste_the_ai_s_response_here')}
          value={aiResponse}
          onChange={(e) => onAiResponseChange(e.target.value)}
        />
      </section>
    )}

    {subStep === 'restored' && (
      <section className="panel">
        <h2>{t('ReversalPanel.restored_text')}</h2>
        <div className="segmented" role="radiogroup" aria-label={t('ReversalPanel.show_restored_text_as')}>
          {FORMATS().map((f) => (
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
        <p className="panel-hint">{FORMATS().find((f) => f.value === restoreFormat)?.hint}</p>
        {restoreFormat === 'markdown' ? (
          // Sanitized with DOMPurify in App before it gets here.
          <div className="panel-textarea restored-html" dangerouslySetInnerHTML={{ __html: restoredView }} />
        ) : (
          <textarea className="panel-textarea" readOnly value={restoredView} placeholder={t('ReversalPanel.restored_text_appears_here')} />
        )}
        <div className="panel-actions">
          <SaveAsControl text={restored} session={session} side="restored" />
        </div>
      </section>
    )}
  </div>
);
