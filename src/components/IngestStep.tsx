import { useEffect, useRef, useState } from 'react';
import { supportedExtensions, type ParsedDocument } from '../core/parsers';
import type { DocumentFormat, ExtractionCoverage } from '../core/types';
import type { AppMode } from '../lib/session';
import { PastePanel } from './PastePanel';

interface IngestStepProps {
  rawMarkdown: string;
  warnings: string[];
  onChange: (markdown: string) => void;
  /** A paste that replaces the whole document: the previous one is discarded. */
  onNewDocument: (markdown: string) => void;
  onCreateRule: (selectedText: string) => void;
  onFileImport: (markdown: string, format: DocumentFormat, fileName: string, warnings: string[], coverage?: ExtractionCoverage) => void;
  parseFile: (name: string, bytes: ArrayBuffer) => Promise<ParsedDocument>;
  onBeginImport: () => number;
  onCancelImport: () => void;
  onImportError: () => void;
  isImportCurrent: (id: number) => boolean;
  /** S2: the remembered mode gets the primary button. */
  defaultMode: AppMode;
  onRun: (mode: AppMode) => void;
}

export const IngestStep = ({
  rawMarkdown,
  warnings,
  onChange,
  onNewDocument,
  onCreateRule,
  onFileImport,
  onBeginImport,
  parseFile,
  isImportCurrent,
  onCancelImport,
  onImportError,
  defaultMode,
  onRun,
}: IngestStepProps) => {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const handleFile = async (file: File) => {
    setError(null);
    const request = onBeginImport(); setParsing(true);
    try {
      if (file.size > 20_000_000) throw new Error('File exceeds the 20 MB import limit.');
      const bytes = await file.arrayBuffer();
      const parsed = await parseFile(file.name, bytes);
      if (!alive.current || !isImportCurrent(request)) return;
      setParsing(false);
      onFileImport(parsed.markdown, parsed.format, file.name, parsed.coverage?.warnings ?? parsed.warnings ?? [], parsed.coverage);
    } catch (e) {
      if (!alive.current || !isImportCurrent(request)) return;
      setParsing(false); onImportError();
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <div className="ingest-step">
      <PastePanel rawMarkdown={rawMarkdown} onChange={onChange} onNewDocument={onNewDocument} onCreateRule={onCreateRule} />

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
        {parsing && <button type="button" onClick={() => { onCancelImport(); setParsing(false); setError('Import cancelled.'); }}>Cancel import</button>}
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

      <div className="mode-choice" role="group" aria-label="How to anonymize">
        {!rawMarkdown && <span className="empty-hint">Paste or drop a document first</span>}
        {(['standard', 'advanced'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={mode === defaultMode ? 'step-footer-next' : 'step-footer-back'}
            disabled={!rawMarkdown}
            onClick={() => onRun(mode)}
          >
            {mode === 'standard' ? 'Quick — anonymize now' : 'Detailed — review each item'}
          </button>
        ))}
      </div>
    </div>
  );
};
