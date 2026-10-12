import { useEffect, useRef } from 'react';
import { useOutput } from './OutputContext';
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
  structuredMarkdown?: string;
}

type ExportKind = TextExportKind | 'xlsx';

const KINDS: { id: ExportKind; label: string }[] = [
  { id: 'txt', label: 'Plain text (.txt)' },
  { id: 'md', label: 'Markdown (.md)' },
  { id: 'html', label: 'Web page (.html)' },
  { id: 'xlsx', label: 'Spreadsheet (.xlsx)' },
];

export const SaveAsControl = ({ text, session, side, structuredMarkdown }: SaveAsControlProps) => {
  // .xlsx only for tabular sources (csv/xlsx); a prose document has no sheet shape.
  const output = useOutput();
  const currentText = useRef(text);
  useEffect(() => { currentText.current = text; }, [text]);
  const kinds = KINDS.filter((k) => k.id !== 'xlsx' || canExportXlsx(session));
  const [kind, setKind] = useState<ExportKind>('txt');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      const artifact = side === 'sanitized' ? output.prepare(text, kind === 'xlsx' ? 'md' : kind) : null;
      if (kind === 'xlsx') {
        const file = buildXlsxExport(text, session, side);
        const bytes = await zipXlsxParts(file.parts);
        artifact?.assertCurrent();
        if (currentText.current !== text) throw new Error('Output changed during export. Prepare again.');
        if (bytes.byteLength > 8_000_000) throw new Error('Export exceeds the size limit.');
        downloadFile(file.fileName, bytes, file.mimeType);
      } else {
        // The sanitized HTML keeps the on-screen placeholder highlighting.
        const file = artifact?.file ?? buildExport(kind, kind === 'txt' ? text : structuredMarkdown ?? text, session, side);
        artifact?.assertCurrent();
        downloadFile(file.fileName, file.content, file.mimeType);
      }
      if (artifact) output.delivered(artifact.exportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  return (
    <div className="save-as">
      <select aria-label="Export format" value={kind} onChange={(e) => setKind(e.target.value as ExportKind)}>
        {kinds.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <button type="button" className="copy-button" disabled={!text} onClick={() => void save()}>
        Save as…
      </button>
      {error && <span className="save-as-error" role="alert">{error}</span>}
    </div>
  );
};
