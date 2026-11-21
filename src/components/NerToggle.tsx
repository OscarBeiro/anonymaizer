import { t } from '../i18n';
import { getNerModel, modelTotalBytes, OFFERED_NER_MODEL_IDS } from '../core/nerModels';
import { formatMegabytes } from '../lib/formatBytes';
import type { NerStatus } from '../lib/nerClient';

interface NerToggleProps {
  enabled: boolean;
  /** L3: the document is large enough that NER will be slow. */
  longDocument?: boolean;
  status: NerStatus;
  /** The user's chosen model; changing it never starts a download. */
  modelId: string;
  /** This origin may download the model after an explicit opt-in. */
  downloadAllowed: boolean;
  /** Every file of the chosen model is already on this device. */
  provisioned: boolean;
  /** Result of the last model-package import, already worded. */
  importMessage?: string;
  onModelChange: (id: string) => void;
  onToggle: (enabled: boolean) => void;
  onRetry: () => void;
  onImportPackage: (files: File[]) => void;
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
 * The local-AI control. While off it shows the models on offer, each with its
 * complete download size and the languages we have actually measured; nothing
 * is fetched until the user ticks the box, and only on a hosted origin. A copy
 * that never connects asks for a model package instead.
 *
 * Once on, it shows which model finished the document and whether it covered
 * all of it. "Turn off" keeps the model on the device for an instant re-enable;
 * "Delete" frees it — the two must never be conflated.
 */
export const NerToggle = ({
  enabled, longDocument, status, modelId, downloadAllowed, provisioned, importMessage,
  onModelChange, onToggle, onRetry, onImportPackage, onDeleteModel,
}: NerToggleProps) => {
  const loading = status.state === 'loading' || status.state === 'scanning';
  const text = statusText(status);
  const spec = getNerModel(modelId) ?? getNerModel('bert-base-ner')!;
  const size = formatMegabytes(modelTotalBytes(spec));

  if (enabled) {
    return (
      <div className="ner-toggle ner-toggle-active">
        <span className="ner-status-ready">{t('NerToggle.local_ai_detection_on_model_runs_fully')}</span>
        {text && <span className={status.state === 'error' ? 'ner-status ner-status-error' : 'ner-status'}>{text}</span>}
        {status.state === 'error' && (
          <button type="button" className="ner-rescan-button" onClick={onRetry}>{t('NerToggle.retry')}</button>
        )}
        {status.state === 'ready' && status.coverage?.complete && (
          <span className="ner-status">{t('NerToggle.model_completed', { p0: spec.name, p1: status.coverage.totalChars.toLocaleString() })}</span>
        )}
        {status.state === 'ready' && status.coverage && !status.coverage.complete && (
          <p className="ner-long-note" role="alert">
            {t('NerToggle.coverage_incomplete', { p0: status.coverage.coveredChars.toLocaleString(), p1: status.coverage.totalChars.toLocaleString() })}</p>
        )}
        {status.state === 'ready' && status.cacheWriteFailed && (
          <p className="ner-long-note" role="note">
            {status.cacheWriteFailed === 'quota' ? t('NerToggle.cache_quota_exceeded') : t('NerToggle.cache_write_failed')}</p>
        )}
        {longDocument && (
          <p className="ner-long-note" role="note">
            {t('NerToggle.large_document_ai_detection_runs_on_every')}</p>
        )}
        <div className="ner-model-actions">
          <button type="button" className="ner-rescan-button" onClick={() => onToggle(false)}>
            {loading ? t('NerToggle.cancel') : t('NerToggle.turn_off')}</button>
          <button type="button" className="ner-rescan-button ner-delete-button" onClick={onDeleteModel}>
            {t('NerToggle.delete_model')}</button>
        </div>
      </div>
    );
  }

  const canEnable = downloadAllowed || provisioned;
  return (
    <div className="ner-toggle ner-toggle-setup">
      <fieldset className="ner-model-choice">
        <legend>{t('NerToggle.model')}</legend>
        {OFFERED_NER_MODEL_IDS.map((id) => {
          const model = getNerModel(id)!;
          const tested = model.languages.tested.length ? model.languages.tested.join(', ').toUpperCase() : '—';
          return (
            <label key={id} className="ner-model-option">
              <input type="radio" name="ner-model" checked={id === modelId} onChange={() => onModelChange(id)} />
              {' '}<strong>{model.name}</strong>{' — '}
              {t('NerToggle.model_details', { p0: formatMegabytes(modelTotalBytes(model)), p1: tested })}
              {model.status === 'experimental' && <> {t('NerToggle.model_experimental')}</>}
            </label>
          );
        })}
      </fieldset>
      {canEnable ? (
        <label>
          <input type="checkbox" checked={enabled} disabled={loading} onChange={(e) => onToggle(e.target.checked)} />
          {' '}{provisioned
            ? t('NerToggle.use_model_on_device', { p0: spec.name })
            : t('NerToggle.download_model_opt_in', { p0: spec.name, p1: size })}
        </label>
      ) : (
        <div className="ner-offline-import">
          <p className="ner-status">{t('NerToggle.offline_copy_needs_package', { p0: spec.name, p1: size })}</p>
          <input type="file" multiple aria-label={t('NerToggle.import_model_files')}
            onChange={(e) => { onImportPackage([...(e.target.files ?? [])]); e.target.value = ''; }} />
        </div>
      )}
      {importMessage && <p className="ner-long-note" role="status">{importMessage}</p>}
      {text && <span className={status.state === 'error' ? 'ner-status ner-status-error' : 'ner-status'}>{text}</span>}
      {status.state === 'error' && (
        <button type="button" className="ner-rescan-button" onClick={onRetry}>{t('NerToggle.retry')}</button>
      )}
      {provisioned && (
        <button type="button" className="ner-rescan-button ner-delete-button" onClick={onDeleteModel}>
          {t('NerToggle.delete_model')}</button>
      )}
    </div>
  );
};
