import { useRef, useState } from 'react';
import { parseDocument, supportedExtensions } from '../core/parsers';
import type { DocumentFormat } from '../core/types';
import { PastePanel } from './PastePanel';

interface IngestStepProps {
  rawMarkdown: string;
  warnings: string[];
  onChange: (markdown: string) => void;
  onCreateRule: (selectedText: string) => void;
  onFileImport: (markdown: string, format: DocumentFormat, fileName: string, warnings: string[]) => void;
}

export const IngestStep = ({ rawMarkdown, warnings, onChange, onCreateRule, onFileImport }: IngestStepProps) => {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const parsed = await parseDocument(file.name, bytes);
      onFileImport(parsed.markdown, parsed.format, file.name, parsed.warnings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <div className="ingest-step">
      <PastePanel rawMarkdown={rawMarkdown} onChange={onChange} onCreateRule={onCreateRule} />

      <div
        className={dragOver ? 'drop-zone drop-zone-active' : 'drop-zone'}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <p>Drop a file here, or</p>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Choose file
        </button>
        <p className="drop-zone-hint">Supported: {supportedExtensions().join(', ')}</p>
        {error && <p className="form-error">{error}</p>}
        {warnings.length > 0 && (
          <div className="import-warnings" role="status">
            <p className="import-warnings-title">Imported with warnings</p>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedExtensions()
            .map((ext) => `.${ext}`)
            .join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
