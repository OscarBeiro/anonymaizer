import type { NerStatus } from '../lib/nerClient';

interface NerToggleProps {
  enabled: boolean;
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
      return status.detail ? `Loading model… (${status.detail})` : 'Loading model…';
    case 'error':
      return `NER failed: ${status.message}`;
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
export const NerToggle = ({ enabled, status, onToggle, onDeleteModel }: NerToggleProps) => {
  const loading = status.state === 'loading';
  const text = statusText(status);
  const modelDownloaded = status.state === 'ready';

  if (modelDownloaded) {
    return (
      <div className="ner-toggle ner-toggle-active">
        {enabled ? (
          <span className="ner-status-ready">🔒 Local AI detection on — model runs fully in your browser, nothing is uploaded</span>
        ) : (
          <label>
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
            {' '}Local AI detection (model already downloaded — re-enabling is instant)
          </label>
        )}
        <div className="ner-model-actions">
          {enabled && (
            <button type="button" className="ner-rescan-button" onClick={() => onToggle(false)}>
              Turn off
            </button>
          )}
          <button type="button" className="ner-rescan-button ner-delete-button" onClick={onDeleteModel}>
            Delete model
          </button>
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
        {' '}Smart name/company detection (local AI model, ~104MB one-time download, opt-in — runs entirely in
        your browser, nothing is ever sent anywhere)
      </label>
      {text && <span className={status.state === 'error' ? 'ner-status ner-status-error' : 'ner-status'}>{text}</span>}
    </div>
  );
};
