import { useState } from 'react';
import { buildExport, type ExportSide, type TextExportKind } from '../core/export/textExport';
import type { MappingSession } from '../core/types';
import { downloadFile } from '../lib/download';

interface SaveAsControlProps {
  text: string;
  session: MappingSession;
  side: ExportSide;
}

const KINDS: { id: TextExportKind; label: string }[] = [
  { id: 'txt', label: 'Plain text (.txt)' },
  { id: 'md', label: 'Markdown (.md)' },
  { id: 'html', label: 'Web page (.html)' },
];

export const SaveAsControl = ({ text, session, side }: SaveAsControlProps) => {
  const [kind, setKind] = useState<TextExportKind>('txt');

  const save = () => {
    // The sanitized HTML keeps the on-screen placeholder highlighting.
    const file = buildExport(kind, text, session, side, { highlight: side === 'sanitized' });
    downloadFile(file.fileName, file.content, file.mimeType);
  };

  return (
    <div className="save-as">
      <select aria-label="Export format" value={kind} onChange={(e) => setKind(e.target.value as TextExportKind)}>
        {KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <button type="button" className="copy-button" disabled={!text} onClick={save}>
        Save as…
      </button>
    </div>
  );
};
