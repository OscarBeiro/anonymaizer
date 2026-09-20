import { useRef, useState } from 'react';
import { convertHtmlToMarkdown } from '../lib/htmlToMarkdown';

interface PastePanelProps {
  rawMarkdown: string;
  onChange: (markdown: string) => void;
  onCreateRule: (selectedText: string) => void;
}

export const PastePanel = ({ rawMarkdown, onChange, onCreateRule }: PastePanelProps) => {
  const [selection, setSelection] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      onChange(convertHtmlToMarkdown(html));
      return;
    }
    // Plain text: let the browser's default paste behavior run, then read
    // the resulting value on the next tick.
    requestAnimationFrame(() => {
      if (textareaRef.current) onChange(textareaRef.current.value);
    });
  };

  const handleSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(el.value.slice(el.selectionStart, el.selectionEnd));
  };

  return (
    <section className="panel">
      <h2>1. Paste text</h2>
      <textarea
        ref={textareaRef}
        className="panel-textarea"
        placeholder="Paste plain text or rich HTML here…"
        value={rawMarkdown}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onSelect={handleSelect}
        onBlur={() => setSelection('')}
      />
      {selection.trim().length > 0 && (
        <button
          type="button"
          className="create-rule-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onCreateRule(selection)}
        >
          + Create dictionary rule from "{selection.length > 30 ? `${selection.slice(0, 30)}…` : selection}"
        </button>
      )}
    </section>
  );
};
