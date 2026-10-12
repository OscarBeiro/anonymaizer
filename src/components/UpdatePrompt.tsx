import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateAvailable } from '../lib/swUpdate';

// P21b: shown when a new release has installed and is waiting.
export function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  useEffect(() => onUpdateAvailable(setAvailable), []);
  if (!available) return null;
  return (
    <div className="update-prompt" role="status">
      <span>{t('UpdatePrompt.new_version_available')}</span>
      <button type="button" onClick={applyUpdate}>
        {t('UpdatePrompt.reload')}</button>
      <button type="button" className="update-prompt-dismiss" aria-label={t('UpdatePrompt.dismiss')} onClick={() => setAvailable(false)}>
        ×
      </button>
    </div>
  );
}
