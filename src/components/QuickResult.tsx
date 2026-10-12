import { t } from '../i18n';
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
      <h2>{t('QuickResult.anonymized_text')}</h2>
      <div className="panel-textarea sanitized-highlight"><HighlightedText text={text} /></div>
      <p className="quick-result-hint">
        {t('QuickResult.need_realistic_fake_data_names_companies_amounts')}</p>
      <div className="panel-actions quick-result-actions">
        <button type="button" className="step-footer-next" disabled={!text} onClick={() => void copy()}>
          {copied ? t('QuickResult.copied') : t('QuickResult.copy')}
        </button>
        <SaveAsControl text={text} session={session} side="sanitized" />
        <button type="button" className="step-footer-back" onClick={onFineTune}>
          {t('QuickResult.fine_tune')}</button>
        <button type="button" className="step-footer-back" onClick={onNewDocument}>
          {t('QuickResult.new_document')}</button>
        <button type="button" className="link-button" onClick={onRestore}>
          {t('QuickResult.restore_an_ai_response')}</button>
      </div>
    </section>
  );
};
