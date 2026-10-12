import { t } from '../i18n';
import { useState } from 'react';
import { buildExport, type ExportSide, type TextExportKind } from '../core/export/textExport';
import { buildXlsxExport, canExportXlsx } from '../core/export/xlsxExport';
import type { MappingSession } from '../core/types';
import { downloadFile } from '../lib/download';
import { zipXlsxParts } from '../lib/xlsxZip';

interface SaveAsControlProps {
  text: string;
  session: MappingSession;
  side: ExportSide;
}

type ExportKind = TextExportKind | 'xlsx';

const KINDS: () => { id: ExportKind; label: string }[] = () => ([
  { id: 'txt', label: t('SaveAsControl.plain_text_txt') },
  { id: 'md', label: t('SaveAsControl.markdown_md') },
  { id: 'html', label: t('SaveAsControl.web_page_html') },
  { id: 'xlsx', label: t('SaveAsControl.spreadsheet_xlsx') },
]);

export const SaveAsControl = ({ text, session, side }: SaveAsControlProps) => {
  // .xlsx only for tabular sources (csv/xlsx); a prose document has no sheet shape.
  const kinds = KINDS().filter((k) => k.id !== 'xlsx' || canExportXlsx(session));
  const [kind, setKind] = useState<ExportKind>('txt');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      if (kind === 'xlsx') {
        const file = buildXlsxExport(text, session, side);
        downloadFile(file.fileName, await zipXlsxParts(file.parts), file.mimeType);
      } else {
        // The sanitized HTML keeps the on-screen placeholder highlighting.
        const file = buildExport(kind, text, session, side, { highlight: side === 'sanitized' });
        downloadFile(file.fileName, file.content, file.mimeType);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('SaveAsControl.export_failed'));
    }
  };

  return (
    <div className="save-as">
      <select aria-label={t('SaveAsControl.export_format')} value={kind} onChange={(e) => setKind(e.target.value as ExportKind)}>
        {kinds.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <button type="button" className="copy-button" disabled={!text} onClick={() => void save()}>
        {t('SaveAsControl.save_as')}</button>
      {error && <span className="save-as-error">{error}</span>}
    </div>
  );
};
