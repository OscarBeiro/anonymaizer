import { t } from '../i18n';
import type { NerStatus } from '../lib/nerClient';

interface NerToggleProps {
  enabled: boolean;
  /** L3: the document is large enough that NER will be slow. */
  longDocument?: boolean;
  status: NerStatus;
  onToggle: (enabled: boolean) => void;
  onDeleteModel: () => void;
}

const statusText = (status: NerStatus): string | null => {
  switch (status.state) {
    case 'loading':
      // Deliberately not "Downloading…": transformers.js fires this
      // same progress event whether the model comes from the network or
      // from our IndexedDB cache — it gives no cache-hit signal — so a
      // returning user who already has it cached sees this too, briefly.
      // Claiming "downloading" every time would be a false alarm.
      return status.detail ? t('NerToggle.loading_model', { p0: status.detail }) : t('NerToggle.loading_model_2');
    case 'scanning':
      return status.total && status.total > 1
        ? t('NerToggle.scanning_progress', { p0: (status.done ?? 0) + 1, p1: status.total })
        : t('NerToggle.scanning_document');
    case 'error':
      return t('NerToggle.ner_failed', { p0: status.message });
    default:
      return null;
  }
};

/**
 * P7d opt-in control, revised: once the model is loaded (`status.state ===
 * 'ready'`), the checkbox and its download blurb serve no purpose anymore —
 * there's nothing left to opt into — so they're replaced by a compact
 * status line. Re-scanning is automatic from here (App.tsx re-runs NER on
 * every edit once ready), so there is no manual "Re-scan" button to show.
 *
 * "Turn off" and "Delete model" are deliberately separate actions: turning
 * off just stops using the model this session, keeping the ~104MB cached
 * for an instant re-enable later. Delete actually frees that cache and
 * forces a full re-download next time — the two must never be conflated.
 */
export const NerToggle = ({ enabled, longDocument, status, onToggle, onDeleteModel }: NerToggleProps) => {
  const loading = status.state === 'loading' || status.state === 'scanning';
  const text = statusText(status);
  const modelDownloaded = status.state === 'ready';

  if (modelDownloaded) {
    return (
      <div className="ner-toggle ner-toggle-active">
        {enabled ? (
          <span className="ner-status-ready">{t('NerToggle.local_ai_detection_on_model_runs_fully')}</span>
        ) : (
          <label>
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
            {' '}{t('NerToggle.local_ai_detection_model_already_downloaded_re')}</label>
        )}
        {status.state === 'ready' && status.coverage && !status.coverage.complete && (
          <p className="ner-long-note" role="alert">
            {t('NerToggle.coverage_incomplete', { p0: status.coverage.coveredChars.toLocaleString(), p1: status.coverage.totalChars.toLocaleString() })}</p>
        )}
        {status.state === 'ready' && status.cacheWriteFailed && (
          <p className="ner-long-note" role="note">{t('NerToggle.cache_write_failed')}</p>
        )}
        {enabled && longDocument && (
          <p className="ner-long-note" role="note">
            {t('NerToggle.large_document_ai_detection_runs_on_every')}</p>
        )}
        <div className="ner-model-actions">
          {enabled && (
            <button type="button" className="ner-rescan-button" onClick={() => onToggle(false)}>
              {t('NerToggle.turn_off')}</button>
          )}
          <button type="button" className="ner-rescan-button ner-delete-button" onClick={onDeleteModel}>
            {t('NerToggle.delete_model')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ner-toggle">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {' '}{t('NerToggle.smart_name_company_detection_local_ai_model')}</label>
      {text && <span className={status.state === 'error' ? 'ner-status ner-status-error' : 'ner-status'}>{text}</span>}
    </div>
  );
};
