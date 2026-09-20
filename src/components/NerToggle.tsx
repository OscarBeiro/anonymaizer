import type { NerStatus } from '../lib/nerClient';

interface NerToggleProps {
  enabled: boolean;
  status: NerStatus;
  canRescan: boolean;
  onToggle: (enabled: boolean) => void;
  onRescan: () => void;
}

const statusText = (status: NerStatus): string | null => {
  switch (status.state) {
    case 'loading':
      return status.detail ? `Loading model… (${status.detail})` : 'Loading model (~104MB, first time only)…';
    case 'error':
      return `NER failed: ${status.message}`;
    case 'ready':
      return 'Model ready.';
    default:
      return null;
  }
};

/**
 * P7d opt-in control. The checkbox itself is disabled mid-download so the
 * ~104MB fetch can't be triggered twice, and everything else in the app
 * keeps working on the M1/P7a-c heuristics regardless of opt-in state — NER
 * is additive, never blocking.
 */
export const NerToggle = ({ enabled, status, canRescan, onToggle, onRescan }: NerToggleProps) => {
  const loading = status.state === 'loading';
  const text = statusText(status);

  return (
    <div className="ner-toggle">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {' '}Smart name/company detection (AI model, ~104MB one-time download, opt-in)
      </label>
      {text && <span className={status.state === 'error' ? 'ner-status ner-status-error' : 'ner-status'}>{text}</span>}
      {enabled && (
        <button type="button" className="ner-rescan-button" disabled={!canRescan || loading} onClick={onRescan}>
          Re-scan with model
        </button>
      )}
    </div>
  );
};
