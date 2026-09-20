import type { NerStatus } from '../lib/nerClient';

interface NerToggleProps {
  enabled: boolean;
  status: NerStatus;
  onToggle: (enabled: boolean) => void;
}

const statusText = (status: NerStatus): string | null => {
  switch (status.state) {
    case 'loading':
      return status.detail ? `Downloading model, once only… (${status.detail})` : 'Downloading model (~104MB, once only)…';
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
 * "on" indicator plus a way to turn it back off. Re-scanning is automatic
 * from here (App.tsx re-runs NER on every edit once ready), so there is no
 * manual "Re-scan" button to show.
 */
export const NerToggle = ({ enabled, status, onToggle }: NerToggleProps) => {
  const loading = status.state === 'loading';
  const text = statusText(status);

  if (enabled && status.state === 'ready') {
    return (
      <div className="ner-toggle ner-toggle-active">
        <span className="ner-status-ready">🔒 Local AI detection on — model runs fully in your browser, nothing is uploaded</span>
        <button type="button" className="ner-rescan-button" onClick={() => onToggle(false)}>
          Turn off
        </button>
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
